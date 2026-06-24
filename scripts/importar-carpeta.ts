// Importador GENÉRICO: toma una carpeta donde cada SUBCARPETA es un modelo descargado (de Cults3d,
// Printables, un pack, etc.) con imágenes + malla (STL/3MF sueltos o en un zip anidado STL.zip/3MF.zip),
// y lo mete a la fábrica: copia imágenes → public/pack/<slug>/, extrae la malla → pack-mallas/<slug>/,
// LEE LA LICENCIA REAL del 3MF y la normaliza (el gate esAptoVenta bloquea lo no-vendible), y crea el
// Modelo en estado Pendiente. Idempotente por nombre.
//
// Uso: npx tsx scripts/importar-carpeta.ts --dir "ruta/a/carpeta" [--categoria Decoracion] [--fuente Printables]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const PUBLIC = path.join(process.cwd(), "public", "pack");
const STAGE = path.join(process.cwd(), "..", "pack-mallas");
const TEMP = path.join(STAGE, "_temp");
const MANIFEST = path.join(STAGE, "_mallas.json");
const IMG = /\.(jpg|jpeg|png|webp)$/i;

function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
function slugify(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "modelo";
}
/** Licencia real (string) → vocabulario del sistema (esAptoVenta whitelist). */
function normalizarLic(raw: string): string {
  const l = (raw || "").toLowerCase().trim();
  if (!l || l === "?") return "Revisar";
  if (/\bnc\b|non.?commercial|no.?comercial/.test(l)) return "CC-BY-NC";
  if (/standard digital file/.test(l)) return "Personal";
  if (/exclusive/.test(l)) return "Revisar-Exclusive";
  if (/cc0|public domain|dominio p/.test(l)) return "Dominio publico";
  if (/commercial|comercial/.test(l)) return "Comercial";
  if (/by-nd|by-sa|attribution|^by\b|^cc-by\b/.test(l)) return "CC-BY";
  return "Revisar";
}
function buscar(dir: string, re: RegExp): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...buscar(f, re));
    else if (re.test(e.name)) out.push(f);
  }
  return out;
}

async function main() {
  const dir = arg("dir");
  if (!dir || !fs.existsSync(dir)) throw new Error("Pasa --dir <carpeta existente>");
  const categoria = arg("categoria", "Decoracion")!;
  const fuente = arg("fuente", "Importado")!;
  fs.mkdirSync(TEMP, { recursive: true });
  const manifest: Record<string, { path: string; tipo: string }> = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};

  const subdirs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  let creados = 0, actualizados = 0, sinMalla = 0;
  for (const nombre of subdirs) {
    const src = path.join(dir, nombre);
    const slug = slugify(nombre);

    // 1) imágenes → public/pack/<slug>/
    const imgs = fs.readdirSync(src).filter((f) => IMG.test(f)).sort();
    const destImg = path.join(PUBLIC, slug);
    fs.mkdirSync(destImg, { recursive: true });
    const imagenes = imgs.map((f, i) => { const ext = path.extname(f).toLowerCase(); fs.copyFileSync(path.join(src, f), path.join(destImg, `${i + 1}${ext}`)); return `/pack/${slug}/${i + 1}${ext}`; });

    // 2) malla: zip anidado (STL-3MF/3MF/STL.zip) o sueltos
    let tipo = "", licReal = "?";
    const destMesh = path.join(STAGE, slug);
    fs.mkdirSync(destMesh, { recursive: true });
    try {
      const zips = fs.readdirSync(src).filter((f) => /\.(zip)$/i.test(f) && /stl|3mf/i.test(f));
      if (zips.length) {
        const rank = (z: string) => (/3mf/i.test(z) ? 2 : 1);
        const z = zips.sort((a, b) => rank(b) - rank(a))[0];
        execSync(`unzip -o -q "${path.join(src, z)}" -d "${destMesh}"`, { stdio: "ignore" });
      } else {
        for (const m of buscar(src, /\.(stl|3mf)$/i)) fs.copyFileSync(m, path.join(destMesh, path.basename(m)));
      }
      const mallas = buscar(destMesh, /\.(stl|3mf)$/i);
      const m3 = mallas.filter((f) => /\.3mf$/i.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      const ms = mallas.filter((f) => /\.stl$/i.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      const elegido = m3[0] ?? ms[0];
      if (elegido) {
        tipo = /\.3mf$/i.test(elegido) ? "3mf" : "stl";
        manifest[slug] = { path: path.relative(process.cwd(), elegido).replace(/\\/g, "/"), tipo };
        if (tipo === "3mf") {
          try { const xml = execSync(`unzip -p "${elegido}" "3D/3dmodel.model"`, { encoding: "utf8", maxBuffer: 1 << 26 }); licReal = (/name="License">([^<]*)/.exec(xml)?.[1] || "?").trim(); } catch { /* */ }
        }
      } else sinMalla++;
    } catch { sinMalla++; }

    const licencia = normalizarLic(licReal);
    const data = {
      nombre, fuente, licencia, categoria, nicho: "importado",
      tiempoImpresionMin: 240, gramosFilamento: 60, tipoFilamento: "PLA",
      multicolorAms: false, requiereSoportes: false, dificultad: "Media",
      estadoValidacion: "Pendiente", archivoTipo: tipo || "otro",
      notas: `Importado de ${fuente}. [Licencia real: ${licReal} → ${licencia}]`,
      imagenes,
    };
    const ex = await prisma.modelo.findFirst({ where: { nombre } });
    if (ex) { await prisma.modelo.update({ where: { id: ex.id }, data }); actualizados++; }
    else { await prisma.modelo.create({ data }); creados++; }
    console.log(`  ${tipo ? "✅" : "⚠️"} ${nombre.slice(0, 30).padEnd(30)} ${imagenes.length} img · malla:${tipo || "NO"} · lic:${licencia}`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
  console.log(`\n>>> ${creados} creados, ${actualizados} actualizados, ${sinMalla} sin malla. Luego: fondos:blancos + render-todos + publicar.`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e.message); process.exit(1); });

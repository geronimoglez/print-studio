// Extrae las MALLAS (STL/3MF) de los modelos del pack. Las mallas vienen en ZIPs ANIDADOS
// dentro de cada carpeta: <CAT>/<Modelo>/{STL.zip|STL-3MF.zip|3MF.zip}. Doble-extracción:
//   zip part (Downloads) → zip anidado → archivos .stl/.3mf.
// Prefiere 3MF (lleva color → mejor render). Stagea en pack-mallas/<slug>/ + escribe manifiesto
// pack-mallas/_mallas.json (slug → {path, tipo}). Setea Modelo.archivoTipo.
//
// Uso:
//   npx tsx scripts/extraer-mallas.ts --solo "Soporte de Vino - Dragon,Alcancia Pulpo"   (sample)
//   npx tsx scripts/extraer-mallas.ts --all                                               (los 52)
//   (--reindex para reconstruir el índice de zips)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DOWNLOADS = "C:/Users/gglez/Downloads";
const STAGE = path.join(process.cwd(), "..", "pack-mallas");
const TEMP = path.join(STAGE, "_temp");
const INDEX = path.join(STAGE, "_index.json");
const MANIFEST = path.join(STAGE, "_mallas.json");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? "" : undefined;
}
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

type Entrada = { part: string; entry: string; tipo: "stl-3mf" | "3mf" | "stl" };
// índice: clave normalizada "<cat>/<folder>" → mejor zip anidado de malla
function construirIndice(): Record<string, Entrada> {
  if (!arg("reindex") && fs.existsSync(INDEX)) return JSON.parse(fs.readFileSync(INDEX, "utf8"));
  const parts = fs.readdirSync(DOWNLOADS).filter((f) => /^(ARTICULADO|FUNCIONALES|URBAN)-.*\.zip$/i.test(f));
  console.log(`Indexando ${parts.length} zips del pack…`);
  const rank: Record<Entrada["tipo"], number> = { "stl-3mf": 3, "3mf": 2, stl: 1 };
  const idx: Record<string, Entrada> = {};
  const reLine = /^\s*\d+\s+\d{4}-\d\d-\d\d\s+\d\d:\d\d\s+(.+?)\s*$/;
  for (const part of parts) {
    const out = execSync(`unzip -l "${path.join(DOWNLOADS, part)}"`, { encoding: "utf8", maxBuffer: 1 << 28 });
    for (const ln of out.split("\n")) {
      const m = reLine.exec(ln);
      if (!m) continue;
      const p = m[1].replace(/\\/g, "/");
      const mz = /^([^/]+)\/(.+)\/(STL-3MF|3MF|STL)\.zip$/i.exec(p);
      if (!mz) continue;
      const cat = mz[1], folder = mz[2];
      const tipo = mz[3].toLowerCase() === "stl-3mf" ? "stl-3mf" : (mz[3].toLowerCase() as "3mf" | "stl");
      const key = `${norm(cat)}/${norm(folder)}`;
      if (!idx[key] || rank[tipo] > rank[idx[key].tipo]) idx[key] = { part, entry: p, tipo };
    }
  }
  fs.mkdirSync(STAGE, { recursive: true });
  fs.writeFileSync(INDEX, JSON.stringify(idx, null, 0));
  console.log(`Índice: ${Object.keys(idx).length} carpetas con malla.`);
  return idx;
}

function buscarMallas(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...buscarMallas(full));
    else if (/\.(stl|3mf)$/i.test(e.name)) out.push(full);
  }
  return out;
}

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  const idx = construirIndice();
  const solo = arg("solo");
  const filtro = solo ? solo.split(",").map((s) => norm(s)) : null;

  const modelos = (await prisma.modelo.findMany({ where: { notas: { startsWith: "Pack " } } })).filter(
    (m) => !filtro || filtro.includes(norm(m.nombre)),
  );
  fs.mkdirSync(TEMP, { recursive: true });
  const manifest: Record<string, { path: string; tipo: string }> = fs.existsSync(MANIFEST)
    ? JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
    : {};

  let ok = 0, sin = 0;
  for (const m of modelos) {
    const cat = /Pack (\w+)/.exec(m.notas ?? "")?.[1] ?? "";
    const slug = (m.imagenes ?? []).find((u) => u.startsWith("/pack/"))?.split("/")[2] ?? norm(m.nombre).replace(/[^a-z0-9]+/g, "-");
    const key = `${norm(cat)}/${norm(m.nombre)}`;
    const ent = idx[key];
    if (!ent) { console.log(`  ⚠️  sin malla en índice: ${m.nombre} (${key})`); sin++; continue; }
    const destDir = path.join(STAGE, slug);
    fs.mkdirSync(destDir, { recursive: true });
    try {
      // 1) extraer el zip anidado del part a TEMP
      const tmpZip = path.join(TEMP, `${slug}.zip`);
      if (fs.existsSync(tmpZip)) fs.rmSync(tmpZip);
      execSync(`unzip -o -j "${path.join(DOWNLOADS, ent.part)}" "${ent.entry}" -d "${TEMP}"`, { stdio: "ignore" });
      const extraido = path.join(TEMP, path.basename(ent.entry));
      fs.renameSync(extraido, tmpZip);
      // 2) extraer las mallas del zip anidado a destDir
      execSync(`unzip -o "${tmpZip}" -d "${destDir}"`, { stdio: "ignore" });
      fs.rmSync(tmpZip);
      // 3) elegir mejor malla: 3mf preferido, si no el .stl más grande
      const mallas = buscarMallas(destDir);
      const m3 = mallas.filter((f) => /\.3mf$/i.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      const ms = mallas.filter((f) => /\.stl$/i.test(f)).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size);
      const elegido = m3[0] ?? ms[0];
      if (!elegido) { console.log(`  ⚠️  zip sin .stl/.3mf: ${m.nombre}`); sin++; continue; }
      const tipo = /\.3mf$/i.test(elegido) ? "3mf" : "stl";
      manifest[slug] = { path: path.relative(process.cwd(), elegido).replace(/\\/g, "/"), tipo };
      await prisma.modelo.update({ where: { id: m.id }, data: { archivoTipo: tipo } });
      ok++;
      console.log(`  ✅ ${m.nombre.padEnd(28)} → ${tipo.toUpperCase()} (${mallas.length} mallas) ${path.basename(elegido)}`);
    } catch (e) {
      console.log(`  ❌ ${m.nombre}: ${e instanceof Error ? e.message.slice(0, 60) : "error"}`);
      sin++;
    }
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 0));
  console.log(`\n>>> mallas: ${ok} ok, ${sin} sin malla. Manifiesto: ${MANIFEST}`);
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

// Mide el tamaño real de cada pieza leyendo el bounding box de su malla (STL/3MF) y lo ESCALA al tamaño
// base (~12 cm de dimensión máxima — Blas escala sus impresiones a eso). Guarda alto/ancho/largo (cm) en
// el Modelo, que luego van en la descripción y en el empaque (SELLER_PACKAGE_*) para el costo de envío.
//
// Uso: npx tsx scripts/medir-mallas.ts [--max 12] [--solo slug1,slug2] [--dry]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { unzipSync } from "fflate";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { DIM_BASE_CM } from "../src/lib/publicacion";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const MANIFEST = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");
function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const MAX_CM = parseFloat(arg("max", String(Math.max(DIM_BASE_CM.alto, DIM_BASE_CM.ancho, DIM_BASE_CM.largo)))!);
const SOLO = arg("solo")?.split(",").map((s) => s.trim());
const DRY = process.argv.includes("--dry");

type Box = { x: number; y: number; z: number };

function bboxSTL(buf: Buffer): Box {
  // ¿binario? tamaño = 84 + nTri*50
  const nTri = buf.length >= 84 ? buf.readUInt32LE(80) : 0;
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  const upd = (x: number, y: number, z: number) => { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z; };
  if (buf.length === 84 + nTri * 50) {
    let off = 84;
    for (let i = 0; i < nTri; i++) {
      for (let v = 0; v < 3; v++) { const p = off + 12 + v * 12; upd(buf.readFloatLE(p), buf.readFloatLE(p + 4), buf.readFloatLE(p + 8)); }
      off += 50;
    }
  } else {
    // ASCII
    const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
    const txt = buf.toString("utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(txt))) upd(+m[1], +m[2], +m[3]);
  }
  return { x: mxx - mnx, y: mxy - mny, z: mxz - mnz };
}

function bbox3MF(buf: Buffer): Box {
  const files = unzipSync(new Uint8Array(buf));
  // La geometría (vertices) puede estar en 3D/3dmodel.model y/o en 3D/Objects/object_*.model (Bambu).
  // Acumulamos el bbox de TODOS los .model.
  const modelos = Object.keys(files).filter((k) => /\.model$/i.test(k));
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  const re = /<vertex\b([^>]*?)\/?>/g;
  const num = (s: string, a: string) => { const r = new RegExp(`\\b${a}="([-\\d.eE+]+)"`).exec(s); return r ? +r[1] : NaN; };
  for (const k of modelos) {
    const xml = Buffer.from(files[k]).toString("utf8");
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml))) {
      const x = num(m[1], "x"), y = num(m[1], "y"), z = num(m[1], "z");
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) { if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z; }
    }
  }
  return { x: isFinite(mxx - mnx) ? mxx - mnx : 0, y: isFinite(mxy - mny) ? mxy - mny : 0, z: isFinite(mxz - mnz) ? mxz - mnz : 0 };
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, { path: string; tipo: "stl" | "3mf" }>;
  let slugs = Object.keys(manifest);
  if (SOLO) slugs = slugs.filter((s) => SOLO.includes(s));

  const dimsPorSlug: Record<string, { alto: number; ancho: number; largo: number }> = {};
  for (const slug of slugs) {
    const { path: rel, tipo } = manifest[slug];
    const file = fs.existsSync(rel) ? rel : path.join(process.cwd(), rel);
    if (!fs.existsSync(file)) { console.log(`  ⚠️ sin archivo: ${slug}`); continue; }
    try {
      const buf = fs.readFileSync(file);
      const b = tipo === "3mf" ? bbox3MF(buf) : bboxSTL(buf);
      const maxRaw = Math.max(b.x, b.y, b.z);
      if (!(maxRaw > 0)) { console.log(`  ⚠️ bbox vacío: ${slug}`); continue; }
      const k = MAX_CM / (maxRaw / 10); // raw está en mm → cm; escalar a MAX_CM la dimensión mayor
      const cm = (v: number) => Math.round((v / 10) * k * 10) / 10;
      // Slicer Z-up: alto = Z, ancho = X, largo = Y
      dimsPorSlug[slug] = { alto: cm(b.z), ancho: cm(b.x), largo: cm(b.y) };
    } catch (e) { console.log(`  ⚠️ ${slug}: ${(e as Error).message.slice(0, 50)}`); }
  }

  // Aplicar a los modelos por slug (sale de /pack/{slug}/...)
  const modelos = await prisma.modelo.findMany({ select: { id: true, nombre: true, imagenes: true } });
  let aplicados = 0;
  for (const m of modelos) {
    const slug = (m.imagenes ?? []).find((u) => u.startsWith("/pack/"))?.split("/")[2];
    const d = slug ? dimsPorSlug[slug] : undefined;
    if (!d) continue;
    aplicados++;
    if (aplicados <= 12) console.log(`  ${m.nombre.padEnd(28)} ${d.alto} x ${d.ancho} x ${d.largo} cm`);
    if (!DRY) await prisma.modelo.update({ where: { id: m.id }, data: { altoCm: d.alto, anchoCm: d.ancho, largoCm: d.largo } });
  }
  console.log(`\nMallas medidas: ${Object.keys(dimsPorSlug).length} · modelos actualizados: ${aplicados}${DRY ? " (DRY)" : ""} · máx ${MAX_CM} cm`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

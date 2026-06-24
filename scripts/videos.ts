// UN SOLO COMANDO para los videos 360° de Mercado Libre:  npm run videos
//
// Hace todo solo, sin decisiones manuales: por cada modelo PUBLICADO que aún no tiene video, genera el
// clip 360° (Vía A — render fiel de la pieza, GRATIS), y SOLO procede si está SEGURO de que es de una
// sola pieza (revisa varios ángulos: si en alguno se ve partido en piezas, lo descarta). Si YouTube está
// conectado (3 variables en .env), sube el clip a YouTube y lo pega al anuncio; los descartados se borran
// de Blob. Es idempotente: salta los que ya tienen video, así que puedes correrlo cuando quieras (o dejarlo
// programado) y solo procesa lo nuevo.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { del } from "@vercel/blob";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { analizarFrame } from "../src/lib/imagen";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const MANIFEST = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");
const CLIPDIR = path.join(process.cwd(), "_preview", "clip");
const BLOB_HOST = "https://itgirjfh1wrixlgb.public.blob.vercel-storage.com";
function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
const REGEN = process.argv.includes("--regenerar");
const HAS_YT = !!(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);

const frames = (slug: string) => {
  const dir = path.join(CLIPDIR, slug);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /^f_\d+\.png$/.test(f)).sort() : [];
};

/** ¿El clip es de UNA sola pieza? Revisa 8 ángulos: si en cualquiera se ve partido (≥2 objetos), no. */
async function esUnaPieza(slug: string): Promise<boolean> {
  const fr = frames(slug);
  if (!fr.length) return false;
  let maxBlobs = 0, maxArea = 0;
  for (const k of Array.from({ length: 8 }, (_, i) => Math.floor((i * fr.length) / 8))) {
    const a = await analizarFrame(path.join(CLIPDIR, slug, fr[k]));
    if (a.blobs > maxBlobs) maxBlobs = a.blobs;
    if (a.areaMax > maxArea) maxArea = a.areaMax;
  }
  return maxBlobs === 1 && maxArea >= 0.08;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, { path: string; tipo: string }>;
  const modelos = await prisma.modelo.findMany({
    where: { publicadoMl: true, mlItemId: { not: null }, videoYoutubeId: null },
    select: { id: true, nombre: true, imagenes: true },
  });
  let cand = modelos
    .map((m) => ({ ...m, slug: (m.imagenes ?? []).find((u) => u.startsWith("/pack/"))?.split("/")[2] ?? null }))
    .filter((m) => m.slug && manifest[m.slug!]);
  if (LIMIT) cand = cand.slice(0, LIMIT);

  console.log(`Modelos publicados con malla y sin video: ${cand.length} · YouTube: ${HAS_YT ? "conectado" : "SIN credenciales (los buenos quedan listos para subir)"}`);
  let listos = 0, descartados = 0, subidos = 0;
  for (const m of cand) {
    const slug = m.slug!;
    if (REGEN || !frames(slug).length) {
      try { execSync(`npx tsx scripts/clip-360.ts --slug ${slug} --frames 48`, { stdio: "ignore", timeout: 180000 }); }
      catch { console.log(`  ✗ ${m.nombre}: no se pudo generar el clip`); continue; }
    }
    if (!(await esUnaPieza(slug))) {
      descartados++;
      try { await del(`${BLOB_HOST}/clip/${slug}/360.mp4`, { token: process.env.BLOB_READ_WRITE_TOKEN }); } catch { /* ya no estaba */ }
      console.log(`  – ${m.nombre}: descartado (no es de 1 pieza segura)`);
      continue;
    }
    listos++;
    if (HAS_YT) {
      try { execSync(`npx tsx scripts/subir-video.ts --slug ${slug} --privacy unlisted`, { stdio: "ignore", timeout: 180000 }); subidos++; console.log(`  ✓ ${m.nombre}: video publicado en el anuncio`); }
      catch { console.log(`  ✗ ${m.nombre}: clip OK pero falló la subida a YouTube`); }
    } else {
      console.log(`  ✓ ${m.nombre}: clip de 1 pieza listo (falta conectar YouTube para publicarlo)`);
    }
  }
  console.log(`\nDe 1 pieza (con video): ${HAS_YT ? subidos : listos} · descartados multi-pieza: ${descartados}`);
  if (!HAS_YT) console.log(`Conecta YouTube (3 variables YOUTUBE_* en .env) y vuelve a correr "npm run videos": subirá los ${listos} videos a sus anuncios.`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

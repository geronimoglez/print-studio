// Quita de cada modelo los RENDERS "dispersos/chicos" — el objeto ocupa muy poco del cuadro (fill ratio
// bajo), típico de modelos multi-pieza/flexi cuyo 3MF es la placa de impresión con las partes separadas.
// Conserva SIEMPRE las fotos reales y los renders buenos. Tras actualizar la BD, re-sincroniza las fotos
// de los anuncios PUBLICADOS afectados a Mercado Libre (PUT /items/{id} {pictures}).
//
// Mide el fill ratio (fracción de píxeles no-blancos) de cada render bajándolo y analizándolo con sharp.
// Calibración (jun 2026): render bueno (calavera) ~0.22, disperso (ajolote) ~0.012. Umbral default 0.06.
//
// Uso: npx tsx scripts/limpiar-renders-dispersos.ts [--umbral 0.06] [--dry]
import "dotenv/config";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://lab3d.apps.minka.one").replace(/\/+$/, "");
function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const UMBRAL = parseFloat(arg("umbral", "0.06")!);
const DRY = process.argv.includes("--dry");
const esRender = (u: string) => u.includes("/render/");
const abs = (u: string) => (u.startsWith("http") ? u : `${APP_URL}${u.startsWith("/") ? "" : "/"}${u}`);

const cacheFill = new Map<string, number>();
async function fillRatio(url: string): Promise<number> {
  if (cacheFill.has(url)) return cacheFill.get(url)!;
  try {
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const { data } = await sharp(buf).greyscale().raw().toBuffer({ resolveWithObject: true });
    let obj = 0;
    for (const v of data) if (v < 248) obj++;
    const f = obj / data.length;
    cacheFill.set(url, f);
    return f;
  } catch {
    return 1; // si no se puede medir, conservar (no borrar a ciegas)
  }
}

async function main() {
  const modelos = await prisma.modelo.findMany({
    where: { imagenes: { isEmpty: false } },
    select: { id: true, nombre: true, imagenes: true, publicadoMl: true, mlItemId: true },
  });
  const conRender = modelos.filter((m) => (m.imagenes ?? []).some(esRender));
  console.log(`Modelos con render: ${conRender.length} · umbral ${UMBRAL}${DRY ? " · DRY" : ""}`);

  let cambiados = 0, removidos = 0;
  const aResync: typeof conRender = [];
  for (const m of conRender) {
    const imgs = m.imagenes ?? [];
    const reales = imgs.filter((u) => !esRender(u));
    const renders = imgs.filter(esRender);
    const buenos: string[] = [];
    for (const u of renders) if ((await fillRatio(abs(u))) >= UMBRAL) buenos.push(u);
    let nuevas = [...reales, ...buenos];
    if (nuevas.length === 0 && renders.length) {
      // nunca dejar sin imágenes: conservar el mejor render
      let mejor = renders[0], mf = -1;
      for (const u of renders) { const f = await fillRatio(abs(u)); if (f > mf) { mf = f; mejor = u; } }
      nuevas = [mejor];
    }
    const quita = imgs.length - nuevas.length;
    if (quita > 0) {
      cambiados++; removidos += quita;
      console.log(`  ${DRY ? "[dry] " : ""}${m.nombre}: -${quita} render(s) disperso(s) (quedan ${nuevas.length} img)`);
      if (!DRY) {
        await prisma.modelo.update({ where: { id: m.id }, data: { imagenes: nuevas } });
        if (m.publicadoMl && m.mlItemId) aResync.push({ ...m, imagenes: nuevas });
      }
    }
  }
  console.log(`\nModelos modificados: ${cambiados} · renders removidos: ${removidos}`);

  if (!DRY && aResync.length) {
    const token = await getAccessTokenValido();
    if (!token) { console.log("ML no conectado: no se resincronizan fotos."); await prisma.$disconnect(); return; }
    let ok = 0;
    for (const m of aResync) {
      const pictures = m.imagenes.map((u) => ({ source: abs(u) }));
      const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pictures }),
      });
      if (r.ok) ok++;
      else console.log(`  ✗ resync ${m.nombre}: ${((await r.json().catch(() => ({}))) as { message?: string }).message ?? r.status}`);
    }
    console.log(`Resync a ML: ${ok}/${aResync.length} anuncios publicados actualizados.`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

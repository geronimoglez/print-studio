// Orquesta la detección visual de IP sobre TODO el catálogo marcaIp="no" llamando a la ruta
// /api/bot/clasificar-vision por lotes (la ruta vive en Vercel, donde están OPENROUTER + token ML).
// Cada lote respeta el límite de 120s; aquí solo coordinamos y acumulamos el reporte.
//
// Uso: npx tsx scripts/vision-ip-lotes.ts [--tam 12]
import "dotenv/config";
import fs from "node:fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://lab3d.apps.minka.one";
function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
const TAM = parseInt(arg("tam") ?? "12", 10);

function leerKey(): string {
  const env = fs.readFileSync(".env", "utf8");
  const m = env.match(/^BOT_API_KEY=(.*)$/m);
  if (!m) throw new Error("BOT_API_KEY no está en .env");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

async function main() {
  const key = leerKey();
  const nombres = (await prisma.modelo.findMany({ where: { marcaIp: "no" }, orderBy: { nombre: "asc" }, select: { nombre: true } })).map((m) => m.nombre);
  await prisma.$disconnect();
  console.log(`${nombres.length} modelos marcaIp="no" → lotes de ${TAM}\n`);

  let subidos = 0, pausados = 0, procesados = 0;
  const flagged: Array<{ nombre: string; tipo: string; detalle: string; pausado: boolean }> = [];
  for (let i = 0; i < nombres.length; i += TAM) {
    const lote = nombres.slice(i, i + TAM);
    process.stdout.write(`  lote ${i / TAM + 1} (${lote.length})… `);
    const res = await fetch(`${BASE}/api/bot/clasificar-vision`, {
      method: "POST", headers: { "x-bot-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ solo: lote, limit: TAM }),
    });
    const j = (await res.json()) as any;
    if (!j.ok) { console.log(`❌ ${JSON.stringify(j).slice(0, 80)}`); continue; }
    procesados += j.procesados; subidos += j.subidos; pausados += j.pausados ?? 0;
    for (const r of j.resultados as any[]) {
      if (r.ahora !== "no" && r.ahora !== r.antes) flagged.push({ nombre: r.nombre, tipo: r.ahora, detalle: r.detalle, pausado: r.pausado });
    }
    console.log(`procesados ${j.procesados}, marcados ${j.subidos}, pausados ${j.pausados ?? 0}`);
  }

  console.log(`\n=== TOTAL visión-IP ===`);
  console.log(`  procesados ${procesados} · marcados ${subidos} · pausados en ML ${pausados}`);
  if (flagged.length) {
    console.log(`\n  🚩 IP detectada (el nombre no la veía):`);
    for (const f of flagged) console.log(`   - ${f.nombre}  [${f.tipo}${f.pausado ? ", pausado" : ""}]  «${f.detalle}»`);
  } else {
    console.log(`\n  ✓ ningún modelo nuevo con IP oculta.`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

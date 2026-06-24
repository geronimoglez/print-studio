// Detección VISUAL de IP sobre TODO el catálogo marcaIp="no" (lo que el nombre no ve: logo/personaje
// moldeado o en la foto). Corre LOCAL (sin el límite de 120s de Vercel) usando OPENROUTER_API_KEY.
// Si detecta IP: sube marcaIp (marca|personaje), anota, y —si quedó NO publicable— PAUSA en ML
// (política híbrida: pausar publicaciones posiblemente dañinas).
//
// Uso:
//   npx tsx scripts/clasificar-vision-todos.ts [--dry] [--limit N] [--pausar]
//   --dry: no escribe nada · --pausar: además pausa en ML lo no-publicable (default: sí pausa)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { detectarIpVisual } from "../src/lib/vision";
import { esPublicable, nivelRiesgo } from "../src/lib/riesgo";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://lab3d.apps.minka.one";
const DRY = process.argv.includes("--dry");
const NO_PAUSAR = process.argv.includes("--no-pausar");
function argN(name: string): number | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : undefined; }
const LIMIT = argN("limit");
const abs = (u?: string) => (!u ? undefined : u.startsWith("http") ? u : `${BASE}${u}`);

async function main() {
  if (!process.env.OPENROUTER_API_KEY) { console.error("Falta OPENROUTER_API_KEY"); process.exit(1); }
  const token = !DRY && !NO_PAUSAR ? ((await getAccessTokenValido()) as string | null) : null;
  let modelos = await prisma.modelo.findMany({ where: { marcaIp: "no" }, orderBy: { nombre: "asc" } });
  if (LIMIT) modelos = modelos.slice(0, LIMIT);
  console.log(`Visión-IP sobre ${modelos.length} modelos marcaIp="no"…\n`);

  let subidos = 0, pausados = 0, noEval = 0;
  const flagged: string[] = [];
  for (const m of modelos) {
    const cover = abs((m.imagenes ?? []).find((u) => !u.includes("/render/")) ?? (m.imagenes ?? [])[0]);
    const v = await detectarIpVisual(cover);
    if (!v.evaluado) { noEval++; console.log(`  ··  ${m.nombre.slice(0, 30).padEnd(30)} (no evaluado: ${v.detalle ?? "sin foto/err"})`); continue; }
    if (v.ip && v.tipo && v.tipo !== "no") {
      const nivelAntes = nivelRiesgo(m.marcaIp, m.licencia);
      const nivelDespues = nivelRiesgo(v.tipo, m.licencia);
      console.log(`  🚩 ${m.nombre.slice(0, 30).padEnd(30)} → ${v.tipo}  (${nivelAntes}→${nivelDespues})  «${v.detalle}»`);
      flagged.push(`${m.nombre} — ${v.tipo}: ${v.detalle}`);
      if (!DRY) {
        await prisma.modelo.update({ where: { id: m.id }, data: { marcaIp: v.tipo, notas: `${m.notas ?? ""} [IP-visual: ${v.tipo} · ${v.detalle ?? ""}]`.slice(0, 1000) } });
        subidos++;
        // pausar en ML si dejó de ser publicable
        if (token && !esPublicable(v.tipo, m.licencia) && m.publicadoMl && m.mlItemId) {
          try {
            const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "paused" }) });
            if (r.ok) { pausados++; console.log(`     ⏸️  pausado en ML`); }
          } catch { /* */ }
        }
      }
    } else {
      console.log(`  ✓   ${m.nombre.slice(0, 30).padEnd(30)} limpio`);
    }
  }
  console.log(`\n=== Resumen visión-IP ===`);
  console.log(`  evaluados con IP (subidos): ${subidos}   pausados en ML: ${pausados}   no evaluados: ${noEval}`);
  if (flagged.length) { console.log(`\n  Marcados:`); for (const f of flagged) console.log(`   - ${f}`); }
  if (DRY) console.log(`\n  (DRY — no se escribió nada)`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

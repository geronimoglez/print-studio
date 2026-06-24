// Revierte una clasificación de IP-visual errónea: vuelve marcaIp a la clasificación POR NOMBRE,
// limpia la nota "[IP-visual…]" y —si vuelve a ser publicable— reactiva el anuncio en ML.
// Útil cuando el VLM sobre-marcó un motivo genérico (dragón, pulpo, ajolote, ménsula…).
//
// Uso: npx tsx scripts/revertir-ip-visual.ts "Nombre 1" "Nombre 2" ...
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clasificarIp, esPublicable, nivelRiesgo } from "../src/lib/riesgo";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const NOMBRES = process.argv.slice(2);

async function main() {
  if (!NOMBRES.length) { console.error("Pasa al menos un nombre."); process.exit(1); }
  const token = (await getAccessTokenValido().catch(() => null)) as string | null;
  const modelos = await prisma.modelo.findMany({ where: { nombre: { in: NOMBRES } } });
  let revertidos = 0, reactivados = 0;
  for (const m of modelos) {
    const porNombre = clasificarIp(m.nombre);
    const nota = (m.notas ?? "").replace(/\s*\[IP-visual:[^\]]*\]/g, "").trim();
    await prisma.modelo.update({ where: { id: m.id }, data: { marcaIp: porNombre, notas: nota } });
    revertidos++;
    const nivel = nivelRiesgo(porNombre, m.licencia);
    console.log(`  ↩️  ${m.nombre.padEnd(30)} marcaIp:${porNombre} (${nivel})`);
    if (token && esPublicable(porNombre, m.licencia) && m.publicadoMl && m.mlItemId) {
      try {
        const it = (await (await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}?attributes=status`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
        if (it.status === "paused") {
          const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) });
          if (r.ok) { reactivados++; console.log(`     ▶️  reactivado en ML`); }
        }
      } catch { /* */ }
    }
  }
  console.log(`\n>>> revertidos:${revertidos}  reactivados:${reactivados}`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

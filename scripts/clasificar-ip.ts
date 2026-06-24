// Clasifica TODOS los modelos en su estatus de MARCA/IP (capa 1) y calcula el nivel de riesgo.
// Con --reactivar, REACTIVA en ML los IP-limpios (verde/amarillo) que quedaron pausados por la capa 2
// (ahora sí son publicables bajo la política híbrida).
//
// Uso: npx tsx scripts/clasificar-ip.ts [--reactivar]
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clasificarIp, nivelRiesgo, esPublicable } from "../src/lib/riesgo";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const REACTIVAR = process.argv.includes("--reactivar");

async function main() {
  const modelos = await prisma.modelo.findMany();
  const dist: Record<string, number> = { verde: 0, amarillo: 0, rojo: 0 };
  const ip: Record<string, number> = { no: 0, personaje: 0, marca: 0 };
  let reactivados = 0;
  const token = REACTIVAR ? ((await getAccessTokenValido()) as string) : null;

  // rango de severidad: la clasificación por NOMBRE solo puede SUBIR el riesgo, nunca bajarlo.
  // Así no pisa los overrides de la visión (p.ej. "Porta Figuritas" = "no" por nombre pero "marca" por visión).
  const rango: Record<string, number> = { no: 0, personaje: 1, marca: 2 };
  for (const m of modelos) {
    const porNombre = clasificarIp(m.nombre);
    const marcaIp = rango[porNombre] > rango[m.marcaIp ?? "no"] ? porNombre : (m.marcaIp ?? "no");
    if (marcaIp !== m.marcaIp) await prisma.modelo.update({ where: { id: m.id }, data: { marcaIp } });
    const nivel = nivelRiesgo(marcaIp, m.licencia);
    dist[nivel]++; ip[marcaIp]++;

    // Reactivar en ML los IP-limpios que pausamos por capa 2
    if (REACTIVAR && token && esPublicable(marcaIp, m.licencia) && m.publicadoMl && m.mlItemId) {
      try {
        const it: any = await (await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}?attributes=status`, { headers: { Authorization: `Bearer ${token}` } })).json();
        if (it.status === "paused") {
          const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ status: "active" }) });
          if (r.ok) { reactivados++; console.log(`  ▶️  reactivado ${m.nombre.slice(0, 28).padEnd(28)} (${nivel})`); }
        }
      } catch { /* */ }
    }
  }
  console.log(`\n=== Clasificación IP (capa 1) ===`);
  console.log(`  sin marca: ${ip.no} | personaje: ${ip.personaje} | marca: ${ip.marca}`);
  console.log(`=== Nivel de riesgo (capa 1 + 2) ===`);
  console.log(`  🟢 verde (100% limpio): ${dist.verde}`);
  console.log(`  🟡 amarillo (IP-limpio, file-license restringida): ${dist.amarillo}`);
  console.log(`  🔴 rojo (marca/personaje IP): ${dist.rojo}`);
  if (REACTIVAR) console.log(`\n>>> reactivados en ML: ${reactivados}`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e.message); process.exit(1); });

// Valida en ML cada modelo del pack y refleja el resultado en estadoValidacion:
//   apto + valida verde → "Validado" · apto + no verde → "Pendiente" · bloqueado por licencia → "Rechazado".
// Así el dashboard ("listos para publicar") refleja la realidad.
// Correr: npx tsx scripts/validar-todos.ts
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { validarPublicacion } from "../src/lib/mercadolibre";
import { esAptoVenta } from "../src/lib/licencias";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const modelos = await prisma.modelo.findMany({ where: { notas: { startsWith: "Pack " } }, orderBy: { nombre: "asc" } });
  let validados = 0, pendientes = 0, bloqueados = 0;
  for (const m of modelos) {
    if (!esAptoVenta(m.licencia)) {
      await prisma.modelo.update({ where: { id: m.id }, data: { estadoValidacion: "Rechazado" } });
      bloqueados++;
      continue;
    }
    let estado = "Pendiente";
    try {
      const r = await validarPublicacion(m.id);
      estado = r.valido ? "Validado" : "Pendiente";
    } catch { /* deja Pendiente */ }
    await prisma.modelo.update({ where: { id: m.id }, data: { estadoValidacion: estado } });
    if (estado === "Validado") validados++; else pendientes++;
    process.stdout.write(`  ${estado === "Validado" ? "✅" : "•"} ${estado.padEnd(9)} ${m.nombre}\n`);
  }
  console.log(`\n>>> Validados: ${validados} · Pendientes: ${pendientes} · Rechazados(licencia): ${bloqueados}`);
}

main().then(() => prisma.$disconnect()).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

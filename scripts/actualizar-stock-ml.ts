// Actualiza el STOCK (available_quantity) de los anuncios ya publicados en Mercado Libre.
// Negocio bajo demanda: el stock no es inventario físico, es cuántas unidades simultáneas aceptamos.
// Con >=2, ML muestra el selector de cantidad y quita el "¡Última en stock!". Todos los anuncios son
// gold_special (Clásica) → sin tope de stock. Manda SOLO { available_quantity } (no re-pisa el precio).
//
// Uso:
//   npx tsx scripts/actualizar-stock-ml.ts                 (5 unidades a todos los ACTIVOS)
//   npx tsx scripts/actualizar-stock-ml.ts --cantidad 3    (otra cantidad)
//   npx tsx scripts/actualizar-stock-ml.ts --todos         (intenta también pausados/en revisión)
//   npx tsx scripts/actualizar-stock-ml.ts --limite 5      (probar con pocos primero)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAccessTokenValido } from "../src/lib/mercadolibre";
import { STOCK_ML_DEFAULT } from "../src/lib/publicacion";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
function arg(name: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
function flag(name: string) { return process.argv.includes(`--${name}`); }

async function main() {
  const cantidad = Math.max(0, Math.floor(Number(arg("cantidad") ?? STOCK_ML_DEFAULT)));
  const limite = arg("limite") ? parseInt(arg("limite")!, 10) : undefined;
  const todos = flag("todos");

  const token = await getAccessTokenValido();
  if (!token) { console.error("ML no conectado"); process.exit(1); }

  const where: Record<string, unknown> = { publicadoMl: true, mlItemId: { not: null } };
  if (!todos) where.mlEstado = "active"; // por defecto solo activos (evita PUTs a forbidden/closed que ML rechaza)
  let modelos = await prisma.modelo.findMany({ where, select: { nombre: true, mlItemId: true, mlEstado: true } });
  if (limite) modelos = modelos.slice(0, limite);

  console.log(`Actualizando stock a ${cantidad} en ${modelos.length} anuncio(s) (${todos ? "todos" : "solo activos"})…\n`);
  let ok = 0, fail = 0;
  for (const m of modelos) {
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ available_quantity: cantidad }),
      });
      if (r.ok) { ok++; }
      else {
        fail++;
        const b = (await r.json().catch(() => ({}))) as { message?: string };
        console.log(`  ✗ ${m.nombre} (${m.mlEstado}) — ${b.message ?? r.status}`);
      }
    } catch (e) {
      fail++;
      console.log(`  ✗ ${m.nombre} — ${(e as Error).message}`);
    }
  }
  console.log(`\nListo. OK: ${ok} · Fallidos: ${fail} · Stock objetivo: ${cantidad}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

// Actualiza los anuncios ACTIVOS ya publicados con: tiempo de fabricación (2 días), medidas de empaque
// (SELLER_PACKAGE_* de la pieza medida) y descripción con la línea de medidas. No re-publica ni cambia
// título/categoría (no re-dispara moderación): solo PUT de sale_terms + attributes + description.
//
// Uso: npx tsx scripts/actualizar-anuncios.ts [--solo "Nombre1,Nombre2"] [--limit 20] [--dry]
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAccessTokenValido } from "../src/lib/mercadolibre";
import { DIAS_FABRICACION_ML, atributosPaquete, generarDescripcion, asegurarMedidas, sanitizarDescripcion } from "../src/lib/publicacion";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }
const SOLO = arg("solo")?.split(",").map((s) => s.trim());
const LIMIT = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
const DRY = process.argv.includes("--dry");

async function main() {
  const where: Record<string, unknown> = SOLO
    ? { nombre: { in: SOLO }, publicadoMl: true, mlItemId: { not: null } }
    : { publicadoMl: true, mlItemId: { not: null }, mlEstado: "active" };
  let modelos = await prisma.modelo.findMany({ where });
  if (LIMIT) modelos = modelos.slice(0, LIMIT);
  const token = await getAccessTokenValido();
  if (!token) { console.error("ML no conectado"); process.exit(1); }

  console.log(`Anuncios a actualizar: ${modelos.length} · fabricación ${DIAS_FABRICACION_ML} días${DRY ? " · DRY" : ""}`);
  let ok = 0, errItem = 0, errDesc = 0;
  for (const m of modelos) {
    const sale_terms = [
      { id: "MANUFACTURING_TIME", value_name: `${DIAS_FABRICACION_ML} días` },
      { id: "WARRANTY_TYPE", value_name: "Garantía del vendedor" },
      { id: "WARRANTY_TIME", value_name: "30 días" },
    ];
    const attributes = atributosPaquete(m);
    const desc = sanitizarDescripcion(asegurarMedidas(m.descripcionMl ?? generarDescripcion(m), m));
    if (DRY) { console.log(`  [dry] ${m.nombre}: ${m.altoCm ?? "base"}x${m.anchoCm ?? ""}x${m.largoCm ?? ""} cm`); continue; }
    const ri = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sale_terms, attributes }),
    });
    if (!ri.ok) { errItem++; console.log(`  ✗ item ${m.nombre}: ${((await ri.json().catch(() => ({}))) as { message?: string }).message ?? ri.status}`); }
    const rd = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}/description`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ plain_text: desc }),
    });
    if (!rd.ok) errDesc++;
    if (ri.ok && rd.ok) ok++;
  }
  console.log(`\nActualizados OK: ${ok} · errores item: ${errItem} · errores descripción: ${errDesc}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });

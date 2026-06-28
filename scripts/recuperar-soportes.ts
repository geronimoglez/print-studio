// Recupera los soportes de pelota genéricos: su MALLA es genérica (un soporte/cuna/ménsula),
// la marca (Adidas/FIFA/UEFA/Mikasa) estaba SOLO en el balón-utilería de la foto original.
// Tras renderizarlos limpios (render-todos --modo limpio), este script:
//   1) baja marcaIp a "no"  → nivel 🟡 amarillo (IP-limpio; file-license restringida) → publicable
//   2) empuja a ML las fotos limpias (renders) y reactiva el anuncio (status=active)
// Solo toca la lista dada; NO reclasifica por nombre (no pisa overrides de visión en otros modelos).
//
// Uso: npx tsx scripts/recuperar-soportes.ts [--dry]
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAccessTokenValido } from "../src/lib/mercadolibre";
import { nivelRiesgo, esPublicable } from "../src/lib/riesgo";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DRY = process.argv.includes("--dry");
const abs = (u: string) => (u.startsWith("http") ? u : `${BASE}${u}`);

const NOMBRES = [
  "Soporte para Pelota I", "Soporte para Pelota II", "Soporte para Pelota III", "Soporte para Pelota IV",
  "Soporte para Pelota V", "Soporte para Pelota Pared I", "Soporte para Pelota Pared II", "Soporte para Pelota Pared III",
];

async function main() {
  const token = (await getAccessTokenValido()) as string | null;
  const modelos = await prisma.modelo.findMany({ where: { nombre: { in: NOMBRES } } });
  let reclas = 0, fotos = 0, react = 0, err = 0;

  for (const m of modelos) {
    const renders = (m.imagenes ?? []).filter((u) => u.includes("/render/"));
    if (!renders.length) { console.log(`  ⚠️  ${m.nombre}: sin renders, saltado`); continue; }

    // 1) reclasificar a "no" (la malla es genérica)
    const nivel = nivelRiesgo("no", m.licencia);
    if (!DRY && m.marcaIp !== "no") {
      const nota = `${m.notas ?? ""} [recuperado: malla genérica; marca solo en balón-utilería de la foto]`.slice(0, 1000);
      await prisma.modelo.update({ where: { id: m.id }, data: { marcaIp: "no", notas: nota } });
    }
    reclas++;
    console.log(`  🟢→ ${m.nombre.padEnd(30)} marcaIp:no  nivel:${nivel}  renders:${renders.length}`);

    if (DRY) continue;
    if (!esPublicable("no", m.licencia)) { console.log(`     (no publicable por política, no se reactiva)`); continue; }
    if (!token) { console.log(`     (ML no conectado, solo reclasificado)`); continue; }
    if (!m.publicadoMl || !m.mlItemId) { console.log(`     (no estaba publicado en ML; queda listo para publicar)`); continue; }

    // 2) empujar fotos limpias + reactivar
    const pics = renders.slice(0, 10).map((u) => ({ source: abs(u) }));
    try {
      const rp = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pictures: pics }),
      });
      const bp = (await rp.json()) as { pictures?: unknown[]; message?: string };
      if (rp.ok) { fotos++; console.log(`     📷 fotos → ${bp.pictures?.length ?? "?"}`); }
      else { err++; console.log(`     ❌ fotos: ${String(bp.message ?? rp.status).slice(0, 60)}`); }

      const rs = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const bs = (await rs.json()) as { status?: string; message?: string };
      if (rs.ok && bs.status === "active") { react++; console.log(`     ▶️  reactivado (active)`); }
      else { console.log(`     ⏸️  status: ${String(bs.status ?? bs.message ?? rs.status).slice(0, 60)}`); }
    } catch (e) { err++; console.log(`     ❌ ${e instanceof Error ? e.message.slice(0, 50) : "error"}`); }
  }
  console.log(`\n>>> reclasificados:${reclas}  fotos-ML:${fotos}  reactivados:${react}  errores:${err}${DRY ? "  (DRY)" : ""}`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

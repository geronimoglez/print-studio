// Re-sincroniza las FOTOS de los anuncios ya publicados en ML con las imágenes actuales del
// modelo (foto real + renders). PUT /items/{id} { pictures }. Útil tras agregar renders.
//
// Uso:
//   npx tsx scripts/resync-fotos-ml.ts            (todos los publicados aptos)
//   npx tsx scripts/resync-fotos-ml.ts --solo "Calavera,Cobra"   (algunos)
//   npx tsx scripts/resync-fotos-ml.ts --limite 3 (probar pocos)
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { esPublicable } from "../src/lib/riesgo";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://lab3d.apps.minka.one";
function arg(name: string) { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }
const abs = (u: string) => (u.startsWith("http") ? u : `${BASE}${u}`);

async function main() {
  const token = await getAccessTokenValido();
  if (!token) { console.error("ML no conectado"); process.exit(1); }
  const solo = arg("solo")?.split(",").map((s) => s.trim());
  const limite = arg("limite") ? parseInt(arg("limite")!, 10) : undefined;

  let modelos = (await prisma.modelo.findMany({ where: { publicadoMl: true, mlItemId: { not: null } } })).filter(
    (m) => esPublicable(m.marcaIp, m.licencia) && (!solo || solo.includes(m.nombre)),
  );
  if (limite) modelos = modelos.slice(0, limite);
  console.log(`Re-sync de fotos en ${modelos.length} anuncios…\n`);

  let ok = 0, err = 0;
  for (const m of modelos) {
    // ML acepta hasta ~10-12 fotos; mandamos foto(s) real(es) + renders, máx 10.
    const pics = (m.imagenes ?? []).filter(Boolean).slice(0, 10).map((u) => ({ source: abs(u) }));
    if (!pics.length) continue;
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ pictures: pics }),
      });
      const b = (await r.json()) as { pictures?: unknown[]; status?: string; message?: string };
      if (r.ok) { ok++; console.log(`  ✅ ${m.nombre.padEnd(26)} ${m.mlItemId} → ${b.pictures?.length ?? "?"} fotos`); }
      else { err++; console.log(`  ❌ ${m.nombre.padEnd(26)} ${String(b.message ?? r.status).slice(0, 50)}`); }
    } catch (e) { err++; console.log(`  ❌ ${m.nombre}: ${e instanceof Error ? e.message.slice(0, 40) : "error"}`); }
  }
  console.log(`\n>>> ${ok} ok, ${err} error.`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

// Importa en masa los publicables (verde+amarillo) de los packs nuevos desde import_manifest.json
// (generado por catalogo-packs/preparar_publicables.py: imágenes ya en public/pack, licencia normalizada).
// - marcaIp se calcula POR NOMBRE (clasificarIp) → cruza con la visión: lo que el nombre delate como
//   marca/personaje (ej. autos McLaren/Nissan que la visión vio "genérico") queda 🔴 y NO entra a revisión.
// - Sin malla (se jala on-demand luego; meshRef queda en notas).
// - Backfill: marca estadoValidacion=Validado en los ya publicados (coherencia del ciclo).
// Idempotente por nombre (no toca los que ya existen).
//
// Uso: npx tsx scripts/importar-publicables.ts [--dry]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { clasificarIp, nivelRiesgo } from "../src/lib/riesgo";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const DRY = process.argv.includes("--dry");
const MANIFEST = path.join(process.cwd(), "..", "catalogo-packs", "import_manifest.json");

type Item = { slug: string; nombre: string; pack: string; categoria: string; licencia: string; nivel: string; imagenes: string[]; meshRef: string; descripcion: string; archivoTipo: string };

async function main() {
  // Backfill del quirk: publicados que quedaron "Pendiente" → "Validado".
  if (!DRY) {
    const bf = await prisma.modelo.updateMany({ where: { publicadoMl: true, estadoValidacion: "Pendiente" }, data: { estadoValidacion: "Validado" } });
    console.log(`Backfill: ${bf.count} publicados → Validado`);
  }

  const items = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Item[];
  const dist: Record<string, number> = { verde: 0, amarillo: 0, rojo: 0 };
  let creados = 0, saltados = 0;
  const rojos: string[] = [];

  for (const it of items) {
    const marcaIp = clasificarIp(it.nombre); // por nombre; visión ya filtró a "generico"
    const nivel = nivelRiesgo(marcaIp, it.licencia);
    dist[nivel]++;
    if (marcaIp !== "no") rojos.push(`${it.nombre} (${marcaIp})`);

    const existe = await prisma.modelo.findFirst({ where: { nombre: it.nombre }, select: { id: true } });
    if (existe) { saltados++; continue; }
    if (DRY) { creados++; continue; }

    await prisma.modelo.create({
      data: {
        nombre: it.nombre, fuente: "Packs jun2026", licencia: it.licencia, categoria: it.categoria,
        nicho: "importado", tiempoImpresionMin: 240, gramosFilamento: 60, tipoFilamento: "PLA",
        multicolorAms: false, requiereSoportes: false, dificultad: "Media",
        estadoValidacion: "Pendiente", marcaIp, archivoTipo: it.archivoTipo,
        notas: `Importado de pack ${it.pack}. Malla on-demand: ${it.meshRef || "—"}. [${it.descripcion}]`.slice(0, 1000),
        imagenes: it.imagenes,
      },
    });
    creados++;
  }

  console.log(`\n>>> ${DRY ? "(DRY) " : ""}creados:${creados} saltados(ya existían):${saltados}`);
  console.log(`Distribución por nivel: 🟢 ${dist.verde} · 🟡 ${dist.amarillo} · 🔴 ${dist.rojo}`);
  if (rojos.length) { console.log(`\n🔴 marcados rojo por nombre (NO entran a revisión):`); for (const r of rojos) console.log(`   - ${r}`); }
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

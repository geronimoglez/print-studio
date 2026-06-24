// Pone la foto de fondo blanco (blanco.jpg) como PORTADA de cada modelo del pack.
// Lee el manifiesto que genera fondos-blancos.py y antepone /pack/<slug>/blanco.jpg en imagenes.
// Idempotente. Correr: npx tsx scripts/aplicar-fondos.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const MANIFEST = path.join(process.cwd(), "public", "pack", "_blancos.json");

async function main() {
  if (!fs.existsSync(MANIFEST)) {
    console.error("No existe el manifiesto. Corre primero scripts/fondos-blancos.py");
    return;
  }
  const manifest: Record<string, string> = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  const modelos = await prisma.modelo.findMany({ where: { notas: { startsWith: "Pack " } } });
  let aplicados = 0;
  for (const m of modelos) {
    const first = (m.imagenes ?? []).find((u) => u.startsWith("/pack/"));
    const slug = first?.split("/")[2];
    if (!slug || !manifest[slug]) continue;
    const blanco = manifest[slug];
    const rest = (m.imagenes ?? []).filter((u) => u !== blanco);
    const nuevas = [blanco, ...rest];
    if (JSON.stringify(nuevas) !== JSON.stringify(m.imagenes)) {
      await prisma.modelo.update({ where: { id: m.id }, data: { imagenes: nuevas } });
      aplicados++;
    }
  }
  console.log(`✅ Portada con fondo blanco aplicada a ${aplicados} modelos.`);
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

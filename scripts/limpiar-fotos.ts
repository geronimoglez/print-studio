// Quita las fotos placeholder (picsum) de los modelos demo. No borra modelos ni otros datos.
// Correr: npm run limpiar:fotos
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function main() {
  const modelos = await prisma.modelo.findMany({ select: { id: true, imagenes: true } });
  let n = 0;
  for (const m of modelos) {
    if (m.imagenes.some((u) => u.includes("picsum"))) {
      await prisma.modelo.update({ where: { id: m.id }, data: { imagenes: [] } });
      n++;
    }
  }
  console.log(`✅ Fotos placeholder removidas de ${n} modelo(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function main() {
  await prisma.modelo.deleteMany({ where: { nombre: { contains: "prueba catálogo" } } });
  console.log("✅ modelo(s) de prueba de catálogo eliminado(s).");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());

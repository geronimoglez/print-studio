// Crea unos modelos de prueba CON foto (no borra nada). Para probar el copiloto de publicación.
// Correr: npm run modelos:demo
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

const img = (s: number) => `https://picsum.photos/seed/lab3d${s}/900/900`;

const modelos = [
  { nombre: "Maceta geométrica decorativa", categoria: "Decoracion", nicho: "hogar", tiempoImpresionMin: 180, gramosFilamento: 90, tipoFilamento: "PLA", s: 1 },
  { nombre: "Organizador de escritorio minimalista", categoria: "Organizador", nicho: "oficina", tiempoImpresionMin: 120, gramosFilamento: 60, tipoFilamento: "PETG", s: 2 },
  { nombre: "Llavero personalizado con nombre", categoria: "Regalo", nicho: "personalizado", tiempoImpresionMin: 45, gramosFilamento: 12, tipoFilamento: "PLA", s: 3 },
  { nombre: "Soporte para celular plegable", categoria: "Organizador", nicho: "oficina", tiempoImpresionMin: 90, gramosFilamento: 40, tipoFilamento: "PLA", s: 4 },
];

async function main() {
  let n = 0;
  for (const m of modelos) {
    await prisma.modelo.create({
      data: {
        nombre: m.nombre,
        fuente: "Propio",
        licencia: "Propia",
        categoria: m.categoria,
        nicho: m.nicho,
        tiempoImpresionMin: m.tiempoImpresionMin,
        gramosFilamento: m.gramosFilamento,
        tipoFilamento: m.tipoFilamento,
        tiempoOperacionMin: 10,
        costoPostproceso: 3,
        estadoValidacion: "Validado",
        publicadoMl: false,
        imagenes: [img(m.s)],
      },
    });
    n++;
  }
  console.log(`✅ ${n} modelos de prueba creados (con foto).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

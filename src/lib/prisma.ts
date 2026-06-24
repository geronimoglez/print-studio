import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 usa driver adapters (sin engine Rust). App en Postgres (Neon) para local y producción.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function crearPrisma(): PrismaClient {
  let url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL no está definida");
  // Neon requiere SSL. Si la URL llega sin query string (p.ej. seteada en Vercel sin `?sslmode`
  // porque el CLI corrompe valores con `?&=`), se lo añadimos aquí. Así DATABASE_URL puede vivir
  // sin caracteres especiales y la conexión sigue siendo segura.
  if (!url.includes("?")) url += "?sslmode=require";
  return new PrismaClient({ adapter: new PrismaPg(url) });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? crearPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

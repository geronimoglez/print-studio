// Punto único de acceso a datos (choke point).
//
// CONVENCIÓN open-core: todo el código de la app importa `prisma` desde "@/lib/db",
// NO desde "@/lib/prisma" (las únicas excepciones son lib/prisma.ts y lib/datos.ts).
// Así, el overlay SaaS puede inyectar el scoping por tenant en un solo lugar el día de mañana,
// sin reescribir ~30 archivos.
import { prisma } from "./prisma";

export { prisma };

// En self-host es identidad (no añade ningún filtro). El overlay SaaS lo reemplaza para
// ejecutar `fn` dentro de un contexto de tenant (AsyncLocalStorage + RLS).
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

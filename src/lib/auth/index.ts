// Costura open-core: sesión / usuario actual.
// - Self-host (repo público): NO hay login. Devuelve un "owner" sintético; la UI queda abierta
//   (debe desplegarse tras red privada / reverse proxy — ver SECURITY.md).
// - SaaS (overlay privado): registra un proveedor con sesión real (Better-Auth) y validación de tenant.

import { getTenantId } from "@/lib/tenant";

export type Rol = "owner" | "admin" | "operador";
export type Session = { userId: string; tenantId: string; rol: Rol };

type AuthProvider = { getSession: () => Promise<Session | null> };

async function ownerSintetico(): Promise<Session> {
  return { userId: "owner", tenantId: await getTenantId(), rol: "owner" };
}

let provider: AuthProvider = { getSession: ownerSintetico };

/** El overlay SaaS llama esto en su bootstrap para inyectar la sesión real. */
export function setAuthProvider(p: AuthProvider): void {
  provider = p;
}

export async function getSession(): Promise<Session | null> {
  return provider.getSession();
}

/** Lanza si no hay sesión. En self-host nunca lanza (owner sintético). */
export async function requireSession(): Promise<Session> {
  const s = await provider.getSession();
  if (!s) throw new Error("No autenticado");
  return s;
}

/**
 * Envuelve una Server Action. En self-host es identidad (sin fricción).
 * En SaaS, el overlay reemplaza esta implementación para validar sesión + tenant + rol
 * (las server actions no quedan protegidas por el middleware, así que se protegen aquí).
 */
export function accionSegura<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => fn(...args);
}

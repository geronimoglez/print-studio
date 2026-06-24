// Costura open-core: resolución del "tenant" actual.
// - Self-host (repo público): siempre devuelve una constante (un solo negocio).
// - SaaS (overlay privado): registra un resolver que deduce el tenant de la sesión/subdominio.
// El core SIEMPRE importa getTenantId() desde aquí; nunca conoce la implementación del overlay.

export const TENANT_DEFAULT = process.env.TENANT_ID || "default";

type TenantResolver = () => Promise<string> | string;

let resolver: TenantResolver = () => TENANT_DEFAULT;

/** El overlay SaaS llama esto en su bootstrap para inyectar la resolución real. */
export function setTenantResolver(fn: TenantResolver): void {
  resolver = fn;
}

/** Devuelve el id del tenant actual. En self-host es `TENANT_DEFAULT`. */
export async function getTenantId(): Promise<string> {
  return resolver();
}

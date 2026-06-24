// Costura open-core: resolución de secretos / claves de API.
// - Self-host (repo público): lee de process.env (igual que hoy).
// - SaaS (overlay privado): resuelve secretos por-tenant (cifrados en DB) con fallback a claves
//   de plataforma. Las libs (vision, firecrawl, storage, mercadolibre, ia-marca) piden por aquí
//   en lugar de leer process.env directo.

type SecretResolver = (proveedor: string, tenantId?: string) => Promise<string | undefined> | string | undefined;

// Nombres de env aceptados por proveedor (el primero que exista gana).
const ENV_MAP: Record<string, string[]> = {
  openrouter: ["OPENROUTER_API_KEY"],
  fal: ["FAL_KEY", "FAL_AI_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  blob: ["BLOB_READ_WRITE_TOKEN", "LAB3DBLOB_TOKEN", "lab3dblob_token"],
};

const resolverDefault: SecretResolver = (proveedor) => {
  const claves = ENV_MAP[proveedor] ?? [proveedor.toUpperCase()];
  for (const k of claves) {
    const v = process.env[k];
    if (v) return v;
  }
  return undefined;
};

let resolver: SecretResolver = resolverDefault;

/** El overlay SaaS llama esto para inyectar la resolución por-tenant (cifrada). */
export function setSecretResolver(fn: SecretResolver): void {
  resolver = fn;
}

/** Devuelve el secreto del proveedor para el tenant dado (o el de plataforma en self-host). */
export async function secretoDe(proveedor: string, tenantId?: string): Promise<string | undefined> {
  return resolver(proveedor, tenantId);
}

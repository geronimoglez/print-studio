// Costura open-core: autenticación de los endpoints del bot (Hermes/openclaw → /api/bot/*).
// - Self-host (repo público): header `x-bot-key` == `BOT_API_KEY` (comportamiento histórico).
// - SaaS (overlay privado): resuelve el tenant a partir de la clave (tabla ApiKey por tenant).
// El contrato HTTP con Hermes NO cambia: misma cabecera, mismos endpoints.

import { getTenantId } from "@/lib/tenant";

export type BotAuth = { tenantId: string };

type BotVerifier = (req: Request) => Promise<BotAuth | null>;

const verificadorDefault: BotVerifier = async (req) => {
  const key = process.env.BOT_API_KEY;
  const enviada = req.headers.get("x-bot-key");
  if (!key || enviada !== key) return null;
  return { tenantId: await getTenantId() };
};

let verifier: BotVerifier = verificadorDefault;

/** El overlay SaaS llama esto en su bootstrap para inyectar la verificación por-tenant. */
export function setBotVerifier(fn: BotVerifier): void {
  verifier = fn;
}

/** Devuelve el contexto de bot (tenant) o `null` si la clave es inválida. */
export async function verifyBotKey(req: Request): Promise<BotAuth | null> {
  return verifier(req);
}

/** Atajo booleano para los endpoints existentes que solo necesitan permitir/denegar. */
export async function botAutorizado(req: Request): Promise<boolean> {
  return (await verifyBotKey(req)) !== null;
}

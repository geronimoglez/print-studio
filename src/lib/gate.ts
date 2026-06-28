// Gate opcional de acceso por contraseña para TODA la instancia.
// Se activa SOLO si existe la variable de entorno APP_PASSWORD. Si no, la app queda
// abierta (comportamiento self-host por defecto). Pensado para herramientas internas
// (una sola contraseña compartida), no para auth multi-usuario — eso es la capa SaaS.

export const GATE_COOKIE = "app_auth";

export function gateEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

// Token determinista derivado de la contraseña: NO guardamos la clave en la cookie.
export async function tokenPara(password: string): Promise<string> {
  const data = new TextEncoder().encode("app-gate:v1:" + password);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function tokenEsperado(): Promise<string> {
  return tokenPara(process.env.APP_PASSWORD ?? "");
}

// Comparación en tiempo ~constante (mismo largo siempre: son hashes hex).
export function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Rutas que nunca se protegen: tienen su propia auth (x-bot-key, OAuth) o deben ser
// alcanzables por máquinas (callback de ML, cron, estado que lee el bot) + la propia /login.
export function rutaLibre(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/api/bot/") ||
    pathname === "/api/ml/callback" ||
    pathname === "/api/ml/procesar" ||
    pathname === "/api/estado"
  );
}

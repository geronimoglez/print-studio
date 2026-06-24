// Resolución del idioma de UI (server). Prioridad: cookie NEXT_LOCALE → Config.localeUi → default.
import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export async function getUserLocale(): Promise<Locale> {
  try {
    const c = await cookies();
    const fromCookie = c.get(LOCALE_COOKIE)?.value;
    if (isLocale(fromCookie)) return fromCookie;
  } catch {
    // sin contexto de request (p.ej. build) → seguir a los fallbacks
  }
  try {
    const { getConfig } = await import("@/lib/datos");
    const cfg = await getConfig();
    if (isLocale(cfg.localeUi)) return cfg.localeUi;
  } catch {
    // sin DB → default
  }
  return defaultLocale;
}

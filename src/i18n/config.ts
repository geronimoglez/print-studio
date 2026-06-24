// Configuración de i18n (estrategia: cookie, sin prefijo de ruta — ver src/i18n/request.ts).
export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";
export const localeNames: Record<Locale, string> = { es: "Español", en: "English" };

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (locales as readonly string[]).includes(v);
}

// Costura open-core + white-label: identidad de marca de la instancia.
// Resolución por capas (de mayor a menor prioridad):
//   1) Override en DB (Config.branding)  ← editable en runtime desde /setup y /config (Fase 1D, ver getBrandingResuelto)
//   2) Variables de entorno (BRAND_*)    ← para fijar la marca en el deploy
//   3) Defaults neutros                  ← para que el OSS no quede atado a ninguna marca comercial
//
// El shell estático (metadata, manifest, logo) usa getBranding() (síncrono, sin DB) para no
// requerir base de datos en build. El merge con el override de DB se hace en getBrandingResuelto().

export type Branding = {
  appName: string;
  appShortName: string;
  appDescription: string;
  tagline: string;
  /** URL del logo (vacío = usar monograma SVG generado a partir de las iniciales). */
  logoUrl: string;
  /** URL pública de la app (sin barra final). Reemplaza el dominio antes hardcodeado. */
  appUrl: string;
  /** Nombre del vendedor que se inserta en descripciones/atributos de marketplace. */
  mlSellerName: string;
  themeColor: string;
  colorPrimary: string;
  colorAccent: string;
  colorBgDark: string;
  colorBgLight: string;
};

// Defaults NEUTROS (no es una marca comercial; se cambian por env o en el wizard /setup).
export const BRANDING_DEFAULT: Branding = {
  appName: "Taller 3D",
  appShortName: "Taller 3D",
  appDescription: "Catálogo, costeo y publicación para impresión 3D.",
  tagline: "Catálogo y costeo de impresión 3D",
  logoUrl: "",
  appUrl: "http://localhost:3000",
  mlSellerName: "Taller 3D",
  themeColor: "#0f172a",
  colorPrimary: "#0891b2", // cyan-600
  colorAccent: "#22d3ee", // cyan-400
  colorBgDark: "#020617", // slate-950
  colorBgLight: "#f1f5f9", // slate-100
};

function desdeEnv(): Partial<Branding> {
  const e = process.env;
  const appUrl = (e.NEXT_PUBLIC_APP_URL || e.APP_URL || "").replace(/\/+$/, "");
  const out: Partial<Branding> = {};
  if (e.BRAND_NAME) out.appName = e.BRAND_NAME;
  if (e.BRAND_SHORT_NAME) out.appShortName = e.BRAND_SHORT_NAME;
  if (e.BRAND_DESCRIPTION) out.appDescription = e.BRAND_DESCRIPTION;
  if (e.BRAND_TAGLINE) out.tagline = e.BRAND_TAGLINE;
  if (e.BRAND_LOGO_URL) out.logoUrl = e.BRAND_LOGO_URL;
  if (appUrl) out.appUrl = appUrl;
  if (e.BRAND_ML_SELLER_NAME) out.mlSellerName = e.BRAND_ML_SELLER_NAME;
  if (e.BRAND_THEME_COLOR) out.themeColor = e.BRAND_THEME_COLOR;
  if (e.BRAND_COLOR_PRIMARY) out.colorPrimary = e.BRAND_COLOR_PRIMARY;
  if (e.BRAND_COLOR_ACCENT) out.colorAccent = e.BRAND_COLOR_ACCENT;
  if (e.BRAND_COLOR_BG_DARK) out.colorBgDark = e.BRAND_COLOR_BG_DARK;
  if (e.BRAND_COLOR_BG_LIGHT) out.colorBgLight = e.BRAND_COLOR_BG_LIGHT;
  return out;
}

/** Combina capas de branding, ignorando valores vacíos del override. */
export function mergeBranding(base: Branding, override?: Partial<Branding> | null): Branding {
  if (!override) return base;
  const out = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (v !== undefined && v !== null && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

// `iniciales` vive en ./iniciales (módulo puro) para que componentes cliente puedan usarlo
// sin arrastrar este módulo (que toca la DB vía getBrandingResuelto).
export { iniciales } from "./iniciales";

/** Branding del shell estático: defaults + env. Sin acceso a base de datos (seguro en build). */
export function getBranding(): Branding {
  return mergeBranding(BRANDING_DEFAULT, desdeEnv());
}

/**
 * Branding resuelto en runtime: defaults + env + override en DB (Config.branding).
 * Es lo que permite el white-label SIN redeploy (lo edita el wizard /setup y /config).
 * Si la DB no está disponible (p.ej. en build), cae a getBranding() sin fallar.
 * El import de ./datos es dinámico a propósito: así getBranding() (shell estático) nunca
 * carga el cliente Prisma.
 */
export async function getBrandingResuelto(): Promise<Branding> {
  const base = getBranding();
  try {
    const { getConfig } = await import("./datos");
    const cfg = await getConfig();
    const override = (cfg.branding ?? null) as Partial<Branding> | null;
    return mergeBranding(base, override);
  } catch {
    return base;
  }
}

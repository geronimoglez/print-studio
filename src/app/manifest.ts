import type { MetadataRoute } from "next";
import { getBrandingResuelto } from "@/lib/branding";

// PWA: hace la app "instalable" (Agregar a pantalla de inicio). Sin offline.
// El nombre/colores salen del branding (DB → env → defaults). El icono usa el logo de la marca si
// existe, con fallback a /icon.png (reemplazar por uno neutro antes de publicar el repo).
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const b = await getBrandingResuelto();
  // Logo de la marca si existe; si no, el ícono neutro por defecto (src/app/icon.svg).
  const icon = b.logoUrl || "/icon.svg";
  const esSvg = icon.endsWith(".svg");
  return {
    name: b.appName,
    short_name: b.appShortName,
    description: b.appDescription,
    start_url: "/",
    display: "standalone",
    background_color: b.colorBgDark,
    theme_color: b.themeColor,
    icons: esSvg
      ? [{ src: icon, sizes: "any", type: "image/svg+xml" }]
      : [
          { src: icon, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: icon, sizes: "512x512", type: "image/png", purpose: "any" },
          { src: icon, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
  };
}

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Externalizar el cliente de Postgres para que no se empaquete (se carga en el server).
  serverExternalPackages: ["@prisma/adapter-pg", "pg"],
  images: {
    // Renders propios viven en Vercel Blob (subdominio aleatorio) y algunas fotos vienen del CDN de ML.
    remotePatterns: [
      { protocol: "https", hostname: "**.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "http2.mlstatic.com" },
    ],
  },
};

export default withNextIntl(nextConfig);

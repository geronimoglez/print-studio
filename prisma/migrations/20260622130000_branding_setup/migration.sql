-- White-label y preferencias en Config (Fase 1D / i18n).
-- Columnas aditivas y nullable/con default: seguras en Postgres (no reescriben filas, no bloquean).
ALTER TABLE "Config" ADD COLUMN "branding" JSONB,
ADD COLUMN "setupCompletado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "localeUi" TEXT NOT NULL DEFAULT 'es',
ADD COLUMN "localeContenido" TEXT NOT NULL DEFAULT 'es-MX',
ADD COLUMN "monedaNegocio" TEXT NOT NULL DEFAULT 'MXN';

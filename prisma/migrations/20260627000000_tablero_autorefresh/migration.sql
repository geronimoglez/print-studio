-- Tablero: auto-refresco opcional (pantalla de pared). Apagado por defecto porque mantener
-- la BD activa puede aumentar su consumo. Idempotente (IF NOT EXISTS) para DBs ya existentes.
ALTER TABLE "Config"
  ADD COLUMN IF NOT EXISTS "tableroAutoRefresh" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "tableroAutoRefreshSegundos" INTEGER NOT NULL DEFAULT 300;

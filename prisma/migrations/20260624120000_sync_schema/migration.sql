-- Sincroniza el esquema con schema.prisma: columnas y tablas que se habían añadido vía `db push`
-- sin migración (por eso un `migrate deploy` en una DB nueva fallaba con ColumnNotFound).
-- Idempotente (IF NOT EXISTS) para ser seguro también en despliegues que ya tienen estas columnas.

-- AlterTable: columnas faltantes en Modelo
ALTER TABLE "Modelo"
  ADD COLUMN IF NOT EXISTS "marcaIp" TEXT NOT NULL DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS "mlSubEstado" TEXT,
  ADD COLUMN IF NOT EXISTS "mlEstado" TEXT,
  ADD COLUMN IF NOT EXISTS "mlEstadoAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mlPermalink" TEXT,
  ADD COLUMN IF NOT EXISTS "mlCatalogProductId" TEXT,
  ADD COLUMN IF NOT EXISTS "videoYoutubeId" TEXT,
  ADD COLUMN IF NOT EXISTS "altoCm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "anchoCm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "largoCm" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "mlMotivo" TEXT,
  ADD COLUMN IF NOT EXISTS "mlMotivoAt" TIMESTAMP(3);

-- CreateTable: AvisoCorreo
CREATE TABLE IF NOT EXISTS "AvisoCorreo" (
    "id" TEXT NOT NULL,
    "de" TEXT,
    "paraEmail" TEXT,
    "asunto" TEXT NOT NULL,
    "motivo" TEXT,
    "tipo" TEXT DEFAULT 'otro',
    "mlItemId" TEXT,
    "modeloId" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvisoCorreo_pkey" PRIMARY KEY ("id")
);

-- CreateTable: NotificacionDestino
CREATE TABLE IF NOT EXISTS "NotificacionDestino" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "etiqueta" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'adicional',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nota" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificacionDestino_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "AvisoCorreo_recibidoEn_idx" ON "AvisoCorreo"("recibidoEn");
CREATE UNIQUE INDEX IF NOT EXISTS "NotificacionDestino_email_key" ON "NotificacionDestino"("email");

-- Foreign key (idempotente)
DO $$ BEGIN
  ALTER TABLE "AvisoCorreo" ADD CONSTRAINT "AvisoCorreo_modeloId_fkey"
    FOREIGN KEY ("modeloId") REFERENCES "Modelo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

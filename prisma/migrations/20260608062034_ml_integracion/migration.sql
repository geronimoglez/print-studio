-- CreateTable
CREATE TABLE "Integracion" (
    "id" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "mlUserId" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiraEn" TIMESTAMP(3),
    "conectadoEn" TIMESTAMP(3),
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notificacion" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "mlUserId" TEXT,
    "recibidoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "payload" TEXT NOT NULL,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Integracion_proveedor_key" ON "Integracion"("proveedor");

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "modeloNombre" TEXT NOT NULL,
    "tiempoImpresionMin" INTEGER NOT NULL DEFAULT 120,
    "estado" TEXT NOT NULL DEFAULT 'Vendido',
    "fechaVenta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaLimite" TIMESTAMP(3),
    "clienteAtendido" BOOLEAN NOT NULL DEFAULT false,
    "mlOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

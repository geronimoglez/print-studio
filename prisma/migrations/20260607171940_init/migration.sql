-- CreateTable
CREATE TABLE "Modelo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fuente" TEXT NOT NULL DEFAULT 'Propio',
    "urlFuente" TEXT,
    "creador" TEXT,
    "licencia" TEXT NOT NULL DEFAULT 'Propia',
    "categoria" TEXT NOT NULL DEFAULT 'Otro',
    "nicho" TEXT,
    "tiempoImpresionMin" INTEGER NOT NULL,
    "gramosFilamento" DOUBLE PRECISION NOT NULL,
    "tipoFilamento" TEXT NOT NULL DEFAULT 'PLA',
    "multicolorAms" BOOLEAN NOT NULL DEFAULT false,
    "requiereSoportes" BOOLEAN NOT NULL DEFAULT false,
    "dificultad" TEXT NOT NULL DEFAULT 'Media',
    "tiempoOperacionMin" INTEGER NOT NULL DEFAULT 20,
    "costoPostproceso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoLicencia" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "popularidad" INTEGER,
    "impresoraId" TEXT,
    "estadoValidacion" TEXT NOT NULL DEFAULT 'Pendiente',
    "publicadoMl" BOOLEAN NOT NULL DEFAULT false,
    "mlItemId" TEXT,
    "archivoUrl" TEXT,
    "archivoTipo" TEXT,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Modelo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filamento" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "color" TEXT,
    "costoPorKg" DOUBLE PRECISION NOT NULL,
    "densidad" DOUBLE PRECISION DEFAULT 1.24,
    "stockGramos" DOUBLE PRECISION DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Filamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Impresora" (
    "id" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "potenciaW" DOUBLE PRECISION NOT NULL,
    "horasUso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costoEquipo" DOUBLE PRECISION NOT NULL,
    "depreciacionPorHora" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "disponible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Impresora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venta" (
    "id" TEXT NOT NULL,
    "mlItemId" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "precio" DOUBLE PRECISION NOT NULL,
    "visitas" INTEGER DEFAULT 0,

    CONSTRAINT "Venta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "tarifaKwh" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "comisionMlPct" DOUBLE PRECISION NOT NULL DEFAULT 0.14,
    "costoEnvio" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "tasaFallos" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "costoHoraManoObra" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "markup" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
    "costoPorKgDefault" DOUBLE PRECISION NOT NULL DEFAULT 330,
    "potenciaWDefault" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "depreciacionPorHora" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "horasProductivasDia" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "tiempoColaHoras" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "diasEnvio" INTEGER NOT NULL DEFAULT 3,
    "colchonDias" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Modelo" ADD CONSTRAINT "Modelo_impresoraId_fkey" FOREIGN KEY ("impresoraId") REFERENCES "Impresora"("id") ON DELETE SET NULL ON UPDATE CASCADE;

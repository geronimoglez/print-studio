-- AlterTable
ALTER TABLE "Modelo" ADD COLUMN     "descripcionMl" TEXT,
ADD COLUMN     "imagenes" TEXT[],
ADD COLUMN     "mlCategoriaId" TEXT,
ADD COLUMN     "mlListingType" TEXT;

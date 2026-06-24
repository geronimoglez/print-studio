import { prisma } from "@/lib/prisma";
import { crearModelo } from "@/app/actions";
import { ModeloForm } from "../ModeloForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NuevoModelo() {
  const impresoras = await prisma.impresora.findMany({ orderBy: { modelo: "asc" } });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo modelo</h1>
      <Card>
        <ModeloForm action={crearModelo} impresoras={impresoras} submitLabel="Crear modelo" />
      </Card>
    </div>
  );
}

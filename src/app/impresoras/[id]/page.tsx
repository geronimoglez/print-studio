import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarImpresora } from "@/app/actions";
import { ImpresoraForm } from "../ImpresoraForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditarImpresora({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const impresora = await prisma.impresora.findUnique({ where: { id } });
  if (!impresora) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Editar impresora</h1>
      <Card>
        <ImpresoraForm action={actualizarImpresora} impresora={impresora} submitLabel="Guardar cambios" />
      </Card>
    </div>
  );
}

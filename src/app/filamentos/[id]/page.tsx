import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { actualizarFilamento } from "@/app/actions";
import { FilamentoForm } from "../FilamentoForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditarFilamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filamento = await prisma.filamento.findUnique({ where: { id } });
  if (!filamento) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Editar filamento</h1>
      <Card>
        <FilamentoForm action={actualizarFilamento} filamento={filamento} submitLabel="Guardar cambios" />
      </Card>
    </div>
  );
}

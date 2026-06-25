import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { actualizarFilamento } from "@/app/actions";
import { FilamentoForm } from "../FilamentoForm";
import { Card } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

export default async function EditarFilamento({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("filamentoDetalle");
  const { id } = await params;
  const filamento = await prisma.filamento.findUnique({ where: { id } });
  if (!filamento) notFound();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-[20px] text-brand">
          <Icon name="box" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-slate-500">{t("subtitulo")}</p>
        </div>
      </div>

      <Card>
        <FilamentoForm action={actualizarFilamento} filamento={filamento} submitLabel={t("guardarCambios")} />
      </Card>
    </div>
  );
}

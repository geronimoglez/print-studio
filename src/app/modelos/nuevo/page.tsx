import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { crearModelo } from "@/app/actions";
import { ModeloForm } from "../ModeloForm";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NuevoModelo() {
  const t = await getTranslations("modeloNuevo");
  const impresoras = await prisma.impresora.findMany({ orderBy: { modelo: "asc" } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>
      <Card>
        <ModeloForm action={crearModelo} impresoras={impresoras} submitLabel={t("crear")} />
      </Card>
    </div>
  );
}

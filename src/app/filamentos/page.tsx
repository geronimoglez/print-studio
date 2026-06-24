import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { crearFilamento, eliminarFilamento } from "@/app/actions";
import { mxn } from "@/lib/format";
import { Card, EstadoVacio } from "@/components/ui";
import { FilamentoForm } from "./FilamentoForm";

export const dynamic = "force-dynamic";

export default async function FilamentosPage() {
  const t = await getTranslations("filamentos");
  const filamentos = await prisma.filamento.findMany({ orderBy: { tipo: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">{t("colTipo")}</th>
                <th className="px-3 py-2.5">{t("colMarca")}</th>
                <th className="px-3 py-2.5">{t("colColor")}</th>
                <th className="px-3 py-2.5 text-right">{t("colCostoKg")}</th>
                <th className="px-3 py-2.5 text-right">{t("colStock")}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filamentos.map((f) => (
                <tr key={f.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium">{f.tipo}</td>
                  <td className="px-3 py-2.5 text-slate-600">{f.marca ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-600">{f.color ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{mxn(f.costoPorKg)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{f.stockGramos ?? 0}</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/filamentos/${f.id}`} className="text-brand hover:underline">
                        {t("editar")}
                      </Link>
                      <form action={eliminarFilamento}>
                        <input type="hidden" name="id" defaultValue={f.id} />
                        <button type="submit" className="text-rose-700 hover:underline">
                          {t("eliminar")}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
              {filamentos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-2">
                    <EstadoVacio icon="box">{t("vacio")}</EstadoVacio>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={t("agregarTitulo")}>
        <FilamentoForm action={crearFilamento} submitLabel={t("agregarBoton")} />
      </Card>
    </div>
  );
}

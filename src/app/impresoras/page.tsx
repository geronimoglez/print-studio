import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/datos";
import { crearImpresora, eliminarImpresora } from "@/app/actions";
import { calcularCapacidad } from "@/lib/capacidad";
import { mxn } from "@/lib/format";
import { Badge, Card, Kpi, EstadoVacio } from "@/components/ui";
import { ImpresoraForm } from "./ImpresoraForm";

export const dynamic = "force-dynamic";

export default async function ImpresorasPage() {
  const t = await getTranslations("impresoras");
  await getLocale();
  const [impresoras, config] = await Promise.all([
    prisma.impresora.findMany({ orderBy: { modelo: "asc" } }),
    getConfig(),
  ]);
  const cap = calcularCapacidad(impresoras, config);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      {/* Capacidad */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon="printer" valor={cap.horasDiaTotal} label={t("kpi.horasDiaTotal")} tone="sky" />
        <Kpi
          icon="box"
          valor={
            <>
              {cap.numDisponibles}
              <span className="text-base font-normal text-slate-400">/{cap.numTotal}</span>
            </>
          }
          label={t("kpi.disponibles")}
          tone="emerald"
        />
        <Kpi icon="sparkles" valor={cap.horasDiaAms} label={t("kpi.horasDiaAms")} tone="amber" />
        <Kpi icon="check" valor={cap.horasDiaSinAms} label={t("kpi.horasDiaSinAms")} tone="slate" />
      </div>
      <p className="text-xs text-slate-500">
        {t("notaCapacidad", { horas: config.horasProductivasDia })}
      </p>

      <Card title={t("listaTitulo")} className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2.5">{t("colModelo")}</th>
                <th className="px-3 py-2.5 text-right">{t("colPotencia")}</th>
                <th className="px-3 py-2.5 text-right">{t("colCostoEquipo")}</th>
                <th className="px-3 py-2.5 text-right">{t("colDepreciacion")}</th>
                <th className="px-3 py-2.5 text-right">{t("colHorasUso")}</th>
                <th className="px-3 py-2.5">{t("colEstado")}</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {impresoras.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-2.5 font-medium">{p.modelo}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.potenciaW}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{mxn(p.costoEquipo)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{mxn(p.depreciacionPorHora)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.horasUso}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={p.disponible ? "green" : "slate"}>
                      {p.disponible ? t("disponible") : t("noDisponible")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/impresoras/${p.id}`} className="font-medium text-brand hover:underline">
                        {t("editar")}
                      </Link>
                      <form action={eliminarImpresora}>
                        <input type="hidden" name="id" defaultValue={p.id} />
                        <button type="submit" className="font-medium text-rose-700 hover:underline">
                          {t("eliminar")}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {impresoras.length === 0 && <EstadoVacio icon="printer">{t("vacio")}</EstadoVacio>}
        </div>
      </Card>

      <Card title={t("agregarTitulo")}>
        <ImpresoraForm action={crearImpresora} submitLabel={t("agregar")} />
      </Card>
    </div>
  );
}

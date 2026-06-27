import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getConfig } from "@/lib/datos";
import { prisma } from "@/lib/prisma";
import { guardarConfig } from "@/app/actions";
import { Campo, Card, btnPrimary, btnGhost, inputClass } from "@/components/ui";
import { GestionDatos } from "./GestionDatos";

export const dynamic = "force-dynamic";

export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const t = await getTranslations("config");
  const c = await getConfig();
  const ok = (await searchParams).ok === "1";
  const [totalModelos, totalVentas] = await Promise.all([
    prisma.modelo.count(),
    prisma.venta.count(),
  ]);

  const numInput = (name: string, value: number, step = "0.01") => (
    <input name={name} type="number" step={step} defaultValue={value} className={inputClass} />
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      <Card title={t("marcaTitulo")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">{t("marcaDesc")}</p>
          <Link href="/setup" className={btnGhost}>
            {t("editarMarca")}
          </Link>
        </div>
      </Card>

      {ok && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("guardadoOk")}
        </div>
      )}

      <Card>
        <form action={guardarConfig} className="space-y-6">
          <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-slate-600">{t("grupoPrecios")}</legend>
            <Campo label={t("campos.markup")} hint={t("campos.markupHint")}>
              {numInput("markup", c.markup, "0.1")}
            </Campo>
            <Campo label={t("campos.comision")} hint={t("campos.comisionHint")}>
              {numInput("comisionMlPct", c.comisionMlPct, "0.01")}
            </Campo>
            <Campo label={t("campos.envio")}>{numInput("costoEnvio", c.costoEnvio)}</Campo>
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-slate-600">{t("grupoProduccion")}</legend>
            <Campo label={t("campos.tarifaKwh")} hint={t("campos.tarifaKwhHint")}>
              {numInput("tarifaKwh", c.tarifaKwh, "0.1")}
            </Campo>
            <Campo label={t("campos.tasaFallos")} hint={t("campos.tasaFallosHint")}>
              {numInput("tasaFallos", c.tasaFallos, "0.01")}
            </Campo>
            <Campo label={t("campos.manoObra")}>
              {numInput("costoHoraManoObra", c.costoHoraManoObra, "1")}
            </Campo>
            <Campo label={t("campos.costoFilamento")} hint={t("campos.costoFilamentoHint")}>
              {numInput("costoPorKgDefault", c.costoPorKgDefault, "1")}
            </Campo>
            <Campo label={t("campos.potencia")} hint={t("campos.potenciaHint")}>
              {numInput("potenciaWDefault", c.potenciaWDefault, "1")}
            </Campo>
            <Campo label={t("campos.depreciacion")}>
              {numInput("depreciacionPorHora", c.depreciacionPorHora, "0.1")}
            </Campo>
          </fieldset>

          <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <legend className="mb-2 text-sm font-semibold text-slate-600">{t("grupoEntrega")}</legend>
            <Campo label={t("campos.horasDia")}>
              {numInput("horasProductivasDia", c.horasProductivasDia, "0.5")}
            </Campo>
            <Campo label={t("campos.tiempoCola")}>
              {numInput("tiempoColaHoras", c.tiempoColaHoras, "0.5")}
            </Campo>
            <Campo label={t("campos.diasEnvio")}>{numInput("diasEnvio", c.diasEnvio, "1")}</Campo>
            <Campo label={t("campos.colchon")}>{numInput("colchonDias", c.colchonDias, "1")}</Campo>
          </fieldset>

          <fieldset className="space-y-3 border-t border-slate-100 pt-4">
            <legend className="mb-1 text-sm font-semibold text-slate-600">{t("tableroTitulo")}</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="tableroAutoRefresh" defaultChecked={c.tableroAutoRefresh} />
              {t("tableroAuto")}
            </label>
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <span>{t("tableroCada")}</span>
              <select
                name="tableroAutoRefreshSegundos"
                defaultValue={c.tableroAutoRefreshSegundos}
                className={inputClass + " w-auto"}
              >
                <option value={300}>5 min</option>
                <option value={900}>15 min</option>
                <option value={1800}>30 min</option>
                <option value={3600}>1 h</option>
              </select>
            </div>
            <p className="text-xs text-amber-700">{t("tableroAutoNota")}</p>
          </fieldset>

          <button type="submit" className={btnPrimary}>
            {t("guardar")}
          </button>
        </form>
      </Card>

      <GestionDatos totalModelos={totalModelos} totalVentas={totalVentas} />
    </div>
  );
}

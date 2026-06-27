import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/datos";
import { calcularTableros, type Color } from "@/lib/semaforo";
import { AutoRefresh } from "./AutoRefresh";

export const dynamic = "force-dynamic";

const BG: Record<Color, string> = {
  verde: "bg-emerald-600",
  amarillo: "bg-amber-500",
  rojo: "bg-rose-600",
};

export default async function TableroPage() {
  const t = await getTranslations("tablero");
  const [pedidos, impresoras, config] = await Promise.all([
    prisma.pedido.findMany(),
    prisma.impresora.findMany(),
    getConfig(),
  ]);
  const tableros = calcularTableros(pedidos, impresoras, config);

  const etiqueta: Record<Color, string> = {
    verde: t("etiqueta.verde"),
    amarillo: t("etiqueta.amarillo"),
    rojo: t("etiqueta.rojo"),
  };

  return (
    <div className="space-y-5">
      {config.tableroAutoRefresh && <AutoRefresh segundos={config.tableroAutoRefreshSegundos} />}

      {/* Estado global */}
      <div
        className={`rounded-2xl ${BG[tableros.global]} px-6 py-4 text-center text-white shadow-sm`}
      >
        <div className="text-sm font-medium uppercase tracking-wide opacity-90">
          {t("estadoGeneral")}
        </div>
        <div className="text-2xl font-bold">{etiqueta[tableros.global]}</div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Impresión */}
        <div className={`rounded-2xl ${BG[tableros.impresion.color]} p-6 text-white shadow-md`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("impresionTitulo")}</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase">
              {tableros.impresion.color}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-7xl font-black leading-none tabular-nums">
              {tableros.impresion.porImprimir}
            </span>
            <span className="mb-2 text-lg opacity-90">{t("porImprimir")}</span>
          </div>
          <div className="mt-3 text-sm opacity-90">
            {t("impresionResumen", {
              enProceso: tableros.impresion.enProceso,
              horasRequeridas: tableros.impresion.horasRequeridas,
              capacidad: tableros.impresion.capacidadHorizonte,
              dias: tableros.impresion.horizonteDias,
            })}
          </div>
          {tableros.impresion.impresorasFaltantes > 0 && (
            <div className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold">
              {t("faltanImpresoras", { n: tableros.impresion.impresorasFaltantes })}
            </div>
          )}
          <p className="mt-4 text-base font-medium">{tableros.impresion.mensaje}</p>
        </div>

        {/* Clientes */}
        <div className={`rounded-2xl ${BG[tableros.clientes.color]} p-6 text-white shadow-md`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("clientesTitulo")}</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase">
              {tableros.clientes.color}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-7xl font-black leading-none tabular-nums">
              {tableros.clientes.pendientes}
            </span>
            <span className="mb-2 text-lg opacity-90">{t("porAtender")}</span>
          </div>
          <div className="mt-3 text-sm opacity-90">
            {t("urgentes", { n: tableros.clientes.urgentes })}
          </div>
          <p className="mt-4 text-base font-medium">{tableros.clientes.mensaje}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        {t("ayuda")}{" "}
        <code className="rounded bg-slate-100 px-1">/api/estado?formato=hex</code>{" "}
        {t("ayudaCola")}
      </p>
    </div>
  );
}

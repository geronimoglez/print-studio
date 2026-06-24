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
const ETIQUETA: Record<Color, string> = {
  verde: "VERDE · sin prisa",
  amarillo: "AMARILLO · a moverse",
  rojo: "ROJO · actuar ya",
};

export default async function TableroPage() {
  const [pedidos, impresoras, config] = await Promise.all([
    prisma.pedido.findMany(),
    prisma.impresora.findMany(),
    getConfig(),
  ]);
  const t = calcularTableros(pedidos, impresoras, config);

  return (
    <div className="space-y-5">
      <AutoRefresh />

      {/* Estado global */}
      <div className={`rounded-2xl ${BG[t.global]} px-6 py-4 text-center text-white shadow-sm`}>
        <div className="text-sm font-medium uppercase tracking-wide opacity-90">Estado general</div>
        <div className="text-2xl font-bold">{ETIQUETA[t.global]}</div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Impresión */}
        <div className={`rounded-2xl ${BG[t.impresion.color]} p-6 text-white shadow-md`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🖨️ Impresión</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase">
              {t.impresion.color}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-7xl font-black leading-none tabular-nums">
              {t.impresion.porImprimir}
            </span>
            <span className="mb-2 text-lg opacity-90">por imprimir</span>
          </div>
          <div className="mt-3 text-sm opacity-90">
            {t.impresion.enProceso} en proceso · {t.impresion.horasRequeridas} h requeridas /{" "}
            {t.impresion.capacidadHorizonte} h disponibles ({t.impresion.horizonteDias} días)
          </div>
          {t.impresion.impresorasFaltantes > 0 && (
            <div className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1.5 text-sm font-semibold">
              ⚠️ Falta(n) {t.impresion.impresorasFaltantes} impresora(s)
            </div>
          )}
          <p className="mt-4 text-base font-medium">{t.impresion.mensaje}</p>
        </div>

        {/* Clientes */}
        <div className={`rounded-2xl ${BG[t.clientes.color]} p-6 text-white shadow-md`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">🙋 Clientes</h2>
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium uppercase">
              {t.clientes.color}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-7xl font-black leading-none tabular-nums">
              {t.clientes.pendientes}
            </span>
            <span className="mb-2 text-lg opacity-90">por atender</span>
          </div>
          <div className="mt-3 text-sm opacity-90">{t.clientes.urgentes} urgente(s)</div>
          <p className="mt-4 text-base font-medium">{t.clientes.mensaje}</p>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Verde = vas a tiempo (aunque tengas varios). Amarillo = hay que moverse. Rojo = actuar ya. Se
        actualiza solo. Para foco/pantalla inteligente:{" "}
        <code className="rounded bg-slate-100 px-1">/api/estado?formato=hex</code> devuelve el color.
      </p>
    </div>
  );
}

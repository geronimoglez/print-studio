import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/datos";
import { crearImpresora, eliminarImpresora } from "@/app/actions";
import { calcularCapacidad } from "@/lib/capacidad";
import { mxn } from "@/lib/format";
import { Badge, Card } from "@/components/ui";
import { ImpresoraForm } from "./ImpresoraForm";

export const dynamic = "force-dynamic";

export default async function ImpresorasPage() {
  const [impresoras, config] = await Promise.all([
    prisma.impresora.findMany({ orderBy: { modelo: "asc" } }),
    getConfig(),
  ]);
  const cap = calcularCapacidad(impresoras, config);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Impresoras</h1>
        <p className="text-sm text-slate-500">
          Potencia y depreciación alimentan el costeo; la capacidad decide cuándo comprar más máquinas.
        </p>
      </div>

      {/* Capacidad */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card className="border-t-4 border-cyan-400">
          <div className="text-3xl font-bold tabular-nums text-cyan-600">{cap.horasDiaTotal}</div>
          <div className="mt-1 text-xs text-slate-500">horas-impresora / día</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold tabular-nums">
            {cap.numDisponibles}
            <span className="text-base font-normal text-slate-400">/{cap.numTotal}</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">impresoras disponibles</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold tabular-nums">{cap.horasDiaAms}</div>
          <div className="mt-1 text-xs text-slate-500">h/día con AMS (multicolor)</div>
        </Card>
        <Card>
          <div className="text-3xl font-bold tabular-nums">{cap.horasDiaSinAms}</div>
          <div className="mt-1 text-xs text-slate-500">h/día sin AMS</div>
        </Card>
      </div>
      <p className="text-xs text-slate-500">
        Capacidad = impresoras disponibles × {config.horasProductivasDia} h/día (de Configuración). En
        la Fase D se cruza con la demanda pronosticada para avisarte cuándo conviene comprar otra
        impresora.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Modelo</th>
              <th className="px-3 py-2.5 text-right">Potencia (W)</th>
              <th className="px-3 py-2.5 text-right">Costo equipo</th>
              <th className="px-3 py-2.5 text-right">Deprec./h</th>
              <th className="px-3 py-2.5 text-right">Horas uso</th>
              <th className="px-3 py-2.5">Estado</th>
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
                    {p.disponible ? "Disponible" : "No disponible"}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/impresoras/${p.id}`} className="text-cyan-700 hover:underline">
                      Editar
                    </Link>
                    <form action={eliminarImpresora}>
                      <input type="hidden" name="id" defaultValue={p.id} />
                      <button type="submit" className="text-rose-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {impresoras.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                  Sin impresoras.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card title="Agregar impresora">
        <ImpresoraForm action={crearImpresora} submitLabel="Agregar" />
      </Card>
    </div>
  );
}

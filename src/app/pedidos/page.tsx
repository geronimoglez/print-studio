import { prisma } from "@/lib/prisma";
import { avanzarPedido, marcarAtendido } from "@/app/actions";
import { Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const PIPELINE = ["Vendido", "EnCola", "Imprimiendo", "Impreso", "Entregado"] as const;
const ETIQUETA: Record<string, string> = {
  Vendido: "Mandar a imprimir",
  EnCola: "En cola",
  Imprimiendo: "Imprimiendo",
  Impreso: "Impreso",
  Entregado: "Entregado",
};
function tono(estado: string): "amber" | "blue" | "green" | "slate" {
  if (estado === "Vendido") return "amber";
  if (estado === "EnCola" || estado === "Imprimiendo") return "blue";
  if (estado === "Impreso") return "green";
  if (estado === "Entregado") return "slate";
  return "slate";
}

export default async function PedidosPage() {
  const pedidos = await prisma.pedido.findMany({ orderBy: { fechaVenta: "desc" } });
  const activos = pedidos.filter((p) => p.estado !== "Entregado");
  const ordenados = [...activos, ...pedidos.filter((p) => p.estado === "Entregado")];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
        <p className="text-sm text-slate-500">
          {activos.length} activo(s) · {pedidos.length} en total. Avanza el estado conforme imprimes y
          entregas; el tablero se actualiza solo.
        </p>
      </div>

      {pedidos.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-500">
            Aún no hay pedidos. Entran solos al sincronizar las ventas de Mercado Libre.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {ordenados.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[200px]">
                  <div className="font-medium text-slate-900">{p.modeloNombre}</div>
                  <div className="text-xs text-slate-400">
                    Vendido {p.fechaVenta.toLocaleDateString("es-MX")}
                    {p.fechaLimite ? ` · entregar antes del ${p.fechaLimite.toLocaleDateString("es-MX")}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={tono(p.estado)}>{p.estado}</Badge>
                  {p.clienteAtendido ? (
                    <Badge tone="green">Cliente atendido</Badge>
                  ) : (
                    <Badge tone="amber">Sin atender</Badge>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {PIPELINE.map((e) => (
                  <form key={e} action={avanzarPedido}>
                    <input type="hidden" name="id" defaultValue={p.id} />
                    <input type="hidden" name="estado" defaultValue={e} />
                    <button
                      type="submit"
                      disabled={p.estado === e}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                        p.estado === e
                          ? "bg-slate-900 text-white"
                          : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                      } disabled:cursor-default`}
                    >
                      {ETIQUETA[e]}
                    </button>
                  </form>
                ))}
                {!p.clienteAtendido && (
                  <form action={marcarAtendido}>
                    <input type="hidden" name="id" defaultValue={p.id} />
                    <button type="submit" className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                      ✓ Marcar atendido
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

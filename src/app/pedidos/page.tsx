import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { avanzarPedido, marcarAtendido } from "@/app/actions";
import { Badge, Card, Kpi, EstadoVacio } from "@/components/ui";

export const dynamic = "force-dynamic";

const PIPELINE = ["Vendido", "EnCola", "Imprimiendo", "Impreso", "Entregado"] as const;

function tono(estado: string): "amber" | "blue" | "green" | "slate" {
  if (estado === "Vendido") return "amber";
  if (estado === "EnCola" || estado === "Imprimiendo") return "blue";
  if (estado === "Impreso") return "green";
  if (estado === "Entregado") return "slate";
  return "slate";
}

export default async function PedidosPage() {
  const t = await getTranslations("pedidos");
  const locale = await getLocale();

  const pedidos = await prisma.pedido.findMany({ orderBy: { fechaVenta: "desc" } });
  const activos = pedidos.filter((p) => p.estado !== "Entregado");
  const ordenados = [...activos, ...pedidos.filter((p) => p.estado === "Entregado")];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Kpi icon="rocket" valor={activos.length} label={t("kpi.activos")} tone="sky" />
        <Kpi icon="box" valor={pedidos.length} label={t("kpi.total")} tone="slate" />
        <Kpi icon="check" valor={pedidos.length - activos.length} label={t("kpi.entregados")} tone="emerald" />
      </div>

      {pedidos.length === 0 ? (
        <Card>
          <EstadoVacio icon="sparkles">{t("vacio")}</EstadoVacio>
        </Card>
      ) : (
        <div className="space-y-3">
          {ordenados.map((p) => (
            <Card key={p.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-[200px]">
                  <div className="font-medium text-slate-900">{p.modeloNombre}</div>
                  <div className="text-xs text-slate-400">
                    {t("vendidoEl", { fecha: p.fechaVenta.toLocaleDateString(locale) })}
                    {p.fechaLimite
                      ? ` · ${t("entregarAntes", { fecha: p.fechaLimite.toLocaleDateString(locale) })}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={tono(p.estado)}>{t(`estado.${p.estado}`)}</Badge>
                  {p.clienteAtendido ? (
                    <Badge tone="green">{t("clienteAtendido")}</Badge>
                  ) : (
                    <Badge tone="amber">{t("sinAtender")}</Badge>
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
                      className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-default ${
                        p.estado === e
                          ? "bg-brand text-white"
                          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {t(`paso.${e}`)}
                    </button>
                  </form>
                ))}
                {!p.clienteAtendido && (
                  <form action={marcarAtendido}>
                    <input type="hidden" name="id" defaultValue={p.id} />
                    <button
                      type="submit"
                      className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700"
                    >
                      ✓ {t("marcarAtendido")}
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

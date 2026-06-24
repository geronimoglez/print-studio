import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCatalogo, getConfig } from "@/lib/datos";
import { mxn } from "@/lib/format";
import { motivoLicencia } from "@/lib/licencias";
import { Badge, Card } from "@/components/ui";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  // Primer arranque: si aún no se configuró la marca, guiar al wizard.
  // SKIP_SETUP=1 lo desactiva (p.ej. un despliegue ya en uso que migra al código nuevo, como el de Blas).
  const cfg = await getConfig();
  if (!cfg.setupCompletado && process.env.SKIP_SETUP !== "1") redirect("/setup");
  const t = await getTranslations("dashboard");
  const { filas } = await getCatalogo();

  const total = filas.length;
  const aptos = filas.filter((f) => f.apto).length;
  const listos = filas.filter(
    (f) => f.apto && f.modelo.estadoValidacion === "Validado" && !f.modelo.publicadoMl,
  ).length;
  const riesgo = filas.filter((f) => !f.apto);
  const publicados = filas.filter((f) => f.modelo.publicadoMl).length;

  const topRentables = [...filas]
    .filter((f) => f.apto)
    .sort((a, b) => b.costeo.rentabilidadHora - a.costeo.rentabilidadHora)
    .slice(0, 5);

  const kpis = [
    { id: "total", valor: total, href: "/modelos", color: "text-slate-900", borde: "border-slate-300" },
    { id: "aptos", valor: aptos, href: "/modelos?vista=todos", color: "text-emerald-600", borde: "border-emerald-400" },
    { id: "listos", valor: listos, href: "/modelos?vista=listos", color: "text-cyan-600", borde: "border-cyan-400" },
    { id: "riesgo", valor: riesgo.length, href: "/modelos?vista=riesgo", color: "text-rose-600", borde: "border-rose-400" },
    { id: "publicados", valor: publicados, href: "/modelos", color: "text-sky-600", borde: "border-sky-400" },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-slate-500">{getBranding().appDescription}</p>
        </div>
        <Link
          href="/modelos/nuevo"
          className="rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
        >
          + {t("nuevoModelo")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {kpis.map((k) => (
          <Link key={k.id} href={k.href}>
            <Card className={`border-t-4 ${k.borde} transition-shadow hover:shadow-md`}>
              <div className={`text-3xl font-bold tabular-nums ${k.color}`}>{k.valor}</div>
              <div className="mt-1 text-xs text-slate-500">{t(`kpi.${k.id}`)}</div>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={t("topTitulo")}>
          {topRentables.length === 0 ? (
            <p className="text-sm text-slate-500">{t("sinAptos")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">{t("colModelo")}</th>
                  <th className="pb-2 text-right">{t("colHora")}</th>
                  <th className="pb-2 text-right">{t("colPrecio")}</th>
                  <th className="pb-2 text-right">{t("colMargen")}</th>
                </tr>
              </thead>
              <tbody>
                {topRentables.map((f) => (
                  <tr key={f.modelo.id} className="border-t border-slate-100">
                    <td className="py-2">{f.modelo.nombre}</td>
                    <td className="py-2 text-right font-semibold tabular-nums text-emerald-700">
                      {mxn(f.costeo.rentabilidadHora)}
                    </td>
                    <td className="py-2 text-right tabular-nums">{mxn(f.costeo.precioVenta)}</td>
                    <td className="py-2 text-right tabular-nums">{f.costeo.margenPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-500">{t("topNota")}</p>
        </Card>

        <Card title={t("riesgoTitulo")}>
          {riesgo.length === 0 ? (
            <p className="text-sm text-slate-500">{t("sinRiesgo")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {riesgo.map((f) => (
                <li key={f.modelo.id} className="flex items-center justify-between gap-3">
                  <span>{f.modelo.nombre}</span>
                  <Badge tone="red" title={motivoLicencia(f.modelo.licencia)}>
                    {f.modelo.licencia}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">{t("riesgoNota")}</p>
        </Card>
      </div>
    </div>
  );
}

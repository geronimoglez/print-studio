import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getIntegracion, urlAutorizacion } from "@/lib/mercadolibre";
import { sincronizarMl } from "@/app/actions";
import { Badge, Card, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function IntegracionesPage({
  searchParams,
}: {
  searchParams: Promise<{ ml?: string }>;
}) {
  const t = await getTranslations("integraciones");
  const locale = await getLocale();
  const { ml } = await searchParams;
  const [integ, notifs, totalVentas] = await Promise.all([
    getIntegracion(),
    prisma.notificacion.findMany({ orderBy: { recibidoEn: "desc" }, take: 10 }),
    prisma.venta.count(),
  ]);
  const conectado = !!integ?.refreshToken;
  const authUrl = urlAutorizacion();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      {ml === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("okConectado")}
        </div>
      )}
      {(ml === "fail" || ml === "error") && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          {t("errorConexion")}
        </div>
      )}

      <Card title="Mercado Libre">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={conectado ? "green" : "amber"}>{conectado ? t("conectado") : t("noConectado")}</Badge>
          {conectado ? (
            <span className="text-sm text-slate-600">
              {t("vendedor", { id: integ?.mlUserId ?? "", n: totalVentas })}
            </span>
          ) : (
            <span className="text-sm text-slate-600">{t("faltaAuth")}</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!conectado && (
            <a href={authUrl} className={btnPrimary}>
              {t("conectar")}
            </a>
          )}
          {conectado && (
            <form
              action={async () => {
                "use server";
                await sincronizarMl();
              }}
            >
              <button type="submit" className={btnPrimary}>
                {t("sincronizar")}
              </button>
            </form>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {conectado ? t("notaConectado") : t("notaNoConectado")}
        </p>
      </Card>

      <Card title={t("webhooksTitulo")}>
        <p className="mb-3 text-xs text-slate-500">
          {t("webhooksDesc")} <code className="rounded bg-slate-100 px-1">/api/ml/callbacknotice</code>
        </p>
        {notifs.length === 0 ? (
          <p className="text-sm text-slate-500">{t("sinNotifs")}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">{t("colTopico")}</th>
                <th className="pb-2">{t("colRecurso")}</th>
                <th className="pb-2">{t("colRecibido")}</th>
                <th className="pb-2">{t("colEstado")}</th>
              </tr>
            </thead>
            <tbody>
              {notifs.map((n) => (
                <tr key={n.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{n.topic}</td>
                  <td className="py-2 text-slate-600">{n.resource}</td>
                  <td className="py-2 text-slate-500">{n.recibidoEn.toLocaleString(locale)}</td>
                  <td className="py-2">
                    <Badge tone={n.procesado ? "green" : "amber"}>
                      {n.procesado ? t("procesado") : t("pendiente")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

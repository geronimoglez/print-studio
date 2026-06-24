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
        <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
        <p className="text-sm text-slate-500">
          Conecta Mercado Libre para traer el histórico de ventas (alimenta el forecast) y recibir
          eventos en tiempo real.
        </p>
      </div>

      {ml === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Mercado Libre conectado.
        </div>
      )}
      {(ml === "fail" || ml === "error") && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          No se pudo conectar Mercado Libre. Revisa que el Redirect URI coincida e inténtalo de nuevo.
        </div>
      )}

      <Card title="Mercado Libre">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={conectado ? "green" : "amber"}>{conectado ? "Conectado" : "No conectado"}</Badge>
          {conectado ? (
            <span className="text-sm text-slate-600">
              Vendedor #{integ?.mlUserId} · {totalVentas} venta(s) sincronizadas
            </span>
          ) : (
            <span className="text-sm text-slate-600">
              Falta la autorización de la cuenta de Blas (un solo clic).
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!conectado && (
            <a href={authUrl} className={btnPrimary}>
              Conectar Mercado Libre
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
                Sincronizar ventas ahora
              </button>
            </form>
          )}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {conectado
            ? "El sync trae las órdenes pagadas recientes a la base, para el forecast."
            : "Abre este enlace en la sesión de Mercado Libre de Blas y autoriza la app una vez. La app puede ser tuya; él solo aprueba el acceso a su cuenta de venta."}
        </p>
      </Card>

      <Card title="Notificaciones recibidas (webhooks)">
        <p className="mb-3 text-xs text-slate-500">
          ML envía aquí cada evento (venta, mensaje, pago, envío…). Endpoint:{" "}
          <code className="rounded bg-slate-100 px-1">/api/ml/callbacknotice</code>
        </p>
        {notifs.length === 0 ? (
          <p className="text-sm text-slate-500">Sin notificaciones todavía.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-400">
                <th className="pb-2">Tópico</th>
                <th className="pb-2">Recurso</th>
                <th className="pb-2">Recibido</th>
                <th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {notifs.map((n) => (
                <tr key={n.id} className="border-t border-slate-100">
                  <td className="py-2 font-medium">{n.topic}</td>
                  <td className="py-2 text-slate-600">{n.resource}</td>
                  <td className="py-2 text-slate-500">{n.recibidoEn.toLocaleString("es-MX")}</td>
                  <td className="py-2">
                    <Badge tone={n.procesado ? "green" : "amber"}>
                      {n.procesado ? "Procesado" : "Pendiente"}
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

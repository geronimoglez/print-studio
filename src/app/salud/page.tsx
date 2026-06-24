// Panel "Salud ML": estado real de los anuncios publicados (activo / pausado / en revisión / con
// problema / sin sincronizar) + ventas. Se abre cuando hay tiempo y se maneja todo en lote, en vez
// de reaccionar a cada notificación. El estado lo sincroniza refrescarEstatusMl() (botón Refrescar).
import Link from "next/link";
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EstadoVacio, btnPrimary } from "@/components/ui";
import { refrescarEstatusMl } from "../actions";

export const dynamic = "force-dynamic";

type Cat = "problema" | "revision" | "pausado" | "activo" | "sin";
const META: Record<Cat, { emoji: string; tono: "red" | "amber" | "blue" | "green" | "slate" }> = {
  problema: { emoji: "🛑", tono: "red" },
  revision: { emoji: "🟠", tono: "amber" },
  pausado: { emoji: "⏸️", tono: "slate" },
  activo: { emoji: "🟢", tono: "green" },
  sin: { emoji: "❔", tono: "slate" },
};
const ORDEN: Cat[] = ["problema", "revision", "pausado", "activo", "sin"];

function clasificar(mlEstado: string | null, sub: string | null): Cat {
  if (!mlEstado) return "sin";
  const s = sub ?? "";
  if (mlEstado === "closed" || /forbidden|denounced/i.test(s)) return "problema";
  if (mlEstado === "paused") return "pausado";
  if (mlEstado === "under_review") return "revision";
  if (mlEstado === "active") return "activo";
  return "sin";
}

/** Devuelve la clave i18n de la explicación en lenguaje claro del sub_status
 *  (la razón fina exacta sólo la da el panel de ML). */
function razonHumanaKey(estado: string | null, sub: string | null): string | null {
  const s = (sub ?? "").toLowerCase();
  if (/forbidden/.test(s)) return "razon.forbidden";
  if (/picture_download_pending/.test(s) && /waiting_for_patch/.test(s)) return "razon.fichaYFotos";
  if (/waiting_for_patch/.test(s)) return "razon.fichaTecnica";
  if (/picture_download_pending/.test(s)) return "razon.fotos";
  if (/denounced/.test(s)) return "razon.denuncia";
  if (/out_of_stock/.test(s)) return "razon.sinStock";
  if (estado === "paused") return "razon.pausado";
  return null;
}

/** Panel de vendedor de ML donde se ve el motivo exacto del rechazo y se edita el anuncio.
 *  Ruta correcta verificada: /publicaciones/{id}/modificar (redirige al editor; pide login). */
function urlEditarMl(itemId: string | null): string | null {
  return itemId ? `https://www.mercadolibre.com.mx/publicaciones/${itemId}/modificar` : null;
}

export default async function SaludPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await getTranslations("salud");
  const locale = await getLocale();
  const q = ((await searchParams).q ?? "").trim();
  const [pubAll, pedidos] = await Promise.all([
    prisma.modelo.findMany({
      where: { publicadoMl: true, mlItemId: { not: null } },
      select: { id: true, nombre: true, mlItemId: true, mlEstado: true, mlSubEstado: true, mlEstadoAt: true, mlPermalink: true, mlMotivo: true, imagenes: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.pedido.count(),
  ]);
  const pub = q ? pubAll.filter((m) => m.nombre.toLowerCase().includes(q.toLowerCase())) : pubAll;

  const grupos: Record<Cat, typeof pub> = { problema: [], revision: [], pausado: [], activo: [], sin: [] };
  for (const m of pub) grupos[clasificar(m.mlEstado, m.mlSubEstado)].push(m);
  const ultimaSync = pubAll.map((m) => m.mlEstadoAt).filter(Boolean).sort().pop() as Date | undefined;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-slate-500">
            {t("resumen", { anuncios: pubAll.length, pedidos })}{" "}
            {ultimaSync
              ? t("ultimaSync", { fecha: new Date(ultimaSync).toLocaleString(locale) })
              : t("sinSync")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder={t("buscarPlaceholder")}
              className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {t("buscar")}
            </button>
            {q && (
              <Link href="/salud" className="text-sm text-slate-500 hover:text-slate-800">
                {t("limpiar")}
              </Link>
            )}
          </form>
          <form action={refrescarEstatusMl}>
            <button type="submit" className={btnPrimary}>
              ↻ {t("refrescar")}
            </button>
          </form>
        </div>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">{t("guia.titulo")}</summary>
        <p className="mt-3">{t.rich("guia.intro", { b: (chunks) => <b>{chunks}</b> })}</p>
        <ul className="mt-3 space-y-1.5">
          <li>{t.rich("guia.problema", { b: (chunks) => <b>{chunks}</b> })}</li>
          <li>{t.rich("guia.revision", { b: (chunks) => <b>{chunks}</b> })}</li>
          <li>{t.rich("guia.pausado", { b: (chunks) => <b>{chunks}</b> })}</li>
          <li>{t.rich("guia.activo", { b: (chunks) => <b>{chunks}</b> })}</li>
          <li>{t.rich("guia.vendidos", { b: (chunks) => <b>{chunks}</b> })}</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">{t("guia.nota")}</p>
      </details>

      {/* Resumen de un vistazo */}
      <div className="flex flex-wrap gap-2">
        {ORDEN.map((c) => (
          <span key={c} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span>{META[c].emoji}</span>
            <span className="font-medium text-slate-700">{t(`cat.${c}.titulo`)}</span>
            <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">{grupos[c].length}</span>
          </span>
        ))}
        <Link href="/pedidos" className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100">
          🛒 {t("vendidosPedidos")} <span className="rounded-full bg-white px-2 text-xs font-semibold">{pedidos}</span>
        </Link>
      </div>

      {ORDEN.filter((c) => grupos[c].length > 0).map((c) => (
        <section key={c} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {META[c].emoji} {t(`cat.${c}.titulo`)} ({grupos[c].length})
            </h2>
            <p className="text-xs text-slate-500">{t(`cat.${c}.desc`)}</p>
          </div>
          <Card className="overflow-hidden p-0">
            {grupos[c].map((m) => {
              // Preferimos el motivo REAL del correo de ML (si llegó) sobre la explicación genérica.
              const razonKey = razonHumanaKey(m.mlEstado, m.mlSubEstado);
              const razon = m.mlMotivo || (razonKey ? t(razonKey) : null);
              const editar = urlEditarMl(m.mlItemId);
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                  {m.imagenes?.[0] ? (
                    <Image src={m.imagenes[0]} alt={m.nombre} width={40} height={40} className="h-10 w-10 flex-none rounded-md border border-slate-200 object-cover" />
                  ) : (
                    <div className="h-10 w-10 flex-none rounded-md border border-dashed border-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/modelos/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand">
                      {m.nombre}
                    </Link>
                    {razon && <p className="mt-0.5 text-xs leading-snug text-slate-500">{razon}</p>}
                  </div>
                  {m.mlSubEstado ? <Badge tone={META[c].tono}>{m.mlSubEstado}</Badge> : <Badge tone={META[c].tono}>{m.mlEstado ?? "?"}</Badge>}
                  {m.mlPermalink && m.mlEstado === "active" ? (
                    <a href={m.mlPermalink} target="_blank" rel="noopener noreferrer" className="flex-none text-xs font-medium text-brand hover:underline" title={t("abrirEnMl")}>
                      ML ↗
                    </a>
                  ) : editar ? (
                    <a href={editar} target="_blank" rel="noopener noreferrer" className="flex-none text-xs font-medium text-brand hover:underline" title={t("verMotivoTitle")}>
                      {t("verMotivo")} ↗
                    </a>
                  ) : (
                    <span className="flex-none text-xs text-slate-400" title={t("noVisibleTitle")}>{t("noVisible")}</span>
                  )}
                </div>
              );
            })}
          </Card>
        </section>
      ))}

      {pub.length === 0 && (
        <Card>
          <EstadoVacio icon="printer">{t("vacio")}</EstadoVacio>
        </Card>
      )}
    </div>
  );
}

// Panel "Salud ML": estado real de los anuncios publicados (activo / pausado / en revisión / con
// problema / sin sincronizar) + ventas. Blas lo abre cuando tiene tiempo y maneja todo en lote, en vez
// de reaccionar a cada notificación. El estado lo sincroniza sincronizarEstatusMl() (botón Refrescar).
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
import { refrescarEstatusMl } from "../actions";

export const dynamic = "force-dynamic";

type Cat = "problema" | "revision" | "pausado" | "activo" | "sin";
const META: Record<Cat, { emoji: string; titulo: string; tono: "red" | "amber" | "blue" | "green" | "slate"; desc: string }> = {
  problema: { emoji: "🛑", titulo: "Con problema", tono: "red", desc: "ML los rechazó (forbidden/closed) — hay que corregir o pausar." },
  revision: { emoji: "🟠", titulo: "En revisión de ML", tono: "amber", desc: "ML los está moderando/procesando — suelen resolverse solos." },
  pausado: { emoji: "⏸️", titulo: "Pausados", tono: "slate", desc: "No visibles para vender (pausados por nosotros o por ML)." },
  activo: { emoji: "🟢", titulo: "Activos", tono: "green", desc: "Vivos y vendibles." },
  sin: { emoji: "❔", titulo: "Sin sincronizar", tono: "slate", desc: "Aún no consultamos su estado — dale a Refrescar." },
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

/** Explicación en lenguaje claro del sub_status (la razón fina exacta sólo la da el panel de ML). */
function razonHumana(estado: string | null, sub: string | null): string | null {
  const s = (sub ?? "").toLowerCase();
  if (/forbidden/.test(s))
    return "ML lo prohibió. Casi siempre es: una marca de terceros en el título, una categoría no permitida, o un anuncio casi duplicado. Ábrelo en ML para ver el motivo exacto y corregir.";
  if (/picture_download_pending/.test(s) && /waiting_for_patch/.test(s))
    return "Falta completar la ficha y ML aún está procesando las fotos. Ábrelo en ML y completa lo que pida.";
  if (/waiting_for_patch/.test(s))
    return "Falta completar la ficha técnica (un dato obligatorio de la categoría). Ábrelo en ML y completa lo que marque.";
  if (/picture_download_pending/.test(s)) return "ML aún está descargando/validando las fotos. Suele resolverse solo.";
  if (/denounced/.test(s)) return "Recibió una denuncia. Revisa el motivo en ML.";
  if (/out_of_stock/.test(s)) return "Sin stock: súbelo a 1 o más para reactivar.";
  if (estado === "paused") return "Pausado (por ti o por ML).";
  return null;
}

/** Panel de vendedor de ML donde se ve el motivo exacto del rechazo y se edita el anuncio.
 *  Ruta correcta verificada: /publicaciones/{id}/modificar (redirige al editor; pide login). */
function urlEditarMl(itemId: string | null): string | null {
  return itemId ? `https://www.mercadolibre.com.mx/publicaciones/${itemId}/modificar` : null;
}

export default async function SaludPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
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
          <h1 className="text-2xl font-bold tracking-tight">Salud de Mercado Libre</h1>
          <p className="text-sm text-slate-500">
            {pubAll.length} anuncios publicados · {pedidos} pedido(s).{" "}
            {ultimaSync ? `Última sincronización: ${new Date(ultimaSync).toLocaleString("es-MX")}.` : "Aún sin sincronizar."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar anuncio…"
              className="w-48 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <button type="submit" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Buscar
            </button>
            {q && (
              <Link href="/salud" className="text-sm text-slate-500 hover:text-slate-800">
                Limpiar
              </Link>
            )}
          </form>
          <form action={refrescarEstatusMl}>
            <button type="submit" className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700">
              ↻ Refrescar
            </button>
          </form>
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">📘 ¿Qué es esto y qué hago? (guía rápida)</summary>
        <p className="mt-3">Aquí ves cómo están tus anuncios en Mercado Libre. Ábrela cuando tengas un rato y revísalos en lote. Dale <b>“Refrescar estatus”</b> para ver lo más reciente. Toca cualquier anuncio para abrir su ficha y manejarlo.</p>
        <ul className="mt-3 space-y-1.5">
          <li>🛑 <b>Con problema:</b> Mercado Libre los rechazó. Ábrelos y corrige (a veces es una palabra de marca en el título, ej. “Durlock”) o pausa el anuncio.</li>
          <li>🟠 <b>En revisión de ML:</b> ML los está checando. Normalmente se activan solos en unas horas — <b>no hagas nada</b>, solo espera.</li>
          <li>⏸️ <b>Pausados:</b> no se están vendiendo (porque los pausaste tú o ML).</li>
          <li>🟢 <b>Activos:</b> vivos y vendibles. Todo bien.</li>
          <li>🛒 <b>Vendidos / Pedidos:</b> lo que ya se vendió — ahí ves los pedidos por imprimir y entregar.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">No tienes que estar aquí a cada rato: entra cuando tengas tiempo libre y atiende varios de una.</p>
      </details>

      {/* Resumen de un vistazo */}
      <div className="flex flex-wrap gap-2">
        {ORDEN.map((c) => (
          <span key={c} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
            <span>{META[c].emoji}</span>
            <span className="font-medium text-slate-700">{META[c].titulo}</span>
            <span className="rounded-full bg-slate-100 px-2 text-xs font-semibold text-slate-600">{grupos[c].length}</span>
          </span>
        ))}
        <Link href="/pedidos" className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-800 hover:bg-sky-100">
          🛒 Vendidos / Pedidos <span className="rounded-full bg-white px-2 text-xs font-semibold">{pedidos}</span>
        </Link>
      </div>

      {ORDEN.filter((c) => grupos[c].length > 0).map((c) => (
        <section key={c} className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">
              {META[c].emoji} {META[c].titulo} ({grupos[c].length})
            </h2>
            <p className="text-xs text-slate-500">{META[c].desc}</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {grupos[c].map((m) => {
              // Preferimos el motivo REAL del correo de ML (si llegó) sobre la explicación genérica.
              const razon = m.mlMotivo || razonHumana(m.mlEstado, m.mlSubEstado);
              const editar = urlEditarMl(m.mlItemId);
              return (
                <div key={m.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                  {m.imagenes?.[0] ? (
                    <Image src={m.imagenes[0]} alt={m.nombre} width={40} height={40} className="h-10 w-10 flex-none rounded-md border border-slate-200 object-cover" />
                  ) : (
                    <div className="h-10 w-10 flex-none rounded-md border border-dashed border-slate-300" />
                  )}
                  <div className="min-w-0 flex-1">
                    <Link href={`/modelos/${m.id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-cyan-700">
                      {m.nombre}
                    </Link>
                    {razon && <p className="mt-0.5 text-xs leading-snug text-slate-500">{razon}</p>}
                  </div>
                  {m.mlSubEstado ? <Badge tone={META[c].tono}>{m.mlSubEstado}</Badge> : <Badge tone={META[c].tono}>{m.mlEstado ?? "?"}</Badge>}
                  {m.mlPermalink && m.mlEstado === "active" ? (
                    <a href={m.mlPermalink} target="_blank" rel="noopener noreferrer" className="flex-none text-xs font-medium text-cyan-700 hover:underline" title="Abrir en Mercado Libre">
                      ML ↗
                    </a>
                  ) : editar ? (
                    <a href={editar} target="_blank" rel="noopener noreferrer" className="flex-none text-xs font-medium text-cyan-700 hover:underline" title="Abrir en Mercado Libre para ver el motivo exacto y editar el anuncio">
                      ver motivo / editar ↗
                    </a>
                  ) : (
                    <span className="flex-none text-xs text-slate-400" title="No visible en ML hasta que esté activo">no visible</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {pub.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          No hay anuncios publicados todavía.
        </div>
      )}
    </div>
  );
}

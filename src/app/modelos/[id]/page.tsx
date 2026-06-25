import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import {
  actualizarModelo,
  eliminarModelo,
  enriquecerModelo,
  agregarImagen,
  quitarImagen,
  publicarEnMl,
  actualizarEnMl,
  validarEnMl,
} from "@/app/actions";
import { previsualizarPublicacion } from "@/lib/mercadolibre";
import { mxn } from "@/lib/format";
import { ModeloForm } from "../ModeloForm";
import { Badge, Card, btnGhost, btnPrimary, inputClass } from "@/components/ui";
import { FotoThumb } from "@/components/Lightbox";
import { BuscarMakerWorld } from "./BuscarMakerWorld";
import { BuscarCatalogo } from "./BuscarCatalogo";

export const dynamic = "force-dynamic";

export default async function EditarModelo({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mw?: string; pub?: string; msg?: string; item?: string }>;
}) {
  const t = await getTranslations("modeloDetalle");
  const locale = await getLocale();
  const { id } = await params;
  const sp = await searchParams;
  const [modelo, impresoras, prev] = await Promise.all([
    prisma.modelo.findUnique({ where: { id } }),
    prisma.impresora.findMany({ orderBy: { modelo: "asc" } }),
    previsualizarPublicacion(id),
  ]);
  if (!modelo) notFound();
  const p = prev.preview;
  const puedePublicar = !!p && p.faltantes.length === 0 && !p.yaPublicado;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>

      {sp.mw === "ok" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("avisoMwOk")}
        </div>
      )}
      {sp.mw === "fail" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t("avisoMwFail")}
        </div>
      )}
      {sp.pub === "ok" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("avisoPubOk")} <strong>{sp.item}</strong>
        </div>
      )}
      {sp.pub === "upd" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("avisoPubUpd")}
        </div>
      )}
      {sp.pub === "fail" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          ✗ {sp.msg || t("avisoPubFail")}
        </div>
      )}
      {sp.pub === "val_ok" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {t("avisoValOk")}
        </div>
      )}
      {sp.pub === "val_fail" && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {t("avisoValFail", { msg: sp.msg ?? "" })}
        </div>
      )}

      {/* ---------- Publicar en Mercado Libre (copiloto) ---------- */}
      <Card title={t("publicarTitulo")}>
        {p && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-slate-500">{t("campoTitulo")}</span> <strong>{p.title}</strong>
              </div>
              <div>
                <span className="text-slate-500">{t("campoCategoria")}</span>{" "}
                {p.categoriaId ? (
                  <strong>{p.categoriaNombre ?? p.categoriaId}</strong>
                ) : (
                  <span className="text-amber-700">{t("porDeterminar")}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500">{t("campoPrecio")}</span>{" "}
                <strong className="text-emerald-700">{mxn(p.precio)}</strong>
              </div>
              <div>
                <span className="text-slate-500">{t("campoEntrega")}</span>{" "}
                {t("dias", { d: p.tiempoEntregaDias })}
              </div>
            </div>

            {/* Imágenes */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">{t("fotos", { n: p.imagenes.length })}</div>
              {p.imagenes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {p.imagenes.map((url) => (
                    <div key={url} className="relative">
                      <FotoThumb url={url} />
                      <form action={quitarImagen} className="absolute -right-2 -top-2">
                        <input type="hidden" name="id" defaultValue={modelo.id} />
                        <input type="hidden" name="url" defaultValue={url} />
                        <button
                          type="submit"
                          title={t("quitarFoto")}
                          className="h-5 w-5 rounded-full bg-rose-600 text-xs text-white"
                        >
                          ×
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              <form action={agregarImagen} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" defaultValue={modelo.id} />
                <input name="url" placeholder={t("fotoPlaceholder")} className={`${inputClass} max-w-md flex-1`} />
                <button type="submit" className={btnGhost}>
                  {t("agregarFoto")}
                </button>
              </form>
            </div>

            {/* Faltantes */}
            {p.faltantes.length > 0 && !p.yaPublicado && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{t("falta")}</span>
                {p.faltantes.map((f) => (
                  <Badge key={f} tone="amber">
                    {f}
                  </Badge>
                ))}
              </div>
            )}

            {/* Acciones */}
            {p.yaPublicado ? (
              <div className="flex flex-wrap items-center gap-3">
                <Badge tone="blue">{t("publicadoItem", { id: p.mlItemId ?? "" })}</Badge>
                {modelo.mlPermalink && modelo.mlEstado === "active" ? (
                  <a
                    href={modelo.mlPermalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-cyan-700 hover:underline"
                  >
                    {t("verEnMl")}
                  </a>
                ) : modelo.mlEstado && modelo.mlEstado !== "active" ? (
                  <span className="text-xs text-slate-500" title={modelo.mlSubEstado ?? ""}>
                    {t("noVisibleMl", {
                      estado: modelo.mlEstado,
                      sub: modelo.mlSubEstado ? ` · ${modelo.mlSubEstado}` : "",
                    })}
                  </span>
                ) : null}
                <form action={actualizarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button type="submit" className={btnGhost}>
                    {t("actualizarPrecioStock")}
                  </button>
                </form>
                <form action={actualizarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <input type="hidden" name="pausar" value="1" />
                  <button type="submit" className="text-sm text-rose-700 hover:underline">
                    {t("pausar")}
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <form action={validarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button type="submit" className={btnGhost}>
                    {t("validarMl")}
                  </button>
                </form>
                <form action={publicarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button
                    type="submit"
                    disabled={!puedePublicar}
                    className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {t("publicarMl")}
                  </button>
                </form>
                {!puedePublicar && (
                  <span className="text-xs text-slate-500">{t("resuelvePendientes")}</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <ModeloForm action={actualizarModelo} modelo={modelo} impresoras={impresoras} submitLabel={t("guardarCambios")} />
      </Card>

      <Card title={t("makerworldTitulo")}>
        <p className="mb-3 text-xs text-slate-500">{t("makerworldDesc")}</p>
        <form action={enriquecerModelo} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" defaultValue={modelo.id} />
          <input
            name="mwUrl"
            defaultValue={modelo.urlFuente ?? ""}
            placeholder={t("makerworldPlaceholder")}
            className={`${inputClass} max-w-md flex-1`}
          />
          <button type="submit" className={btnGhost}>
            {t("enriquecerUrl")}
          </button>
        </form>
        <BuscarMakerWorld modeloId={modelo.id} nombre={modelo.nombre} />
      </Card>

      <Card title={t("catalogoTitulo")}>
        <p className="mb-3 text-xs text-slate-500">{t("catalogoDesc")}</p>
        <BuscarCatalogo
          modeloId={modelo.id}
          nombre={modelo.nombre}
          actual={modelo.mlCatalogProductId}
          fotoModelo={modelo.imagenes?.[0] ?? null}
        />
      </Card>

      <form action={eliminarModelo}>
        <input type="hidden" name="id" defaultValue={modelo.id} />
        <button type="submit" className="text-sm text-rose-700 hover:underline">
          {t("eliminarModelo")}
        </button>
      </form>
    </div>
  );
}

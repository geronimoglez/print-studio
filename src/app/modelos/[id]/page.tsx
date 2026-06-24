import { notFound } from "next/navigation";
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
      <h1 className="text-2xl font-bold tracking-tight">Editar modelo</h1>

      {sp.mw === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Datos de MakerWorld aplicados (solo se rellenaron campos vacíos).
        </div>
      )}
      {sp.mw === "fail" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No se pudo leer de MakerWorld. No se cambió nada.
        </div>
      )}
      {sp.pub === "ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Publicado en Mercado Libre. Item: <strong>{sp.item}</strong>
        </div>
      )}
      {sp.pub === "upd" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Publicación actualizada.
        </div>
      )}
      {sp.pub === "fail" && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
          ✗ {sp.msg || "No se pudo completar la acción en Mercado Libre."}
        </div>
      )}
      {sp.pub === "val_ok" && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          ✓ Mercado Libre validó el anuncio: el publicar funcionaría. (No se creó ninguna publicación.)
        </div>
      )}
      {sp.pub === "val_fail" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠️ ML reporta ajustes antes de publicar: {sp.msg}
        </div>
      )}

      {/* ---------- Publicar en Mercado Libre (copiloto) ---------- */}
      <Card title="🛒 Publicar en Mercado Libre">
        {p && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
              <div>
                <span className="text-slate-500">Título:</span> <strong>{p.title}</strong>
              </div>
              <div>
                <span className="text-slate-500">Categoría ML:</span>{" "}
                {p.categoriaId ? (
                  <strong>{p.categoriaNombre ?? p.categoriaId}</strong>
                ) : (
                  <span className="text-amber-700">por determinar</span>
                )}
              </div>
              <div>
                <span className="text-slate-500">Precio:</span>{" "}
                <strong className="text-emerald-700">{mxn(p.precio)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Entrega:</span> {p.tiempoEntregaDias} días
              </div>
            </div>

            {/* Imágenes */}
            <div>
              <div className="mb-1 text-sm font-medium text-slate-700">Fotos ({p.imagenes.length})</div>
              {p.imagenes.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {p.imagenes.map((url) => (
                    <div key={url} className="relative">
                      <FotoThumb url={url} />
                      <form action={quitarImagen} className="absolute -right-2 -top-2">
                        <input type="hidden" name="id" defaultValue={modelo.id} />
                        <input type="hidden" name="url" defaultValue={url} />
                        <button type="submit" title="Quitar" className="h-5 w-5 rounded-full bg-rose-600 text-xs text-white">
                          ×
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              <form action={agregarImagen} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" defaultValue={modelo.id} />
                <input name="url" placeholder="URL de una foto o render (https://…)" className={`${inputClass} max-w-md flex-1`} />
                <button type="submit" className={btnGhost}>
                  Agregar foto
                </button>
              </form>
            </div>

            {/* Faltantes */}
            {p.faltantes.length > 0 && !p.yaPublicado && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">Falta:</span>
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
                <Badge tone="blue">Publicado · {p.mlItemId}</Badge>
                {modelo.mlPermalink && modelo.mlEstado === "active" ? (
                  <a href={modelo.mlPermalink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-cyan-700 hover:underline">
                    Ver en Mercado Libre ↗
                  </a>
                ) : modelo.mlEstado && modelo.mlEstado !== "active" ? (
                  <span className="text-xs text-slate-500" title={modelo.mlSubEstado ?? ""}>
                    No visible en ML (estatus: {modelo.mlEstado}{modelo.mlSubEstado ? ` · ${modelo.mlSubEstado}` : ""})
                  </span>
                ) : null}
                <form action={actualizarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button type="submit" className={btnGhost}>
                    Actualizar precio/stock
                  </button>
                </form>
                <form action={actualizarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <input type="hidden" name="pausar" value="1" />
                  <button type="submit" className="text-sm text-rose-700 hover:underline">
                    Pausar
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <form action={validarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button type="submit" className={btnGhost}>
                    Validar en ML (sin publicar)
                  </button>
                </form>
                <form action={publicarEnMl}>
                  <input type="hidden" name="id" defaultValue={modelo.id} />
                  <button
                    type="submit"
                    disabled={!puedePublicar}
                    className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    Publicar en Mercado Libre
                  </button>
                </form>
                {!puedePublicar && (
                  <span className="text-xs text-slate-500">Resuelve los pendientes para habilitar.</span>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <ModeloForm action={actualizarModelo} modelo={modelo} impresoras={impresoras} submitLabel="Guardar cambios" />
      </Card>

      <Card title="MakerWorld (buscar o pegar liga)">
        <p className="mb-3 text-xs text-slate-500">
          Busca el modelo en MakerWorld por nombre y elige el correcto (trae portada y datos), o pega
          la URL directo. Solo rellena campos vacíos.
        </p>
        <form action={enriquecerModelo} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" defaultValue={modelo.id} />
          <input
            name="mwUrl"
            defaultValue={modelo.urlFuente ?? ""}
            placeholder="https://makerworld.com/en/models/123456-…"
            className={`${inputClass} max-w-md flex-1`}
          />
          <button type="submit" className={btnGhost}>
            Enriquecer por URL
          </button>
        </form>
        <BuscarMakerWorld modeloId={modelo.id} nombre={modelo.nombre} />
      </Card>

      <Card title="📦 Catálogo de Mercado Libre (opcional — solo producto exacto)">
        <p className="mb-3 text-xs text-slate-500">
          La vía <strong>recomendada para impresiones propias es el anuncio libre</strong> (arriba). El
          catálogo es <strong>la excepción</strong>: solo engancha cuando el modelo ES exactamente un
          producto que ya existe en ML (misma marca/modelo). Compara las fotos y confirma antes de
          enganchar.
        </p>
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
          Eliminar modelo
        </button>
      </form>
    </div>
  );
}

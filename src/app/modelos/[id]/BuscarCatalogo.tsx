"use client";

import { useState } from "react";
import { aplicarCatalogo } from "@/app/actions";
import { btnGhost } from "@/components/ui";

type Producto = {
  id: string;
  name: string;
  domain_id?: string;
  foto?: string;
  marca?: string;
  modelo?: string;
};

export function BuscarCatalogo({
  modeloId,
  nombre,
  actual,
  fotoModelo,
}: {
  modeloId: string;
  nombre: string;
  actual: string | null;
  fotoModelo: string | null;
}) {
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [error, setError] = useState("");
  const [confirmadoId, setConfirmadoId] = useState<string | null>(null);

  async function buscar() {
    setCargando(true);
    setError("");
    setProductos(null);
    setConfirmadoId(null);
    try {
      const r = await fetch(`/api/catalogo/buscar?q=${encodeURIComponent(nombre)}`);
      const j = (await r.json()) as { ok?: boolean; productos?: Producto[] };
      setProductos(j.productos ?? []);
    } catch {
      setError("No se pudo buscar en el catálogo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      {actual && (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
            Enganchado al catálogo: {actual}
          </span>
          <form action={aplicarCatalogo}>
            <input type="hidden" name="id" value={modeloId} />
            <button type="submit" className="text-xs text-rose-700 hover:underline">
              quitar
            </button>
          </form>
        </div>
      )}
      <button type="button" onClick={buscar} disabled={cargando} className={btnGhost}>
        {cargando ? "Buscando en catálogo…" : "📦 Buscar en catálogo de ML"}
      </button>
      <p className="mt-1 text-xs text-slate-500">
        ⚠️ Engancha al catálogo <b>solo si es EXACTAMENTE el mismo producto</b> (misma marca/modelo).
        Para impresiones originales, usa el <b>anuncio libre</b> (arriba).
      </p>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {productos && productos.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">Sin productos de catálogo para “{nombre}”.</p>
      )}
      {productos && productos.length > 0 && (
        <ul className="mt-3 space-y-3">
          {productos.map((p) => {
            const confirmado = confirmadoId === p.id;
            return (
              <li key={p.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-start gap-3">
                  {/* Comparación visual: tu modelo vs producto de catálogo */}
                  <div className="flex flex-none gap-2">
                    <figure className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {fotoModelo ? (
                        <img src={fotoModelo} alt="Tu modelo" className="h-20 w-20 rounded-md border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">sin foto</div>
                      )}
                      <figcaption className="mt-0.5 text-[10px] text-slate-500">Tu modelo</figcaption>
                    </figure>
                    <figure className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.foto ? (
                        <img src={p.foto} alt={p.name} className="h-20 w-20 rounded-md border border-slate-200 object-cover" />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">sin foto</div>
                      )}
                      <figcaption className="mt-0.5 text-[10px] text-slate-500">Catálogo</figcaption>
                    </figure>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.marca ? `Marca: ${p.marca}` : ""} {p.modelo ? `· Modelo: ${p.modelo}` : ""}
                      <span className="text-slate-400"> · [{p.id}]</span>
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={confirmado}
                      onChange={(e) => setConfirmadoId(e.target.checked ? p.id : null)}
                    />
                    Es <b>exactamente</b> este producto
                  </label>
                  <form action={aplicarCatalogo}>
                    <input type="hidden" name="id" value={modeloId} />
                    <input type="hidden" name="productId" value={p.id} />
                    <button
                      type="submit"
                      disabled={!confirmado}
                      className="rounded bg-cyan-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      Enganchar
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { aplicarCatalogo } from "@/app/actions";
import { Badge, btnGhost, btnPrimary, EstadoVacio } from "@/components/ui";
import { Icon } from "@/components/Icon";

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
  const t = useTranslations("buscarCatalogo");
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
      setError(t("errorBuscar"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div>
      {actual && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Badge tone="green">
            {t("enganchadoA")} {actual}
          </Badge>
          <form action={aplicarCatalogo}>
            <input type="hidden" name="id" value={modeloId} />
            <button type="submit" className="text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline">
              {t("quitar")}
            </button>
          </form>
        </div>
      )}

      <button type="button" onClick={buscar} disabled={cargando} className={`${btnGhost} disabled:opacity-60`}>
        <Icon name="box" />
        {cargando ? t("buscando") : t("buscarCta")}
      </button>

      <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <span aria-hidden="true">⚠️</span>
        <span>
          {t.rich("advertencia", {
            b: (chunks) => <b className="font-semibold text-slate-700">{chunks}</b>,
          })}
        </span>
      </p>

      {error && <p className="mt-2 text-sm font-medium text-rose-600">{error}</p>}

      {productos && productos.length === 0 && (
        <div className="mt-3">
          <EstadoVacio icon="box">{t("sinResultados", { nombre })}</EstadoVacio>
        </div>
      )}

      {productos && productos.length > 0 && (
        <ul className="mt-3 space-y-3">
          {productos.map((p) => {
            const confirmado = confirmadoId === p.id;
            return (
              <li key={p.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
                <div className="flex items-start gap-3">
                  {/* Comparación visual: tu modelo vs producto de catálogo */}
                  <div className="flex flex-none gap-2">
                    <figure className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {fotoModelo ? (
                        <img
                          src={fotoModelo}
                          alt={t("tuModelo")}
                          className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[10px] text-slate-400">
                          {t("sinFoto")}
                        </div>
                      )}
                      <figcaption className="mt-1 text-[10px] font-medium text-slate-500">{t("tuModelo")}</figcaption>
                    </figure>
                    <figure className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {p.foto ? (
                        <img
                          src={p.foto}
                          alt={p.name}
                          className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-slate-300 text-[10px] text-slate-400">
                          {t("sinFoto")}
                        </div>
                      )}
                      <figcaption className="mt-1 text-[10px] font-medium text-slate-500">{t("catalogo")}</figcaption>
                    </figure>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.marca ? t("marca", { marca: p.marca }) : ""}{" "}
                      {p.modelo ? t("modelo", { modelo: p.modelo }) : ""}
                      <span className="text-slate-400"> · [{p.id}]</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={confirmado}
                      onChange={(e) => setConfirmadoId(e.target.checked ? p.id : null)}
                    />
                    {t.rich("esExacto", {
                      b: (chunks) => <b className="font-semibold text-slate-700">{chunks}</b>,
                    })}
                  </label>
                  <form action={aplicarCatalogo}>
                    <input type="hidden" name="id" value={modeloId} />
                    <input type="hidden" name="productId" value={p.id} />
                    <button type="submit" disabled={!confirmado} className={`${btnPrimary} disabled:cursor-not-allowed disabled:opacity-50`}>
                      <Icon name="check" />
                      {t("enganchar")}
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

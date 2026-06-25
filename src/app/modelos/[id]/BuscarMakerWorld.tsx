"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { aplicarMakerWorld } from "@/app/actions";
import { btnGhost, EstadoVacio } from "@/components/ui";
import { Icon } from "@/components/Icon";

type Resultado = { titulo: string; url: string; imagen?: string; creador?: string };

export function BuscarMakerWorld({ modeloId, nombre }: { modeloId: string; nombre: string }) {
  const t = useTranslations("buscarMakerworld");
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState("");

  async function buscar() {
    setCargando(true);
    setError("");
    setResultados(null);
    try {
      const r = await fetch(`/api/makerworld/buscar?q=${encodeURIComponent(nombre)}`);
      const j = (await r.json()) as { resultados?: Resultado[] };
      setResultados(j.resultados ?? []);
    } catch {
      setError(t("error"));
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={buscar} disabled={cargando} className={`${btnGhost} disabled:opacity-60`}>
        {cargando ? t("buscando") : t("buscar")}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {resultados && resultados.length === 0 && (
        <div className="mt-3">
          <EstadoVacio icon="box">{t("sinResultados", { nombre })}</EstadoVacio>
        </div>
      )}
      {resultados && resultados.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {resultados.map((m, i) => (
            <div
              key={i}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-sm transition hover:shadow-md"
            >
              {m.imagen ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imagen} alt="" className="mb-2 h-24 w-full rounded-xl object-cover" />
              ) : (
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded-xl border border-dashed border-slate-300 text-[18px] text-slate-300">
                  <Icon name="box" />
                </div>
              )}
              <div className="line-clamp-2 font-medium text-slate-800">{m.titulo}</div>
              {m.creador && <div className="mt-0.5 text-slate-400">{m.creador}</div>}
              <form action={aplicarMakerWorld} className="mt-2">
                <input type="hidden" name="id" value={modeloId} />
                <input type="hidden" name="url" value={m.url} />
                <input type="hidden" name="imagen" value={m.imagen ?? ""} />
                <input type="hidden" name="creador" value={m.creador ?? ""} />
                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-brand px-2 py-1.5 font-medium text-white transition hover:opacity-90 active:scale-[.98]"
                >
                  <Icon name="check" />
                  {t("usarEste")}
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

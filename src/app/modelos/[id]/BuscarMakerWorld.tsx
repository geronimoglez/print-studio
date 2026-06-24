"use client";

import { useState } from "react";
import { aplicarMakerWorld } from "@/app/actions";
import { btnGhost } from "@/components/ui";

type Resultado = { titulo: string; url: string; imagen?: string; creador?: string };

export function BuscarMakerWorld({ modeloId, nombre }: { modeloId: string; nombre: string }) {
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
      setError("No se pudo buscar (Firecrawl). Intenta de nuevo.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={buscar} disabled={cargando} className={btnGhost}>
        {cargando ? "Buscando en MakerWorld…" : "🔎 Buscar en MakerWorld"}
      </button>
      {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      {resultados && resultados.length === 0 && (
        <p className="mt-2 text-sm text-slate-500">Sin resultados para “{nombre}”.</p>
      )}
      {resultados && resultados.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {resultados.map((m, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-2 text-xs">
              {m.imagen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imagen} alt="" className="mb-1 h-24 w-full rounded object-cover" />
              )}
              <div className="line-clamp-2 font-medium text-slate-800">{m.titulo}</div>
              {m.creador && <div className="text-slate-400">{m.creador}</div>}
              <form action={aplicarMakerWorld} className="mt-1">
                <input type="hidden" name="id" value={modeloId} />
                <input type="hidden" name="url" value={m.url} />
                <input type="hidden" name="imagen" value={m.imagen ?? ""} />
                <input type="hidden" name="creador" value={m.creador ?? ""} />
                <button type="submit" className="w-full rounded bg-cyan-600 px-2 py-1 font-medium text-white hover:bg-cyan-700">
                  Usar este
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

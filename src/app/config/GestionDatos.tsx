"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { borrarTodosLosModelos, borrarVentas } from "@/app/actions";
import { Card, btnGhost, inputClass } from "@/components/ui";

async function descargarRespaldo(tipo: "modelos" | "ventas") {
  const r = await fetch(`/api/respaldo/${tipo}`);
  if (!r.ok) throw new Error("No se pudo generar el respaldo");
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const fecha = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `respaldo-${tipo}-${fecha}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function GestionDatos({
  totalModelos,
  totalVentas,
}: {
  totalModelos: number;
  totalVentas: number;
}) {
  const router = useRouter();
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function borrarModelos() {
    if (conf !== "BORRAR") return;
    if (!window.confirm(`¿Borrar los ${totalModelos} modelos? Se descargará un respaldo primero. NO se tocan filamentos ni impresoras.`))
      return;
    setBusy(true);
    setMsg("");
    try {
      await descargarRespaldo("modelos"); // respaldo automático ANTES de borrar
      const { borrados } = await borrarTodosLosModelos();
      setMsg(`✓ ${borrados} modelos borrados. Respaldo descargado a tu equipo.`);
      setConf("");
      router.refresh();
    } catch (e) {
      setMsg(`✗ Error: ${e instanceof Error ? e.message : "desconocido"}. No se borró nada.`);
    } finally {
      setBusy(false);
    }
  }

  async function borrarVentasPrueba() {
    if (!window.confirm(`¿Borrar las ${totalVentas} ventas de prueba? Se descargará un respaldo primero.`)) return;
    setBusy(true);
    setMsg("");
    try {
      if (totalVentas > 0) await descargarRespaldo("ventas");
      const { borrados } = await borrarVentas();
      setMsg(`✓ ${borrados} ventas borradas.`);
      router.refresh();
    } catch (e) {
      setMsg(`✗ Error: ${e instanceof Error ? e.message : "desconocido"}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-rose-200">
      <h2 className="mb-1 text-sm font-semibold text-rose-700">⚠️ Gestión de datos de prueba</h2>
      <p className="mb-4 text-xs text-slate-500">
        Borra el catálogo de modelos (y/o ventas) cuando empieces a cargar los reales.{" "}
        <strong>Nunca toca filamentos ni impresoras</strong> (esos son datos reales de Blas). Antes de
        borrar se descarga automáticamente un <strong>respaldo en JSON</strong> a tu equipo.
      </p>

      <div className="space-y-5">
        {/* Modelos */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Modelos del catálogo</div>
              <div className="text-xs text-slate-500">{totalModelos} modelo(s) actualmente</div>
            </div>
            <button type="button" onClick={() => descargarRespaldo("modelos")} className={btnGhost}>
              Descargar respaldo (JSON)
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              placeholder='Escribe BORRAR'
              className={`${inputClass} w-40`}
            />
            <button
              type="button"
              onClick={borrarModelos}
              disabled={busy || conf !== "BORRAR" || totalModelos === 0}
              className="rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Procesando…" : `Borrar los ${totalModelos} modelos`}
            </button>
          </div>
        </div>

        {/* Ventas */}
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Ventas (datos de prueba)</div>
              <div className="text-xs text-slate-500">{totalVentas} venta(s) registradas</div>
            </div>
            <button
              type="button"
              onClick={borrarVentasPrueba}
              disabled={busy || totalVentas === 0}
              className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Borrar ventas
            </button>
          </div>
        </div>
      </div>

      {msg && <p className="mt-4 text-sm font-medium text-slate-700">{msg}</p>}
    </Card>
  );
}

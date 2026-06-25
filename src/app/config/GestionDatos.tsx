"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { borrarTodosLosModelos, borrarVentas } from "@/app/actions";
import { Badge, Card, btnGhost, inputClass } from "@/components/ui";
import { Icon } from "@/components/Icon";

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
  const t = useTranslations("gestionDatos");
  const router = useRouter();
  const [conf, setConf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"ok" | "error">("ok");

  const palabraClave = t("palabraClave");

  async function borrarModelos() {
    if (conf !== palabraClave) return;
    if (!window.confirm(t("confirmarModelos", { n: totalModelos }))) return;
    setBusy(true);
    setMsg("");
    try {
      await descargarRespaldo("modelos"); // respaldo automático ANTES de borrar
      const { borrados } = await borrarTodosLosModelos();
      setMsgTone("ok");
      setMsg(t("okModelos", { n: borrados }));
      setConf("");
      router.refresh();
    } catch (e) {
      setMsgTone("error");
      setMsg(t("errorModelos", { detalle: e instanceof Error ? e.message : t("errorDesconocido") }));
    } finally {
      setBusy(false);
    }
  }

  async function borrarVentasPrueba() {
    if (!window.confirm(t("confirmarVentas", { n: totalVentas }))) return;
    setBusy(true);
    setMsg("");
    try {
      if (totalVentas > 0) await descargarRespaldo("ventas");
      const { borrados } = await borrarVentas();
      setMsgTone("ok");
      setMsg(t("okVentas", { n: borrados }));
      router.refresh();
    } catch (e) {
      setMsgTone("error");
      setMsg(t("errorVentas", { detalle: e instanceof Error ? e.message : t("errorDesconocido") }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-rose-200 bg-rose-50/30">
      <div className="mb-1 flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-rose-100 text-[16px] text-rose-700">
          <Icon name="alert" />
        </span>
        <h2 className="text-sm font-semibold text-rose-700">{t("titulo")}</h2>
      </div>
      <p className="mb-4 text-xs text-slate-500">
        {t.rich("descripcion", {
          fuerte: (chunks) => <strong>{chunks}</strong>,
        })}
      </p>

      <div className="space-y-4">
        {/* Modelos */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{t("modelosTitulo")}</span>
                <Badge tone="slate">{t("modelosConteo", { n: totalModelos })}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{t("modelosNota")}</div>
            </div>
            <button type="button" onClick={() => descargarRespaldo("modelos")} className={btnGhost}>
              <Icon name="box" />
              {t("descargarRespaldo")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={conf}
              onChange={(e) => setConf(e.target.value)}
              placeholder={t("placeholderConfirmar", { palabra: palabraClave })}
              className={`${inputClass} w-44`}
            />
            <button
              type="button"
              onClick={borrarModelos}
              disabled={busy || conf !== palabraClave || totalModelos === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? t("procesando") : t("borrarModelos", { n: totalModelos })}
            </button>
          </div>
        </div>

        {/* Ventas */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800">{t("ventasTitulo")}</span>
                <Badge tone="slate">{t("ventasConteo", { n: totalVentas })}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{t("ventasNota")}</div>
            </div>
            <button
              type="button"
              onClick={borrarVentasPrueba}
              disabled={busy || totalVentas === 0}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-rose-700 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t("borrarVentas")}
            </button>
          </div>
        </div>
      </div>

      {msg && (
        <p
          className={`mt-4 text-sm font-medium ${
            msgTone === "ok" ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {msg}
        </p>
      )}
    </Card>
  );
}

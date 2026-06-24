"use client";

// Importador self-serve: el operador sube el ZIP de un pack y el sistema crea los modelos solo, en la nube,
// sin scripts locales ni redeploy. El navegador sube el ZIP DIRECTO a Blob (sin tope de tamaño de la
// función), luego una ruta lo procesa: extrae fotos → Blob → crea los modelos en estado Pendiente, que
// caen en /revisión para aprobar. La licencia queda "por revisar" (amarillo) y la visión corre después.
import { useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { upload } from "@vercel/blob/client";
import { Card, Badge, btnPrimary, inputClass, labelClass } from "@/components/ui";

type Estado = "idle" | "subiendo" | "procesando" | "ok" | "error";

export default function ImportarPage() {
  const t = useTranslations("importar");
  const [file, setFile] = useState<File | null>(null);
  const [categoria, setCategoria] = useState("Importado");
  const [fuente, setFuente] = useState("Pack web");
  const [estado, setEstado] = useState<Estado>("idle");
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<{ encontrados: number; creados: number; saltados: number } | null>(null);

  async function importar() {
    if (!file) return;
    setRes(null);
    try {
      setEstado("subiendo");
      setMsg(t("subiendoArchivo", { nombre: file.name, mb: (file.size / 1048576).toFixed(0) }));
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/importar/token" });
      setEstado("procesando");
      setMsg(t("procesandoPack"));
      const r = await fetch("/api/importar/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, categoria, fuente }),
      });
      const j = await r.json();
      if (!j.ok) { setEstado("error"); setMsg(j.error || t("errorProcesando")); return; }
      setRes({ encontrados: j.encontrados, creados: j.creados, saltados: j.saltados });
      setEstado("ok");
      setMsg("");
    } catch (e) {
      setEstado("error");
      setMsg(e instanceof Error ? e.message : t("errorSubiendo"));
    }
  }

  const trabajando = estado === "subiendo" || estado === "procesando";

  // Chunk reutilizable para enrutar el enlace a Revisión dentro de textos traducidos.
  const linkRevision = (chunks: ReactNode) => (
    <Link href="/revision" className="font-medium text-brand underline">
      {chunks}
    </Link>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">
          {t.rich("subtitulo", { revision: linkRevision })}
        </p>
      </div>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">{t("guiaTitulo")}</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>{t.rich("guiaPaso1", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("guiaPaso2", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("guiaPaso3", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("guiaPaso4", { b: (c) => <b>{c}</b> })}</li>
          <li>{t.rich("guiaPaso5", { b: (c) => <b>{c}</b>, revision: linkRevision })}</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          {t.rich("guiaNota", { b: (c) => <b>{c}</b> })}
        </p>
      </details>

      <Card>
        <div className="space-y-4">
          <label className="block">
            <span className={labelClass}>{t("campoArchivo")}</span>
            <input
              type="file"
              accept=".zip"
              disabled={trabajando}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition hover:file:opacity-90"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>{t("campoCategoria")}</span>
              <input value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={trabajando}
                className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>{t("campoFuente")}</span>
              <input value={fuente} onChange={(e) => setFuente(e.target.value)} disabled={trabajando}
                className={inputClass} />
            </label>
          </div>
          <button
            onClick={importar}
            disabled={!file || trabajando}
            className={`${btnPrimary} disabled:opacity-40`}
          >
            {trabajando ? t("trabajando") : t("importarPack")}
          </button>

          {msg && <p className={`text-sm ${estado === "error" ? "text-rose-600" : "text-slate-500"}`}>{msg}</p>}

          {estado === "ok" && res && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              <Badge tone="green">{t("listo")}</Badge>{" "}
              {t("resumenCreados", { creados: res.creados, encontrados: res.encontrados })}
              {res.saltados ? ` ${t("resumenSaltados", { saltados: res.saltados })}` : ""}.{" "}
              <Link href="/revision" className="font-medium text-brand underline">
                {t("irRevision")}
              </Link>
            </div>
          )}
        </div>
      </Card>

      <p className="text-xs text-slate-400">
        {t("notaPie")}
      </p>
    </div>
  );
}

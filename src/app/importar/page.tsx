"use client";

// Importador self-serve: Blas (o tú) sube el ZIP de un pack y el sistema crea los modelos solo, en la nube,
// sin scripts locales ni redeploy. El navegador sube el ZIP DIRECTO a Blob (sin tope de tamaño de la
// función), luego una ruta lo procesa: extrae fotos → Blob → crea los modelos en estado Pendiente, que
// caen en /revisión para aprobar. La licencia queda "por revisar" (amarillo) y la visión corre después.
import { useState } from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";

type Estado = "idle" | "subiendo" | "procesando" | "ok" | "error";

export default function ImportarPage() {
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
      setMsg(`Subiendo ${file.name} (${(file.size / 1048576).toFixed(0)} MB)…`);
      const blob = await upload(file.name, file, { access: "public", handleUploadUrl: "/api/importar/token" });
      setEstado("procesando");
      setMsg("Procesando el pack (extrayendo fotos y creando modelos)…");
      const r = await fetch("/api/importar/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blobUrl: blob.url, categoria, fuente }),
      });
      const j = await r.json();
      if (!j.ok) { setEstado("error"); setMsg(j.error || "Error procesando"); return; }
      setRes({ encontrados: j.encontrados, creados: j.creados, saltados: j.saltados });
      setEstado("ok");
      setMsg("");
    } catch (e) {
      setEstado("error");
      setMsg(e instanceof Error ? e.message : "Error subiendo el archivo");
    }
  }

  const trabajando = estado === "subiendo" || estado === "procesando";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar un pack</h1>
        <p className="text-sm text-slate-500">
          Sube el ZIP de un pack (carpetas por modelo, con fotos). El sistema crea los modelos solo y los
          deja en <Link href="/revision" className="text-cyan-700 underline">Revisión</Link> para aprobar.
          No necesitas instalar nada.
        </p>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">📘 ¿Cómo importar un pack? (guía rápida)</summary>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5">
          <li>Ten a la mano el <b>ZIP del pack</b> (debe tener una carpeta por modelo, y dentro las fotos).</li>
          <li>Dale a <b>“Archivo ZIP del pack”</b> y elígelo.</li>
          <li>Escribe la <b>Categoría</b> (ej. Macetas, Lámparas, Organizadores) y la <b>Fuente</b> (de dónde salió el pack).</li>
          <li>Clic en <b>“Importar pack”</b> y espera. Los packs grandes tardan un poco — no cierres la página.</li>
          <li>Listo: los modelos aparecen en <Link href="/revision" className="text-cyan-700 underline">Revisión</Link> en 🟡 amarillo. Ahí tú decides cuáles publicar.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Se crean como <b>🟡 “por revisar”</b> a propósito, para que tú elijas. El sistema revisa marca/IP por la
          foto después. Si un pack es muy grande (&gt; 1.2 GB), pártelo en menos categorías y súbelo por partes.
        </p>
      </details>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Archivo ZIP del pack</span>
          <input
            type="file"
            accept=".zip"
            disabled={trabajando}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-700"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Categoría</span>
            <input value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={trabajando}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">Fuente / pack</span>
            <input value={fuente} onChange={(e) => setFuente(e.target.value)} disabled={trabajando}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
        </div>
        <button
          onClick={importar}
          disabled={!file || trabajando}
          className="inline-flex items-center rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-40"
        >
          {trabajando ? "Trabajando…" : "Importar pack"}
        </button>

        {msg && <p className={`text-sm ${estado === "error" ? "text-rose-600" : "text-slate-500"}`}>{msg}</p>}

        {estado === "ok" && res && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            ✅ Listo: <b>{res.creados}</b> modelo(s) creado(s) de {res.encontrados} encontrado(s)
            {res.saltados ? ` (${res.saltados} ya existían/sin foto)` : ""}.{" "}
            <Link href="/revision" className="font-medium underline">Ir a Revisión →</Link>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Nota: se crean en 🟡 amarillo (licencia &quot;por revisar&quot;) para que Blas decida. La detección de
        marca/IP por foto y la malla 3D para imprimir se procesan después. Packs muy grandes (&gt;1.2 GB)
        conviene partirlos por categoría.
      </p>
    </div>
  );
}

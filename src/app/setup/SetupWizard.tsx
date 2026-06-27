"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import { iniciales } from "@/lib/iniciales";
import { locales, localeNames } from "@/i18n/config";

type Valores = {
  appName: string;
  appShortName: string;
  tagline: string;
  appDescription: string;
  mlSellerName: string;
  logoUrl: string;
  colorPrimary: string;
  colorAccent: string;
  colorBgDark: string;
  themeColor: string;
  localeUi: string;
  localeContenido: string;
  monedaNegocio: string;
};

type ProvText = "openrouter" | "openai" | "anthropic";
type ProvImg = "fal" | "openai";

const PRESETS: { key: string; colorPrimary: string; colorAccent: string; colorBgDark: string; themeColor: string }[] = [
  { key: "cian", colorPrimary: "#0891b2", colorAccent: "#22d3ee", colorBgDark: "#020617", themeColor: "#0f172a" },
  { key: "violeta", colorPrimary: "#7c3aed", colorAccent: "#a78bfa", colorBgDark: "#1e1b4b", themeColor: "#2e1065" },
  { key: "esmeralda", colorPrimary: "#059669", colorAccent: "#34d399", colorBgDark: "#022c22", themeColor: "#064e3b" },
  { key: "ambar", colorPrimary: "#d97706", colorAccent: "#fbbf24", colorBgDark: "#1c1917", themeColor: "#292524" },
  { key: "rosa", colorPrimary: "#e11d48", colorAccent: "#fb7185", colorBgDark: "#1f0a12", themeColor: "#4c0519" },
];

const COLOR_LABEL: Record<string, string> = {
  colorPrimary: "colPrimario",
  colorAccent: "colAcento",
  colorBgDark: "colFondo",
  themeColor: "colTema",
};

export function SetupWizard({
  action,
  inicial,
  yaConfigurado,
}: {
  action: (formData: FormData) => void | Promise<void>;
  inicial: Valores;
  yaConfigurado: boolean;
}) {
  const t = useTranslations("setup");
  const [v, setV] = useState<Valores>(inicial);
  const [paso, setPaso] = useState(1);
  const set = <K extends keyof Valores>(k: K, val: Valores[K]) => setV((s) => ({ ...s, [k]: val }));

  // Asistente IA (BYOK): el token vive solo en el navegador, no se envía a la DB.
  const [token, setToken] = useState("");
  const [provText, setProvText] = useState<ProvText>("openrouter");
  const [provImg, setProvImg] = useState<ProvImg>("fal");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[]>([]);

  async function subirLogo(file: File) {
    setBusy("logo");
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/branding/logo", { method: "POST", body: fd });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || t("errSubir"));
      set("logoUrl", data.url);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("errSubirGen"));
    } finally {
      setBusy(null);
    }
  }

  async function ia(endpoint: string, body: object, etiqueta: string): Promise<Record<string, unknown> | null> {
    setBusy(etiqueta);
    setMsg(null);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!data.ok) throw new Error(data.error || t("errIa"));
      return data;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : t("errIaGen"));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function genNombre() {
    const d = await ia(
      "/api/setup/generar-nombre",
      { brief: `${v.appName} ${v.appDescription}`.trim(), proveedor: provText, token, idioma: localeNames[v.localeUi as keyof typeof localeNames] ?? "español" },
      "nombre",
    );
    if (!d) return;
    setIdeas(Array.isArray(d.nombres) ? (d.nombres as string[]) : []);
    if (typeof d.tagline === "string") set("tagline", d.tagline);
    if (typeof d.descripcion === "string") set("appDescription", d.descripcion);
  }

  async function genPaleta() {
    const d = await ia("/api/setup/generar-paleta", { brief: v.appName, proveedor: provText, token }, "paleta");
    if (!d) return;
    set("colorPrimary", String(d.colorPrimary));
    set("colorAccent", String(d.colorAccent));
    set("colorBgDark", String(d.colorBgDark));
    set("themeColor", String(d.themeColor));
  }

  async function genLogo() {
    const d = await ia(
      "/api/setup/generar-logo",
      { descripcion: `${v.appName} — ${v.appDescription}`.trim(), proveedor: provImg, token },
      "logoIA",
    );
    if (d && typeof d.url === "string") set("logoUrl", d.url);
  }

  const aplicarPreset = (p: (typeof PRESETS)[number]) => {
    set("colorPrimary", p.colorPrimary);
    set("colorAccent", p.colorAccent);
    set("colorBgDark", p.colorBgDark);
    set("themeColor", p.themeColor);
  };

  const Paso = ({ n, txt }: { n: number; txt: string }) => (
    <button
      type="button"
      onClick={() => setPaso(n)}
      className={`flex items-center gap-2 text-sm font-medium ${paso === n ? "text-slate-900" : "text-slate-400"}`}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
          paso === n ? "bg-brand text-white" : "bg-slate-200 text-slate-600"
        }`}
      >
        {n}
      </span>
      {txt}
    </button>
  );

  return (
    <form action={action} className="space-y-5">
      {/* Vista previa en vivo */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2.5 px-4 py-3 text-white" style={{ background: v.colorBgDark }}>
          {v.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.logoUrl} alt="logo" className="h-9 w-9 rounded-full bg-white object-cover" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
              style={{ background: v.colorAccent, color: v.colorBgDark }}
            >
              {iniciales(v.appName)}
            </span>
          )}
          <span className="font-semibold tracking-tight">{v.appName || t("previewMarca")}</span>
        </div>
        <div className="flex items-center justify-between bg-white px-4 py-2 text-xs text-slate-500">
          <span>{v.tagline || t("previewTagline")}</span>
          <span className="rounded-lg px-3 py-1 text-white" style={{ background: v.colorPrimary }}>
            {t("previewBoton")}
          </span>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-5">
        <Paso n={1} txt={t("pasoNegocio")} />
        <Paso n={2} txt={t("pasoMarca")} />
        <Paso n={3} txt={t("pasoConfirmar")} />
      </div>

      {msg && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{msg}</div>
      )}

      {/* PASO 1 — Negocio */}
      <fieldset className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-5 ${paso === 1 ? "" : "hidden"}`}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClass}>{t("nombreNegocio")}</span>
            <input name="appName" className={inputClass} value={v.appName} onChange={(e) => set("appName", e.target.value)} />
          </label>
          <label className="block">
            <span className={labelClass}>{t("nombreCorto")}</span>
            <input name="appShortName" className={inputClass} value={v.appShortName} onChange={(e) => set("appShortName", e.target.value)} />
          </label>
        </div>
        <label className="block">
          <span className={labelClass}>{t("tagline")}</span>
          <input name="tagline" className={inputClass} value={v.tagline} onChange={(e) => set("tagline", e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{t("descripcion")}</span>
          <input name="appDescription" className={inputClass} value={v.appDescription} onChange={(e) => set("appDescription", e.target.value)} />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className={labelClass}>{t("idiomaUi")}</span>
            <select name="localeUi" className={inputClass} value={v.localeUi} onChange={(e) => set("localeUi", e.target.value)}>
              {locales.map((l) => (
                <option key={l} value={l}>
                  {localeNames[l]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t("idiomaContenido")}</span>
            <select name="localeContenido" className={inputClass} value={v.localeContenido} onChange={(e) => set("localeContenido", e.target.value)}>
              <option value="es-MX">Español (México)</option>
              <option value="es-AR">Español (Argentina)</option>
              <option value="es-CO">Español (Colombia)</option>
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block">
            <span className={labelClass}>{t("moneda")}</span>
            <input name="monedaNegocio" className={inputClass} value={v.monedaNegocio} onChange={(e) => set("monedaNegocio", e.target.value)} />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-700">{t("aiTitulo")}</p>
          <p className="mb-3 text-xs text-slate-500">{t("aiNota")}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select className={inputClass} value={provText} onChange={(e) => setProvText(e.target.value as ProvText)}>
              <option value="openrouter">OpenRouter</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Claude (Anthropic)</option>
            </select>
            <input
              className={`${inputClass} sm:col-span-2`}
              type="password"
              placeholder={t("aiTokenPlaceholder")}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <button type="button" className={`${btnGhost} mt-3`} onClick={genNombre} disabled={busy === "nombre"}>
            {busy === "nombre" ? t("generando") : t("sugerirNombre")}
          </button>
          {ideas.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {ideas.map((n) => (
                <button key={n} type="button" className="rounded-full bg-white px-3 py-1 text-xs ring-1 ring-slate-300 hover:bg-slate-100" onClick={() => set("appName", n)}>
                  {n}
                </button>
              ))}
            </div>
          )}
        </div>
      </fieldset>

      {/* PASO 2 — Marca */}
      <fieldset className={`space-y-5 rounded-2xl border border-slate-200 bg-white p-5 ${paso === 2 ? "" : "hidden"}`}>
        <input type="hidden" name="logoUrl" value={v.logoUrl} readOnly />
        <div>
          <span className={labelClass}>{t("logoLabel")}</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept="image/*"
              className="text-sm"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) subirLogo(f);
              }}
            />
            <button type="button" className={btnGhost} onClick={genLogo} disabled={busy === "logoIA"}>
              {busy === "logoIA" ? t("generando") : t("logoIa")}
            </button>
            <select className={inputClass + " w-auto"} value={provImg} onChange={(e) => setProvImg(e.target.value as ProvImg)}>
              <option value="fal">fal.ai (FLUX)</option>
              <option value="openai">OpenAI</option>
            </select>
            {v.logoUrl && (
              <button type="button" className="text-xs text-rose-600 underline" onClick={() => set("logoUrl", "")}>
                {t("quitar")}
              </button>
            )}
          </div>
          {busy === "logo" && <p className="mt-1 text-xs text-slate-500">{t("subiendo")}</p>}
        </div>

        <div>
          <span className={labelClass}>{t("paletaLabel")}</span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => aplicarPreset(p)}
                className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
              >
                <span className="h-3 w-3 rounded-full" style={{ background: p.colorPrimary }} />
                <span className="h-3 w-3 rounded-full" style={{ background: p.colorAccent }} />
                {t(`preset.${p.key}`)}
              </button>
            ))}
            <button type="button" className={btnGhost} onClick={genPaleta} disabled={busy === "paleta"}>
              {busy === "paleta" ? t("generando") : t("paletaIa")}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["colorPrimary", "colorAccent", "colorBgDark", "themeColor"] as const).map((k) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">{t(COLOR_LABEL[k])}</span>
              <div className="flex items-center gap-2">
                <input type="color" name={k} value={v[k]} onChange={(e) => set(k, e.target.value)} className="h-9 w-12 rounded border border-slate-300" />
                <input className={`${inputClass} font-mono text-xs`} value={v[k]} onChange={(e) => set(k, e.target.value)} />
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* PASO 3 — Confirmar */}
      <fieldset className={`space-y-4 rounded-2xl border border-slate-200 bg-white p-5 ${paso === 3 ? "" : "hidden"}`}>
        <label className="block">
          <span className={labelClass}>{t("vendedorMl")}</span>
          <input name="mlSellerName" className={inputClass} value={v.mlSellerName} onChange={(e) => set("mlSellerName", e.target.value)} />
          <span className="mt-1 block text-xs text-slate-500">{t("vendedorMlHint")}</span>
        </label>
        <p className="text-sm text-slate-600">{t("confirmarNota")}</p>
        <button type="submit" className={btnPrimary}>
          {yaConfigurado ? t("guardarCambios") : t("guardarEmpezar")}
        </button>
      </fieldset>

      {/* Navegación */}
      <div className="flex justify-between">
        <button type="button" className={btnGhost} onClick={() => setPaso((p) => Math.max(1, p - 1))} disabled={paso === 1}>
          ← {t("atras")}
        </button>
        {paso < 3 && (
          <button type="button" className={btnPrimary} onClick={() => setPaso((p) => Math.min(3, p + 1))}>
            {t("siguiente")} →
          </button>
        )}
      </div>
    </form>
  );
}

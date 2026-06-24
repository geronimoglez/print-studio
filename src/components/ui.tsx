// Componentes y clases compartidas de UI (server components, sin estado).
// Estilo: cálido y amigable — esquinas redondeadas, tintes suaves, botones de marca.
import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
export const selectClass = inputClass;
export const labelClass = "block text-sm font-medium text-slate-700 mb-1";
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 active:scale-[.98]";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50";

type Tone = "green" | "red" | "amber" | "blue" | "slate";
const tones: Record<Tone, string> = {
  green: "bg-emerald-100 text-emerald-800",
  red: "bg-rose-100 text-rose-800",
  amber: "bg-amber-100 text-amber-800",
  blue: "bg-sky-100 text-sky-800",
  slate: "bg-slate-200 text-slate-700",
};

export function Badge({ tone = "slate", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className={labelClass}>{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title ? <h2 className="mb-3 text-sm font-semibold text-slate-700">{title}</h2> : null}
      {children}
    </section>
  );
}

type KpiTone = "slate" | "sky" | "emerald" | "amber" | "rose";
const kpiTones: Record<KpiTone, { bg: string; iconBg: string; text: string; label: string }> = {
  slate: { bg: "bg-slate-100", iconBg: "bg-white", text: "text-slate-800", label: "text-slate-500" },
  sky: { bg: "bg-sky-50", iconBg: "bg-sky-100", text: "text-sky-700", label: "text-sky-600/80" },
  emerald: { bg: "bg-emerald-50", iconBg: "bg-emerald-100", text: "text-emerald-700", label: "text-emerald-600/80" },
  amber: { bg: "bg-amber-50", iconBg: "bg-amber-100", text: "text-amber-700", label: "text-amber-600/80" },
  rose: { bg: "bg-rose-50", iconBg: "bg-rose-100", text: "text-rose-700", label: "text-rose-600/80" },
};

// Tarjeta de métrica cálida: ícono en chip + número grande + etiqueta. (Envuélvela en <Link> si es clicable.)
export function Kpi({
  icon,
  valor,
  label,
  tone = "slate",
}: {
  icon: string;
  valor: ReactNode;
  label: string;
  tone?: KpiTone;
}) {
  const t = kpiTones[tone];
  return (
    <div className={`rounded-2xl p-4 ${t.bg} transition hover:shadow-sm`}>
      <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl text-[18px] ${t.iconBg} ${t.text}`}>
        <Icon name={icon} />
      </span>
      <div className={`text-3xl font-bold tabular-nums ${t.text}`}>{valor}</div>
      <div className={`mt-0.5 text-xs ${t.label}`}>{label}</div>
    </div>
  );
}

// Estado vacío amigable: ícono suave + mensaje.
export function EstadoVacio({ icon = "sparkles", children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-[20px] text-slate-400">
        <Icon name={icon} />
      </span>
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { mxn, horas } from "@/lib/format";
import { motivoLicencia } from "@/lib/licencias";
import { Badge, Card, EstadoVacio, inputClass, selectClass } from "@/components/ui";

export type FilaUI = {
  id: string;
  nombre: string;
  imagen: string | null;
  fuente: string;
  nicho: string | null;
  licencia: string;
  marcaIp: string;
  riesgo: "verde" | "amarillo" | "rojo";
  apto: boolean;
  categoria: string;
  tipoFilamento: string;
  gramos: number;
  tiempoMin: number;
  costoTotal: number;
  precioVenta: number;
  margenPct: number;
  rentabilidadHora: number;
  tiempoEntregaDias: number;
  estadoValidacion: string;
  publicadoMl: boolean;
  mlPermalink: string | null;
  mlEstado: string | null;
};

type SortKey =
  | "nombre"
  | "riesgo"
  | "licencia"
  | "categoria"
  | "tiempoMin"
  | "gramos"
  | "costoTotal"
  | "precioVenta"
  | "margenPct"
  | "rentabilidadHora"
  | "tiempoEntregaDias"
  | "estadoValidacion";

// hide = clases para ocultar columnas no esenciales en móvil (se ven al ampliar / en escritorio).
const COLS: { key: SortKey; right?: boolean; hide?: string }[] = [
  { key: "nombre" },
  { key: "riesgo" },
  { key: "licencia" },
  { key: "categoria", hide: "hidden lg:table-cell" },
  { key: "tiempoMin", right: true, hide: "hidden xl:table-cell" },
  { key: "gramos", right: true, hide: "hidden xl:table-cell" },
  { key: "costoTotal", right: true, hide: "hidden lg:table-cell" },
  { key: "precioVenta", right: true },
  { key: "margenPct", right: true, hide: "hidden lg:table-cell" },
  { key: "rentabilidadHora", right: true },
  { key: "tiempoEntregaDias", right: true, hide: "hidden xl:table-cell" },
  { key: "estadoValidacion" },
];

const NUM: Set<SortKey> = new Set([
  "tiempoMin",
  "gramos",
  "costoTotal",
  "precioVenta",
  "margenPct",
  "rentabilidadHora",
  "tiempoEntregaDias",
]);

function distinct(arr: (string | null)[]): string[] {
  return [...new Set(arr.filter(Boolean) as string[])].sort();
}

// Nivel de riesgo (capa IP + licencia): 🟢 100% limpio · 🟡 IP-limpio, licencia restringida · 🔴 MARCA/IP.
const RIESGO_META: Record<FilaUI["riesgo"], { emoji: string; tone: "green" | "amber" | "red" }> = {
  verde: { emoji: "🟢", tone: "green" },
  amarillo: { emoji: "🟡", tone: "amber" },
  rojo: { emoji: "🔴", tone: "red" },
};
const RIESGO_RANK: Record<FilaUI["riesgo"], number> = { verde: 0, amarillo: 1, rojo: 2 };

export function TablaModelos({ filas }: { filas: FilaUI[] }) {
  const t = useTranslations("tabla");
  const [q, setQ] = useState("");
  const [fLic, setFLic] = useState("");
  const [fCat, setFCat] = useState("");
  const [fFil, setFFil] = useState("");
  const [fEst, setFEst] = useState("");
  const [fRiesgo, setFRiesgo] = useState("");
  const [soloAptos, setSoloAptos] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("rentabilidadHora");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const opcLic = useMemo(() => distinct(filas.map((f) => f.licencia)), [filas]);
  const opcCat = useMemo(() => distinct(filas.map((f) => f.categoria)), [filas]);
  const opcFil = useMemo(() => distinct(filas.map((f) => f.tipoFilamento)), [filas]);
  const opcEst = useMemo(() => distinct(filas.map((f) => f.estadoValidacion)), [filas]);

  const vista = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtradas = filas.filter((f) => {
      if (soloAptos && !f.apto) return false;
      if (fRiesgo && f.riesgo !== fRiesgo) return false;
      if (fLic && f.licencia !== fLic) return false;
      if (fCat && f.categoria !== fCat) return false;
      if (fFil && f.tipoFilamento !== fFil) return false;
      if (fEst && f.estadoValidacion !== fEst) return false;
      if (term) {
        const blob = `${f.nombre} ${f.nicho ?? ""} ${f.fuente} ${f.categoria}`.toLowerCase();
        if (!blob.includes(term)) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return filtradas.sort((a, b) => {
      if (sortKey === "riesgo") return (RIESGO_RANK[a.riesgo] - RIESGO_RANK[b.riesgo]) * dir;
      const va = a[sortKey];
      const vb = b[sortKey];
      if (NUM.has(sortKey)) return ((va as number) - (vb as number)) * dir;
      return String(va).localeCompare(String(vb), "es") * dir;
    });
  }, [filas, q, fLic, fCat, fFil, fEst, fRiesgo, soloAptos, sortKey, sortDir]);

  function ordenarPor(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(NUM.has(key) ? "desc" : "asc");
    }
  }

  function limpiar() {
    setQ("");
    setFLic("");
    setFCat("");
    setFFil("");
    setFEst("");
    setFRiesgo("");
    setSoloAptos(false);
  }

  const flecha = (key: SortKey) => (key === sortKey ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="space-y-3">
      {/* Toolbar de filtros por columna */}
      <Card className="flex flex-wrap items-center gap-2 p-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("buscarPlaceholder")}
          className={`${inputClass} w-56`}
        />
        <select value={fRiesgo} onChange={(e) => setFRiesgo(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="">{t("filtroRiesgoTodos")}</option>
          <option value="verde">{t("riesgoVerde")}</option>
          <option value="amarillo">{t("riesgoAmarillo")}</option>
          <option value="rojo">{t("riesgoRojo")}</option>
        </select>
        <select value={fLic} onChange={(e) => setFLic(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="">{t("filtroLicenciaTodas")}</option>
          {opcLic.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="">{t("filtroCategoriaTodas")}</option>
          {opcCat.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={fFil} onChange={(e) => setFFil(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="">{t("filtroFilamentoTodos")}</option>
          {opcFil.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <select value={fEst} onChange={(e) => setFEst(e.target.value)} className={`${selectClass} w-auto`}>
          <option value="">{t("filtroEstadoTodos")}</option>
          {opcEst.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={soloAptos} onChange={(e) => setSoloAptos(e.target.checked)} />
          {t("soloAptos")}
        </label>
        <button onClick={limpiar} className="ml-auto text-sm text-slate-500 hover:text-slate-800">
          {t("limpiar")}
        </button>
        <span className="text-sm font-medium text-slate-500">{t("resultados", { n: vista.length })}</span>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {COLS.map((c) => (
                <th key={c.key} className={`px-3 py-2.5 ${c.right ? "text-right" : ""} ${c.hide ?? ""}`}>
                  <button
                    onClick={() => ordenarPor(c.key)}
                    className={`inline-flex items-center font-semibold uppercase hover:text-slate-900 ${
                      c.key === sortKey ? "text-brand" : ""
                    }`}
                  >
                    {t(`col.${c.key}`)}
                    {flecha(c.key)}
                  </button>
                </th>
              ))}
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {vista.map((f) => (
              <tr key={f.id} className={`border-t border-slate-100 ${f.apto ? "hover:bg-slate-50" : "bg-rose-50/60"}`}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {f.imagen ? (
                      <Image
                        src={f.imagen}
                        alt={f.nombre}
                        width={48}
                        height={48}
                        className="h-12 w-12 flex-none rounded-md border border-slate-200 object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-12 w-12 flex-none items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
                        {t("sinFoto")}
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-slate-900">{f.nombre}</div>
                      <div className="text-xs text-slate-400">
                        {f.fuente}
                        {f.nicho ? ` · ${f.nicho}` : ""}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={RIESGO_META[f.riesgo].tone} title={t(`riesgoTitulo.${f.riesgo}`)}>
                    {RIESGO_META[f.riesgo].emoji} {t(`riesgoLabel.${f.riesgo}`)}
                  </Badge>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={f.apto ? "green" : "red"} title={motivoLicencia(f.licencia)}>
                    {f.apto ? "✓ " : "✕ "}
                    {f.licencia}
                  </Badge>
                </td>
                <td className="px-3 py-2.5 text-slate-600 hidden lg:table-cell">{f.categoria}</td>
                <td className="px-3 py-2.5 text-right tabular-nums hidden xl:table-cell">{horas(f.tiempoMin)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 hidden xl:table-cell">
                  {t("gramosFilamento", { g: f.gramos, filamento: f.tipoFilamento })}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">{mxn(f.costoTotal)}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums">{mxn(f.precioVenta)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">{f.margenPct}%</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-emerald-700">
                  {mxn(f.rentabilidadHora)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums hidden xl:table-cell">
                  {t("dias", { d: f.tiempoEntregaDias })}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1">
                    <Badge
                      tone={
                        f.estadoValidacion === "Validado"
                          ? "green"
                          : f.estadoValidacion === "Rechazado"
                            ? "red"
                            : "amber"
                      }
                    >
                      {f.estadoValidacion}
                    </Badge>
                    {f.publicadoMl &&
                      (f.mlPermalink && f.mlEstado === "active" ? (
                        <a
                          href={f.mlPermalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 hover:bg-sky-200"
                          title={t("abrirAnuncio")}
                        >
                          {t("enMlLink")}
                        </a>
                      ) : (
                        <Badge
                          tone="slate"
                          title={f.mlEstado ? t("estatusMl", { estado: f.mlEstado }) : t("publicado")}
                        >
                          {t("enMl")}
                          {f.mlEstado && f.mlEstado !== "active"
                            ? ` · ${
                                f.mlEstado === "under_review"
                                  ? t("mlEnRevision")
                                  : f.mlEstado === "paused"
                                    ? t("mlPausado")
                                    : f.mlEstado
                              }`
                            : ""}
                        </Badge>
                      ))}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <Link href={`/modelos/${f.id}`} className="font-medium text-brand hover:underline">
                    {t("editar")}
                  </Link>
                </td>
              </tr>
            ))}
            {vista.length === 0 && (
              <tr>
                <td colSpan={13} className="px-3 py-8">
                  <EstadoVacio icon="box">{t("vacio")}</EstadoVacio>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCatalogo, type FilaCatalogo } from "@/lib/datos";
import { nivelRiesgo } from "@/lib/riesgo";
import { btnPrimary } from "@/components/ui";
import { TablaModelos, type FilaUI } from "./TablaModelos";

export const dynamic = "force-dynamic";

const VISTAS = ["todos", "listos", "rentabilidad", "rapidos", "riesgo", "nicho"] as const;

type Vista = (typeof VISTAS)[number];

function filtrar(filas: FilaCatalogo[], vista: Vista, nicho?: string): FilaCatalogo[] {
  switch (vista) {
    case "listos":
      return filas.filter(
        (f) => f.apto && f.modelo.estadoValidacion === "Validado" && !f.modelo.publicadoMl,
      );
    case "rapidos":
      return filas.filter((f) => f.modelo.tiempoImpresionMin < 180);
    case "riesgo":
      return filas.filter((f) => nivelRiesgo(f.modelo.marcaIp, f.modelo.licencia) === "rojo");
    case "nicho":
      return nicho ? filas.filter((f) => f.modelo.nicho === nicho) : filas;
    default:
      return filas;
  }
}

function aFilaUI(f: FilaCatalogo): FilaUI {
  return {
    id: f.modelo.id,
    nombre: f.modelo.nombre,
    imagen: f.modelo.imagenes?.[0] ?? null,
    fuente: f.modelo.fuente,
    nicho: f.modelo.nicho,
    licencia: f.modelo.licencia,
    marcaIp: f.modelo.marcaIp ?? "no",
    riesgo: nivelRiesgo(f.modelo.marcaIp, f.modelo.licencia),
    apto: f.apto,
    categoria: f.modelo.categoria,
    tipoFilamento: f.modelo.tipoFilamento,
    gramos: f.modelo.gramosFilamento,
    tiempoMin: f.modelo.tiempoImpresionMin,
    costoTotal: f.costeo.costoTotal,
    precioVenta: f.costeo.precioVenta,
    margenPct: f.costeo.margenPct,
    rentabilidadHora: f.costeo.rentabilidadHora,
    tiempoEntregaDias: f.costeo.tiempoEntregaDias,
    estadoValidacion: f.modelo.estadoValidacion,
    publicadoMl: f.modelo.publicadoMl,
    mlPermalink: f.modelo.mlPermalink ?? null,
    mlEstado: f.modelo.mlEstado ?? null,
  };
}

export default async function ModelosPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; nicho?: string }>;
}) {
  const t = await getTranslations("modelos");
  const sp = await searchParams;
  const vista = (VISTAS.find((v) => v === sp.vista) ?? "todos") as Vista;
  const nicho = sp.nicho;

  const { filas } = await getCatalogo();
  const filtradas = filtrar(filas, vista, nicho);
  const nichos = [...new Set(filas.map((f) => f.modelo.nicho).filter(Boolean))] as string[];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
          <p className="text-sm text-slate-500">{t(`vistas.${vista}.desc`)}</p>
        </div>
        <Link href="/modelos/nuevo" className={btnPrimary}>
          + {t("nuevoModelo")}
        </Link>
      </div>

      {/* Vistas predefinidas (servidor) */}
      <div className="flex flex-wrap gap-2">
        {VISTAS.map((v) => {
          const activo = v === vista;
          return (
            <Link
              key={v}
              href={`/modelos?vista=${v}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                activo
                  ? "bg-brand text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t(`vistas.${v}.label`)}
            </Link>
          );
        })}
      </div>

      {vista === "nicho" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{t("nicho")}</span>
          {nichos.map((n) => (
            <Link
              key={n}
              href={`/modelos?vista=nicho&nicho=${encodeURIComponent(n)}`}
              className={`rounded-full px-2.5 py-1 ${
                nicho === n
                  ? "bg-brand text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      )}

      {/* Tabla ordenable + filtrable por columna (cliente) */}
      <TablaModelos filas={filtradas.map(aFilaUI)} />
    </div>
  );
}

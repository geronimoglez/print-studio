// Sala de Revisión: galería del LOTE pendiente de aprobar. El equipo selecciona modelos y los Publica o
// Descarta con un clic (server action accionLote → publicarModelo, gate fail-closed). También se puede
// aprobar por Telegram con el bot. Misma fuente de verdad que el bot (la BD).
import Image from "next/image";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { nivelRiesgo, esPublicable, type NivelRiesgo } from "@/lib/riesgo";
import { Badge, Card, EstadoVacio, btnPrimary, btnGhost } from "@/components/ui";
import { accionLote } from "../actions";

export const dynamic = "force-dynamic";

const RANK: Record<NivelRiesgo, number> = { verde: 0, amarillo: 1, rojo: 2 };
const TONO: Record<NivelRiesgo, "green" | "amber" | "red"> = { verde: "green", amarillo: "amber", rojo: "red" };
const EMOJI: Record<NivelRiesgo, string> = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };

export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ fuente?: string; ok?: string; fail?: string; desc?: string }>;
}) {
  const t = await getTranslations("revision");
  const locale = await getLocale();
  const sp = await searchParams;
  const modelos = await prisma.modelo.findMany({
    where: { estadoValidacion: "Pendiente", publicadoMl: false, ...(sp.fuente ? { fuente: sp.fuente } : {}) },
  });
  const lote = modelos
    .map((m) => ({ m, nivel: nivelRiesgo(m.marcaIp, m.licencia) }))
    .filter((x) => esPublicable(x.m.marcaIp, x.m.licencia))
    .sort((a, b) => RANK[a.nivel] - RANK[b.nivel] || a.m.nombre.localeCompare(b.m.nombre, locale))
    .map((x, i) => ({ ...x, numero: i + 1 }));

  const verdes = lote.filter((l) => l.nivel === "verde").length;
  const amarillos = lote.filter((l) => l.nivel === "amarillo").length;

  const NOMBRE_NIVEL: Record<NivelRiesgo, string> = {
    verde: t("nivel.verde"),
    amarillo: t("nivel.amarillo"),
    rojo: t("nivel.rojo"),
  };

  // Banner de resultado tras una acción (vuelve por query: ?ok=&fail=&desc=)
  const rOk = Number(sp.ok ?? 0), rFail = Number(sp.fail ?? 0), rDesc = Number(sp.desc ?? 0);
  const huboResultado = !!(sp.ok || sp.fail || sp.desc);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">
          {t("subtitulo", { n: lote.length, verde: EMOJI.verde, verdes, amarillo: EMOJI.amarillo, amarillos })}{" "}
          {t("subtituloAccion.antes")}{" "}
          <span className="font-medium text-slate-700">{t("subtituloAccion.publica")}</span>{" "}
          {t("subtituloAccion.o")}{" "}
          <span className="font-medium text-slate-700">{t("subtituloAccion.descarta")}</span>{" "}
          {t("subtituloAccion.despues")}
        </p>
      </div>

      {huboResultado && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
          {rOk > 0 && <span className="mr-3 font-medium text-emerald-700">{t("resultado.publicados", { n: rOk })}</span>}
          {rDesc > 0 && <span className="mr-3 font-medium text-slate-600">{t("resultado.descartados", { n: rDesc })}</span>}
          {rFail > 0 && <span className="font-medium text-rose-700">{t("resultado.fallidos", { n: rFail })}</span>}
          {rOk === 0 && rDesc === 0 && rFail === 0 && <span>{t("resultado.ninguno")}</span>}
        </div>
      )}

      {lote.length === 0 ? (
        <Card>
          <EstadoVacio icon="sparkles">{t("vacio")}</EstadoVacio>
        </Card>
      ) : (
        <form action={accionLote} className="space-y-4">
          {/* Barra de acciones (sticky para que esté siempre a la mano) */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <span className="text-sm text-slate-500">{t("barra.instruccion")}</span>
            <button type="submit" name="accion" value="publicar" className={`${btnPrimary} ml-auto`}>
              {t("barra.publicar")}
            </button>
            <button
              type="submit"
              name="accion"
              value="descartar"
              className={`${btnGhost} border-rose-300 text-rose-700 hover:bg-rose-50`}
            >
              {t("barra.descartar")}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lote.map(({ m, nivel, numero }) => (
              <label
                key={m.id}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition has-[:checked]:border-brand has-[:checked]:ring-2 has-[:checked]:ring-brand/30"
              >
                <div className="relative aspect-square bg-slate-50">
                  {m.imagenes?.[0] ? (
                    <Image src={m.imagenes[0]} alt={m.nombre} fill sizes="240px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">{t("sinFoto")}</div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white">
                    #{numero}
                  </span>
                  <input
                    type="checkbox"
                    name="ids"
                    value={m.id}
                    className="absolute right-2 top-2 h-5 w-5 cursor-pointer accent-brand"
                  />
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="truncate text-sm font-medium text-slate-900" title={m.nombre}>
                    {m.nombre}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone={TONO[nivel]} title={NOMBRE_NIVEL[nivel]}>
                      {EMOJI[nivel]} {nivel}
                    </Badge>
                    <Badge tone="slate" title={t("licenciaTitle")}>
                      {m.licencia}
                    </Badge>
                  </div>
                  <div className="truncate text-xs text-slate-400" title={m.fuente}>
                    {m.fuente}
                    {m.categoria ? ` · ${m.categoria}` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </form>
      )}
    </div>
  );
}

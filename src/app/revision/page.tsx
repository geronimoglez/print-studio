// Sala de Revisión: galería del LOTE pendiente de aprobar. Blas selecciona modelos y los Publica o
// Descarta con un clic (server action accionLote → publicarModelo, gate fail-closed). También se puede
// aprobar por Telegram con el bot. Misma fuente de verdad que el bot (la BD).
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { nivelRiesgo, esPublicable, type NivelRiesgo } from "@/lib/riesgo";
import { Badge } from "@/components/ui";
import { accionLote } from "../actions";

export const dynamic = "force-dynamic";

const RANK: Record<NivelRiesgo, number> = { verde: 0, amarillo: 1, rojo: 2 };
const TONO: Record<NivelRiesgo, "green" | "amber" | "red"> = { verde: "green", amarillo: "amber", rojo: "red" };
const EMOJI: Record<NivelRiesgo, string> = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
const NOMBRE_NIVEL: Record<NivelRiesgo, string> = { verde: "Verde · publicable", amarillo: "Amarillo · con tu OK", rojo: "Rojo · IP" };

export default async function RevisionPage({
  searchParams,
}: {
  searchParams: Promise<{ fuente?: string; ok?: string; fail?: string; desc?: string }>;
}) {
  const sp = await searchParams;
  const modelos = await prisma.modelo.findMany({
    where: { estadoValidacion: "Pendiente", publicadoMl: false, ...(sp.fuente ? { fuente: sp.fuente } : {}) },
  });
  const lote = modelos
    .map((m) => ({ m, nivel: nivelRiesgo(m.marcaIp, m.licencia) }))
    .filter((x) => esPublicable(x.m.marcaIp, x.m.licencia))
    .sort((a, b) => RANK[a.nivel] - RANK[b.nivel] || a.m.nombre.localeCompare(b.m.nombre, "es"))
    .map((x, i) => ({ ...x, numero: i + 1 }));

  const verdes = lote.filter((l) => l.nivel === "verde").length;
  const amarillos = lote.filter((l) => l.nivel === "amarillo").length;

  // Banner de resultado tras una acción (vuelve por query: ?ok=&fail=&desc=)
  const rOk = Number(sp.ok ?? 0), rFail = Number(sp.fail ?? 0), rDesc = Number(sp.desc ?? 0);
  const huboResultado = !!(sp.ok || sp.fail || sp.desc);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sala de Revisión</h1>
        <p className="text-sm text-slate-500">
          Lote pendiente de aprobar · {lote.length} modelos ({EMOJI.verde} {verdes} verde · {EMOJI.amarillo} {amarillos} amarillo).
          Selecciona y <span className="font-medium text-slate-700">Publica</span> o <span className="font-medium text-slate-700">Descarta</span>; o apruébalos por Telegram con el bot.
        </p>
      </div>

      {huboResultado && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
          {rOk > 0 && <span className="mr-3 font-medium text-emerald-700">✅ {rOk} publicado(s)</span>}
          {rDesc > 0 && <span className="mr-3 font-medium text-slate-600">🗑 {rDesc} descartado(s)</span>}
          {rFail > 0 && <span className="font-medium text-rose-700">⚠️ {rFail} no se pudo(eron) publicar (revisa el modelo)</span>}
          {rOk === 0 && rDesc === 0 && rFail === 0 && <span>No se seleccionó ningún modelo.</span>}
        </div>
      )}

      {lote.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          No hay modelos pendientes de revisión. (Importa un lote para que aparezca aquí.)
        </div>
      ) : (
        <form action={accionLote} className="space-y-4">
          {/* Barra de acciones (sticky para que esté siempre a la mano) */}
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
            <span className="text-sm text-slate-500">Marca los que quieras y elige una acción:</span>
            <button
              type="submit"
              name="accion"
              value="publicar"
              className="ml-auto inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              ✅ Publicar seleccionados
            </button>
            <button
              type="submit"
              name="accion"
              value="descartar"
              className="inline-flex items-center rounded-md border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
            >
              🗑 Descartar seleccionados
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {lote.map(({ m, nivel, numero }) => (
              <label
                key={m.id}
                className="group cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition has-[:checked]:border-cyan-500 has-[:checked]:ring-2 has-[:checked]:ring-cyan-300"
              >
                <div className="relative aspect-square bg-slate-50">
                  {m.imagenes?.[0] ? (
                    <Image src={m.imagenes[0]} alt={m.nombre} fill sizes="240px" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-slate-400">sin foto</div>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-xs font-bold text-white">
                    #{numero}
                  </span>
                  <input
                    type="checkbox"
                    name="ids"
                    value={m.id}
                    className="absolute right-2 top-2 h-5 w-5 cursor-pointer accent-cyan-600"
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
                    <Badge tone="slate" title="Licencia del archivo">
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

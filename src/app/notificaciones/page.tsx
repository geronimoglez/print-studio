// Centro de notificaciones: (1) a qué correos avisamos / queremos que ML avise (monitoreo), y (2) el log
// de avisos de ML recibidos por correo (lo que entra por /api/ml/correo). Pensado multi-creador.
import Link from "next/link";
import { getTranslations, getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { Badge, Card, Kpi, EstadoVacio, inputClass, selectClass, btnPrimary } from "@/components/ui";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const TONO: Record<string, "red" | "amber" | "blue" | "green" | "slate"> = {
  moderacion: "red", venta: "green", pregunta: "amber", colaboracion: "blue", otro: "slate",
};

async function agregarDestino(fd: FormData) {
  "use server";
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!email || !/.+@.+\..+/.test(email)) return;
  await prisma.notificacionDestino.upsert({
    where: { email },
    update: { etiqueta: String(fd.get("etiqueta") ?? "") || null, tipo: String(fd.get("tipo") ?? "adicional"), activo: true },
    create: { email, etiqueta: String(fd.get("etiqueta") ?? "") || null, tipo: String(fd.get("tipo") ?? "adicional") },
  });
  revalidatePath("/notificaciones");
}

async function toggleDestino(fd: FormData) {
  "use server";
  const id = String(fd.get("id") ?? "");
  const d = await prisma.notificacionDestino.findUnique({ where: { id } });
  if (d) await prisma.notificacionDestino.update({ where: { id }, data: { activo: !d.activo } });
  revalidatePath("/notificaciones");
}

export default async function NotificacionesPage() {
  const t = await getTranslations("notificaciones");
  const locale = await getLocale();
  const [destinos, avisos, sinLeer] = await Promise.all([
    prisma.notificacionDestino.findMany({ orderBy: [{ tipo: "asc" }, { creadoEn: "asc" }] }),
    prisma.avisoCorreo.findMany({ orderBy: { recibidoEn: "desc" }, take: 50, include: { modelo: { select: { id: true, nombre: true } } } }),
    prisma.avisoCorreo.count({ where: { leido: false } }),
  ]);

  // Etiqueta visible para el tipo de destino (el valor de datos se conserva tal cual en el formulario).
  const etiquetaTipo = (tipo: string): string => {
    if (tipo === "cuenta-ml") return t("tipo.cuentaMl");
    if (tipo === "reenvio") return t("tipo.reenvio");
    if (tipo === "adicional") return t("tipo.adicional");
    return tipo;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("titulo")}</h1>
        <p className="text-sm text-slate-500">{t("subtitulo")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Kpi icon="check" valor={avisos.length} label={t("kpi.recientes")} tone="sky" />
        <Kpi icon="alert" valor={sinLeer} label={t("kpi.sinLeer")} tone={sinLeer > 0 ? "amber" : "slate"} />
      </div>

      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">{t("guia.titulo")}</summary>
        <p className="mt-3">
          {t("guia.parte1")}{" "}
          <Link href="/salud" className="font-medium text-brand hover:underline">{t("guia.enlaceSalud")}</Link>
          {t("guia.parte2")}
        </p>
        <p className="mt-2 text-xs text-slate-500">{t("guia.nota")}</p>
      </details>

      {/* Destinos */}
      <Card title={t("destinos.titulo")}>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {destinos.length === 0 && (
            <EstadoVacio icon="sparkles">{t("destinos.vacio")}</EstadoVacio>
          )}
          {destinos.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{d.email}</span>
              {d.etiqueta && <span className="text-xs text-slate-500">{d.etiqueta}</span>}
              <Badge tone={d.tipo === "cuenta-ml" ? "blue" : d.tipo === "reenvio" ? "slate" : "green"}>{etiquetaTipo(d.tipo)}</Badge>
              <Badge tone={d.activo ? "green" : "slate"}>{d.activo ? t("estado.activo") : t("estado.pausado")}</Badge>
              <form action={toggleDestino}>
                <input type="hidden" name="id" defaultValue={d.id} />
                <button type="submit" className="text-xs text-slate-500 hover:text-slate-800">
                  {d.activo ? t("accion.pausar") : t("accion.activar")}
                </button>
              </form>
            </div>
          ))}
        </div>
        <form action={agregarDestino} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <input name="email" type="email" required placeholder={t("form.emailPlaceholder")} className={`${inputClass} flex-1 min-w-48`} />
          <input name="etiqueta" placeholder={t("form.etiquetaPlaceholder")} className={`${inputClass} w-40 flex-none`} />
          <select name="tipo" className={`${selectClass} w-auto flex-none`}>
            <option value="adicional">{t("tipo.adicional")}</option>
            <option value="cuenta-ml">{t("tipo.cuentaMl")}</option>
            <option value="reenvio">{t("tipo.reenvio")}</option>
          </select>
          <button type="submit" className={btnPrimary}>{t("form.agregar")}</button>
        </form>
      </Card>

      {/* Log de avisos */}
      <Card title={t("avisos.titulo")}>
        {avisos.length === 0 ? (
          <EstadoVacio icon="sparkles">{t("avisos.vacio")}</EstadoVacio>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {avisos.map((a) => (
              <div key={a.id} className="border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Badge tone={TONO[a.tipo ?? "otro"] ?? "slate"}>{a.tipo}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{a.asunto}</span>
                  <span className="flex-none text-xs text-slate-400">{new Date(a.recibidoEn).toLocaleString(locale)}</span>
                </div>
                {a.motivo && a.motivo !== a.asunto && <p className="mt-0.5 text-xs leading-snug text-slate-600">{a.motivo}</p>}
                {a.modelo && <Link href={`/modelos/${a.modelo.id}`} className="text-xs text-brand hover:underline">{a.modelo.nombre} ↗</Link>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

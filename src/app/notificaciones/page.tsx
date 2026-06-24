// Centro de notificaciones: (1) a qué correos avisamos / queremos que ML avise (monitoreo), y (2) el log
// de avisos de ML recibidos por correo (lo que entra por /api/ml/correo). Pensado multi-creador.
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui";
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
  const [destinos, avisos, sinLeer] = await Promise.all([
    prisma.notificacionDestino.findMany({ orderBy: [{ tipo: "asc" }, { creadoEn: "asc" }] }),
    prisma.avisoCorreo.findMany({ orderBy: { recibidoEn: "desc" }, take: 50, include: { modelo: { select: { id: true, nombre: true } } } }),
    prisma.avisoCorreo.count({ where: { leido: false } }),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
        <p className="text-sm text-slate-500">A qué correos avisamos y qué avisos de Mercado Libre van llegando ({avisos.length} recientes · {sinLeer} sin leer).</p>
      </div>

      <details className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 [&_summary]:cursor-pointer">
        <summary className="font-semibold text-slate-800">📘 ¿Cómo funciona? (guía rápida)</summary>
        <p className="mt-3">Mercado Libre manda los avisos (rechazos, ventas, preguntas) por correo a la cuenta. Ese correo se reenvía a Gmail y un pequeño script lo manda aquí, que <b>extrae el motivo y el anuncio</b> y lo muestra. Así el motivo del rechazo aparece también en <Link href="/salud" className="text-cyan-700 hover:underline">Salud ML</Link>, no solo el código.</p>
        <p className="mt-2 text-xs text-slate-500">Abajo administras a qué correos avisamos (para monitoreo). La config de qué correos recibe Mercado Libre se ajusta en la cuenta de ML; aquí solo lo registramos y vemos qué llega.</p>
      </details>

      {/* Destinos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">📤 Correos que avisamos / monitoreamos</h2>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {destinos.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Aún no hay correos registrados.</div>}
          {destinos.map((d) => (
            <div key={d.id} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0">
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{d.email}</span>
              {d.etiqueta && <span className="text-xs text-slate-500">{d.etiqueta}</span>}
              <Badge tone={d.tipo === "cuenta-ml" ? "blue" : d.tipo === "reenvio" ? "slate" : "green"}>{d.tipo}</Badge>
              <Badge tone={d.activo ? "green" : "slate"}>{d.activo ? "activo" : "pausado"}</Badge>
              <form action={toggleDestino}>
                <input type="hidden" name="id" defaultValue={d.id} />
                <button type="submit" className="text-xs text-slate-500 hover:text-slate-800">{d.activo ? "pausar" : "activar"}</button>
              </form>
            </div>
          ))}
        </div>
        <form action={agregarDestino} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm">
          <input name="email" type="email" required placeholder="correo@dominio.com" className="flex-1 min-w-48 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
          <input name="etiqueta" placeholder="etiqueta (ej. Simón)" className="w-40 rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none" />
          <select name="tipo" className="rounded-md border border-slate-300 px-2 py-2">
            <option value="adicional">adicional</option>
            <option value="cuenta-ml">cuenta-ml</option>
            <option value="reenvio">reenvío</option>
          </select>
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700">Agregar</button>
        </form>
      </section>

      {/* Log de avisos */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800">📥 Avisos de Mercado Libre recibidos</h2>
        {avisos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Aún no llega ningún aviso. Cuando ML mande un correo (rechazo, venta…) y el reenvío esté configurado, aparecerá aquí con su motivo.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {avisos.map((a) => (
              <div key={a.id} className="border-b border-slate-100 px-3 py-2 last:border-0 hover:bg-slate-50">
                <div className="flex items-center gap-2">
                  <Badge tone={TONO[a.tipo ?? "otro"] ?? "slate"}>{a.tipo}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{a.asunto}</span>
                  <span className="flex-none text-xs text-slate-400">{new Date(a.recibidoEn).toLocaleString("es-MX")}</span>
                </div>
                {a.motivo && a.motivo !== a.asunto && <p className="mt-0.5 text-xs leading-snug text-slate-600">{a.motivo}</p>}
                {a.modelo && <Link href={`/modelos/${a.modelo.id}`} className="text-xs text-cyan-700 hover:underline">{a.modelo.nombre} ↗</Link>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

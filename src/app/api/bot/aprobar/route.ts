// Aprobación por LOTE (el ✅ del operador vía Telegram). Recibe ids a publicar y/o descartar.
//   publicarIds  → publicarModelo() cada uno (el gate IP/licencia bloquea 🔴 aunque venga en la lista).
//   descartarIds → estadoValidacion = "Rechazado" (queda fuera, no se borra).
// Regla fail-closed: un id 🔴 NUNCA se publica; se reporta como bloqueado. Auth: x-bot-key.
import { prisma } from "@/lib/prisma";
import { publicarModelo } from "@/lib/mercadolibre";
import { esPublicable, nivelRiesgo } from "@/lib/riesgo";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // publicar muchos a la vez puede tardar (1 llamada a ML por modelo)

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { publicarIds?: string[]; descartarIds?: string[] };
  const publicarIds = body.publicarIds ?? [];
  const descartarIds = body.descartarIds ?? [];

  const publicados: Array<Record<string, unknown>> = [];
  for (const id of publicarIds) {
    const m = await prisma.modelo.findUnique({ where: { id } });
    if (!m) { publicados.push({ id, ok: false, error: "no existe" }); continue; }
    // fail-closed: aunque el operador lo haya incluido, si es 🔴 IP no se publica.
    if (!esPublicable(m.marcaIp, m.licencia)) {
      publicados.push({ id, nombre: m.nombre, ok: false, bloqueado: true, nivel: nivelRiesgo(m.marcaIp, m.licencia), error: "🔴 MARCA/IP — no se publica" });
      continue;
    }
    const r = await publicarModelo(id);
    publicados.push({ id, nombre: m.nombre, ok: r.ok, permalink: (r as { permalink?: string }).permalink, mlItemId: (r as { mlItemId?: string }).mlItemId, error: (r as { error?: string }).error });
  }

  let descartados = 0;
  if (descartarIds.length) {
    const r = await prisma.modelo.updateMany({ where: { id: { in: descartarIds } }, data: { estadoValidacion: "Rechazado" } });
    descartados = r.count;
  }

  const okPub = publicados.filter((p) => p.ok).length;
  const bloqueados = publicados.filter((p) => p.bloqueado).length;
  return Response.json({ ok: true, publicados, descartados, resumen: { publicados: okPub, bloqueados, descartados, fallidos: publicados.length - okPub - bloqueados } });
}

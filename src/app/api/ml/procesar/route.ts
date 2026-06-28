// Worker de webhooks de ML: procesa la cola de Notificacion (que llena /api/ml/callbacknotice).
// - orders_v2 / payments → re-sincroniza órdenes → Pedidos.
// - items → revisa estado; si quedó forbidden/anulado/closed, marca el modelo y deja alerta.
// Llamado por el bot (poll) o un cron, con header x-bot-key === BOT_API_KEY.
import { prisma } from "@/lib/prisma";
import { getAccessTokenValido, sincronizarOrdenes } from "@/lib/mercadolibre";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorizado(req: Request) {
  if (process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY) return true;
  // Vercel Cron manda Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
}

/** Manda una alerta por Telegram a el operador (si hay token+chats configurados). */
async function alertarTelegram(texto: string) {
  const token = process.env.TELEGRAM_ALERT_TOKEN || process.env.TELEGRAM_BOT_TOKEN_LAB3D;
  const chats = (process.env.TELEGRAM_ALERT_CHATS || process.env.TELEGRAM_ALLOWED_IDS_LAB3D || "")
    .split(/[,\s]+/)
    .filter(Boolean);
  if (!token || !chats.length) return;
  await Promise.all(
    chats.map((chat) =>
      fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: texto, disable_web_page_preview: true }),
      }).catch(() => null),
    ),
  );
}

async function procesar() {
  const pend = await prisma.notificacion.findMany({
    where: { procesado: false },
    orderBy: { recibidoEn: "asc" },
    take: 200,
  });
  if (!pend.length) return { ok: true, procesadas: 0, ordenesSync: 0, problemas: 0 };

  const token = await getAccessTokenValido();
  const base = getBranding().appUrl;
  let huboOrden = false;
  const itemIds = new Set<string>(); // dedup: muchas notificaciones pueden ser del MISMO ítem

  for (const n of pend) {
    const topic = (n.topic || "").toLowerCase();
    if (topic.includes("order") || topic.includes("payment")) huboOrden = true;
    else if (topic.includes("item")) {
      const id = (n.resource || "").split("/").filter(Boolean).pop();
      if (id) itemIds.add(id);
    }
  }

  // Revisa cada ítem UNA sola vez, guarda su estado, y solo deja alerta si el problema es NUEVO (cambió).
  const nuevosProblemas: Array<{ nombre: string; estado: string; sub: string }> = [];
  if (token) {
    for (const id of itemIds) {
      try {
        const r = await fetch(`https://api.mercadolibre.com/items/${id}?attributes=id,status,sub_status`, { headers: { Authorization: `Bearer ${token}` } });
        const b = (await r.json()) as { status?: string; sub_status?: unknown };
        const m = await prisma.modelo.findFirst({ where: { mlItemId: id } });
        if (!m) continue;
        const estado = b.status ?? "";
        const sub = Array.isArray(b.sub_status) ? (b.sub_status as string[]).join(",") : "";
        const malo = estado === "closed" || /forbidden|denounced|under_review/i.test(sub);
        const cambio = m.mlEstado !== estado || (m.mlSubEstado ?? "") !== sub;
        await prisma.modelo.update({ where: { id: m.id }, data: { mlEstado: estado || null, mlSubEstado: sub || null, mlEstadoAt: new Date() } });
        if (malo && cambio) nuevosProblemas.push({ nombre: m.nombre, estado, sub });
      } catch {
        /* ignora ítems no legibles */
      }
    }
  }

  let ordenesSync = 0;
  if (huboOrden) {
    const r = await sincronizarOrdenes();
    ordenesSync = r.pedidos ?? r.ventas ?? 0;
  }
  await prisma.notificacion.updateMany({ where: { id: { in: pend.map((n) => n.id) } }, data: { procesado: true } });

  // Digest conciso (1 línea por ítem, sin repetir) — solo si hay pedidos nuevos o problemas NUEVOS.
  if (huboOrden || nuevosProblemas.length) {
    const lineas = [`🔔 ${getBranding().appName} — novedades de Mercado Libre`];
    if (huboOrden) lineas.push(`🛒 ${ordenesSync} pedido(s) nuevos/actualizados.`);
    if (nuevosProblemas.length) {
      const forb = nuevosProblemas.filter((p) => /forbidden/i.test(p.sub)).length;
      lineas.push(`⚠️ ${nuevosProblemas.length} anuncio(s) con problema nuevo${forb ? ` (${forb} prohibido(s))` : ""}:`);
      for (const p of nuevosProblemas.slice(0, 8)) lineas.push(`• ${p.nombre} — ${p.estado}${p.sub ? ` [${p.sub}]` : ""}`);
      if (nuevosProblemas.length > 8) lineas.push(`…y ${nuevosProblemas.length - 8} más`);
      lineas.push(`Revísalos cuando puedas: ${base}/salud`);
    }
    await alertarTelegram(lineas.join("\n"));
  }
  return { ok: true, procesadas: pend.length, ordenesSync, problemas: nuevosProblemas.length };
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  return Response.json(await procesar());
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  return Response.json(await procesar());
}

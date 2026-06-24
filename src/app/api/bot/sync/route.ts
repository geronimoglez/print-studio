import { sincronizarOrdenes } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

// Dispara la sincronización de órdenes de ML → ventas + pedidos (para el tablero/forecast).
// Útil para Hermes (cron) o disparo manual. Protegido con BOT_API_KEY.
function autorizado(req: Request) {
  const key = req.headers.get("x-bot-key");
  return !!process.env.BOT_API_KEY && key === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const r = await sincronizarOrdenes();
  return Response.json(r, { status: r.ok ? 200 : 400 });
}

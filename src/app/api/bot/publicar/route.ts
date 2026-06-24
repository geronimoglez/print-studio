import { publicarModelo } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

// Endpoint para Hermes/openclaw. Misma lógica que el botón copiloto.
// Flujo: openclaw recibe → delega a Hermes → Hermes llama aquí con header x-bot-key.
function autorizado(req: Request) {
  const key = req.headers.get("x-bot-key");
  return !!process.env.BOT_API_KEY && key === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { modeloId?: string };
  if (!body.modeloId) return Response.json({ ok: false, error: "falta modeloId" }, { status: 400 });
  const r = await publicarModelo(body.modeloId);
  return Response.json(r, { status: r.ok ? 200 : 400 });
}

// Refresca el estado de salud (active/paused/forbidden/closed) de todos los anuncios publicados
// desde la API de ML y lo guarda en cada modelo. Alimenta el panel /salud. Auth: x-bot-key.
import { sincronizarEstatusMl } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  return Response.json(await sincronizarEstatusMl());
}
export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  return Response.json(await sincronizarEstatusMl());
}

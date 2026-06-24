import { validarPublicacion } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const modeloId = new URL(req.url).searchParams.get("modeloId")?.trim() ?? "";
  if (!modeloId) return Response.json({ ok: false, error: "falta modeloId" }, { status: 400 });
  return Response.json(await validarPublicacion(modeloId));
}

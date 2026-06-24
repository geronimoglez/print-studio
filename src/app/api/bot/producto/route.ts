import { inspeccionarProducto } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id")?.trim() ?? "";
  if (!id) return Response.json({ ok: false, error: "falta id" }, { status: 400 });
  return Response.json(await inspeccionarProducto(id));
}

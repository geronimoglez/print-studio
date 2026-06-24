import { misItems } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  const key = req.headers.get("x-bot-key");
  return !!process.env.BOT_API_KEY && key === process.env.BOT_API_KEY;
}

// Diagnóstico: cómo están armadas las publicaciones reales del vendedor (categoría, catálogo, tipo).
export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  return Response.json(await misItems());
}

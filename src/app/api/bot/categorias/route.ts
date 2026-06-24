import { diagnosticarCategorias } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  const key = req.headers.get("x-bot-key");
  return !!process.env.BOT_API_KEY && key === process.env.BOT_API_KEY;
}

// Diagnóstico: GET /api/bot/categorias?q=... → categorías sugeridas y si permiten publicación libre.
export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ ok: false, error: "falta q" }, { status: 400 });
  return Response.json(await diagnosticarCategorias(q));
}

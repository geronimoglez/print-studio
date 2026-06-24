import { buscarCatalogo } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ ok: false, productos: [] });
  return Response.json(await buscarCatalogo(q));
}

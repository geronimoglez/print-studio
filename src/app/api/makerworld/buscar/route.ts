import { buscarEnMakerWorld } from "@/lib/importar/makerworld";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Firecrawl + extracción LLM puede tardar

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ resultados: [] });
  const resultados = await buscarEnMakerWorld(q);
  return Response.json({ resultados });
}

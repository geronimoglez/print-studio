// Enriquecimiento OPCIONAL desde MakerWorld/BambuLab.
// Frágil por diseño: si falla, no pasa nada. Solo enriquece, nunca es dependencia.
import { firecrawlScrapeJson } from "@/lib/firecrawl";

export type ResultadoMakerWorld = { titulo: string; url: string; imagen?: string; creador?: string };

const ESQUEMA_BUSQUEDA = {
  type: "object",
  properties: {
    modelos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string", description: "nombre del modelo" },
          url: { type: "string", description: "enlace a la página del modelo en makerworld.com" },
          imagen: { type: "string", description: "URL de la imagen de portada del modelo" },
          creador: { type: "string", description: "autor del modelo" },
        },
        required: ["titulo", "url"],
      },
    },
  },
  required: ["modelos"],
};

/** Busca modelos en MakerWorld por nombre (vía Firecrawl, que renderiza JS). */
export async function buscarEnMakerWorld(nombre: string): Promise<ResultadoMakerWorld[]> {
  const url = `https://makerworld.com/en/search/models?keyword=${encodeURIComponent(nombre)}`;
  const data = await firecrawlScrapeJson(
    url,
    ESQUEMA_BUSQUEDA,
    "Extrae la lista de modelos 3D de los resultados de búsqueda: título, URL del modelo, URL de la imagen de portada y creador. Hasta 12.",
  );
  const modelos = (data as { modelos?: ResultadoMakerWorld[] } | null)?.modelos ?? [];
  // MakerWorld rankea por relevancia → 9 es buen límite.
  return modelos.filter((m) => m?.url).slice(0, 9);
}

export type DatosMakerWorld = {
  designId: string;
  titulo?: string;
  rating?: number;
  popularidad?: number;
  creador?: string;
  coverUrl?: string;
};

/** Extrae el ID numérico de una URL de MakerWorld o acepta el ID directo. */
export function extraerId(input: string): string | null {
  const s = input.trim();
  const m =
    s.match(/models\/(\d+)/) ||
    s.match(/design\/(\d+)/) ||
    s.match(/^(\d+)$/);
  return m ? m[1] : null;
}

/** Mejor esfuerzo: lee metadata pública de un modelo. Devuelve null si no se puede. */
export async function fetchMakerWorld(input: string): Promise<DatosMakerWorld | null> {
  const id = extraerId(input);
  if (!id) return null;
  try {
    const r = await fetch(`https://api.bambulab.com/v1/design-service/design/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j: Record<string, unknown> = await r.json();
    const num = (v: unknown) => (typeof v === "number" ? v : undefined);
    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const designer = (j.designer ?? j.creator) as Record<string, unknown> | undefined;
    return {
      designId: id,
      titulo: str(j.title) ?? str(j.name),
      rating: num(j.rating) ?? num(j.score),
      popularidad: num(j.likeCount) ?? num(j.downloadCount) ?? num(j.likes),
      creador: designer ? str(designer.name) : undefined,
      coverUrl: str(j.coverUrl) ?? str(j.cover),
    };
  } catch {
    return null;
  }
}

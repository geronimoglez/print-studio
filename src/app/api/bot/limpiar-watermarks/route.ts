// Detecta (con IA/VLM) qué FOTOS reales tienen MARCA DE AGUA del creador y las REPORTA para revisión.
// NO modifica imágenes automáticamente: probamos parchar/borrar, pero (a) el parche blanco solo sirve en
// fondo blanco —estas fotos tienen fondos reales (jardín/mesa)— y (b) el VLM tiene falsos positivos, así
// que borrar fotos automáticamente puede tirar fotos buenas. Mejor: listar las sospechosas para que Blas
// las revise (reshoot, quitar la foto, o la función "crear imagen con IA" de Mercado Libre).
// Corre en Vercel (OPENROUTER_API_KEY). Solo lectura: no cambia BD ni ML.
//
// POST con header x-bot-key. Body: { solo?: string[]; limit?: number }
import { prisma } from "@/lib/prisma";
import { detectarWatermark } from "@/lib/vision";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

const APP_URL = getBranding().appUrl;
const esPack = (u: string) => u.startsWith("/pack/");
const abs = (u: string) => (u.startsWith("http") ? u : `${APP_URL}${u.startsWith("/") ? "" : "/"}${u}`);
function autorizado(req: Request) { return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY; }

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { solo?: string[]; limit?: number };
  if (!process.env.OPENROUTER_API_KEY) return Response.json({ ok: false, error: "Falta OPENROUTER_API_KEY" }, { status: 400 });

  const where: Record<string, unknown> = body.solo?.length ? { nombre: { in: body.solo } } : { publicadoMl: true };
  let modelos = await prisma.modelo.findMany({ where, select: { id: true, nombre: true, imagenes: true, mlItemId: true } });
  modelos = modelos.filter((m) => (m.imagenes ?? []).some(esPack));
  if (body.limit) modelos = modelos.slice(0, body.limit);

  const conMarca: Array<{ nombre: string; mlItemId: string | null; fotos: Array<{ url: string; zona: string; sobreProducto: boolean }> }> = [];
  for (const m of modelos) {
    const fotos: Array<{ url: string; zona: string; sobreProducto: boolean }> = [];
    for (const u of (m.imagenes ?? []).filter(esPack)) {
      const w = await detectarWatermark(abs(u));
      if (w.evaluado && w.tiene) fotos.push({ url: u, zona: w.zona ?? "", sobreProducto: !!w.sobreProducto });
    }
    if (fotos.length) conMarca.push({ nombre: m.nombre, mlItemId: m.mlItemId, fotos });
  }
  return Response.json({ ok: true, revisados: modelos.length, conMarcaDeAgua: conMarca.length, modelos: conMarca });
}

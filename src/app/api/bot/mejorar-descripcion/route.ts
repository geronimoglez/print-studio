// Mejora la DESCRIPCIÓN de los anuncios publicados: la IA mira la foto y escribe copy de venta (con
// plantilla de respaldo), la guarda en descripcionMl y la sincroniza a ML (PUT /items/{id}/description).
// Solo descripción → NO re-modera el anuncio (seguro). Corre en Vercel (key OpenRouter + token ML). Auth: x-bot-key.
// Body: { solo?: string[] (nombres), limit?: number, soloVacias?: boolean }
import { prisma } from "@/lib/prisma";
import { getAccessTokenValido } from "@/lib/mercadolibre";
import { describirProductoMkt } from "@/lib/vision";
import { generarDescripcion, sanitizarDescripcion, asegurarMedidas } from "@/lib/publicacion";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { solo?: string[]; limit?: number; soloVacias?: boolean };
  const base = getBranding().appUrl;
  const abs = (u?: string) => (!u ? undefined : u.startsWith("http") ? u : `${base}${u}`);
  const token = await getAccessTokenValido();
  if (!token) return Response.json({ ok: false, error: "Mercado Libre no conectado" }, { status: 400 });

  const where: Record<string, unknown> = { publicadoMl: true, mlItemId: { not: null } };
  if (body.solo?.length) where.nombre = { in: body.solo };
  if (body.soloVacias) where.descripcionMl = null;
  const modelos = (await prisma.modelo.findMany({ where })).slice(0, body.limit ?? 20);

  const resultados: Array<Record<string, unknown>> = [];
  let ia = 0, plantilla = 0, sync = 0;
  for (const m of modelos) {
    const cover = abs((m.imagenes ?? []).find((u) => !u.includes("/render/")) ?? (m.imagenes ?? [])[0]);
    const conIa = await describirProductoMkt(cover, m.nombre, m.categoria);
    const desc = sanitizarDescripcion(asegurarMedidas(conIa ?? generarDescripcion(m), m)); // texto plano + medidas garantizadas
    conIa ? ia++ : plantilla++;
    await prisma.modelo.update({ where: { id: m.id }, data: { descripcionMl: desc } });
    let ok = false;
    try {
      const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}/description`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plain_text: desc }),
      });
      ok = r.ok;
      if (ok) sync++;
    } catch { /* */ }
    resultados.push({ nombre: m.nombre, fuente: conIa ? "IA" : "plantilla", sincronizado: ok, preview: desc.slice(0, 70) });
  }
  return Response.json({ ok: true, procesados: resultados.length, conIa: ia, conPlantilla: plantilla, sincronizados: sync, resultados });
}

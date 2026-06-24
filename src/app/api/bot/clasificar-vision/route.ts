// Reclasificación VISUAL de IP: corre el VLM sobre la foto de cada modelo y detecta marcas/personajes
// que el nombre no ve (logo FIFA moldeado, balón Adidas en la foto, etc.). Sube marcaIp si halla IP
// y —si el modelo dejó de ser publicable— lo PAUSA en ML (política híbrida: pausar lo dañino).
// Corre en Vercel (donde vive OPENROUTER_API_KEY + token ML). Auth: x-bot-key.
// Body: { solo?: string[] (nombres), limit?: number }  · default: revisa los marcaIp="no".
import { prisma } from "@/lib/prisma";
import { detectarIpVisual } from "@/lib/vision";
import { esPublicable } from "@/lib/riesgo";
import { getAccessTokenValido } from "@/lib/mercadolibre";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { solo?: string[]; limit?: number };
  const base = getBranding().appUrl;
  const abs = (u?: string) => (!u ? undefined : u.startsWith("http") ? u : `${base}${u}`);

  const where = body.solo?.length ? { nombre: { in: body.solo } } : { marcaIp: "no" };
  const modelos = (await prisma.modelo.findMany({ where })).slice(0, body.limit ?? 15);
  const token = (await getAccessTokenValido().catch(() => null)) as string | null;

  const resultados: Array<Record<string, unknown>> = [];
  let subidos = 0, pausados = 0;
  for (const m of modelos) {
    // foto de portada real (no render) para ver el branding del producto/foto original
    const cover = abs((m.imagenes ?? []).find((u) => !u.includes("/render/")) ?? (m.imagenes ?? [])[0]);
    const v = await detectarIpVisual(cover);
    let nuevo = m.marcaIp;
    if (v.evaluado && v.ip && v.tipo && v.tipo !== "no") nuevo = v.tipo; // solo SUBE el riesgo
    let pausado = false;
    if (nuevo !== m.marcaIp) {
      await prisma.modelo.update({
        where: { id: m.id },
        data: { marcaIp: nuevo, notas: `${m.notas ?? ""} [IP-visual: ${v.tipo} «${v.entidad ?? ""}» conf=${v.confianza ?? "?"} · ${v.detalle ?? ""}]`.slice(0, 1000) },
      });
      subidos++;
      // Si dejó de ser publicable y está activo en ML, pausarlo (no se vende IP de terceros).
      if (token && !esPublicable(nuevo, m.licencia) && m.publicadoMl && m.mlItemId) {
        try {
          const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
            method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "paused" }),
          });
          if (r.ok) { pausados++; pausado = true; }
        } catch { /* */ }
      }
    }
    resultados.push({ nombre: m.nombre, antes: m.marcaIp, ahora: nuevo, ip: v.ip ?? null, tipo: v.tipo ?? null, entidad: v.entidad ?? null, confianza: v.confianza ?? null, detalle: v.detalle ?? null, pausado });
  }
  return Response.json({ ok: true, procesados: resultados.length, subidos, pausados, resultados });
}

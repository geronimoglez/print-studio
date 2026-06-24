// "Corregir y reenviar": toma los anuncios RECHAZADOS por ML (forbidden / waiting_for_patch, que viven
// bajo mlEstado="under_review", o "closed") y los REPUBLICA con la lógica de publicación actual —título
// sanitizado de marcas, mejor categoría (lámpara/florero/cuadro), atributos completos—. Cierra el anuncio
// viejo (best-effort) y crea uno nuevo con publicarModelo(). NO toca los pausados a propósito (paused).
//
// Body (todo opcional):
//   { ids?: string[]   // ids de Modelo específicos; si se omite, toma todos los rechazados
//     estados?: string[] // mlEstado objetivo; default ["under_review","closed"]
//     limit?: number    // procesar solo N (probar de a poco)
//     dryRun?: boolean } // no cambia nada: solo muestra el título nuevo que se usaría
import { prisma } from "@/lib/prisma";
import { getAccessTokenValido, publicarModelo } from "@/lib/mercadolibre";
import { construirTitulo } from "@/lib/publicacion";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

async function cerrarItem(itemId: string, token: string): Promise<boolean> {
  try {
    // Pausar y luego cerrar (ML exige paused antes de closed en varios casos). Best-effort.
    await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    const r = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "closed" }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    estados?: string[];
    limit?: number;
    dryRun?: boolean;
  };
  const token = await getAccessTokenValido();
  if (!token) return Response.json({ ok: false, error: "Mercado Libre no conectado" }, { status: 400 });

  const where: Record<string, unknown> = body.ids?.length
    ? { id: { in: body.ids } }
    : { publicadoMl: true, mlItemId: { not: null }, mlEstado: { in: body.estados ?? ["under_review", "closed"] } };

  let modelos = await prisma.modelo.findMany({ where });
  if (body.limit) modelos = modelos.slice(0, body.limit);

  const resultados: Array<Record<string, unknown>> = [];
  let ok = 0;
  for (const m of modelos) {
    const oldId = m.mlItemId!;
    const tituloNuevo = construirTitulo(m);
    if (body.dryRun) {
      resultados.push({ nombre: m.nombre, oldId, mlEstado: m.mlEstado, mlSubEstado: m.mlSubEstado, tituloNuevo, dryRun: true });
      continue;
    }
    // Limpiamos los flags para que publicarModelo cree uno fresco (rechaza si ya está publicado).
    await prisma.modelo.update({
      where: { id: m.id },
      data: { publicadoMl: false, mlItemId: null, mlPermalink: null, mlEstado: null, mlSubEstado: null, mlEstadoAt: null, estadoValidacion: "Pendiente" },
    });
    const res = await publicarModelo(m.id);
    // El anuncio viejo (rechazado, invisible) se cierra para no dejar basura en ML.
    const cerrado = await cerrarItem(oldId, token);
    if (res.ok) ok++;
    resultados.push({
      nombre: m.nombre,
      oldId,
      cerrado,
      ok: res.ok,
      newId: res.mlItemId ?? null,
      tituloNuevo,
      error: res.ok ? undefined : res.error,
    });
  }
  return Response.json({ ok: true, procesados: resultados.length, republicados: ok, dryRun: !!body.dryRun, resultados });
}

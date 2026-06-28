// Alta de un modelo NUEVO desde el bot (Telegram) o la app, con UNA foto.
// Auth: header x-bot-key === BOT_API_KEY.
//
// Body JSON:
//   { nombre, fotoUrl | fotoBase64, categoria?, tipoFilamento?, gramosFilamento?,
//     tiempoImpresionMin?, multicolorAms?, licencia?, nicho?, notas? }
// - fotoBase64: data URI o base64 puro (lo guardamos en Blob → URL pública).
// - fotoUrl: una URL ya pública (la usamos tal cual).
//
// Crea el modelo en estado "Pendiente". Devuelve el id para que el bot/app sigan el
// pipeline normal (validar → publicar). El fondo blanco NO se aplica aquí (rembg es
// local); queda como paso de batch o futura integración fal.ai (se avisa en la respuesta).
import { prisma } from "@/lib/prisma";
import { subirImagen, backendActivo } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "modelo";
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const nombre = String(body.nombre ?? "").trim();
  const fotoUrl = body.fotoUrl ? String(body.fotoUrl) : undefined;
  const fotoBase64 = body.fotoBase64 ? String(body.fotoBase64) : undefined;
  if (!nombre) return Response.json({ ok: false, error: "Falta 'nombre'." }, { status: 400 });
  if (!fotoUrl && !fotoBase64)
    return Response.json({ ok: false, error: "Falta la foto ('fotoUrl' o 'fotoBase64')." }, { status: 400 });

  // Resolver la URL de la imagen.
  let imagenUrl = fotoUrl;
  let backend = "url";
  if (!imagenUrl && fotoBase64) {
    try {
      const limpio = fotoBase64.replace(/^data:image\/\w+;base64,/, "");
      const buf = Buffer.from(limpio, "base64");
      if (buf.length === 0) throw new Error("base64 vacío");
      const r = await subirImagen(`alta/${slugify(nombre)}/1.jpg`, buf, { contentType: "image/jpeg" });
      imagenUrl = r.url;
      backend = r.backend;
    } catch (e) {
      return Response.json(
        { ok: false, error: `No se pudo guardar la imagen: ${e instanceof Error ? e.message : "error"}` },
        { status: 500 },
      );
    }
  }

  // Defaults sensatos (el operador/el bot los confirman/ajustan luego).
  const num = (v: unknown, d: number) => (typeof v === "number" && isFinite(v) ? v : d);
  try {
    const modelo = await prisma.modelo.create({
      data: {
        nombre,
        fuente: "Alta directa",
        licencia: body.licencia ? String(body.licencia) : "Comercial",
        categoria: body.categoria ? String(body.categoria) : "Figura",
        nicho: body.nicho ? String(body.nicho) : "impresión 3D",
        tiempoImpresionMin: Math.round(num(body.tiempoImpresionMin, 240)),
        gramosFilamento: num(body.gramosFilamento, 60),
        tipoFilamento: body.tipoFilamento ? String(body.tipoFilamento) : "PLA",
        multicolorAms: body.multicolorAms === true,
        requiereSoportes: body.requiereSoportes === true,
        dificultad: "Media",
        estadoValidacion: "Pendiente",
        archivoTipo: "foto",
        notas:
          (body.notas ? String(body.notas) + " " : "") +
          "[Alta vía bot/app] Confirmar datos y aplicar fondo blanco antes de publicar.",
        imagenes: [imagenUrl as string],
      },
    });
    return Response.json({
      ok: true,
      modeloId: modelo.id,
      nombre: modelo.nombre,
      foto: imagenUrl,
      backend: backend === "url" ? "url-externa" : backendActivo(),
      siguiente: "Revisa/ajusta datos y corre el pipeline: validar → publicar.",
      aviso: "El fondo blanco NO se aplicó automáticamente (rembg es local). Aplícalo en batch o súbelo ya con fondo blanco.",
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: `No se pudo crear el modelo: ${e instanceof Error ? e.message : "error"}` },
      { status: 500 },
    );
  }
}

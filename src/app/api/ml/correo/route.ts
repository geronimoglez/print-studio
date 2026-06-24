// Ingesta de AVISOS de Mercado Libre por correo. El correo de ML llega a la cuenta (ej. 3dlabsml@) →
// se reenvía a Gmail → un Google Apps Script (ver GUIA_NOTIFICACIONES.md) hace POST aquí con el asunto y
// el cuerpo. Esto extrae el N° de anuncio (MLM...) y el MOTIVO legible, empareja con el modelo y lo guarda
// en AvisoCorreo + en modelo.mlMotivo (se ve en /salud). Cierra el hueco: la API de ML solo da el código.
//
// POST con header x-bot-key. Body: { de?, paraEmail?, asunto, cuerpo }
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
function autorizado(req: Request) { return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY; }

function aTexto(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function clasificar(t: string): string {
  const s = t.toLowerCase();
  if (/(pausamos|infracci[oó]n|corrige|corregir|moderaci[oó]n|no cumple|dimos de baja|bloque|denuncia|publicaci[oó]n.*revis)/.test(s)) return "moderacion";
  if (/(vendiste|felicidades|nueva venta|pagada|se vendi[oó])/.test(s)) return "venta";
  if (/(pregunta|consulta|te preguntaron)/.test(s)) return "pregunta";
  if (/colaborar|colaborador|invit[oó]/.test(s)) return "colaboracion";
  return "otro";
}

/** Extrae el motivo legible: la(s) frase(s) clave del aviso de moderación. */
function extraerMotivo(texto: string): string | undefined {
  const frases = texto.split(/(?<=[.!?])\s+/);
  const clave = frases.filter((f) => /(porque|no cumple|no se permite|debes|necesitamos que|corrige|motivo|marca|prohibid|categor[ií]a|imagen|foto|t[ií]tulo)/i.test(f));
  const cand = (clave.length ? clave.slice(0, 3) : frases.slice(0, 2)).join(" ").trim();
  return cand ? cand.slice(0, 400) : undefined;
}

export async function POST(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { de?: string; paraEmail?: string; asunto?: string; cuerpo?: string };
  const asunto = (b.asunto ?? "").trim();
  if (!asunto && !b.cuerpo) return Response.json({ ok: false, error: "falta asunto/cuerpo" }, { status: 400 });
  const texto = aTexto(b.cuerpo ?? "");
  const full = `${asunto} ${texto}`;

  const tipo = clasificar(full);
  const mlItemId = (full.match(/MLM-?\d{6,}/i)?.[0] ?? "").replace(/-/g, "").toUpperCase() || null;
  const motivo = tipo === "moderacion" ? extraerMotivo(texto) ?? asunto : asunto;

  const modelo = mlItemId ? await prisma.modelo.findFirst({ where: { mlItemId }, select: { id: true, nombre: true } }) : null;

  await prisma.avisoCorreo.create({
    data: { de: b.de ?? null, paraEmail: b.paraEmail ?? null, asunto: asunto.slice(0, 300), motivo: motivo?.slice(0, 400) ?? null, tipo, mlItemId, modeloId: modelo?.id ?? null },
  });
  // Si es moderación y empareja un anuncio, guarda el motivo en el modelo (se ve en /salud).
  if (modelo && tipo === "moderacion") {
    await prisma.modelo.update({ where: { id: modelo.id }, data: { mlMotivo: motivo?.slice(0, 400) ?? asunto, mlMotivoAt: new Date() } });
  }
  return Response.json({ ok: true, tipo, mlItemId, modelo: modelo?.nombre ?? null, motivo: motivo ?? null });
}

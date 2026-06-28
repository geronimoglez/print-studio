// Lote de REVISIÓN para aprobar por Telegram (skill-revisar-aprobar-telegram). Devuelve los modelos
// PENDIENTES + publicables (no rojo) que aún no están en ML, numerados y con su nivel 🟢🟡🔴, para que
// el bot se los muestre al operador. El operador responde "publica 3,7 / descarta 5" → el bot mapea número→id y
// llama a /api/bot/aprobar con esos ids. Auth: x-bot-key. Solo LECTURA.
import { prisma } from "@/lib/prisma";
import { nivelRiesgo, esPublicable, ETIQUETA } from "@/lib/riesgo";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

const RANK: Record<string, number> = { verde: 0, amarillo: 1, rojo: 2 };

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });
  const url = new URL(req.url);
  const base = getBranding().appUrl;
  const incluirRojo = url.searchParams.get("incluirRojo") === "1";
  const fuente = url.searchParams.get("fuente") || undefined; // p.ej. "Packs jun2026"
  const abs = (u?: string) => (!u ? undefined : u.startsWith("http") ? u : `${base}${u}`);

  const modelos = await prisma.modelo.findMany({
    where: { estadoValidacion: "Pendiente", publicadoMl: false, ...(fuente ? { fuente } : {}) },
  });
  const lote = modelos
    .map((m) => ({ m, nivel: nivelRiesgo(m.marcaIp, m.licencia) }))
    .filter((x) => incluirRojo || esPublicable(x.m.marcaIp, x.m.licencia))
    .sort((a, b) => RANK[a.nivel] - RANK[b.nivel] || a.m.nombre.localeCompare(b.m.nombre, "es"))
    .map((x, i) => ({
      numero: i + 1,
      id: x.m.id,
      nombre: x.m.nombre,
      nivel: x.nivel,
      etiqueta: ETIQUETA[x.nivel],
      licencia: x.m.licencia,
      fuente: x.m.fuente,
      categoria: x.m.categoria,
      foto: abs((x.m.imagenes ?? [])[0]),
    }));

  return Response.json({
    ok: true,
    total: lote.length,
    resumen: { verde: lote.filter((l) => l.nivel === "verde").length, amarillo: lote.filter((l) => l.nivel === "amarillo").length },
    salaRevision: `${base}/revision`,
    lote,
  });
}

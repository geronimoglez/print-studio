import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Respaldo descargable (JSON) de los datos de prueba antes de borrarlos.
// GET /api/respaldo/modelos  |  /api/respaldo/ventas
export async function GET(_req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;

  let data: unknown;
  if (tipo === "modelos") {
    data = await prisma.modelo.findMany({ orderBy: { createdAt: "asc" } });
  } else if (tipo === "ventas") {
    data = await prisma.venta.findMany({ orderBy: { fecha: "asc" } });
  } else {
    return new Response(JSON.stringify({ error: "tipo inválido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = {
    tipo,
    exportadoEn: new Date().toISOString(),
    total: Array.isArray(data) ? data.length : 0,
    registros: data,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="respaldo-${tipo}.json"`,
    },
  });
}

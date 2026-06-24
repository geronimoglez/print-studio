import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Webhooks/tópicos de ML. Patrón "recibir y encolar": guardar y responder 200 al instante.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    await prisma.notificacion.create({
      data: {
        topic: String(body.topic ?? "desconocido"),
        resource: String(body.resource ?? ""),
        mlUserId: body.user_id != null ? String(body.user_id) : null,
        payload: JSON.stringify(body),
      },
    });
  } catch {
    // Respondemos 200 igual para que ML no reintente en bucle.
  }
  return new Response("ok", { status: 200 });
}

// ML hace un GET de verificación al configurar la URL.
export async function GET() {
  return new Response("ok", { status: 200 });
}

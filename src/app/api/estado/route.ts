import { prisma } from "@/lib/prisma";
import { getConfig } from "@/lib/datos";
import { calcularTableros, HEX, type Color } from "@/lib/semaforo";

export const dynamic = "force-dynamic";

// Estado del semáforo para foco/pantalla inteligente o integraciones.
// GET /api/estado            → JSON con global/impresion/clientes + hex
// GET /api/estado?formato=texto[&tablero=impresion]  → "verde" | "amarillo" | "rojo"
// GET /api/estado?formato=hex[&tablero=clientes]      → "#16a34a" ...
export async function GET(req: Request) {
  const url = new URL(req.url);
  const formato = url.searchParams.get("formato");
  const tablero = url.searchParams.get("tablero");

  const [pedidos, impresoras, config] = await Promise.all([
    prisma.pedido.findMany(),
    prisma.impresora.findMany(),
    getConfig(),
  ]);
  const t = calcularTableros(pedidos, impresoras, config);

  const color: Color =
    tablero === "impresion" ? t.impresion.color : tablero === "clientes" ? t.clientes.color : t.global;

  if (formato === "texto") return new Response(color, { headers: { "Content-Type": "text/plain" } });
  if (formato === "hex") return new Response(HEX[color], { headers: { "Content-Type": "text/plain" } });

  return Response.json({
    global: t.global,
    impresion: t.impresion,
    clientes: t.clientes,
    hex: { global: HEX[t.global], impresion: HEX[t.impresion.color], clientes: HEX[t.clientes.color] },
  });
}

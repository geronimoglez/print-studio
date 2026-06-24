// Resumen del sistema en UNA llamada, para el bot de monitoreo (Hermes).
// Auth: header x-bot-key === BOT_API_KEY. Solo LECTURA (semáforo + counts + alertas).
import { prisma } from "@/lib/prisma";
import { getConfig, getCatalogo } from "@/lib/datos";
import { calcularTableros, HEX } from "@/lib/semaforo";
import { mxn } from "@/lib/dinero";
import { nivelRiesgo, esPublicable } from "@/lib/riesgo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function autorizado(req: Request) {
  return !!process.env.BOT_API_KEY && req.headers.get("x-bot-key") === process.env.BOT_API_KEY;
}

const ESTADOS_PEDIDO = ["Vendido", "EnCola", "Imprimiendo", "Impreso", "Entregado"] as const;

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ ok: false, error: "no autorizado" }, { status: 401 });

  const hace7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [pedidos, impresoras, config, { filas }, vTotal, vSumTotal, v7d, vSum7d] = await Promise.all([
    prisma.pedido.findMany(),
    prisma.impresora.findMany(),
    getConfig(),
    getCatalogo(),
    prisma.venta.count(),
    prisma.venta.aggregate({ _sum: { precio: true } }),
    prisma.venta.count({ where: { fecha: { gte: hace7d } } }),
    prisma.venta.aggregate({ _sum: { precio: true }, where: { fecha: { gte: hace7d } } }),
  ]);

  const t = calcularTableros(pedidos, impresoras, config);

  const porEstado: Record<string, number> = {};
  for (const e of ESTADOS_PEDIDO) porEstado[e] = 0;
  for (const p of pedidos) porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;

  // Distribución de riesgo IP (capa 1 marca/personaje + capa 2 licencia del archivo).
  const riesgo = { verde: 0, amarillo: 0, rojo: 0 };
  let bloqueadosPublicados = 0;
  for (const f of filas) {
    const n = nivelRiesgo(f.modelo.marcaIp, f.modelo.licencia);
    riesgo[n]++;
    // rojo (MARCA/IP) que tiene anuncio en ML (activo O pausado; publicadoMl no distingue) → revisar
    if (!esPublicable(f.modelo.marcaIp, f.modelo.licencia) && f.modelo.publicadoMl) bloqueadosPublicados++;
  }

  const alertas: Array<{ nivel: string; area: string; mensaje: string }> = [];
  if (t.impresion.color !== "verde")
    alertas.push({ nivel: t.impresion.color, area: "impresion", mensaje: t.impresion.mensaje });
  if (t.clientes.color !== "verde")
    alertas.push({ nivel: t.clientes.color, area: "clientes", mensaje: t.clientes.mensaje });
  if (bloqueadosPublicados > 0)
    alertas.push({ nivel: "amarillo", area: "ip", mensaje: `${bloqueadosPublicados} modelo(s) 🔴 MARCA/IP con anuncio en ML — verifica que estén PAUSADOS (no deben venderse).` });

  return Response.json({
    ok: true,
    generadoEn: new Date().toISOString(),
    semaforo: {
      global: t.global,
      impresion: t.impresion,
      clientes: t.clientes,
      hex: { global: HEX[t.global], impresion: HEX[t.impresion.color], clientes: HEX[t.clientes.color] },
    },
    modelos: {
      total: filas.length,
      aptos: filas.filter((f) => f.apto).length,
      publicados: filas.filter((f) => f.modelo.publicadoMl).length,
      // Semáforo de riesgo IP: 🟢 limpio · 🟡 IP-limpio (licencia restringida, publicable a riesgo) · 🔴 marca/IP (no publicar)
      riesgo,
      publicables: riesgo.verde + riesgo.amarillo,
      bloqueados: riesgo.rojo,
      bloqueadosPublicados,
    },
    ventas: {
      total: vTotal,
      recientes7d: v7d,
      ingresosTotal: vSumTotal._sum.precio ?? 0,
      ingresos7d: vSum7d._sum.precio ?? 0,
      // Pre-formateado MXN (miles con coma). El bot DEBE usar estos strings tal cual,
      // sin reformatear los números crudos (evita el formato europeo "$46.403").
      ingresosTotalMXN: mxn(vSumTotal._sum.precio ?? 0),
      ingresos7dMXN: mxn(vSum7d._sum.precio ?? 0),
    },
    pedidos: {
      total: pedidos.length,
      porEstado,
      vencidos: t.impresion.vencidos,
      urgentes: t.clientes.urgentes,
    },
    alertas,
  });
}

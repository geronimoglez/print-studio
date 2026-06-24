// Tableros tipo SEMÁFORO. El color no es solo conteo: considera tiempo y capacidad.
// Verde = vas a tiempo (aunque tengas muchos). Amarillo = a moverse. Rojo = actuar ya.
import type { Config, Impresora, Pedido } from "@/generated/prisma/client";
import { calcularCapacidad } from "./capacidad";

export type Color = "verde" | "amarillo" | "rojo";

const HORIZONTE_DIAS = 3; // ventana de planeación de impresión (configurable a futuro)
const HORAS_URGENTE_CLIENTE = 12; // venta sin atender más de esto = urgente

const PENDIENTE_IMPRIMIR = new Set(["Vendido"]);
const EN_PROCESO = new Set(["EnCola", "Imprimiendo"]);

export const HEX: Record<Color, string> = {
  verde: "#16a34a",
  amarillo: "#d97706",
  rojo: "#dc2626",
};

const PESO: Record<Color, number> = { verde: 0, amarillo: 1, rojo: 2 };
export function peor(a: Color, b: Color): Color {
  return PESO[a] >= PESO[b] ? a : b;
}

export type TableroImpresion = {
  color: Color;
  porImprimir: number;
  enProceso: number;
  horasRequeridas: number;
  capacidadHorizonte: number;
  horizonteDias: number;
  impresorasFaltantes: number;
  vencidos: number;
  mensaje: string;
};

export type TableroClientes = {
  color: Color;
  pendientes: number;
  urgentes: number;
  mensaje: string;
};

export function calcularTableros(pedidos: Pedido[], impresoras: Impresora[], config: Config) {
  const cap = calcularCapacidad(impresoras, config);
  const ahora = Date.now();

  // ---------- Tablero de Impresión ----------
  const porImprimir = pedidos.filter((p) => PENDIENTE_IMPRIMIR.has(p.estado));
  const enProceso = pedidos.filter((p) => EN_PROCESO.has(p.estado));
  const activos = [...porImprimir, ...enProceso];
  const horasRequeridas = activos.reduce((s, p) => s + p.tiempoImpresionMin / 60, 0);
  const capacidadHorizonte = cap.horasDiaTotal * HORIZONTE_DIAS;
  const vencidos = activos.filter((p) => p.fechaLimite && p.fechaLimite.getTime() < ahora).length;
  const proximoLimite = activos.some(
    (p) => p.fechaLimite && p.fechaLimite.getTime() < ahora + 24 * 3600 * 1000,
  );
  const faltanHoras = Math.max(0, horasRequeridas - capacidadHorizonte);
  const impresorasFaltantes =
    faltanHoras > 0 ? Math.ceil(faltanHoras / (HORIZONTE_DIAS * config.horasProductivasDia)) : 0;

  let colorImp: Color = "verde";
  if (faltanHoras > 0 || vencidos > 0) colorImp = "rojo";
  else if (horasRequeridas > capacidadHorizonte * 0.8 || proximoLimite) colorImp = "amarillo";

  const impresion: TableroImpresion = {
    color: colorImp,
    porImprimir: porImprimir.length,
    enProceso: enProceso.length,
    horasRequeridas: Math.round(horasRequeridas * 10) / 10,
    capacidadHorizonte,
    horizonteDias: HORIZONTE_DIAS,
    impresorasFaltantes,
    vencidos,
    mensaje:
      colorImp === "rojo"
        ? impresorasFaltantes > 0
          ? `No alcanzas con las impresoras actuales: falta(n) ${impresorasFaltantes} para cumplir a ${HORIZONTE_DIAS} días.`
          : `Hay ${vencidos} pedido(s) vencido(s): manda a imprimir ya.`
        : colorImp === "amarillo"
          ? "Vas a tiempo pero ajustado: conviene avanzar la cola."
          : "Vas a tiempo. Sin prisa.",
  };

  // ---------- Tablero de Clientes ----------
  const pendientesCli = pedidos.filter((p) => !p.clienteAtendido && p.estado !== "Entregado");
  const urgentesCli = pendientesCli.filter(
    (p) => p.fechaVenta.getTime() < ahora - HORAS_URGENTE_CLIENTE * 3600 * 1000,
  );
  let colorCli: Color = "verde";
  if (urgentesCli.length > 0) colorCli = "rojo";
  else if (pendientesCli.length > 0) colorCli = "amarillo";

  const clientes: TableroClientes = {
    color: colorCli,
    pendientes: pendientesCli.length,
    urgentes: urgentesCli.length,
    mensaje:
      colorCli === "rojo"
        ? `${urgentesCli.length} venta(s)/mensaje(s) sin atender hace rato. Responde y procesa.`
        : colorCli === "amarillo"
          ? `${pendientesCli.length} pendiente(s) por atender (aún a tiempo).`
          : "Todo atendido.",
  };

  return { impresion, clientes, global: peor(colorImp, colorCli) as Color };
}

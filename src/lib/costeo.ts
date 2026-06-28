// Motor de costeo, precio y tiempo de entrega (doc 04).
// Convierte los datos técnicos de un modelo en decisiones de negocio:
// cuánto cuesta producirlo, a qué precio venderlo en Mercado Libre y en cuántos días entregarlo.
// `calcularCosteo` es una función PURA (testeable). `costearModelo` resuelve los insumos desde la BD.

import type { Config, Filamento, Impresora, Modelo } from "@/generated/prisma/client";

export type CosteoInput = {
  // Del modelo
  gramosFilamento: number;
  tiempoImpresionMin: number;
  tiempoOperacionMin: number;
  costoPostproceso: number;
  costoLicencia: number;
  // Resueltos (filamento / impresora / config)
  costoPorKg: number;
  potenciaW: number;
  depreciacionPorHora: number;
  // De config
  tarifaKwh: number;
  costoHoraManoObra: number;
  tasaFallos: number;
  markup: number;
  costoEnvio: number;
  comisionMlPct: number;
  tiempoColaHoras: number;
  horasProductivasDia: number;
  diasEnvio: number;
  colchonDias: number;
  tiempoPostprocesoHoras?: number;
};

export type CosteoResultado = {
  horasImpresion: number;
  costoFilamento: number;
  costoEnergia: number;
  costoDepreciacion: number;
  costoManoObra: number;
  costoPostproceso: number;
  costoLicencia: number;
  costoDirecto: number;
  costoTotal: number; // ajustado por tasa de fallos
  precioBase: number; // costoTotal * markup
  precioVenta: number; // con envío y comisión ML despejada
  costoEnvioVendedor: number; // envío que absorbe el vendedor (0 si lo paga el comprador)
  envioGratis: boolean; // true = envío gratis obligatorio (lo pagal operador)
  comisionMl: number; // $ de comisión ML sobre el precio
  margen: number; // utilidad neta tras comisión ML y envío
  margenPct: number;
  rentabilidadHora: number; // utilidad neta por hora-impresora (métrica brújula)
  tiempoEntregaDias: number;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Núcleo de cálculo. Pura: mismos insumos → mismo resultado. */
export function calcularCosteo(i: CosteoInput): CosteoResultado {
  const horasImpresion = i.tiempoImpresionMin / 60;

  // 1. Costo de producción
  const costoFilamento = (i.gramosFilamento / 1000) * i.costoPorKg;
  const costoEnergia = (i.potenciaW / 1000) * horasImpresion * i.tarifaKwh;
  const costoDepreciacion = i.depreciacionPorHora * horasImpresion;
  const costoManoObra = (i.tiempoOperacionMin / 60) * i.costoHoraManoObra;
  const costoDirecto =
    costoFilamento +
    costoEnergia +
    costoDepreciacion +
    costoManoObra +
    i.costoPostproceso +
    i.costoLicencia;

  // Ajuste por fallos: reparte el costo de las impresiones que salen mal
  const costoTotal = i.tasaFallos < 1 ? costoDirecto / (1 - i.tasaFallos) : costoDirecto;

  // 2. Precio de venta (incorpora markup, envío y comisión ML antes de fijar precio)
  // ML México: arriba de ~$299 el ENVÍO GRATIS es obligatorio → lo paga el VENDEDOR.
  // Debajo del umbral, el COMPRADOR paga el envío → no se carga al vendedor.
  const UMBRAL_ENVIO_GRATIS = 299;
  const precioBase = costoTotal * i.markup;
  const grossUp = (p: number) => (i.comisionMlPct < 1 ? p / (1 - i.comisionMlPct) : p);
  let envioVendedor = i.costoEnvio;
  let precioVenta = grossUp(precioBase + envioVendedor);
  if (precioVenta < UMBRAL_ENVIO_GRATIS) {
    // Anuncio barato: el comprador paga el envío → el vendedor no lo absorbe.
    envioVendedor = 0;
    precioVenta = grossUp(precioBase);
  }

  // Utilidad neta: lo que queda tras la comisión de ML y (si aplica) pagar el envío
  const margen = precioVenta * (1 - i.comisionMlPct) - envioVendedor - costoTotal;
  const margenPct = precioVenta > 0 ? margen / precioVenta : 0;
  const rentabilidadHora = horasImpresion > 0 ? margen / horasImpresion : 0;

  // 3. Tiempo de entrega
  const horasTrabajo = i.tiempoColaHoras + horasImpresion + (i.tiempoPostprocesoHoras ?? 0);
  const diasProduccion = Math.ceil(horasTrabajo / i.horasProductivasDia);
  const tiempoEntregaDias = diasProduccion + i.diasEnvio + i.colchonDias;

  return {
    horasImpresion: r2(horasImpresion),
    costoFilamento: r2(costoFilamento),
    costoEnergia: r2(costoEnergia),
    costoDepreciacion: r2(costoDepreciacion),
    costoManoObra: r2(costoManoObra),
    costoPostproceso: r2(i.costoPostproceso),
    costoLicencia: r2(i.costoLicencia),
    costoDirecto: r2(costoDirecto),
    costoTotal: r2(costoTotal),
    precioBase: r2(precioBase),
    precioVenta: r2(precioVenta),
    costoEnvioVendedor: r2(envioVendedor),
    envioGratis: envioVendedor > 0,
    comisionMl: r2(precioVenta * i.comisionMlPct),
    margen: r2(margen),
    margenPct: r2(margenPct * 100),
    rentabilidadHora: r2(rentabilidadHora),
    tiempoEntregaDias,
  };
}

/** Resuelve los insumos de un modelo desde la BD (filamento, impresora, config) y costea. */
export function costearModelo(
  modelo: Pick<
    Modelo,
    | "gramosFilamento"
    | "tiempoImpresionMin"
    | "tipoFilamento"
    | "tiempoOperacionMin"
    | "costoPostproceso"
    | "costoLicencia"
    | "impresoraId"
  >,
  config: Config,
  filamentos: Filamento[],
  impresoras: Impresora[],
): CosteoResultado {
  const filamento = filamentos.find((f) => f.tipo === modelo.tipoFilamento);
  const costoPorKg = filamento?.costoPorKg ?? config.costoPorKgDefault;

  const impresora = modelo.impresoraId
    ? impresoras.find((p) => p.id === modelo.impresoraId)
    : undefined;
  const potenciaW = impresora?.potenciaW ?? config.potenciaWDefault;
  const depreciacionPorHora =
    impresora && impresora.depreciacionPorHora > 0
      ? impresora.depreciacionPorHora
      : config.depreciacionPorHora;

  return calcularCosteo({
    gramosFilamento: modelo.gramosFilamento,
    tiempoImpresionMin: modelo.tiempoImpresionMin,
    tiempoOperacionMin: modelo.tiempoOperacionMin,
    costoPostproceso: modelo.costoPostproceso,
    costoLicencia: modelo.costoLicencia,
    costoPorKg,
    potenciaW,
    depreciacionPorHora,
    tarifaKwh: config.tarifaKwh,
    costoHoraManoObra: config.costoHoraManoObra,
    tasaFallos: config.tasaFallos,
    markup: config.markup,
    costoEnvio: config.costoEnvio,
    comisionMlPct: config.comisionMlPct,
    tiempoColaHoras: config.tiempoColaHoras,
    horasProductivasDia: config.horasProductivasDia,
    diasEnvio: config.diasEnvio,
    colchonDias: config.colchonDias,
  });
}

// Acceso a datos + costeo en vivo. El motor es la fuente única de verdad:
// los económicos NO se guardan, se calculan al leer.
import { cache } from "react";
import { prisma } from "./prisma";
import { costearModelo, type CosteoResultado } from "./costeo";
import { esAptoVenta } from "./licencias";
import type { Config, Modelo } from "@/generated/prisma/client";

export type FilaCatalogo = {
  modelo: Modelo;
  apto: boolean;
  costeo: CosteoResultado;
};

/**
 * Devuelve la config (la crea con defaults si no existe).
 * Memoizada por request (React cache) para no consultar la DB varias veces en un mismo render
 * (el layout, el branding y el catálogo la comparten).
 */
export const getConfig = cache(async function getConfig(): Promise<Config> {
  const existente = await prisma.config.findFirst();
  if (existente) return existente;
  return prisma.config.create({ data: { id: 1 } });
});

/** Catálogo completo con costeo y aptitud legal calculados por modelo. */
export async function getCatalogo() {
  const config = await getConfig();
  const [modelos, filamentos, impresoras] = await Promise.all([
    prisma.modelo.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.filamento.findMany({ orderBy: { tipo: "asc" } }),
    prisma.impresora.findMany({ orderBy: { modelo: "asc" } }),
  ]);

  const filas: FilaCatalogo[] = modelos.map((modelo) => ({
    modelo,
    apto: esAptoVenta(modelo.licencia),
    costeo: costearModelo(modelo, config, filamentos, impresoras),
  }));

  return { filas, config, filamentos, impresoras };
}

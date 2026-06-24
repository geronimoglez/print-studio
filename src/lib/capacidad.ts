// Planeación de capacidad: cuántas horas-impresora hay disponibles al día.
// Base para decidir cuándo comprar más máquinas (se cruza con el forecast en la Fase D).
import type { Config, Impresora } from "@/generated/prisma/client";

export type Capacidad = {
  numTotal: number;
  numDisponibles: number;
  numAms: number;
  horasDiaTotal: number; // Σ(impresoras disponibles) × horasProductivasDia
  horasDiaAms: number; // capacidad de las que tienen AMS (para modelos multicolor)
  horasDiaSinAms: number;
};

// Detecta AMS por el nombre del modelo (p.ej. "Bambu Lab A1 (AMS)").
const tieneAms = (p: Impresora) => /ams/i.test(p.modelo);

export function calcularCapacidad(impresoras: Impresora[], config: Config): Capacidad {
  const disp = impresoras.filter((p) => p.disponible);
  const h = config.horasProductivasDia;
  const ams = disp.filter(tieneAms);
  return {
    numTotal: impresoras.length,
    numDisponibles: disp.length,
    numAms: ams.length,
    horasDiaTotal: disp.length * h,
    horasDiaAms: ams.length * h,
    horasDiaSinAms: (disp.length - ams.length) * h,
  };
}

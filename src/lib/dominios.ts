// Valores válidos para los campos tipo "enum" del catálogo.
// Modelados como texto (Postgres-portable) y validados en la app + usados en los <select> de la UI.

export const FUENTES = ["Propio", "MakerWorld", "Otro"] as const;

export const LICENCIAS = [
  "Propia",
  "Comercial",
  "CC-BY",
  "CC-BY-NC",
  "Personal",
  "Dominio publico",
] as const;

export const CATEGORIAS = [
  "Regalo",
  "Organizador",
  "Decoracion",
  "Evento",
  "Miniatura",
  "Figura",
  "Refaccion",
  "Otro",
] as const;

export const TIPOS_FILAMENTO = ["PLA", "PETG", "ABS", "TPU", "ASA", "Otro"] as const;

export const DIFICULTADES = ["Baja", "Media", "Alta"] as const;

export const ESTADOS_VALIDACION = ["Pendiente", "Validado", "Rechazado"] as const;

export type Fuente = (typeof FUENTES)[number];
export type Licencia = (typeof LICENCIAS)[number];
export type Categoria = (typeof CATEGORIAS)[number];
export type TipoFilamento = (typeof TIPOS_FILAMENTO)[number];
export type Dificultad = (typeof DIFICULTADES)[number];
export type EstadoValidacion = (typeof ESTADOS_VALIDACION)[number];

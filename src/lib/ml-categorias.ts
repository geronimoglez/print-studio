// Mapeo de respaldo dominio→categoría para la publicación por CATÁLOGO de ML.
//
// Problema que resuelve (el caso "dragón"): los productos del catálogo de ML son
// "domain-based" (no traen category_id directo). Normalmente derivamos la categoría
// llamando al predictor con el NOMBRE del producto, pero a veces el nombre real del
// producto de catálogo es tan específico que el predictor no devuelve nada
// (p.ej. un "Soporte de vino dragón"). Para esos casos usamos este respaldo:
//
//   1) terminoCategoriaFallback(nombre): convierte el modelo a un TÉRMINO genérico
//      que el predictor SÍ reconoce (p.ej. "Soporte de Vino - Dragon" → "portavinos
//      decorativo"). Eso evita hardcodear category_id (que ML puede cambiar).
//   2) MAPA_DOMINIO_CATEGORIA: si ya confirmamos un category_id bueno para un
//      domain_id concreto, lo devolvemos directo (override fuerte).
//
// Se usa en lib/mercadolibre.ts dentro del flujo de publicación de catálogo.

/** domain_id del producto de catálogo → category_id confirmado (MLM, México).
 *  Se va llenando conforme confirmamos categorías que validan en verde. */
export const MAPA_DOMINIO_CATEGORIA: Record<string, string> = {
  // Ejemplos confirmados se agregan aquí, p.ej.:
  // "MLM-ACTION_FIGURES": "MLM123456",
};

/**
 * Categorías que la MODERACIÓN de ML prohíbe para anuncios LIBRES genéricos.
 * Aunque el predictor (domain_discovery) las sugiera y la publicación valide en VERDE,
 * ML las anula post-publicación (sub_status "forbidden") y exige moverlas a otra rama.
 * Son típicamente categorías "catalog-driven" muy moderadas. Se EXCLUYEN al elegir
 * categoría para que no caigamos ahí. Se va llenando con casos reales observados.
 */
export const CATEGORIAS_PROHIBIDAS = new Set<string>([
  "MLM417395", // "Soportes para Botellas" → ML anula y recomienda Organizadores. (Soporte Copas, 2026-06)
  // Categorías del rubro "impresión 3D" que el predictor sugiere por el texto "Impresión 3D"
  // del título, pero que son para VENDER impresoras/insumos/archivos, NO productos impresos:
  "MLM131941", // Impresoras 3D
  "MLM455820", // Archivos STL
  "MLM1731", //   Diseño y Edición (servicios)
  "MLM191042", // Camas Calientes (repuesto de impresora)
  "MLM191742", // Filamentos 3D (insumo)
]);

/**
 * Override de categoría para familias de producto donde el predictor de ML CHOCA con su
 * propia moderación. Forzamos la categoría que ML SÍ acepta (su recomendación explícita
 * en el aviso de "categoría apropiada"). El primer match gana. Se aplica ANTES del
 * predictor en el flujo de publicación libre. Reduce el error de "categoría incorrecta".
 */
export const CATEGORIA_OVERRIDE: Array<{ re: RegExp; categoriaId: string; nombre: string }> = [
  // Soportes / portabotellas de vino o copas: ML prohíbe "Soportes para Botellas"
  // (MLM417395) y recomienda la rama "Cocina > Organizadores para Cocina".
  {
    re: /\b(soporte|porta)\b.*(vino|botella|copa)|portavino|porta\s*vino|\bcopas?\b/i,
    categoriaId: "MLM191613", // Organizadores de Fregaderos (recomendada explícitamente por ML)
    nombre: "Organizadores de Fregaderos",
  },
];

/** Categoría de override para un nombre de modelo (si aplica). undefined si no hay match. */
export function categoriaOverride(nombre: string): { categoriaId: string; nombre: string } | undefined {
  for (const o of CATEGORIA_OVERRIDE) {
    if (o.re.test(nombre)) return { categoriaId: o.categoriaId, nombre: o.nombre };
  }
  return undefined;
}

/** Reglas por palabra clave → término genérico que el predictor de ML reconoce.
 *  El orden importa: la primera que machea gana (de lo más específico a lo general). */
const REGLAS: Array<{ re: RegExp; termino: string }> = [
  // --- Funcionales ---
  { re: /\b(soporte|porta).*(vino|botella|copa)|portavino|porta\s*vino/i, termino: "portavinos decorativo" },
  { re: /\b(copa|botella)\b/i, termino: "portavinos decorativo" },
  { re: /perchero|percha|gancho|colgador/i, termino: "perchero de pared" },
  { re: /jabonera/i, termino: "jabonera decorativa" },
  { re: /m[eé]nsula|estante|repisa/i, termino: "repisa decorativa" },
  { re: /tarjetero|billetera|porta\s*tarjeta/i, termino: "tarjetero de escritorio" },
  { re: /alcanc[ií]a/i, termino: "alcancia decorativa" },
  { re: /cenicero/i, termino: "cenicero decorativo" },
  { re: /soporte.*(joystick|control|mando)/i, termino: "soporte para control de videojuego" },
  { re: /soporte.*(celular|tel[eé]fono)/i, termino: "soporte para celular" },
  { re: /tarugo|taquete|fijaci[oó]n/i, termino: "organizador decorativo" },
  { re: /organizador/i, termino: "organizador de escritorio" },
  { re: /maceta/i, termino: "maceta decorativa" },
  { re: /llavero/i, termino: "llavero decorativo" },
  // --- Hogar / decoración (antes caían al genérico "figura decorativa" → categoría equivocada) ---
  { re: /l[aá]mpara|lampara|velador|luminaria/i, termino: "lampara de mesa decorativa" },
  { re: /florero|jarr[oó]n|jarron/i, termino: "florero decorativo" },
  { re: /cuadro|l[aá]mina|poster|p[oó]ster/i, termino: "cuadro decorativo" },
  { re: /portarretrato|porta\s*retrato|portaretrato|marco\s*de\s*foto/i, termino: "portarretrato decorativo" },
  { re: /reloj/i, termino: "reloj de pared decorativo" },
  { re: /espejo/i, termino: "espejo decorativo" },
  { re: /vela|candelabro|portavela|porta\s*vela/i, termino: "candelabro decorativo" },
  // --- Articulados / juguetes ---
  { re: /flex|articulad|fidget|antiestr[eé]s|anti-?stress|sensorial/i, termino: "juguete antiestres figura" },
  { re: /cubo\s*infinito|cubo\s*magico|hexagono|espiral|giratori/i, termino: "juguete antiestres fidget" },
  { re: /dragon|drag[oó]n|dinosaurio|serpiente|cobra|tiburon|tiburón|pez|atun|atún|delf[ií]n|pulpo|manta\s*raya|langosta|esturion|ajolote|gato|perro|panda|tortuga|ciervo|le[oó]n|ardilla|pangoli/i, termino: "figura decorativa de coleccion" },
  { re: /calavera|cr[aá]neo|esqueleto/i, termino: "figura decorativa calavera" },
  { re: /robot/i, termino: "figura robot de coleccion" },
  { re: /huevo/i, termino: "figura decorativa de coleccion" },
  // --- Figuras / coleccionables (pop) ---
  { re: /figura|busto|estatua|coleccion|colecci[oó]n|urban/i, termino: "figura decorativa de coleccion" },
];

/**
 * Devuelve un término genérico apto para el predictor de ML a partir del nombre
 * del modelo (y opcionalmente la categoría del pack). Default: "figura decorativa".
 */
export function terminoCategoriaFallback(nombre: string, categoriaPack?: string): string {
  const txt = `${nombre} ${categoriaPack ?? ""}`;
  for (const r of REGLAS) {
    if (r.re.test(txt)) return r.termino;
  }
  // Fallback por categoría del pack
  switch ((categoriaPack ?? "").toUpperCase()) {
    case "FUNCIONALES":
      return "organizador decorativo";
    case "URBAN":
      return "figura decorativa de coleccion";
    case "ARTICULADO":
      return "juguete antiestres figura";
    default:
      return "figura decorativa";
  }
}

/** Si tenemos un category_id confirmado para el domain_id del producto, lo devuelve. */
export function categoriaPorDominio(domainId?: string | null): string | undefined {
  if (!domainId) return undefined;
  return MAPA_DOMINIO_CATEGORIA[domainId];
}

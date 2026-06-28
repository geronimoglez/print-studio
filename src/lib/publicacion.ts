// Arma el título, la descripción y el payload de la publicación de ML a partir del modelo + costeo.
import type { Modelo } from "@/generated/prisma/client";
import type { CosteoResultado } from "./costeo";
import { getBranding } from "./branding";

// Base pública del sitio (para convertir rutas /pack/... a URLs absolutas que ML pueda descargar).
const APP_URL = getBranding().appUrl;

// Stock por defecto de cada anuncio. Negocio bajo demanda (made-to-order): NO es inventario físico,
// es cuántas unidades simultáneas aceptamos antes de quedar "sin stock". Con >=2 ML muestra el selector
// de cantidad y quita el "¡Última en stock!". 5 = surtido razonable sin sobreventa para piezas chicas/medias
// con ~5 días de plazo (el plazo se comunica aparte vía MANUFACTURING_TIME, no por el stock).
// Todos los anuncios son "gold_special" (Clásica) → sin tope de stock (la gratuita topa en 1).
export const STOCK_ML_DEFAULT = 5;

// Tiempo de FABRICACIÓN/preparación que se le dice a ML (atributo MANUFACTURING_TIME). Es SOLO el plazo
// para tener la pieza lista para despachar — ML le SUMA aparte el tiempo de envío. Antes mandábamos
// producción+envío+colchón (≈5 días), lo que inflaba el plazo al doble. Bajo demanda: 2 días de preparación.
export const DIAS_FABRICACION_ML = 2;

// Tamaño base del producto (cm) cuando no tenemos la malla para medirlo. el operador escala sus impresiones a
// ~12 cm de dimensión máxima; las piezas con malla traen su medida real (alto×ancho×largo) calculada.
export const DIM_BASE_CM = { alto: 12, ancho: 12, largo: 12 };

/** Convierte una ruta relativa (/pack/...) en URL absoluta; deja intactas las http(s). */
function urlAbsoluta(u: string): string {
  if (/^https?:\/\//i.test(u)) return u;
  return `${APP_URL}/${u.replace(/^\/+/, "")}`;
}

/** pictures[] para ML a partir de las imágenes del modelo (absolutas). */
function pictures(modelo: Modelo): Array<{ source: string }> {
  return (modelo.imagenes ?? []).map((url) => ({ source: urlAbsoluta(url) }));
}

// Marcas de TERCEROS que ML prohíbe en el TÍTULO pero cuyo producto SÍ es vendible (ferretería,
// construcción, materiales, homeware genérico). A diferencia de riesgo.ts —que BLOQUEA el modelo como
// 🔴 marca/IP— aquí solo LIMPIAMOS el texto del título de venta. Ej.: un "tarugo para Durlock" es un
// taquete genérico (vendible); solo no se puede nombrar la marca "Durlock" en el título.
const MARCAS_TITULO =
  /\b(durlock|tablaroca|panel\s*rey|knauf|placo|fischer|hilti|truper|pretul|makita|dewalt|de\s*walt|\bbosch\b|black\s*\+?\s*decker|tupperware|rubbermaid|\bikea\b)\b/gi;

/** Quita marcas de terceros del título de venta (ML rechaza títulos con marcas ajenas) y limpia los
 *  separadores que queden colgando (" - ", " | ", dobles espacios). No altera el nombre del modelo en BD. */
export function sanitizarTitulo(t: string): string {
  let s = t.replace(MARCAS_TITULO, " ");
  s = s
    .replace(/\s*[-|–—]\s*(?=$)/g, "") // separador final colgante
    .replace(/(^|\s)[-|–—]+(\s|$)/g, " ") // separadores sueltos en medio/extremos
    .replace(/\s+([,.;])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return s;
}

/** Título para ML: descriptivo (ML rechaza títulos muy cortos) y máx 60 caracteres. */
export function construirTitulo(m: Modelo): string {
  let t = sanitizarTitulo(m.nombre.trim().replace(/\s+/g, " "));
  // Enriquecer nombres cortos con términos útiles, sin duplicar ni pasar de 60.
  // Excluimos tags INTERNOS (importado, otro) que no deben aparecer en el título de venta.
  const cat = m.categoria && !/^(otro|importad)/i.test(m.categoria) ? m.categoria : "";
  const nic = m.nicho && !/importad/i.test(m.nicho) ? m.nicho : "";
  const extras = ["Impresión 3D", cat, nic, "Decoración"].filter(Boolean);
  for (const e of extras) {
    if (t.length >= 42) break;
    if (!t.toLowerCase().includes(e.toLowerCase())) {
      const cand = `${t} ${e}`;
      if (cand.length <= 60) t = cand;
    }
  }
  return t.length <= 60 ? t : t.slice(0, 57).trimEnd() + "...";
}

export type Atributo = {
  id: string;
  value_id?: string;
  value_name?: string;
  value_struct?: { number: number; unit: string };
};

export const PAQ = { alto: 15, ancho: 15, largo: 15 }; // caja por defecto (cm) — respaldo histórico
export function pesoPaqueteG(m: Modelo): number {
  return Math.max(50, Math.round((m.gramosFilamento || 80) * 1.3 + 40)); // filamento + empaque
}
/** Medidas reales del PRODUCTO (cm): de la malla escalada a ~12 cm, o el tamaño base si no hay malla. */
export function dimsProductoCm(m: Modelo): { alto: number; ancho: number; largo: number } {
  return {
    alto: m.altoCm ?? DIM_BASE_CM.alto,
    ancho: m.anchoCm ?? DIM_BASE_CM.ancho,
    largo: m.largoCm ?? DIM_BASE_CM.largo,
  };
}
/** Medidas del EMPAQUE (cm): la pieza + holgura, redondeado, mínimo 3 cm por lado (Mercado Envíos). */
function dimsPaqueteCm(m: Modelo): { alto: number; ancho: number; largo: number } {
  const d = dimsProductoCm(m);
  const pad = (v: number) => Math.max(3, Math.ceil(v) + 1);
  return { alto: pad(d.alto), ancho: pad(d.ancho), largo: pad(d.largo) };
}
/** Dimensiones del paquete que ML exige (Mercado Envíos). Formato "altoxanchoxlargo,pesoEnGramos" (cm). */
function dimensionesPaquete(m: Modelo): string {
  const q = dimsPaqueteCm(m);
  return `${q.alto}x${q.ancho}x${q.largo},${pesoPaqueteG(m)}`;
}
/** Medidas del paquete como atributos SELLER_PACKAGE_* (ML los exige con value_name, no solo value_struct). */
export function atributosPaquete(m: Modelo): Atributo[] {
  const q = dimsPaqueteCm(m);
  return [
    { id: "SELLER_PACKAGE_WEIGHT", value_name: `${pesoPaqueteG(m)} g`, value_struct: { number: pesoPaqueteG(m), unit: "g" } },
    { id: "SELLER_PACKAGE_HEIGHT", value_name: `${q.alto} cm`, value_struct: { number: q.alto, unit: "cm" } },
    { id: "SELLER_PACKAGE_WIDTH", value_name: `${q.ancho} cm`, value_struct: { number: q.ancho, unit: "cm" } },
    { id: "SELLER_PACKAGE_LENGTH", value_name: `${q.largo} cm`, value_struct: { number: q.largo, unit: "cm" } },
  ];
}

/** Descripción por plantilla mejorada (respaldo cuando no hay IA). Editable luego en descripcionMl. */
export function generarDescripcion(m: Modelo): string {
  const cat = m.categoria && !/^(otro|importad)/i.test(m.categoria) ? m.categoria.toLowerCase() : "pieza";
  const nic = m.nicho && !/importad/i.test(m.nicho) ? m.nicho : "";
  const d = dimsProductoCm(m);
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  return [
    `${m.nombre} — impresión 3D de alta calidad${m.tipoFilamento ? `, en ${m.tipoFilamento} resistente` : ""}.`,
    "",
    `- Acabado prolijo y detallado, ideal como ${cat} para tu hogar, oficina o para regalar.`,
    m.multicolorAms ? "- Disponible en varios colores: dinos cuál quieres." : "- Varios colores disponibles bajo pedido.",
    nic ? `- Perfecto para: ${nic}.` : "",
    `- Medidas aproximadas: ${fmt(d.alto)} x ${fmt(d.ancho)} x ${fmt(d.largo)} cm.`,
    `- Hecho a pedido por ${getBranding().mlSellerName}: cuidamos cada pieza, una por una.`,
    "- Empaque seguro y envío a todo México.",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Garantiza que la descripción incluya la línea de medidas (la IA a veces no la pone). Idempotente. */
export function asegurarMedidas(desc: string, m: Modelo): string {
  if (/medidas\s+aprox/i.test(desc)) return desc;
  const d = dimsProductoCm(m);
  const fmt = (v: number) => (Math.round(v * 10) / 10).toString().replace(".", ",");
  return `${desc.trimEnd()}\n- Medidas aproximadas: ${fmt(d.alto)} x ${fmt(d.ancho)} x ${fmt(d.largo)} cm.`;
}

/** ML solo acepta descripción en TEXTO PLANO: quita emojis/pictogramas y normaliza viñetas a "-". */
export function sanitizarDescripcion(t: string): string {
  return t
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{2705}\u{2714}]/gu, "")
    .replace(/[•·▪►◦‣]/g, "-")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Payload base para POST /items. Los atributos requeridos por categoría se agregan aparte. */
export function construirPayloadItem(args: {
  modelo: Modelo;
  costeo: CosteoResultado;
  categoriaId: string;
  title: string;
  atributos?: Atributo[];
}): Record<string, unknown> {
  const { modelo, costeo, categoriaId, title, atributos = [] } = args;
  return {
    title,
    category_id: categoriaId,
    price: Math.max(1, Math.round(costeo.precioVenta)),
    currency_id: "MXN",
    available_quantity: STOCK_ML_DEFAULT, // bajo pedido: habilita comprar varias y quita "última en stock"
    buying_mode: "buy_it_now",
    listing_type_id: modelo.mlListingType ?? "bronze",
    condition: "new",
    pictures: pictures(modelo),
    ...(modelo.videoYoutubeId ? { video_id: modelo.videoYoutubeId } : {}),
    sale_terms: [
      { id: "MANUFACTURING_TIME", value_name: `${DIAS_FABRICACION_ML} días` },
      { id: "WARRANTY_TYPE", value_name: "Garantía del vendedor" },
      { id: "WARRANTY_TIME", value_name: "30 días" },
    ],
    // Dimensiones del paquete (que ML exige) en shipping.dimensions Y como atributos SELLER_PACKAGE_*
    // (según la categoría, ML las pide en uno u otro lugar). Formato dims: "altoxanchoxlargo,pesoGramos".
    shipping: { mode: "me2", local_pick_up: false, free_shipping: false, dimensions: dimensionesPaquete(modelo) },
    attributes: [...atributos, ...atributosPaquete(modelo).filter((a) => !atributos.some((x) => x.id === a.id))],
  };
}

/** Payload para PUBLICACIÓN DE CATÁLOGO (enganchado a un producto del catálogo de ML). Sin título/categoría. */
export function construirPayloadCatalogo(args: {
  modelo: Modelo;
  costeo: CosteoResultado;
  catalogProductId: string;
  categoriaId?: string;
}): Record<string, unknown> {
  const { modelo, costeo, catalogProductId, categoriaId } = args;
  return {
    catalog_product_id: catalogProductId,
    catalog_listing: true,
    ...(categoriaId ? { category_id: categoriaId } : {}),
    price: Math.max(1, Math.round(costeo.precioVenta)),
    currency_id: "MXN",
    available_quantity: STOCK_ML_DEFAULT,
    listing_type_id: modelo.mlListingType ?? "gold_special",
    condition: "new",
    pictures: pictures(modelo),
    ...(modelo.videoYoutubeId ? { video_id: modelo.videoYoutubeId } : {}),
    sale_terms: [
      { id: "MANUFACTURING_TIME", value_name: `${DIAS_FABRICACION_ML} días` },
      { id: "WARRANTY_TYPE", value_name: "Garantía del vendedor" },
      { id: "WARRANTY_TIME", value_name: "30 días" },
    ],
    shipping: { mode: "me2", local_pick_up: false, free_shipping: false, dimensions: dimensionesPaquete(modelo) },
  };
}

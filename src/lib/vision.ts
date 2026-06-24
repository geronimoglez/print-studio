// Verificación VISUAL para el enganche a catálogo de Mercado Libre.
//
// Problema: al enganchar una publicación a un producto del catálogo de ML, el catálogo
// puede tener un objeto DISTINTO (ej. nuestro "pulpo impreso" vs un "pulpo de peluche").
// El filtro por nombre (filtro-calidad.ts) cubre lo obvio; esto cubre lo visual: compara
// la FOTO de nuestro modelo impreso contra la FOTO del producto de catálogo y dice si es
// el MISMO objeto, usando un modelo de visión (VLM) vía OpenRouter.
//
// Si no hay OPENROUTER_API_KEY configurada, degrada a "no concluyente" (no bloquea, avisa).
// Modelo configurable con VISION_MODEL (default: gemini flash, barato y con buena visión).

export type ComparacionVisual = {
  evaluado: boolean; // false = no se pudo evaluar (sin key / error) → no bloquea, solo avisa
  mismo?: boolean;
  confianza?: number; // 0..1
  razon?: string;
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export type DeteccionIp = { evaluado: boolean; ip?: boolean; tipo?: "marca" | "personaje" | "no"; detalle?: string; confianza?: number; entidad?: string };

// Umbral de confianza para tratar una detección como IP real. Por debajo, se considera ruido
// (el VLM tiende a especular "podría ser anime"); preferimos NO bloquear inventario genérico.
export const UMBRAL_IP = 0.7;

/**
 * Detección VISUAL de propiedad intelectual ESTRICTA: solo marca IP cuando puede NOMBRAR una marca
 * registrada o un personaje/franquicia con derechos, con alta confianza. Los motivos GENÉRICOS
 * (dragón, pulpo, calavera, ajolote, animal, flor, figura sin nombre) NO son IP aunque estén estilizados.
 * Cubre lo que el nombre no ve (logo FIFA moldeado, balón Adidas en la foto). Degrada a no-evaluado sin key.
 */
export async function detectarIpVisual(fotoUrl?: string): Promise<DeteccionIp> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !fotoUrl) return { evaluado: false };
  const model = process.env.VISION_MODEL || "openai/gpt-4o-mini";
  const prompt =
    "Eres el control legal de una tienda de impresos 3D. Marca PROPIEDAD INTELECTUAL DE TERCEROS SOLO si " +
    "puedes NOMBRAR con certeza la entidad concreta visible (en el objeto o en la foto): " +
    "(a) MARCA registrada/logo identificable (FIFA, Adidas, Nike, Puma, UEFA, Mikasa, escudo de un club " +
    "específico, logo de una empresa real, texto de una marca real); " +
    "(b) PERSONAJE/franquicia con derechos identificable por nombre (Goku/Dragon Ball, Pikachu/Pokémon, " +
    "Spider-Man/Marvel, Mickey/Disney, Star Wars, etc.). " +
    "REGLA CLAVE: un motivo GENÉRICO NO es IP, aunque esté estilizado: un dragón genérico, pulpo, calavera, " +
    "ajolote, gato, flor, planta, animal, figura abstracta, organizador, soporte, ménsula, percha o maceta " +
    "SIN logo ni nombre de franquicia → tipo 'no'. NO especules ('podría ser', 'se asemeja a'): si no puedes " +
    "nombrar la marca/personaje exacto, es 'no'. Texto decorativo común (HOME, LOVE, palabras sueltas) no es marca. " +
    'Responde SOLO JSON: {"ip": true|false, "tipo": "marca"|"personaje"|"no", "entidad": "nombre exacto o vacío", ' +
    '"confianza": 0.0-1.0, "detalle": "qué viste, breve"}.';
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 220,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: fotoUrl } }] }],
      }),
    });
    if (!res.ok) return { evaluado: false, detalle: `VLM ${res.status}` };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const j = extraerJSON(data.choices?.[0]?.message?.content ?? "");
    if (!j || typeof j.ip !== "boolean") return { evaluado: false };
    const confianza = typeof j.confianza === "number" ? j.confianza : j.ip ? 0.5 : 1;
    const entidad = String(j.entidad ?? "").trim();
    // Solo es IP si: lo dijo, con confianza suficiente Y nombró una entidad concreta.
    const esIp = j.ip && confianza >= UMBRAL_IP && entidad.length > 1;
    return {
      evaluado: true,
      ip: esIp,
      tipo: esIp ? ((j.tipo as DeteccionIp["tipo"]) ?? "marca") : "no",
      entidad,
      confianza,
      detalle: String(j.detalle ?? ""),
    };
  } catch (e) {
    return { evaluado: false, detalle: e instanceof Error ? e.message : "error" };
  }
}

export type DeteccionWatermark = { evaluado: boolean; tiene?: boolean; zona?: string; sobreProducto?: boolean; confianza?: number };

/**
 * Detecta si una FOTO de producto tiene MARCA DE AGUA / logo / texto / URL sobreimpuesto (no parte del
 * objeto). ML rechaza fotos con marca de agua. Devuelve la zona y si está sobre el producto, para decidir
 * si se puede limpiar (esquina sobre fondo) o hay que quitar la foto (centro/sobre el producto).
 */
export async function detectarWatermark(fotoUrl?: string): Promise<DeteccionWatermark> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !fotoUrl) return { evaluado: false };
  const model = process.env.VISION_MODEL || "openai/gpt-4o-mini";
  const prompt =
    "Mira esta foto de producto (impresión 3D, normalmente fondo blanco). Busca SOLO una MARCA DE AGUA " +
    "SOBREIMPUESTA: un logo, texto, URL, @usuario o nombre de tienda/creador ESTAMPADO ENCIMA de la foto " +
    "(a menudo semitransparente, repetido o en una esquina) que NO es parte de la escena. " +
    "NO la cuentes si es: la etiqueta/marca de un OBJETO FÍSICO real en la escena (ej. una botella de vino con " +
    "su etiqueta), un código de barras de un producto real, o texto que forma parte del objeto impreso. " +
    "Esos son objetos reales, no marca de agua. Si hay marca de agua sobreimpuesta, indica la ZONA y si tapa " +
    "el producto. Ante la duda, responde tiene=false. " +
    'Responde SOLO JSON: {"tiene": true|false, "zona": "sup-izq"|"sup-der"|"inf-izq"|"inf-der"|"centro"|"borde", ' +
    '"sobreProducto": true|false, "confianza": 0.0-1.0}.';
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 120,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: fotoUrl } }] }],
      }),
    });
    if (!res.ok) return { evaluado: false };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const j = extraerJSON(data.choices?.[0]?.message?.content ?? "");
    if (!j || typeof j.tiene !== "boolean") return { evaluado: false };
    const confianza = typeof j.confianza === "number" ? j.confianza : 0.6;
    return { evaluado: true, tiene: j.tiene && confianza >= 0.6, zona: String(j.zona ?? "").trim(), sobreProducto: !!j.sobreProducto, confianza };
  } catch {
    return { evaluado: false };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extraerJSON(texto: string): any {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

/**
 * Compara dos fotos (A = nuestro impreso, B = producto de catálogo ML) y determina si
 * son el MISMO objeto/producto, ignorando material/color (uno es impreso en plástico).
 */
export async function compararProductos(
  fotoImpreso: string | undefined,
  fotoCatalogo: string | undefined,
): Promise<ComparacionVisual> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !fotoImpreso || !fotoCatalogo) return { evaluado: false, razon: "sin key o sin fotos" };
  const model = process.env.VISION_MODEL || "openai/gpt-4o-mini";
  const prompt =
    "Eres el control de calidad de un taller de impresión 3D. FOTO A = nuestro producto IMPRESO en 3D. " +
    "FOTO B = un producto del catálogo de Mercado Libre al que queremos ENGANCHAR la publicación. " +
    "¿Son el MISMO objeto/producto (misma forma y tipo de artículo)? Ignora diferencias de material, " +
    "color y acabado (el nuestro es plástico impreso). Si B es claramente otra cosa (peluche, cuadro, " +
    "hierro, otro animal, otro objeto), entonces NO son el mismo. " +
    'Responde SOLO JSON: {"mismo": true|false, "confianza": 0.0-1.0, "razon": "breve"}.';
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "text", text: "FOTO A (nuestro impreso):" },
              { type: "image_url", image_url: { url: fotoImpreso } },
              { type: "text", text: "FOTO B (catálogo ML):" },
              { type: "image_url", image_url: { url: fotoCatalogo } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return { evaluado: false, razon: `VLM ${res.status}` };
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = data.choices?.[0]?.message?.content ?? "";
    const j = extraerJSON(txt);
    if (!j || typeof j.mismo !== "boolean") return { evaluado: false, razon: "respuesta no parseable" };
    return { evaluado: true, mismo: j.mismo, confianza: j.confianza, razon: j.razon };
  } catch (e) {
    return { evaluado: false, razon: e instanceof Error ? e.message : "error" };
  }
}

/**
 * Genera una DESCRIPCIÓN DE VENTA para Mercado Libre mirando la FOTO del producto (VLM). Devuelve texto
 * plano con copy marketero pero honesto (no inventa lo que no se ve). Si no hay key/foto/falla → null
 * (el llamador usa la plantilla generarDescripcion como respaldo).
 */
export async function describirProductoMkt(fotoUrl: string | undefined, nombre: string, categoria: string): Promise<string | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !fotoUrl) return null;
  const model = process.env.VISION_MODEL || "openai/gpt-4o-mini";
  const prompt =
    "Eres copywriter experto en Mercado Libre México. Mira la foto del producto (está IMPRESO EN 3D) y escribe " +
    "una descripción de venta atractiva y HONESTA (no inventes características que no se ven). Estructura en texto plano:\n" +
    "1) Una línea-gancho corta.\n2) Qué es y para qué sirve (2-3 líneas).\n3) 3 o 4 beneficios en viñetas con '•'.\n" +
    "4) Menciona: impresión 3D de calidad, material resistente, hecho a pedido, personalizable en color, empaque seguro y envío a todo México.\n" +
    "5) Cierre con un llamado a la acción amable.\n" +
    "Tono cálido y vendedor, español de México. Incluye palabras clave que la gente busca. Máx ~110 palabras. " +
    "IMPORTANTE: Mercado Libre SOLO acepta texto plano — NO uses emojis ni símbolos ni markdown ni asteriscos. " +
    "Para las viñetas usa el guion '-'. Solo letras, números, acentos y puntuación normal. " +
    `Producto: "${nombre}" (categoría: ${categoria}). Responde SOLO con la descripción, sin comillas ni encabezados.`;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model, max_tokens: 420, temperature: 0.7,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: fotoUrl } }] }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const txt = (data.choices?.[0]?.message?.content ?? "").trim().replace(/\*\*/g, "").replace(/^["']|["']$/g, "");
    return txt.length > 40 ? txt.slice(0, 1900) : null;
  } catch {
    return null;
  }
}

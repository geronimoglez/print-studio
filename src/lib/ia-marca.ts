// Asistente de marca con IA (opcional, BYOK = trae-tu-propio-token).
// - Texto (nombre, tagline, descripción, paleta): OpenRouter, OpenAI o Anthropic (Claude).
// - Logo (imagen): fal.ai (FLUX) o OpenAI Images.
// Degradación: si no hay token, las funciones lanzan un error claro y la UI sigue 100% manual.
// El token puede venir del wizard (uso transitorio, no se persiste) o del entorno (secretoDe()).
import { subirImagen } from "./storage";
import { secretoDe } from "./secretos";

export type ProveedorTexto = "openrouter" | "openai" | "anthropic";
export type ProveedorImagen = "fal" | "openai";

export type IdeasMarca = { nombres: string[]; tagline: string; descripcion: string };
export type Paleta = { colorPrimary: string; colorAccent: string; colorBgDark: string; themeColor: string };

async function tokenDe(proveedor: string, byok?: string): Promise<string> {
  const t = byok?.trim() || (await secretoDe(proveedor));
  if (!t) throw new Error(`Falta el token de ${proveedor}. Pégalo en el asistente o configúralo en el entorno.`);
  return t;
}

function extraerJSON<T>(texto: string): T {
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió JSON válido.");
  return JSON.parse(m[0]) as T;
}

/** Llamada de chat genérica que devuelve texto plano, según el proveedor. */
async function chat(
  proveedor: ProveedorTexto,
  token: string,
  prompt: string,
  modelo?: string,
): Promise<string> {
  if (proveedor === "anthropic") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": token, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: modelo || "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) throw new Error(`Anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = (await r.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? "";
  }
  // OpenRouter y OpenAI comparten el formato chat/completions.
  const endpoint =
    proveedor === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";
  const model = modelo || (proveedor === "openai" ? "gpt-4o-mini" : process.env.VISION_MODEL || "openai/gpt-4o-mini");
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ model, max_tokens: 700, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`${proveedor} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const data = (await r.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

/** Genera ideas de nombre + tagline + descripción a partir de un brief del negocio. */
export async function generarIdeasMarca(
  brief: string,
  opts: { proveedor?: ProveedorTexto; token?: string; modelo?: string; idioma?: string } = {},
): Promise<IdeasMarca> {
  const proveedor = opts.proveedor ?? "openrouter";
  const token = await tokenDe(proveedor, opts.token);
  const idioma = opts.idioma || "español";
  const prompt =
    `Eres un especialista en branding para pequeños negocios. El negocio es de impresión 3D bajo pedido. ` +
    `Brief del usuario: "${brief || "negocio de impresión 3D"}". ` +
    `Propón en ${idioma}: 5 nombres de marca cortos y memorables, un tagline (máx 6 palabras) y una descripción breve (1 frase). ` +
    `Responde SOLO con JSON: {"nombres":["..."],"tagline":"...","descripcion":"..."}`;
  return extraerJSON<IdeasMarca>(await chat(proveedor, token, prompt, opts.modelo));
}

/** Genera una paleta de marca (colores hex) coherente con el nombre/sector. */
export async function generarPaleta(
  brief: string,
  opts: { proveedor?: ProveedorTexto; token?: string; modelo?: string } = {},
): Promise<Paleta> {
  const proveedor = opts.proveedor ?? "openrouter";
  const token = await tokenDe(proveedor, opts.token);
  const prompt =
    `Diseña una paleta para la marca "${brief || "Taller 3D"}" (negocio de impresión 3D, UI con encabezado oscuro). ` +
    `Devuelve colores hex accesibles. Responde SOLO con JSON: ` +
    `{"colorPrimary":"#RRGGBB","colorAccent":"#RRGGBB","colorBgDark":"#RRGGBB","themeColor":"#RRGGBB"}. ` +
    `colorPrimary = botones; colorAccent = detalle vivo; colorBgDark = fondo del encabezado (muy oscuro); themeColor = barra del navegador (oscuro).`;
  const p = extraerJSON<Paleta>(await chat(proveedor, token, prompt, opts.modelo));
  const hex = (v: string, def: string) => (/^#[0-9a-fA-F]{6}$/.test(v?.trim?.() ?? "") ? v.trim() : def);
  return {
    colorPrimary: hex(p.colorPrimary, "#0891b2"),
    colorAccent: hex(p.colorAccent, "#22d3ee"),
    colorBgDark: hex(p.colorBgDark, "#020617"),
    themeColor: hex(p.themeColor, "#0f172a"),
  };
}

/** Genera un logo con IA, lo persiste con subirImagen() y devuelve su URL pública. */
export async function generarLogo(
  descripcion: string,
  opts: { proveedor?: ProveedorImagen; token?: string } = {},
): Promise<{ url: string }> {
  const proveedor = opts.proveedor ?? "fal";
  const prompt =
    `Minimalist flat vector logo for a 3D printing studio: "${descripcion || "modern 3D print brand"}". ` +
    `Simple icon, centered, solid background, no text, high contrast, suitable as a circular app icon.`;

  let bytes: Uint8Array;
  let contentType = "image/png";

  if (proveedor === "fal") {
    const token = await tokenDe("fal", opts.token);
    const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Key ${token}` },
      body: JSON.stringify({ prompt, image_size: "square_hd", num_images: 1 }),
    });
    if (!r.ok) throw new Error(`fal.ai ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = (await r.json()) as { images?: Array<{ url?: string; content_type?: string }> };
    const url = data.images?.[0]?.url;
    if (!url) throw new Error("fal.ai no devolvió imagen.");
    contentType = data.images?.[0]?.content_type || "image/jpeg";
    bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  } else {
    const token = await tokenDe("openai", opts.token);
    const r = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ model: "gpt-image-1", prompt, size: "1024x1024", n: 1 }),
    });
    if (!r.ok) throw new Error(`OpenAI Images ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const data = (await r.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const b64 = data.data?.[0]?.b64_json;
    const urlImg = data.data?.[0]?.url;
    if (b64) {
      bytes = new Uint8Array(Buffer.from(b64, "base64"));
    } else if (urlImg) {
      const resp = await fetch(urlImg);
      bytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      throw new Error("OpenAI no devolvió imagen.");
    }
  }

  const ext = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : "png";
  const subida = await subirImagen(`branding/logo-ia-${Date.now()}.${ext}`, bytes, { contentType });
  return { url: subida.url };
}

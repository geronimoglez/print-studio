// Capa de almacenamiento intercambiable para imágenes (fotos / renders).
// - Vercel Blob (escala / producción): si hay BLOB_READ_WRITE_TOKEN.
// - Carpeta public/ (sin token): para pocos modelos, servidos estáticos por Next/Vercel.
// En la base de datos solo guardamos la URL resultante (campo Modelo.imagenes).
import fs from "node:fs";
import path from "node:path";

export type SubidaResultado = { url: string; pathname: string; backend: "blob" | "public" };

/** Token de Vercel Blob: acepta el estándar o el nombre personalizado del proyecto. */
function blobToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.lab3dblob_token || process.env.LAB3DBLOB_TOKEN;
}

/**
 * Sube una imagen y devuelve su URL pública.
 * @param nombre ruta/clave relativa, p.ej. "render/ajolote-flex/1.png"
 */
export async function subirImagen(
  nombre: string,
  datos: Buffer | Uint8Array,
  opts?: { contentType?: string },
): Promise<SubidaResultado> {
  const token = blobToken();
  const clave = nombre.replace(/^\/+/, "");
  if (token) {
    const { put } = await import("@vercel/blob");
    const r = await put(clave, Buffer.from(datos), {
      access: "public",
      token,
      contentType: opts?.contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return { url: r.url, pathname: r.pathname, backend: "blob" };
  }
  // Fallback: escribir en public/ (URL relativa servida estática).
  const dest = path.join(process.cwd(), "public", clave);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(datos));
  return { url: `/${clave}`, pathname: `/${clave}`, backend: "public" };
}

/** ¿Qué backend de almacenamiento se usará? (para logs/diagnóstico). */
export function backendActivo(): "blob" | "public" {
  return blobToken() ? "blob" : "public";
}

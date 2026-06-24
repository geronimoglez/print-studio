// Subida del logo de la marca. Reutiliza storage.ts (Vercel Blob o filesystem local).
import { subirImagen } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file");
  if (!(file instanceof File)) return Response.json({ ok: false, error: "Falta el archivo" }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ ok: false, error: "Debe ser una imagen" }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return Response.json({ ok: false, error: "Máximo 4 MB" }, { status: 400 });
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const r = await subirImagen(`branding/logo-${Date.now()}.${ext}`, bytes, { contentType: file.type });
    return Response.json({ ok: true, url: r.url });
  } catch {
    // P.ej. en Vercel sin Blob el filesystem es de solo-lectura. Mensaje claro en vez de 500.
    return Response.json(
      {
        ok: false,
        error:
          "No se pudo guardar la imagen: este despliegue no tiene almacenamiento configurado. Define BLOB_READ_WRITE_TOKEN (Vercel Blob) o pega directamente la URL de tu logo.",
      },
      { status: 200 },
    );
  }
}

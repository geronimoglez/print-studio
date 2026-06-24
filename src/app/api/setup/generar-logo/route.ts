// Asistente de marca: genera un logo con IA y lo guarda (BYOK). Degrada si no hay token.
import { generarLogo, type ProveedorImagen } from "@/lib/ia-marca";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    descripcion?: string;
    proveedor?: ProveedorImagen;
    token?: string;
  };
  try {
    const r = await generarLogo(body.descripcion ?? "", { proveedor: body.proveedor, token: body.token });
    return Response.json({ ok: true, url: r.url });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
}

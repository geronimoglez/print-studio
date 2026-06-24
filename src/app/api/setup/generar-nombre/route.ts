// Asistente de marca: genera ideas de nombre/tagline/descripción (BYOK). Degrada si no hay token.
import { generarIdeasMarca, type ProveedorTexto } from "@/lib/ia-marca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    brief?: string;
    proveedor?: ProveedorTexto;
    token?: string;
    idioma?: string;
  };
  try {
    const ideas = await generarIdeasMarca(body.brief ?? "", {
      proveedor: body.proveedor,
      token: body.token,
      idioma: body.idioma,
    });
    return Response.json({ ok: true, ...ideas });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
}

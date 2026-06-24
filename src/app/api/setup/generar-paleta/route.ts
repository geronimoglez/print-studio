// Asistente de marca: genera una paleta de colores (BYOK). Degrada si no hay token.
import { generarPaleta, type ProveedorTexto } from "@/lib/ia-marca";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    brief?: string;
    proveedor?: ProveedorTexto;
    token?: string;
  };
  try {
    const paleta = await generarPaleta(body.brief ?? "", { proveedor: body.proveedor, token: body.token });
    return Response.json({ ok: true, ...paleta });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "error" });
  }
}

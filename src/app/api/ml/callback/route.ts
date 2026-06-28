import { intercambiarCodigo } from "@/lib/mercadolibre";

export const dynamic = "force-dynamic";

// OAuth: ML regresa aquí con ?code=... tras la autorización del operador.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const base = url.origin;

  if (error || !code) {
    return Response.redirect(`${base}/integraciones?ml=error`, 302);
  }
  try {
    await intercambiarCodigo(code);
    return Response.redirect(`${base}/integraciones?ml=ok`, 302);
  } catch {
    return Response.redirect(`${base}/integraciones?ml=fail`, 302);
  }
}

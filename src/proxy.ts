import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, gateEnabled, rutaLibre, tokenEsperado, igualSeguro } from "@/lib/gate";

// Gate de acceso por contraseña (ver src/lib/gate.ts). No hace nada si APP_PASSWORD no está.
export async function proxy(request: NextRequest) {
  if (!gateEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (rutaLibre(pathname)) return NextResponse.next();

  const cookie = request.cookies.get(GATE_COOKIE)?.value ?? "";
  if (cookie && igualSeguro(cookie, await tokenEsperado())) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  // Corre en todo menos assets estáticos; el resto (incluidas /api/*) lo filtra rutaLibre().
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)).*)",
  ],
};

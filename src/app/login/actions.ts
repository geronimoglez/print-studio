"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GATE_COOKIE, gateEnabled, tokenPara, tokenEsperado, igualSeguro } from "@/lib/gate";

export async function entrar(fd: FormData) {
  const pw = ((fd.get("password") as string | null) ?? "").toString();
  const nextRaw = ((fd.get("next") as string | null) ?? "/").toString();
  // Evita open-redirect: solo rutas internas.
  const destino = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/";

  if (!gateEnabled()) redirect(destino);

  const ok = igualSeguro(await tokenPara(pw), await tokenEsperado());
  if (!ok) redirect(`/login?error=1&next=${encodeURIComponent(destino)}`);

  (await cookies()).set(GATE_COOKIE, await tokenEsperado(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
  redirect(destino);
}

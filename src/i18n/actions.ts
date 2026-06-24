"use server";

// Server action para cambiar el idioma de la UI (lo usa el selector de idioma).
import { cookies } from "next/headers";
import { defaultLocale, isLocale, type Locale } from "./config";
import { LOCALE_COOKIE } from "./locale";

export async function setUserLocale(locale: Locale) {
  const c = await cookies();
  c.set(LOCALE_COOKIE, isLocale(locale) ? locale : defaultLocale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}

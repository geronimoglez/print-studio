import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { getBrandingResuelto } from "@/lib/branding";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBrandingResuelto();
  return {
    title: `${b.appName} · ${b.tagline}`,
    description: b.appDescription,
    appleWebApp: { capable: true, title: b.appName, statusBarStyle: "black-translucent" },
  };
}

export async function generateViewport(): Promise<Viewport> {
  return { themeColor: (await getBrandingResuelto()).themeColor };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [b, locale, messages] = await Promise.all([getBrandingResuelto(), getLocale(), getMessages()]);
  // Inyecta los colores de marca como CSS vars (env ahora; Config.branding en runtime — Fase 1D).
  const brandVars = `:root{--brand-primary:${b.colorPrimary};--brand-accent:${b.colorAccent};--brand-dark:${b.colorBgDark};--brand-dark-2:${b.themeColor};}`;
  return (
    <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-100 text-slate-900">
        <style dangerouslySetInnerHTML={{ __html: brandVars }} />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-gradient-to-r from-brand-dark to-brand-dark-2 text-white shadow-sm">
            <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
              <Link href="/" className="text-white">
                <Logo name={b.appName} logoUrl={b.logoUrl} />
              </Link>
              <Nav />
            </div>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
          <footer className="mx-auto w-full max-w-7xl px-4 py-5 text-xs text-slate-500">
            <span className="font-medium text-slate-600">{b.appName}</span> · {b.tagline}.
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

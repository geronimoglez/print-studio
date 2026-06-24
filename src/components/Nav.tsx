"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

const NAV = [
  { href: "/", key: "dashboard" },
  { href: "/tablero", key: "tablero" },
  { href: "/pedidos", key: "pedidos" },
  { href: "/salud", key: "saludMl" },
  { href: "/notificaciones", key: "notificaciones" },
  { href: "/modelos", key: "modelos" },
  { href: "/importar", key: "importar" },
  { href: "/revision", key: "revision" },
  { href: "/config", key: "config" },
  { href: "/filamentos", key: "filamentos" },
  { href: "/impresoras", key: "impresoras" },
  { href: "/integraciones", key: "integraciones" },
] as const;

export function Nav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activo = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const cls = (a: boolean) =>
    `rounded-md px-3 py-1.5 transition-colors ${
      a ? "bg-cyan-500/15 text-cyan-300" : "text-slate-300 hover:bg-white/5 hover:text-white"
    }`;

  return (
    <>
      {/* Escritorio: nav horizontal */}
      <nav className="ml-auto hidden items-center gap-1 text-sm md:flex">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cls(activo(n.href))}>
            {t(n.key)}
          </Link>
        ))}
        <span className="ml-2">
          <LocaleSwitcher label={t("idioma")} />
        </span>
      </nav>

      {/* Móvil: botón hamburguesa + menú desplegable */}
      <div className="relative ml-auto flex items-center gap-2 md:hidden">
        <LocaleSwitcher label={t("idioma")} />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={t("menu")}
          aria-expanded={open}
          className="rounded-md p-2 text-slate-200 hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6 L18 18 M18 6 L6 18" /> : <path d="M3 6h18 M3 12h18 M3 18h18" />}
          </svg>
        </button>
        {open && (
          <>
            <button type="button" aria-label={t("cerrarMenu")} className="fixed inset-0 z-20 cursor-default" onClick={() => setOpen(false)} />
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-slate-700 bg-slate-900 p-1 text-sm shadow-xl">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className={`block ${cls(activo(n.href))}`}>
                  {t(n.key)}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

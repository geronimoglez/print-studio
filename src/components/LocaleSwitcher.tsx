"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setUserLocale } from "@/i18n/actions";
import { locales, localeNames, type Locale } from "@/i18n/config";

export function LocaleSwitcher({ label }: { label?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <select
      aria-label={label ?? "Language"}
      value={locale}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as Locale;
        start(async () => {
          await setUserLocale(next);
          router.refresh();
        });
      }}
      className="rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10 focus:outline-none"
    >
      {locales.map((l) => (
        <option key={l} value={l} className="text-slate-900">
          {localeNames[l]}
        </option>
      ))}
    </select>
  );
}

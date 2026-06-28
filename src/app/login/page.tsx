import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { gateEnabled } from "@/lib/gate";
import { getBrandingResuelto } from "@/lib/branding";
import { inputClass, labelClass, btnPrimary } from "@/components/ui";
import { entrar } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!gateEnabled()) redirect("/");
  const [sp, t, b] = await Promise.all([
    searchParams,
    getTranslations("login"),
    getBrandingResuelto(),
  ]);

  return (
    <div className="mx-auto mt-16 max-w-sm">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">{b.appName}</h1>
        <p className="mb-4 mt-1 text-sm text-slate-500">{t("subtitulo")}</p>
        {sp.error ? (
          <p className="mb-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{t("error")}</p>
        ) : null}
        <form action={entrar} className="space-y-3">
          <input type="hidden" name="next" value={sp.next ?? "/"} />
          <label className="block">
            <span className={labelClass}>{t("password")}</span>
            <input name="password" type="password" autoFocus required className={inputClass} />
          </label>
          <button type="submit" className={`${btnPrimary} w-full justify-center`}>
            {t("entrar")}
          </button>
        </form>
      </div>
    </div>
  );
}

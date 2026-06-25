import { getTranslations } from "next-intl/server";
import { getConfig } from "@/lib/datos";
import { getBrandingResuelto } from "@/lib/branding";
import { completarSetup } from "@/app/actions";
import { SetupWizard } from "./SetupWizard";

export const dynamic = "force-dynamic";

// Asistente de configuración inicial (white-label). También sirve para re-editar la marca después.
export default async function SetupPage() {
  const [cfg, b, t] = await Promise.all([getConfig(), getBrandingResuelto(), getTranslations("setup")]);
  const inicial = {
    appName: b.appName,
    appShortName: b.appShortName,
    tagline: b.tagline,
    appDescription: b.appDescription,
    mlSellerName: b.mlSellerName,
    logoUrl: b.logoUrl,
    colorPrimary: b.colorPrimary,
    colorAccent: b.colorAccent,
    colorBgDark: b.colorBgDark,
    themeColor: b.themeColor,
    localeUi: cfg.localeUi,
    localeContenido: cfg.localeContenido,
    monedaNegocio: cfg.monedaNegocio,
  };
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {cfg.setupCompletado ? t("tituloEditar") : t("tituloNuevo")}
        </h1>
        <p className="text-sm text-slate-500">{t("intro")}</p>
      </div>
      <SetupWizard action={completarSetup} inicial={inicial} yaConfigurado={cfg.setupCompletado} />
    </div>
  );
}

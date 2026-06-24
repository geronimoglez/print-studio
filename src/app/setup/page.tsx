import { getConfig } from "@/lib/datos";
import { getBrandingResuelto } from "@/lib/branding";
import { completarSetup } from "@/app/actions";
import { SetupWizard } from "./SetupWizard";

export const dynamic = "force-dynamic";

// Asistente de configuración inicial (white-label). También sirve para re-editar la marca después.
export default async function SetupPage() {
  const [cfg, b] = await Promise.all([getConfig(), getBrandingResuelto()]);
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
          {cfg.setupCompletado ? "Marca y apariencia" : "¡Bienvenido! Configura tu marca"}
        </h1>
        <p className="text-sm text-slate-500">
          Personaliza el nombre, el logo y los colores de tu instancia. Puedes hacerlo a mano o dejar que
          la IA te proponga una marca (necesitas tu propio token de fal.ai, OpenAI o Claude). Todo es
          opcional y se puede cambiar luego.
        </p>
      </div>
      <SetupWizard action={completarSetup} inicial={inicial} yaConfigurado={cfg.setupCompletado} />
    </div>
  );
}

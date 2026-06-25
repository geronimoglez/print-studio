"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Impresora, Modelo } from "@/generated/prisma/client";
import {
  CATEGORIAS,
  DIFICULTADES,
  ESTADOS_VALIDACION,
  FUENTES,
  LICENCIAS,
  TIPOS_FILAMENTO,
} from "@/lib/dominios";
import { Campo, Card, btnPrimary, btnGhost, inputClass, selectClass } from "@/components/ui";

export function ModeloForm({
  action,
  modelo,
  impresoras,
  submitLabel,
}: {
  action: (fd: FormData) => void;
  modelo?: Modelo;
  impresoras: Impresora[];
  submitLabel: string;
}) {
  const t = useTranslations("modeloForm");
  const v = <K extends keyof Modelo>(k: K) => modelo?.[k] ?? undefined;
  return (
    <form action={action} className="space-y-4">
      {modelo ? <input type="hidden" name="id" defaultValue={modelo.id} /> : null}

      <Card title={t("seccion.general")}>
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <Campo label={t("nombre")}>
              <input name="nombre" required defaultValue={v("nombre") as string} className={inputClass} />
            </Campo>
          </div>
          <Campo label={t("fuente")}>
            <select name="fuente" defaultValue={(v("fuente") as string) ?? "Propio"} className={selectClass}>
              {FUENTES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("creador")}>
            <input name="creador" defaultValue={(v("creador") as string) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("urlFuente")}>
            <input name="urlFuente" defaultValue={(v("urlFuente") as string) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("licencia")} hint={t("licenciaHint")}>
            <select name="licencia" defaultValue={(v("licencia") as string) ?? "Propia"} className={selectClass}>
              {LICENCIAS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("categoria")}>
            <select name="categoria" defaultValue={(v("categoria") as string) ?? "Otro"} className={selectClass}>
              {CATEGORIAS.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("nicho")} hint={t("nichoHint")}>
            <input name="nicho" defaultValue={(v("nicho") as string) ?? ""} className={inputClass} />
          </Campo>
        </fieldset>
      </Card>

      <Card title={t("seccion.tecnicos")}>
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label={t("tiempoImpresionMin")}>
            <input
              name="tiempoImpresionMin"
              type="number"
              min="0"
              required
              defaultValue={(v("tiempoImpresionMin") as number) ?? ""}
              className={inputClass}
            />
          </Campo>
          <Campo label={t("gramosFilamento")}>
            <input
              name="gramosFilamento"
              type="number"
              min="0"
              step="0.1"
              required
              defaultValue={(v("gramosFilamento") as number) ?? ""}
              className={inputClass}
            />
          </Campo>
          <Campo label={t("tipoFilamento")}>
            <select name="tipoFilamento" defaultValue={(v("tipoFilamento") as string) ?? "PLA"} className={selectClass}>
              {TIPOS_FILAMENTO.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("dificultad")}>
            <select name="dificultad" defaultValue={(v("dificultad") as string) ?? "Media"} className={selectClass}>
              {DIFICULTADES.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("impresoraAsignada")}>
            <select name="impresoraId" defaultValue={(v("impresoraId") as string) ?? ""} className={selectClass}>
              <option value="">{t("impresoraDefault")}</option>
              {impresoras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.modelo}
                </option>
              ))}
            </select>
          </Campo>
          <div className="flex items-end gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="multicolorAms" defaultChecked={!!v("multicolorAms")} /> {t("multicolorAms")}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="requiereSoportes" defaultChecked={!!v("requiereSoportes")} /> {t("requiereSoportes")}
            </label>
          </div>
        </fieldset>
      </Card>

      <Card title={t("seccion.costos")}>
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label={t("tiempoOperacionMin")} hint={t("tiempoOperacionHint")}>
            <input
              name="tiempoOperacionMin"
              type="number"
              min="0"
              defaultValue={(v("tiempoOperacionMin") as number) ?? 20}
              className={inputClass}
            />
          </Campo>
          <Campo label={t("costoPostproceso")}>
            <input
              name="costoPostproceso"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(v("costoPostproceso") as number) ?? 0}
              className={inputClass}
            />
          </Campo>
          <Campo label={t("costoLicencia")} hint={t("costoLicenciaHint")}>
            <input
              name="costoLicencia"
              type="number"
              min="0"
              step="0.01"
              defaultValue={(v("costoLicencia") as number) ?? 0}
              className={inputClass}
            />
          </Campo>
        </fieldset>
      </Card>

      <Card title={t("seccion.mercado")}>
        <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label={t("rating")}>
            <input name="rating" type="number" min="0" max="5" step="0.1" defaultValue={(v("rating") as number) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("popularidad")}>
            <input name="popularidad" type="number" min="0" defaultValue={(v("popularidad") as number) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("estadoValidacion")}>
            <select name="estadoValidacion" defaultValue={(v("estadoValidacion") as string) ?? "Pendiente"} className={selectClass}>
              {ESTADOS_VALIDACION.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </Campo>
          <Campo label={t("mlItemId")}>
            <input name="mlItemId" defaultValue={(v("mlItemId") as string) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("archivoUrl")} hint={t("archivoUrlHint")}>
            <input name="archivoUrl" defaultValue={(v("archivoUrl") as string) ?? ""} className={inputClass} />
          </Campo>
          <Campo label={t("archivoTipo")}>
            <select name="archivoTipo" defaultValue={(v("archivoTipo") as string) ?? ""} className={selectClass}>
              <option value="">—</option>
              <option value="3mf">3mf</option>
              <option value="stl">stl</option>
              <option value="otro">otro</option>
            </select>
          </Campo>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" name="publicadoMl" defaultChecked={!!v("publicadoMl")} /> {t("publicadoMl")}
            </label>
          </div>
        </fieldset>
      </Card>

      <Card title={t("seccion.notas")}>
        <Campo label={t("notas")}>
          <textarea name="notas" rows={2} defaultValue={(v("notas") as string) ?? ""} className={inputClass} />
        </Campo>
      </Card>

      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        <Link href="/modelos" className={btnGhost}>
          {t("cancelar")}
        </Link>
      </div>
    </form>
  );
}

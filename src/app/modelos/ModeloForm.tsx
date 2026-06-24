import Link from "next/link";
import type { Impresora, Modelo } from "@/generated/prisma/client";
import {
  CATEGORIAS,
  DIFICULTADES,
  ESTADOS_VALIDACION,
  FUENTES,
  LICENCIAS,
  TIPOS_FILAMENTO,
} from "@/lib/dominios";
import { Campo, btnPrimary, btnGhost, inputClass, selectClass } from "@/components/ui";

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
  const v = <K extends keyof Modelo>(k: K) => modelo?.[k] ?? undefined;
  return (
    <form action={action} className="space-y-6">
      {modelo ? <input type="hidden" name="id" defaultValue={modelo.id} /> : null}

      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-3">
          <Campo label="Nombre del modelo">
            <input name="nombre" required defaultValue={v("nombre") as string} className={inputClass} />
          </Campo>
        </div>
        <Campo label="Fuente">
          <select name="fuente" defaultValue={(v("fuente") as string) ?? "Propio"} className={selectClass}>
            {FUENTES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Creador (si es de terceros)">
          <input name="creador" defaultValue={(v("creador") as string) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="URL de la fuente">
          <input name="urlFuente" defaultValue={(v("urlFuente") as string) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="Licencia" hint="Define si el modelo se puede vender (filtro legal).">
          <select name="licencia" defaultValue={(v("licencia") as string) ?? "Propia"} className={selectClass}>
            {LICENCIAS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Categoría">
          <select name="categoria" defaultValue={(v("categoria") as string) ?? "Otro"} className={selectClass}>
            {CATEGORIAS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Nicho / etiqueta" hint="ej. Día de Muertos, gaming, refacciones">
          <input name="nicho" defaultValue={(v("nicho") as string) ?? ""} className={inputClass} />
        </Campo>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-600">Técnicos (de Bambu Studio)</legend>
        <Campo label="Tiempo de impresión (min)">
          <input
            name="tiempoImpresionMin"
            type="number"
            min="0"
            required
            defaultValue={(v("tiempoImpresionMin") as number) ?? ""}
            className={inputClass}
          />
        </Campo>
        <Campo label="Filamento (gramos)">
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
        <Campo label="Tipo de filamento">
          <select name="tipoFilamento" defaultValue={(v("tipoFilamento") as string) ?? "PLA"} className={selectClass}>
            {TIPOS_FILAMENTO.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Dificultad">
          <select name="dificultad" defaultValue={(v("dificultad") as string) ?? "Media"} className={selectClass}>
            {DIFICULTADES.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="Impresora asignada">
          <select name="impresoraId" defaultValue={(v("impresoraId") as string) ?? ""} className={selectClass}>
            <option value="">— usar valores por defecto —</option>
            {impresoras.map((p) => (
              <option key={p.id} value={p.id}>
                {p.modelo}
              </option>
            ))}
          </select>
        </Campo>
        <div className="flex items-end gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="multicolorAms" defaultChecked={!!v("multicolorAms")} /> AMS / multicolor
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="requiereSoportes" defaultChecked={!!v("requiereSoportes")} /> Soportes
          </label>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-600">Mano de obra y costos</legend>
        <Campo label="Tiempo de operación (min)" hint="slicing + retiro + post + empaque">
          <input
            name="tiempoOperacionMin"
            type="number"
            min="0"
            defaultValue={(v("tiempoOperacionMin") as number) ?? 20}
            className={inputClass}
          />
        </Campo>
        <Campo label="Costo post-proceso (MXN)">
          <input
            name="costoPostproceso"
            type="number"
            min="0"
            step="0.01"
            defaultValue={(v("costoPostproceso") as number) ?? 0}
            className={inputClass}
          />
        </Campo>
        <Campo label="Costo licencia (MXN)" hint="prorrateo de membresía comercial, si aplica">
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

      <fieldset className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-600">Mercado y estado</legend>
        <Campo label="Rating (1–5)">
          <input name="rating" type="number" min="0" max="5" step="0.1" defaultValue={(v("rating") as number) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="Popularidad (descargas/likes)">
          <input name="popularidad" type="number" min="0" defaultValue={(v("popularidad") as number) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="Estado de validación">
          <select name="estadoValidacion" defaultValue={(v("estadoValidacion") as string) ?? "Pendiente"} className={selectClass}>
            {ESTADOS_VALIDACION.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Campo>
        <Campo label="ID de publicación ML">
          <input name="mlItemId" defaultValue={(v("mlItemId") as string) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="Archivo (URL)" hint="ruta al .3mf / .stl (pipeline F3)">
          <input name="archivoUrl" defaultValue={(v("archivoUrl") as string) ?? ""} className={inputClass} />
        </Campo>
        <Campo label="Tipo de archivo">
          <select name="archivoTipo" defaultValue={(v("archivoTipo") as string) ?? ""} className={selectClass}>
            <option value="">—</option>
            <option value="3mf">3mf</option>
            <option value="stl">stl</option>
            <option value="otro">otro</option>
          </select>
        </Campo>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="publicadoMl" defaultChecked={!!v("publicadoMl")} /> Publicado en Mercado Libre
          </label>
        </div>
      </fieldset>

      <Campo label="Notas">
        <textarea name="notas" rows={2} defaultValue={(v("notas") as string) ?? ""} className={inputClass} />
      </Campo>

      <div className="flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        <Link href="/modelos" className={btnGhost}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

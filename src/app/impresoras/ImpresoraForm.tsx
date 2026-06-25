"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Impresora } from "@/generated/prisma/client";
import { Campo, btnPrimary, btnGhost, inputClass } from "@/components/ui";

export function ImpresoraForm({
  action,
  impresora,
  submitLabel,
}: {
  action: (fd: FormData) => void;
  impresora?: Impresora;
  submitLabel: string;
}) {
  const t = useTranslations("impresoraForm");
  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {impresora ? <input type="hidden" name="id" defaultValue={impresora.id} /> : null}
      <Campo label={t("modelo")} hint={t("modeloHint")}>
        <input name="modelo" defaultValue={impresora?.modelo ?? ""} className={inputClass} placeholder="Bambu Lab A1" />
      </Campo>
      <Campo label={t("potencia")}>
        <input name="potenciaW" type="number" step="1" min="0" defaultValue={impresora?.potenciaW ?? 100} className={inputClass} />
      </Campo>
      <Campo label={t("costoEquipo")}>
        <input name="costoEquipo" type="number" step="0.01" min="0" defaultValue={impresora?.costoEquipo ?? 0} className={inputClass} />
      </Campo>
      <Campo label={t("depreciacion")}>
        <input name="depreciacionPorHora" type="number" step="0.1" min="0" defaultValue={impresora?.depreciacionPorHora ?? 2} className={inputClass} />
      </Campo>
      <Campo label={t("horasUso")}>
        <input name="horasUso" type="number" step="1" min="0" defaultValue={impresora?.horasUso ?? 0} className={inputClass} />
      </Campo>
      <div className="md:col-span-5 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="disponible" defaultChecked={impresora?.disponible ?? true} /> {t("disponible")}
        </label>
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        {impresora ? (
          <Link href="/impresoras" className={btnGhost}>
            {t("cancelar")}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

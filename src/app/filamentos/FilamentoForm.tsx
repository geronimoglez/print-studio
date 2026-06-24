import Link from "next/link";
import type { Filamento } from "@/generated/prisma/client";
import { TIPOS_FILAMENTO } from "@/lib/dominios";
import { Campo, btnPrimary, btnGhost, inputClass, selectClass } from "@/components/ui";

export function FilamentoForm({
  action,
  filamento,
  submitLabel,
}: {
  action: (fd: FormData) => void;
  filamento?: Filamento;
  submitLabel: string;
}) {
  return (
    <form action={action} className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {filamento ? <input type="hidden" name="id" defaultValue={filamento.id} /> : null}
      <Campo label="Tipo">
        <select name="tipo" className={selectClass} defaultValue={filamento?.tipo ?? "PLA"}>
          {TIPOS_FILAMENTO.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </Campo>
      <Campo label="Marca">
        <input name="marca" defaultValue={filamento?.marca ?? ""} className={inputClass} />
      </Campo>
      <Campo label="Color">
        <input name="color" defaultValue={filamento?.color ?? ""} className={inputClass} />
      </Campo>
      <Campo label="Costo/kg (MXN)">
        <input name="costoPorKg" type="number" step="0.01" min="0" defaultValue={filamento?.costoPorKg ?? 330} className={inputClass} />
      </Campo>
      <Campo label="Stock (g)">
        <input name="stockGramos" type="number" step="1" min="0" defaultValue={filamento?.stockGramos ?? 0} className={inputClass} />
      </Campo>
      <div className="md:col-span-5 flex items-center gap-3">
        <button type="submit" className={btnPrimary}>
          {submitLabel}
        </button>
        {filamento ? (
          <Link href="/filamentos" className={btnGhost}>
            Cancelar
          </Link>
        ) : null}
      </div>
    </form>
  );
}

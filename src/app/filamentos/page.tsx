import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { crearFilamento, eliminarFilamento } from "@/app/actions";
import { mxn } from "@/lib/format";
import { Card } from "@/components/ui";
import { FilamentoForm } from "./FilamentoForm";

export const dynamic = "force-dynamic";

export default async function FilamentosPage() {
  const filamentos = await prisma.filamento.findMany({ orderBy: { tipo: "asc" } });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Filamentos</h1>
        <p className="text-sm text-slate-500">
          El costo por kg alimenta el costeo de cada modelo (se cruza por tipo de filamento).
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Tipo</th>
              <th className="px-3 py-2.5">Marca</th>
              <th className="px-3 py-2.5">Color</th>
              <th className="px-3 py-2.5 text-right">Costo/kg</th>
              <th className="px-3 py-2.5 text-right">Stock (g)</th>
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filamentos.map((f) => (
              <tr key={f.id} className="border-t border-slate-100">
                <td className="px-3 py-2.5 font-medium">{f.tipo}</td>
                <td className="px-3 py-2.5 text-slate-600">{f.marca ?? "—"}</td>
                <td className="px-3 py-2.5 text-slate-600">{f.color ?? "—"}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{mxn(f.costoPorKg)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{f.stockGramos ?? 0}</td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <Link href={`/filamentos/${f.id}`} className="text-cyan-700 hover:underline">
                      Editar
                    </Link>
                    <form action={eliminarFilamento}>
                      <input type="hidden" name="id" defaultValue={f.id} />
                      <button type="submit" className="text-rose-700 hover:underline">
                        Eliminar
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {filamentos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">
                  Sin filamentos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Card title="Agregar filamento">
        <FilamentoForm action={crearFilamento} submitLabel="Agregar" />
      </Card>
    </div>
  );
}

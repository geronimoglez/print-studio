// Skeleton instantáneo mientras el servidor renderiza el catálogo (mejora la sensación de velocidad).
export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-slate-100 py-3 last:border-0">
            <div className="h-12 w-12 flex-none animate-pulse rounded-md bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-1/5 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

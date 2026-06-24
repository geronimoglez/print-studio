// Formato de dinero para MÉXICO (MXN): miles con COMA, sin depender del locale/ICU
// del runtime ni del LLM. Determinístico → el bot solo repite el string, no reformatea.
//   46403  → "$46,403 MXN"
//   46403.5 → "$46,404 MXN" (redondeo a entero; los precios 3D no usan centavos)
export function mxn(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  const s = v.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${s} MXN`;
}

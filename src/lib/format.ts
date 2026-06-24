// Helpers de formato (MXN, horas, porcentajes).

const fmtMxn = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 2,
});

export const mxn = (n: number) => fmtMxn.format(n);
export const horas = (min: number) => `${(min / 60).toFixed(1)} h`;
export const pct = (n: number) => `${n.toFixed(0)}%`;

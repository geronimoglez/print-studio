// Reglas de licencia (doc 02). Deriva si un modelo es APTO PARA VENTA.
// Es el filtro previo a publicar: ningún modelo se publica en ML sin licencia que permita venta comercial.

// Licencias que SÍ permiten vender la impresión física.
const LICENCIAS_VENDIBLES = new Set<string>([
  "Propia", // modelo propio: máximo margen, cero riesgo
  "Comercial", // licencia comercial del creador (membresía BambuLab)
  "CC-BY", // uso comercial permitido CON atribución
  "Dominio publico",
]);

/** ¿La licencia permite vender la impresión física? */
export function esAptoVenta(licencia: string): boolean {
  return LICENCIAS_VENDIBLES.has(licencia);
}

/** Explicación legible del estatus legal de la licencia. */
export function motivoLicencia(licencia: string): string {
  switch (licencia) {
    case "Propia":
      return "Modelo propio: venta libre, máximo margen.";
    case "Comercial":
      return "Licencia comercial del creador: venta permitida.";
    case "CC-BY":
      return "Uso comercial permitido CON atribución al autor.";
    case "Dominio publico":
      return "Dominio público: venta permitida.";
    case "CC-BY-NC":
      return "No comercial (NC): NO se puede vender.";
    case "Personal":
      return "Solo uso personal: NO se puede vender.";
    default:
      return "Licencia desconocida: verificar antes de publicar.";
  }
}

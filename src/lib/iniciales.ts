// Utilidad pura (sin dependencias de servidor) — segura para componentes cliente y servidor.
// Iniciales para el monograma cuando no hay logo (p.ej. "Taller 3D" → "T3").
export function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return "3D";
  const letras = palabras.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letras.join("") || "3D";
}

// Filtro de calidad: detecta productos/sugerencias que NO son impresiones 3D.
//
// Caso que resuelve: al "Buscar en catálogo" para un modelo impreso (p.ej. "Pulpo"),
// el catálogo de ML devuelve cosas como "Pulpo de Peluche", "Pulpo de Hierro Fundido",
// "Cuadro/Vinilo de Pulpo" — productos de materiales IMPOSIBLES en impresión 3D FDM.
// Engancharse a uno de esos = publicación equivocada. Este filtro los marca como
// sospechosos para (a) ocultarlos/avisar en la UI y (b) BLOQUEAR el publish hasta
// confirmación humana (el bot manda la liga/foto para decidir rápido).
//
// Es heurístico por palabra clave (determinístico, sin costo). Para fotos propias del
// pack se complementa con una verificación visual (IA) aparte.

// Materiales / tipos de producto que un impreso 3D (plástico FDM/resina) NUNCA es.
const MATERIALES_NO_3D: Array<{ re: RegExp; razon: string }> = [
  { re: /\b(peluche|felpa|plush|almohada|coj[ií]n|relleno|afelpad)/i, razon: "peluche/textil" },
  { re: /\b(hierro|fundido|forjad[oa]|forja|bronce|lat[oó]n|peltre|cobre|herrer[ií]a)\b/i, razon: "metal fundido/forjado" },
  { re: /\b(vinil[oa]?|calcoman[ií]a|sticker|adhesiv[oa]|pegatina)\b/i, razon: "vinil/calcomanía" },
  { re: /\b(cuadro|lienzo|canvas|pintura|[oó]leo|marco|p[oó]ster|poster|l[aá]mina|tapiz)\b/i, razon: "cuadro/lienzo/marco" },
  { re: /\b(madera\s*maciza|tallad[oa]\s*en\s*madera|bamb[uú]|mimbre|ratt[aá]n)\b/i, razon: "madera/tallado" },
  { re: /\b(cer[aá]mica|porcelana|talavera|barro|terracota)\b/i, razon: "cerámica/porcelana" },
  { re: /\b(vidrio|cristal|murano|soplad[oa])\b/i, razon: "vidrio/cristal" },
  { re: /\b(textil|bordad[oa]|tejid[oa]|algod[oó]n|lana|fieltro)\b/i, razon: "textil/bordado" },
  { re: /\b(m[aá]rmol|granito|piedra\s*natural|onix|[oó]nix)\b/i, razon: "piedra/mármol" },
  { re: /\b(vela|jab[oó]n\s*artesanal|cera|resina\s*epox)/i, razon: "vela/jabón/resina colada" },
];

export type Sospecha = { sospechoso: boolean; razon?: string };

/** ¿El texto (nombre del producto/sugerencia) apunta a algo que NO es impresión 3D? */
export function noEsImpresion3D(texto: string | null | undefined): Sospecha {
  const t = (texto ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "");
  for (const m of MATERIALES_NO_3D) {
    if (m.re.test(texto ?? "") || m.re.test(t)) return { sospechoso: true, razon: m.razon };
  }
  return { sospechoso: false };
}

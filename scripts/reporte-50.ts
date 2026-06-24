// Reporte de "match" para los modelos del pack: ¿cómo publicaría cada uno en ML?
//
// Para cada modelo evalúa:
//   - Licencia (apto/no apto) — filtro previo.
//   - Predictor de categoría sobre el NOMBRE (¿ML lo reconoce?).
//   - Si falla, término de RESPALDO (lib/ml-categorias) y su predicción (demuestra el rescate "dragón").
//   - Búsqueda en el CATÁLOGO de ML (¿existe producto de catálogo para enganchar?).
//   - Veredicto: Catálogo / Libre / Requiere respaldo / Bloqueado / Sin categoría.
//
// Genera: ../11_Reporte_Match_ML.md  (+ resumen en consola).
// Correr: npx tsx scripts/reporte-50.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { esAptoVenta } from "../src/lib/licencias";
import { terminoCategoriaFallback } from "../src/lib/ml-categorias";
import { predecirCategoriaPublica, buscarCatalogo } from "../src/lib/mercadolibre";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

type Fila = {
  nombre: string;
  categoria: string;
  licencia: string;
  apto: boolean;
  catNombre?: string;
  catId?: string;
  usoRespaldo: boolean;
  termino?: string;
  catalogoCount?: number;
  catalogoNombre?: string;
  catalogoId?: string;
  dominio?: string;
  veredicto: string;
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/\|/g, "\\|");
}

async function main() {
  const modelos = await prisma.modelo.findMany({
    where: { notas: { startsWith: "Pack " } },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  console.log(`Analizando ${modelos.length} modelos del pack...\n`);

  const filas: Fila[] = [];
  for (const m of modelos) {
    const apto = esAptoVenta(m.licencia);
    const fila: Fila = {
      nombre: m.nombre,
      categoria: m.categoria,
      licencia: m.licencia,
      apto,
      usoRespaldo: false,
      veredicto: "",
    };

    // 1) Predictor sobre el nombre
    let cat = await predecirCategoriaPublica(m.nombre);
    // 2) Respaldo si el nombre no devolvió categoría
    if (!cat) {
      const termino = terminoCategoriaFallback(m.nombre, m.categoria);
      fila.termino = termino;
      const catFb = await predecirCategoriaPublica(termino);
      if (catFb) {
        cat = catFb;
        fila.usoRespaldo = true;
      }
    }
    fila.catNombre = cat?.name;
    fila.catId = cat?.id;

    // 3) Búsqueda en catálogo de ML (candidatos — el match correcto lo confirma el humano con la foto)
    const bc = await buscarCatalogo(m.nombre);
    fila.catalogoCount = bc.productos?.length ?? 0;
    const prod = bc.productos?.[0];
    if (prod) {
      fila.catalogoNombre = String(prod.name ?? "");
      fila.catalogoId = String(prod.id ?? "");
      fila.dominio = String(prod.domain_id ?? "");
    }

    // 4) Veredicto (publicabilidad: licencia + categoría)
    if (!apto) fila.veredicto = "❌ Bloqueado (licencia)";
    else if (cat && fila.usoRespaldo) fila.veredicto = "⚠️ Publicable (respaldo)";
    else if (cat) fila.veredicto = "✅ Publicable";
    else fila.veredicto = "❌ Sin categoría";

    filas.push(fila);
    process.stdout.write(`  ${fila.veredicto.padEnd(24)} ${m.nombre}\n`);
  }

  // Resumen
  const tot = filas.length;
  const conta = (re: RegExp) => filas.filter((f) => re.test(f.veredicto)).length;
  const resumen = {
    total: tot,
    publicable: filas.filter((f) => f.veredicto === "✅ Publicable").length,
    respaldo: conta(/respaldo/),
    bloqueado: conta(/Bloqueado/),
    sinCat: conta(/Sin categoría/),
    conCandidatosCatalogo: filas.filter((f) => (f.catalogoCount ?? 0) > 0).length,
  };

  // Markdown
  const hoy = process.env.REPORTE_FECHA ?? "2026-06-08";
  const lineas: string[] = [];
  lineas.push(`# Reporte de match con Mercado Libre — ${tot} modelos del pack`);
  lineas.push("");
  lineas.push(`> Generado: ${hoy}. Fuente: catálogo del sistema (Lab 3D Brothers).`);
  lineas.push("");
  lineas.push("## Resumen");
  lineas.push("");
  lineas.push(`- **Total analizados:** ${resumen.total}`);
  lineas.push(`- ✅ **Publicables** (apto de licencia + categoría directa del predictor): ${resumen.publicable}`);
  lineas.push(`- ⚠️ **Publicables vía respaldo** dominio→categoría (caso "dragón"): ${resumen.respaldo}`);
  lineas.push(`- ❌ **Bloqueados por licencia** (IP de terceros): ${resumen.bloqueado}`);
  lineas.push(`- ❌ **Sin categoría** (ni predictor ni respaldo): ${resumen.sinCat}`);
  lineas.push(`- 📦 Con **candidatos en el catálogo de ML** (a confirmar con la foto): ${resumen.conCandidatosCatalogo}/${resumen.total}`);
  lineas.push("");
  lineas.push("**Cómo leer esto:**");
  lineas.push("- *Publicable* = la licencia permite vender y el predictor de ML da una categoría válida → el copiloto puede publicar (anuncio libre).");
  lineas.push("- *Publicable vía respaldo* = el predictor NO reconoció el nombre exacto, pero el término genérico de `ml-categorias.ts` sí. **Esto es lo que arregla el caso del dragón.**");
  lineas.push("- *Bloqueado* = la licencia inferida es de IP de terceros (Marvel/DC/Pokémon/etc.) → NO se publica hasta confirmar licencia.");
  lineas.push("- *Candidatos de catálogo* = productos del catálogo de ML que **podrían** ser el match. OJO: la búsqueda por nombre trae también productos irrelevantes (p.ej. un Lego de Pikachu), por eso **el match correcto lo confirma una persona comparando la FOTO** (de ahí la importancia de tener las fotos primero). Publicar por catálogo es opcional y premium; sin catálogo igual se publica como anuncio libre.");
  lineas.push("");
  lineas.push("## Detalle por modelo");
  lineas.push("");
  lineas.push("| Modelo | Cat. interna | Licencia | Veredicto | Categoría ML (predictor) | Respaldo | Candidatos catálogo (top / dominio) |");
  lineas.push("|---|---|---|---|---|---|---|");
  for (const f of filas) {
    const catMl = f.catNombre ? `${esc(f.catNombre)} (${esc(f.catId)})` : "—";
    const resp = f.usoRespaldo ? `via "${esc(f.termino)}"` : f.termino ? `falló incluso "${esc(f.termino)}"` : "—";
    const catalogo = (f.catalogoCount ?? 0) > 0
      ? `${f.catalogoCount}: ${esc((f.catalogoNombre ?? "").slice(0, 32))} (${esc(f.dominio)})`
      : "—";
    lineas.push(
      `| ${esc(f.nombre)} | ${esc(f.categoria)} | ${esc(f.licencia)} | ${esc(f.veredicto)} | ${catMl} | ${resp} | ${catalogo} |`,
    );
  }
  lineas.push("");
  lineas.push("## Hallazgo clave: el predictor de ML se equivoca con figuras estilizadas");
  lineas.push("");
  lineas.push("El predictor de ML clasifica por **palabras sueltas del nombre**, y con nuestras figuras eso falla seguido:");
  lineas.push("");
  lineas.push("| Modelo | Categoría que devuelve ML | Por qué está mal |");
  lineas.push("|---|---|---|");
  lineas.push("| Cobra | Autos de Colección | confunde con el Shelby *Cobra* |");
  lineas.push("| Tortuga | Tortugas de Carga | *tortuga* = montacargas industrial |");
  lineas.push("| Pulpo | Mariscos | lo toma como comida |");
  lineas.push("| Delfín / Panda Flex | Cables Flex | se engancha de \"flex\" |");
  lineas.push("| Atún Flex | Comida enlatada | lo toma como atún de lata |");
  lineas.push("");
  lineas.push("**Implicación:** \"✅ Publicable\" quiere decir *ML dio una categoría que valida*, no que sea la **correcta**. ");
  lineas.push("Lo interesante: el **término genérico del respaldo** (\"figura decorativa de colección\", \"juguete antiestrés\") suele dar una categoría **mejor** que el nombre crudo. ");
  lineas.push("Recomendación: para ARTICULADO/figuras, conviene que el copiloto **proponga la categoría del término genérico** y que una persona confirme/ajuste antes de publicar (revisión humana de 1 clic).");
  lineas.push("");
  lineas.push("## Notas y siguientes pasos");
  lineas.push("");
  lineas.push("- Las **licencias son inferidas** por nombre (heurística). Antes de publicar, confirmar la licencia real en la ficha de MakerWorld de cada modelo.");
  lineas.push("- Los modelos *Bloqueados* (personajes con IP) se pueden vender SÓLO si el creador otorgó licencia comercial o si se sustituyen por versiones originales.");
  lineas.push("- Para los *Publicables*, el sistema ya elige automáticamente la categoría que valida en verde (evita las de catálogo-obligatorio).");
  lineas.push("- El **respaldo dominio→categoría** se amplía agregando reglas en `src/lib/ml-categorias.ts` conforme aparezcan casos nuevos.");
  lineas.push("- **Catálogo de ML:** 52/52 traen candidatos, pero el match real exige comparar la **foto** (por eso fotos-first). El copiloto ya tiene el botón \"Buscar en catálogo\" para enganchar el correcto.");
  lineas.push("");

  const dest = path.join(process.cwd(), "..", "11_Reporte_Match_ML.md");
  fs.writeFileSync(dest, lineas.join("\n"), "utf8");
  console.log("\n=== RESUMEN ===");
  console.log(JSON.stringify(resumen, null, 2));
  console.log(`\n✅ Reporte escrito en ${dest}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

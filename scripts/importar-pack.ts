// Importa ~50 modelos curados del pack curado (FUNCIONALES / URBAN / ARTICULADO)
// con sus FOTOS REALES (las del pack, ya extraídas en ../pack-muestra/fotos).
//
// - Copia las fotos a public/pack/<slug>/ (Vercel las sirve estáticas, sin token de Blob).
// - Crea/actualiza la ficha Modelo con metadatos estimados por categoría.
// - Infiere licencia: personajes con IP de terceros → "Personal" (NO apto venta);
//   genéricos/originales → "Comercial" (apto venta). El operador confirma luego.
// - Idempotente: si el modelo ya existe (por nombre), actualiza fotos/clasificación.
//
// Correr: npx tsx scripts/importar-pack.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

const FOTOS_BASE = path.join(process.cwd(), "..", "pack-muestra", "fotos");
const PUBLIC_BASE = path.join(process.cwd(), "public", "pack");

// --- Curaduría: 50 modelos variados. folder = nombre exacto de carpeta en el pack. ---
type Item = { cat: "FUNCIONALES" | "URBAN" | "ARTICULADO"; folder: string };
const ITEMS: Item[] = [
  // FUNCIONALES (15)
  { cat: "FUNCIONALES", folder: "Alcancia Pulpo" },
  { cat: "FUNCIONALES", folder: "Jabonera Salpicadura" },
  { cat: "FUNCIONALES", folder: "Mensula para Estante" },
  { cat: "FUNCIONALES", folder: "Percha Armario" },
  { cat: "FUNCIONALES", folder: "Perchero - Pared" },
  { cat: "FUNCIONALES", folder: "Perchero Minimalista" },
  { cat: "FUNCIONALES", folder: "Soporte Copas" },
  { cat: "FUNCIONALES", folder: "Soporte de Botellas y Copas" },
  { cat: "FUNCIONALES", folder: "Soporte de Vino - Ciervo" },
  { cat: "FUNCIONALES", folder: "Soporte de Vino - Dragon" }, // ← caso "dragón"
  { cat: "FUNCIONALES", folder: "Soporte de Vino - Minimalista" },
  { cat: "FUNCIONALES", folder: "Soporte de Vino - Pulpo" },
  { cat: "FUNCIONALES", folder: "Soporte de vino - Fenix" },
  { cat: "FUNCIONALES", folder: "Tarjetero - Billetera" },
  { cat: "FUNCIONALES", folder: "Tarugo Mariposa - Durlock" },
  // URBAN (12) — personajes con IP de terceros
  { cat: "URBAN", folder: "Urban Batman" },
  { cat: "URBAN", folder: "Urban Spiderman I" },
  { cat: "URBAN", folder: "Urban Ironman" },
  { cat: "URBAN", folder: "Urban Groot" },
  { cat: "URBAN", folder: "Urban Pikachu" },
  { cat: "URBAN", folder: "Urban Sonic" },
  { cat: "URBAN", folder: "Urban Shrek" },
  { cat: "URBAN", folder: "Urban Venom" },
  { cat: "URBAN", folder: "Urban Deadpool" },
  { cat: "URBAN", folder: "Urban Stormtrooper" },
  { cat: "URBAN", folder: "Urban Mickey Mouse" },
  { cat: "URBAN", folder: "Urban Hulk" },
  // ARTICULADO (25)
  { cat: "ARTICULADO", folder: "Ajolote Flex" },
  { cat: "ARTICULADO", folder: "Atun Flex" },
  { cat: "ARTICULADO", folder: "Bola Antiestres" },
  { cat: "ARTICULADO", folder: "Bulbasaur" },
  { cat: "ARTICULADO", folder: "Calavera" },
  { cat: "ARTICULADO", folder: "Charmander" },
  { cat: "ARTICULADO", folder: "Cobra" },
  { cat: "ARTICULADO", folder: "Cubo Infinito" },
  { cat: "ARTICULADO", folder: "Delfin Flex" },
  { cat: "ARTICULADO", folder: "Dragon" }, // ← dragón articulado genérico
  { cat: "ARTICULADO", folder: "Dragon Flex" },
  { cat: "ARTICULADO", folder: "Dragon Oriental" },
  { cat: "ARTICULADO", folder: "Gato Flex" },
  { cat: "ARTICULADO", folder: "Huevo de Dragon" },
  { cat: "ARTICULADO", folder: "Mew" },
  { cat: "ARTICULADO", folder: "Panda Flex" },
  { cat: "ARTICULADO", folder: "Perro Flex" },
  { cat: "ARTICULADO", folder: "Pikachu Flex" },
  { cat: "ARTICULADO", folder: "Pokeball" },
  { cat: "ARTICULADO", folder: "Pulpo" },
  { cat: "ARTICULADO", folder: "Serpiente" },
  { cat: "ARTICULADO", folder: "Shenron" },
  { cat: "ARTICULADO", folder: "Tiburon" },
  { cat: "ARTICULADO", folder: "Tortuga" },
  { cat: "ARTICULADO", folder: "Robot A" },
];

// Palabras clave de IP de terceros (fan art no licenciable comercialmente sin permiso).
const IP_RE =
  /pikachu|bulbasaur|charmander|squirtle|mew|ditto|eevee|pokeball|pok[eé]|masterball|batman|superman|spiderman|spider-?man|ironman|iron-?man|hulk|thor|venom|deadpool|groot|avenger|marvel|mickey|minnie|donald|duffy|bugs\s*bunny|tweety|piolin|scooby|looney|shrek|sonic|shadow|knuckles|stitch|disney|dobby|harry\s*potter|luffy|naruto|kakashi|sasuke|rinnegan|goku|shenron|dragon\s*ball|skeletor|he-?man|stormtrooper|star\s*wars|joker|derpy|pony/i;

function inferLicencia(nombre: string): string {
  return IP_RE.test(nombre) ? "Personal" : "Comercial";
}

// Presets de costeo/clasificación por categoría del pack.
const PRESET = {
  FUNCIONALES: {
    categoria: "Organizador",
    nicho: "hogar funcional",
    tiempoImpresionMin: 210,
    gramosFilamento: 75,
    tipoFilamento: "PLA",
    requiereSoportes: true,
    dificultad: "Media",
    tiempoOperacionMin: 20,
    costoPostproceso: 8,
    multicolorAms: false,
  },
  URBAN: {
    categoria: "Figura",
    nicho: "coleccionable pop",
    tiempoImpresionMin: 300,
    gramosFilamento: 90,
    tipoFilamento: "PLA",
    requiereSoportes: false,
    dificultad: "Media",
    tiempoOperacionMin: 25,
    costoPostproceso: 10,
    multicolorAms: true,
  },
  ARTICULADO: {
    categoria: "Figura",
    nicho: "juguete flexi",
    tiempoImpresionMin: 240,
    gramosFilamento: 60,
    tipoFilamento: "PLA",
    requiereSoportes: false,
    dificultad: "Baja",
    tiempoOperacionMin: 15,
    costoPostproceso: 5,
    multicolorAms: false,
  },
} as const;

// Soporte de vino / botella → Decoracion (mejor categoría que Organizador).
function ajustarCategoria(cat: string, nombre: string): string {
  if (/vino|botella|copa|cenicero|alcanc[ií]a/i.test(nombre)) return "Decoracion";
  if (/perchero|percha|m[eé]nsula|estante|tarjetero|tarugo|jabonera|soporte\s*joystick/i.test(nombre))
    return "Organizador";
  return cat;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function copiarFotos(cat: string, folder: string, slug: string): string[] {
  const src = path.join(FOTOS_BASE, cat, folder);
  if (!fs.existsSync(src)) return [];
  const archivos = fs
    .readdirSync(src)
    .filter((f) => /\.(webp|jpg|jpeg|png)$/i.test(f))
    .sort();
  if (archivos.length === 0) return [];
  const destDir = path.join(PUBLIC_BASE, slug);
  fs.mkdirSync(destDir, { recursive: true });
  const urls: string[] = [];
  archivos.forEach((f, i) => {
    const ext = path.extname(f).toLowerCase();
    const nombre = `${i + 1}${ext}`;
    fs.copyFileSync(path.join(src, f), path.join(destDir, nombre));
    urls.push(`/pack/${slug}/${nombre}`);
  });
  return urls;
}

async function main() {
  let creados = 0,
    actualizados = 0,
    sinFoto = 0;
  for (const it of ITEMS) {
    const preset = PRESET[it.cat];
    const slug = slugify(it.folder);
    const imagenes = copiarFotos(it.cat, it.folder, slug);
    if (imagenes.length === 0) {
      console.warn(`⚠️  sin fotos: ${it.cat}/${it.folder}`);
      sinFoto++;
    }
    const licencia = inferLicencia(it.folder);
    const categoria = ajustarCategoria(preset.categoria, it.folder);
    const data = {
      nombre: it.folder,
      fuente: "MakerWorld",
      licencia,
      categoria,
      nicho: preset.nicho,
      tiempoImpresionMin: preset.tiempoImpresionMin,
      gramosFilamento: preset.gramosFilamento,
      tipoFilamento: preset.tipoFilamento,
      multicolorAms: preset.multicolorAms,
      requiereSoportes: preset.requiereSoportes,
      dificultad: preset.dificultad,
      tiempoOperacionMin: preset.tiempoOperacionMin,
      costoPostproceso: preset.costoPostproceso,
      estadoValidacion: "Pendiente",
      archivoTipo: "stl",
      notas: `Pack ${it.cat}. Licencia inferida (${licencia}) — confirmar en la ficha de MakerWorld.`,
      imagenes,
    };
    const existente = await prisma.modelo.findFirst({ where: { nombre: it.folder } });
    if (existente) {
      await prisma.modelo.update({ where: { id: existente.id }, data });
      actualizados++;
    } else {
      await prisma.modelo.create({ data });
      creados++;
    }
  }
  console.log(
    `✅ Pack importado: ${creados} creados, ${actualizados} actualizados, ${sinFoto} sin foto (de ${ITEMS.length}).`
  );
  console.log(`   Fotos servidas desde /public/pack/<slug>/ (estáticas en Vercel).`);

  // ESTÁNDAR: portada con fondo BLANCO (rembg) automático en cada importación.
  try {
    console.log("\n[fondos] Generando fondo blanco (rembg)…");
    execSync("python scripts/fondos-blancos.py", {
      stdio: "inherit",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    // Limpia watermarks de creador EN ESQUINA (logos tipo BODY3D/NUKDDD) sobre el fondo blanco.
    execSync("python scripts/limpiar-watermark.py", {
      stdio: "inherit",
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    });
    execSync("npx tsx scripts/aplicar-fondos.ts", { stdio: "inherit", env: process.env });
  } catch {
    console.warn(
      "[fondos] No se generó el fondo blanco (¿python+rembg?). Corre manual: npm run fondos:blancos && npm run fondos:aplicar"
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Procesa un ZIP de pack ya subido a Blob (por /importar): descomprime SOLO las imágenes (no las mallas,
// para no saturar memoria), agrupa por modelo (carpeta hoja), sube las fotos a Blob y crea los modelos en
// estado Pendiente → caen en /revisión. marcaIp se calcula por NOMBRE; la licencia queda "Revisar" (=🟡
// amarillo, publicable con OK de Blas) y la visión de IP/calidad se puede correr después.
// Self-serve y en la nube: NO necesita scripts locales ni redeploy (las fotos van a Blob).
import { unzip } from "fflate";
import { prisma } from "@/lib/prisma";
import { subirImagen } from "@/lib/storage";
import { clasificarIp } from "@/lib/riesgo";
import { getBranding } from "@/lib/branding";

export const dynamic = "force-dynamic";
export const maxDuration = 800; // Vercel Pro: hasta 800s (plan de pago). Packs grandes tardan.

const IMG_RE = /\.(webp|jpe?g|jfif|png)$/i;
const MAX_BYTES = 1200 * 1024 * 1024; // guarda de memoria (con Function CPU = Performance, 4 GB)

function slugify(s: string) {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "modelo";
}
function ctype(name: string) {
  const e = name.toLowerCase();
  return e.endsWith(".png") ? "image/png" : e.endsWith(".webp") ? "image/webp" : "image/jpeg";
}
function nombreDe(dir: string) {
  const rel = dir.split("/").slice(1); // quita la raíz del pack
  return (rel.length ? rel.join(" / ") : dir.split("/").pop() || "modelo").trim();
}

export async function POST(req: Request) {
  const { blobUrl, categoria, fuente } = (await req.json().catch(() => ({}))) as { blobUrl?: string; categoria?: string; fuente?: string };
  if (!blobUrl) return Response.json({ ok: false, error: "falta blobUrl" }, { status: 400 });

  // Bajar el ZIP de Blob a memoria.
  const res = await fetch(blobUrl);
  if (!res.ok) return Response.json({ ok: false, error: `no se pudo leer el ZIP (${res.status})` }, { status: 400 });
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) return Response.json({ ok: false, error: `ZIP muy grande (${(buf.byteLength / 1048576) | 0} MB). Parte el pack en menos categorías.` }, { status: 413 });

  // Descomprimir SOLO imágenes.
  const imgs: Record<string, Uint8Array> = await new Promise((resolve, reject) =>
    unzip(buf, { filter: (f) => IMG_RE.test(f.name) && !f.name.endsWith("/") }, (err, data) => (err ? reject(err) : resolve(data))),
  );

  // Agrupar por carpeta hoja (modelo).
  const grupos = new Map<string, string[]>();
  for (const path of Object.keys(imgs)) {
    const parts = path.split("/");
    if (parts.length < 2) continue;
    const dir = parts.slice(0, -1).join("/");
    (grupos.get(dir) ?? grupos.set(dir, []).get(dir)!).push(path);
  }

  const cat = (categoria || "Importado").trim();
  const fnt = (fuente || "Importado (web)").trim();
  const usados = new Set<string>();
  let encontrados = 0, creados = 0, saltados = 0;

  for (const [dir, paths] of grupos) {
    const nombre = nombreDe(dir);
    encontrados++;
    if (await prisma.modelo.findFirst({ where: { nombre }, select: { id: true } })) { saltados++; continue; }
    let slug = slugify(nombre); const base = slug; let k = 2;
    while (usados.has(slug)) slug = `${base}-${k++}`;
    usados.add(slug);

    const ordenadas = paths.sort((a, b) => a.localeCompare(b));
    const imagenes: string[] = [];
    let i = 1;
    for (const p of ordenadas) {
      const ext = (p.match(/\.[a-z0-9]+$/i)?.[0] || ".jpg").toLowerCase();
      try {
        const r = await subirImagen(`import/${slug}/${i}${ext}`, imgs[p], { contentType: ctype(p) });
        imagenes.push(r.url);
        i++;
      } catch { /* sigue */ }
    }
    if (!imagenes.length) { saltados++; continue; }

    await prisma.modelo.create({
      data: {
        nombre, fuente: fnt, licencia: "Revisar", categoria: cat, nicho: "importado",
        tiempoImpresionMin: 240, gramosFilamento: 60, tipoFilamento: "PLA",
        multicolorAms: false, requiereSoportes: false, dificultad: "Media",
        estadoValidacion: "Pendiente", marcaIp: clasificarIp(nombre), archivoTipo: "otro",
        notas: `Importado por web desde ${fnt}. Licencia por revisar.`,
        imagenes,
      },
    });
    creados++;
  }

  return Response.json({ ok: true, encontrados, creados, saltados, revision: `${getBranding().appUrl}/revision` });
}

// Cierra el ciclo de video: toma el clip 360° de un modelo → lo SUBE a YouTube (canal Lab 3D
// Brothers) con título/descripción MARKETERA + link de venta → guarda Modelo.videoYoutubeId →
// y si el modelo está publicado, PEGA el video_id al anuncio de ML (sale en la galería del producto).
//
// Requiere env: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN (+ DATABASE_URL, ML).
// Uso: npx tsx scripts/subir-video.ts --slug alcancia-pulpo [--privacy public|unlisted] [--solo-attach]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const TIENDA = "https://perfil.mercadolibre.com.mx/GENERGY_SOLUTIONS";
const BLOB_HOST = "https://itgirjfh1wrixlgb.public.blob.vercel-storage.com";
function arg(n: string, d?: string) { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; }

async function subirYoutube(buf: Buffer, title: string, description: string, tags: string[], privacy: string): Promise<string> {
  const { YOUTUBE_CLIENT_ID: cid, YOUTUBE_CLIENT_SECRET: cs, YOUTUBE_REFRESH_TOKEN: rt } = process.env;
  if (!cid || !cs || !rt) throw new Error("Faltan credenciales YOUTUBE_* en el env");
  const tok = (await (await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cid, client_secret: cs, refresh_token: rt, grant_type: "refresh_token" }),
  })).json() as { access_token: string }).access_token;
  const meta = { snippet: { title: title.slice(0, 100), description, tags, categoryId: "22" }, status: { privacyStatus: privacy, selfDeclaredMadeForKids: false } };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": "video/*" },
    body: JSON.stringify(meta),
  });
  const session = init.headers.get("location");
  if (!session) throw new Error(`No se pudo iniciar la subida (${init.status})`);
  const up = await fetch(session, { method: "PUT", headers: { Authorization: `Bearer ${tok}`, "Content-Type": "video/*" }, body: buf as unknown as BodyInit });
  const j = (await up.json()) as { id?: string; error?: unknown };
  if (!j.id) throw new Error(`YouTube rechazó la subida: ${JSON.stringify(j.error).slice(0, 120)}`);
  return j.id;
}

async function main() {
  const slug = arg("slug");
  const privacy = arg("privacy", "public")!;
  if (!slug) throw new Error("Pasa --slug <slug>");
  const m = (await prisma.modelo.findMany({ where: { imagenes: { has: `/pack/${slug}/blanco.jpg` } } }))[0]
    ?? (await prisma.modelo.findMany({ where: { notas: { startsWith: "Pack " } } })).find((x) => (x.imagenes ?? []).some((u) => u.includes(`/${slug}/`)));
  if (!m) throw new Error(`No encontré modelo para slug ${slug}`);
  const token = (await getAccessTokenValido()) as string;

  // 1) conseguir el clip (local o Blob)
  let videoId = m.videoYoutubeId ?? null;
  if (!videoId && !process.argv.includes("--solo-attach")) {
    const local = path.join(process.cwd(), "_preview", "clip", slug, `${slug}-360.mp4`);
    const buf = fs.existsSync(local)
      ? fs.readFileSync(local)
      : Buffer.from(await (await fetch(`${BLOB_HOST}/clip/${slug}/360.mp4`)).arrayBuffer());
    // 2) copy marketera + link de venta (permalink si está publicado y activo, si no la tienda)
    let link = TIENDA;
    if (m.publicadoMl && m.mlItemId) {
      const b: any = await (await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}?attributes=permalink,status`, { headers: { Authorization: `Bearer ${token}` } })).json();
      if (b?.permalink && b?.status === "active") link = b.permalink;
    }
    const title = `${m.nombre} 3D · 360° | Impreso a Color`;
    const description = `${m.nombre} impreso en 3D a tu color favorito — pieza única, lista para regalar.\n\n🛒 Cómpralo aquí: ${link} — envío a todo México.\n\n#impresion3d #${slug.replace(/-/g, "")} #3dprinting #hechoenmexico`;
    videoId = await subirYoutube(buf, title, description, ["impresion3d", "3dprinting", slug], privacy);
    await prisma.modelo.update({ where: { id: m.id }, data: { videoYoutubeId: videoId } });
    console.log(`  ✅ YouTube: https://youtu.be/${videoId} (guardado en el modelo)`);
  }

  // 3) pegar el video_id al anuncio de ML (galería del producto)
  if (videoId && m.publicadoMl && m.mlItemId) {
    const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
      method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    });
    console.log(r.ok ? `  ✅ video_id pegado al anuncio ${m.mlItemId}` : `  ⚠️ ML no aceptó el video_id (${r.status}): ${JSON.stringify(await r.json()).slice(0, 120)}`);
  } else if (videoId) {
    console.log(`  ℹ️ modelo no publicado — el video_id se incluirá al publicar (ya guardado).`);
  }
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e.message); process.exit(1); });

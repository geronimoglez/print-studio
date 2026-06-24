// Batch de renders: para cada modelo del pack con malla (manifiesto), renderiza N ángulos
// (fondo blanco) y los AGREGA como fotos extra (modo extra) o portada (modo portada).
// Un solo navegador, servidor con malla mutable. Filtra a APTOS por defecto (los IP no se venden).
//
// Uso:
//   npx tsx scripts/render-todos.ts [--angles 6] [--modo extra|portada] [--solo slug1,slug2] [--incluir-no-aptos]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { subirImagen, backendActivo } from "../src/lib/storage";
import { esPublicable } from "../src/lib/riesgo";
import { navegadorPath } from "../src/lib/navegador";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const ANGLES = parseInt(arg("angles", "6")!, 10);
const MODO = arg("modo", "extra");
const SOLO = arg("solo");
const INCLUIR_NO_APTOS = process.argv.includes("--incluir-no-aptos");
const EDGE = navegadorPath();
const THREE_DIR = path.join(process.cwd(), "node_modules", "three");
const JSM = path.join(THREE_DIR, "examples", "jsm");
const MANIFEST = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");

function pagina(tipo: "stl" | "3mf"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#c{display:block}</style>
<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script></head>
<body><canvas id="c" width="1100" height="1100"></canvas><script type="module">
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
const W=1100,H=1100, TIPO='${tipo}';
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false); renderer.setClearColor(0xffffff,1);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xffffff);
const camera=new THREE.PerspectiveCamera(35,1,0.1,100000);
scene.add(new THREE.AmbientLight(0xffffff,0.7));
const k=new THREE.DirectionalLight(0xffffff,0.95); k.position.set(1,1.4,1.2); scene.add(k);
const f=new THREE.DirectionalLight(0xffffff,0.45); f.position.set(-1,0.5,-1); scene.add(f);
const bk=new THREE.DirectionalLight(0xffffff,0.3); bk.position.set(0,1,-1.5); scene.add(bk);
window.__radius=1;
const MAT=new THREE.MeshStandardMaterial({color:0xd9d9dc,roughness:0.62,metalness:0.08});
function encuadrar(root){ root.rotation.x=-Math.PI/2; const b=new THREE.Box3().setFromObject(root); const c=b.getCenter(new THREE.Vector3()); root.position.sub(c); window.__radius=b.getBoundingSphere(new THREE.Sphere()).radius||1; scene.add(root); window.__ready=true; }
if(TIPO==='3mf'){ new ThreeMFLoader().load('/model.3mf',(o)=>{ o.traverse((x)=>{ if(x.isMesh) x.material=MAT; }); encuadrar(o); }, undefined, (e)=>{window.__error=String(e);}); }
else{ new STLLoader().load('/model.stl',(g)=>{ g.computeVertexNormals(); encuadrar(new THREE.Mesh(g,MAT)); }, undefined, (e)=>{window.__error=String(e);}); }
window.renderAngle=(i,total)=>{ const az=(i/total)*Math.PI*2, elev=0.42, r=window.__radius; const d=r/Math.sin((35*Math.PI/180)/2)*1.12;
  camera.position.set(Math.cos(az)*d*Math.cos(elev), Math.sin(elev)*d, Math.sin(az)*d*Math.cos(elev)); camera.lookAt(0,0,0); camera.updateProjectionMatrix(); renderer.render(scene,camera); return canvas.toDataURL('image/png'); };
</script></body></html>`;
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, { path: string; tipo: "stl" | "3mf" }>;
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  // Traemos TODOS y dejamos que el chequeo de manifiesto (slug en _mallas.json) decida quién
  // tiene malla renderizable. Antes filtrábamos por notas startsWith "Pack ", lo que EXCLUÍA
  // los modelos importados (fuente "Pack Futbol (generico)", notas "Importado…").
  const modelos = await prisma.modelo.findMany();
  const soloSet = SOLO ? new Set(SOLO.split(",")) : null;

  // mutable: la malla actual que sirve el servidor
  let actual: { meshPath: string; tipo: "stl" | "3mf" } = { meshPath: "", tipo: "stl" };
  const srv = http.createServer((req, res) => {
    const u = (req.url || "/").split("?")[0];
    const send = (file: string, type: string) => { try { res.writeHead(200, { "content-type": type }); res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end("nf"); } };
    if (u === "/" || u === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(pagina(actual.tipo)); }
    else if (/^\/vendor\/three[\w.]*\.js$/.test(u)) send(path.join(THREE_DIR, "build", path.basename(u)), "text/javascript");
    else if (u.startsWith("/vendor/addons/")) send(path.join(JSM, u.replace("/vendor/addons/", "")), "text/javascript");
    else if (u === "/model.stl" || u === "/model.3mf") send(actual.meshPath, "application/octet-stream");
    else { res.writeHead(404); res.end("nf"); }
  });
  await new Promise<void>((r) => srv.listen(0, "127.0.0.1", () => r()));
  const port = (srv.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1100, deviceScaleFactor: 1 });

  let ok = 0, skip = 0, err = 0;
  for (const m of modelos) {
    const slug = (m.imagenes ?? []).find((u) => u.startsWith("/pack/"))?.split("/")[2];
    if (!slug || !manifest[slug]) { skip++; continue; }
    if (soloSet && !soloSet.has(slug)) continue;
    if (!INCLUIR_NO_APTOS && !esPublicable(m.marcaIp, m.licencia)) { skip++; continue; }
    if (!soloSet && m.estadoValidacion === "Rechazado") { skip++; continue; } // descartados (ej. Kahlúa) se manejan aparte
    const { path: rel, tipo } = manifest[slug];
    if (!fs.existsSync(rel)) { console.log(`  ⚠️  sin archivo: ${slug}`); skip++; continue; }
    actual = { meshPath: rel, tipo };
    try {
      await page.goto(`${base}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForFunction("window.__ready === true || window.__error", { timeout: 90000 });
      if (await page.evaluate("window.__error")) { console.log(`  ❌ ${slug}: loader error`); err++; continue; }
      const urls: string[] = [];
      for (let i = 0; i < ANGLES; i++) {
        const d = (await page.evaluate(`window.renderAngle(${i}, ${ANGLES})`)) as string;
        const r = await subirImagen(`render/${slug}/${i + 1}.png`, Buffer.from(d.replace(/^data:image\/png;base64,/, ""), "base64"), { contentType: "image/png" });
        urls.push(r.url);
      }
      const reales = (m.imagenes ?? []).filter((u) => !u.includes("/render/"));
      // limpio = SOLO renders (descarta la foto original; útil cuando la foto trae marca de
      // utilería —p.ej. un balón Adidas— pero el objeto impreso es genérico).
      const nuevas = MODO === "limpio" ? urls : MODO === "portada" ? [...urls, ...reales] : [...reales, ...urls];
      await prisma.modelo.update({ where: { id: m.id }, data: { imagenes: nuevas } });
      ok++;
      console.log(`  ✅ ${m.nombre.padEnd(26)} ${tipo.toUpperCase()} ${urls.length} renders → total ${nuevas.length}`);
    } catch (e) {
      console.log(`  ❌ ${slug}: ${e instanceof Error ? e.message.slice(0, 50) : "error"}`);
      err++;
    }
  }
  await browser.close();
  srv.close();
  await prisma.$disconnect();
  console.log(`\n>>> renders: ${ok} ok, ${skip} saltados, ${err} error.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

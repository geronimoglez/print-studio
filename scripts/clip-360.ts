// Clip 360° (giratorio) de una malla (STL/3MF) → mp4 loop. Vía A: render fiel de la geometría
// real (copyright-libre). Renderiza F frames orbitando + ffmpeg los une a mp4. Sube el mp4 a Blob.
//
// Uso:
//   npx tsx scripts/clip-360.ts --slug alcancia-pulpo [--frames 72] [--fps 12] [--size 720]
//   (lee la malla de pack-mallas/_mallas.json; o --mesh <archivo> --tipo stl|3mf)
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { execSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { subirImagen, backendActivo } from "../src/lib/storage";
import { navegadorPath } from "../src/lib/navegador";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const EDGE = navegadorPath();
const SLUG = arg("slug") || "modelo";
const FRAMES = parseInt(arg("frames", "72")!, 10);
const FPS = parseInt(arg("fps", "12")!, 10);
const SIZE = parseInt(arg("size", "720")!, 10);
const THREE_DIR = path.join(process.cwd(), "node_modules", "three");
const JSM = path.join(THREE_DIR, "examples", "jsm");
const MANIFEST = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");
const OUT = path.join(process.cwd(), "_preview", "clip");

function elegirMalla(): { meshPath: string; tipo: "stl" | "3mf" } {
  const mesh = arg("mesh");
  if (mesh && fs.existsSync(mesh)) return { meshPath: mesh, tipo: (arg("tipo") as "stl" | "3mf") || (/\.3mf$/i.test(mesh) ? "3mf" : "stl") };
  const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, { path: string; tipo: "stl" | "3mf" }>;
  const e = man[SLUG];
  if (!e) throw new Error(`No hay malla para slug ${SLUG} en el manifiesto`);
  return { meshPath: e.path, tipo: e.tipo };
}

function pagina(tipo: "stl" | "3mf"): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}#c{display:block}</style>
<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script></head>
<body><canvas id="c" width="${SIZE}" height="${SIZE}"></canvas><script type="module">
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
const S=${SIZE}, TIPO='${tipo}';
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(S,S,false); renderer.setClearColor(0xffffff,1);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xffffff);
const camera=new THREE.PerspectiveCamera(35,1,0.1,100000);
scene.add(new THREE.AmbientLight(0xffffff,0.7));
const k=new THREE.DirectionalLight(0xffffff,0.95); k.position.set(1,1.4,1.2); scene.add(k);
const f=new THREE.DirectionalLight(0xffffff,0.45); f.position.set(-1,0.5,-1); scene.add(f);
window.__radius=1;
const MAT=new THREE.MeshStandardMaterial({color:0xd9d9dc,roughness:0.62,metalness:0.08});
function encuadrar(root){ root.rotation.x=-Math.PI/2; root.updateMatrixWorld(true);
  // Encuadrar la PIEZA PRINCIPAL (mesh de mayor volumen), no toda la placa (igual que render-stl).
  let main=null, mv=-1; root.traverse((o)=>{ if(o.isMesh){ const bb=new THREE.Box3().setFromObject(o); const s=bb.getSize(new THREE.Vector3()); const v=Math.max(s.x,0.001)*Math.max(s.y,0.001)*Math.max(s.z,0.001); if(v>mv){mv=v; main=o;} } });
  const b=new THREE.Box3().setFromObject(main||root); const c=b.getCenter(new THREE.Vector3()); root.position.sub(c);
  window.__radius=b.getBoundingSphere(new THREE.Sphere()).radius||1; scene.add(root); window.__ready=true; }
if(TIPO==='3mf'){ new ThreeMFLoader().load('/model.3mf',(o)=>{ o.traverse((x)=>{ if(x.isMesh) x.material=MAT; }); encuadrar(o); }, undefined, (e)=>{window.__error=String(e);}); }
else{ new STLLoader().load('/model.stl',(g)=>{ g.computeVertexNormals(); encuadrar(new THREE.Mesh(g,MAT)); }, undefined, (e)=>{window.__error=String(e);}); }
window.frame=(i,total)=>{ const az=(i/total)*Math.PI*2, elev=0.42, r=window.__radius; const d=r/Math.sin((35*Math.PI/180)/2)*1.06;
  camera.position.set(Math.cos(az)*d*Math.cos(elev), Math.sin(elev)*d, Math.sin(az)*d*Math.cos(elev)); camera.lookAt(0,0,0); camera.updateProjectionMatrix(); renderer.render(scene,camera); return canvas.toDataURL('image/png'); };
</script></body></html>`;
}

function servidor(meshPath: string, tipo: "stl" | "3mf"): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = (req.url || "/").split("?")[0];
      const send = (file: string, type: string) => { try { res.writeHead(200, { "content-type": type }); res.end(fs.readFileSync(file)); } catch { res.writeHead(404); res.end("nf"); } };
      if (u === "/" || u === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(pagina(tipo)); }
      else if (/^\/vendor\/three[\w.]*\.js$/.test(u)) send(path.join(THREE_DIR, "build", path.basename(u)), "text/javascript");
      else if (u.startsWith("/vendor/addons/")) send(path.join(JSM, u.replace("/vendor/addons/", "")), "text/javascript");
      else if (u === "/model.stl" || u === "/model.3mf") send(meshPath, "application/octet-stream");
      else { res.writeHead(404); res.end("nf"); }
    });
    srv.listen(0, "127.0.0.1", () => resolve({ url: `http://127.0.0.1:${(srv.address() as { port: number }).port}`, close: () => srv.close() }));
  });
}

async function main() {
  const { meshPath, tipo } = elegirMalla();
  const dir = path.join(OUT, SLUG);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Clip 360°: ${SLUG} (${tipo.toUpperCase()}) · ${FRAMES} frames @ ${FPS}fps · ${SIZE}px · storage ${backendActivo()}`);
  const { url, close } = await servidor(meshPath, tipo);
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await browser.newPage();
  await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
  await page.goto(`${url}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  try { await page.waitForFunction("window.__ready === true || window.__error", { timeout: 90000 }); } catch { console.error("Timeout malla"); }
  if (await page.evaluate("window.__error")) { console.error("Error loader:", await page.evaluate("window.__error")); await browser.close(); close(); process.exit(1); }
  for (let i = 0; i < FRAMES; i++) {
    const dataUrl = (await page.evaluate(`window.frame(${i}, ${FRAMES})`)) as string;
    fs.writeFileSync(path.join(dir, `f_${String(i).padStart(3, "0")}.png`), Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64"));
  }
  await browser.close();
  close();
  // ffmpeg: frames → mp4 loop (yuv420p para compatibilidad web)
  const mp4 = path.join(dir, `${SLUG}-360.mp4`);
  execSync(`ffmpeg -y -framerate ${FPS} -i "${path.join(dir, "f_%03d.png")}" -c:v libx264 -pix_fmt yuv420p -movflags +faststart "${mp4}"`, { stdio: "ignore" });
  const buf = fs.readFileSync(mp4);
  const r = await subirImagen(`clip/${SLUG}/360.mp4`, buf, { contentType: "video/mp4" });
  console.log(`\n✅ Clip 360° (${(buf.length / 1024).toFixed(0)} KB, ${(FRAMES / FPS).toFixed(1)}s): ${r.url}`);
  console.log(`   frames locales: ${dir}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

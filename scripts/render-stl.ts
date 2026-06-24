// Render multi-ángulo de una MALLA (STL o 3MF) → fotos (PNG) sobre FONDO BLANCO.
// Pipeline portable: mini-servidor HTTP que sirve three.js + addons (de node_modules) + la malla,
// Edge headless (puppeteer-core) carga la escena y captura N ángulos. Sube con la capa storage.
//
// Uso:
//   npx tsx scripts/render-stl.ts --slug ajolote-flex            (lee pack-mallas/_mallas.json)
//   npx tsx scripts/render-stl.ts --mesh "ruta/x.3mf" --tipo 3mf --slug x
//   Opcionales: --angles 8 --modelo <id> --modo extra|portada
//     modo extra   = renders se AGREGAN después de las fotos reales (default)
//     modo portada = renders van PRIMERO (portada) — para modelos con marca/watermark
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import puppeteer from "puppeteer-core";
import { subirImagen, backendActivo } from "../src/lib/storage";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function arg(name: string, def?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const SLUG = arg("slug") || "modelo";
const ANGLES = parseInt(arg("angles", "8")!, 10);
const MODELO_ID = arg("modelo");
const MODO = arg("modo", "extra"); // extra | portada
const THREE_DIR = path.join(process.cwd(), "node_modules", "three");
const JSM = path.join(THREE_DIR, "examples", "jsm");
const MANIFEST = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");

// Resolver la malla + tipo: por --mesh/--tipo, o por --slug desde el manifiesto, o legacy --stl/--dir.
function elegirMalla(): { meshPath: string; tipo: "stl" | "3mf" } {
  const mesh = arg("mesh");
  if (mesh && fs.existsSync(mesh)) return { meshPath: mesh, tipo: (arg("tipo") as "stl" | "3mf") || (/\.3mf$/i.test(mesh) ? "3mf" : "stl") };
  if (fs.existsSync(MANIFEST)) {
    const man = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Record<string, { path: string; tipo: "stl" | "3mf" }>;
    const e = man[SLUG];
    if (e && fs.existsSync(e.path)) return { meshPath: e.path, tipo: e.tipo };
  }
  const stl = arg("stl");
  if (stl && fs.existsSync(stl)) return { meshPath: stl, tipo: "stl" };
  const dir = arg("dir");
  if (dir && fs.existsSync(dir)) {
    const stls = fs.readdirSync(dir).filter((f) => /\.stl$/i.test(f)).map((f) => ({ f, s: fs.statSync(path.join(dir, f)).size })).sort((a, b) => b.s - a.s);
    if (stls.length) return { meshPath: path.join(dir, stls[0].f), tipo: "stl" };
  }
  throw new Error("No encontré malla. Usa --slug (con manifiesto) o --mesh <archivo> --tipo stl|3mf");
}

function pagina(tipo: "stl" | "3mf"): string {
  const ext = tipo === "3mf" ? "3mf" : "stl";
  return `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}#c{display:block}</style>
<script type="importmap">{"imports":{"three":"/vendor/three.module.js","three/addons/":"/vendor/addons/"}}</script>
</head><body><canvas id="c" width="1100" height="1100"></canvas>
<script type="module">
import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js';
const W=1100,H=1100, TIPO='${ext}';
const canvas=document.getElementById('c');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});
renderer.setSize(W,H,false); renderer.setClearColor(0xffffff,1);
const scene=new THREE.Scene(); scene.background=new THREE.Color(0xffffff);
const camera=new THREE.PerspectiveCamera(35,1,0.1,100000);
scene.add(new THREE.AmbientLight(0xffffff,0.7));
const key=new THREE.DirectionalLight(0xffffff,0.95); key.position.set(1,1.4,1.2); scene.add(key);
const fill=new THREE.DirectionalLight(0xffffff,0.45); fill.position.set(-1,0.5,-1); scene.add(fill);
const back=new THREE.DirectionalLight(0xffffff,0.3); back.position.set(0,1,-1.5); scene.add(back);
window.__radius=1;
function encuadrar(root){
  root.rotation.x=-Math.PI/2; // Z-up (slicer) → Y-up
  root.updateMatrixWorld(true);
  // Encuadrar la PIEZA PRINCIPAL (el mesh de mayor volumen), no toda la placa: en modelos multi-pieza
  // (flexi, articulados, con varias copias en la placa) el bounding box de TODO el conjunto deja el
  // objeto chiquito y centrado en el vacío. Tomamos el mesh más grande como referencia de encuadre.
  let main=null, mainVol=-1;
  root.traverse((o)=>{
    if(o.isMesh){
      const b=new THREE.Box3().setFromObject(o);
      const s=b.getSize(new THREE.Vector3());
      const v=Math.max(s.x,0.001)*Math.max(s.y,0.001)*Math.max(s.z,0.001);
      if(v>mainVol){ mainVol=v; main=o; }
    }
  });
  const box=new THREE.Box3().setFromObject(main||root);
  const c=box.getCenter(new THREE.Vector3());
  root.position.sub(c); // centrar la cámara en la pieza principal
  const sphere=box.getBoundingSphere(new THREE.Sphere());
  window.__radius=sphere.radius||1;
  scene.add(root);
  window.__ready=true;
}
const MAT=new THREE.MeshStandardMaterial({color:0xd9d9dc,roughness:0.62,metalness:0.08});
if(TIPO==='3mf'){
  new ThreeMFLoader().load('/model.3mf',(obj)=>{ obj.traverse((o)=>{ if(o.isMesh) o.material=MAT; }); encuadrar(obj); }, undefined, (e)=>{ window.__error=String(e); });
}else{
  new STLLoader().load('/model.stl',(geo)=>{ geo.computeVertexNormals(); encuadrar(new THREE.Mesh(geo,MAT)); }, undefined, (e)=>{ window.__error=String(e); });
}
window.renderAngle=(i,total)=>{
  const az=(i/total)*Math.PI*2, elev=0.42, r=window.__radius;
  const d=r/Math.sin((35*Math.PI/180)/2)*1.06; // padding más ajustado: la pieza llena mejor el cuadro
  camera.position.set(Math.cos(az)*d*Math.cos(elev), Math.sin(elev)*d, Math.sin(az)*d*Math.cos(elev));
  camera.lookAt(0,0,0); camera.updateProjectionMatrix();
  renderer.render(scene,camera);
  return canvas.toDataURL('image/png');
};
</script></body></html>`;
}

function servidor(meshPath: string, tipo: "stl" | "3mf"): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const u = (req.url || "/").split("?")[0];
      const send = (file: string, type: string) => {
        try { res.writeHead(200, { "content-type": type }); res.end(fs.readFileSync(file)); }
        catch { res.writeHead(404); res.end("nf"); }
      };
      if (u === "/" || u === "/index.html") { res.writeHead(200, { "content-type": "text/html" }); res.end(pagina(tipo)); }
      else if (/^\/vendor\/three[\w.]*\.js$/.test(u)) send(path.join(THREE_DIR, "build", path.basename(u)), "text/javascript");
      else if (u.startsWith("/vendor/addons/")) send(path.join(JSM, u.replace("/vendor/addons/", "")), "text/javascript");
      else if (u === "/model.stl" || u === "/model.3mf") send(meshPath, "application/octet-stream");
      else { res.writeHead(404); res.end("nf"); }
    });
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as { port: number }).port;
      resolve({ url: `http://127.0.0.1:${port}`, close: () => srv.close() });
    });
  });
}

async function main() {
  const { meshPath, tipo } = elegirMalla();
  console.log(`Malla: ${meshPath} (${tipo.toUpperCase()})`);
  console.log(`Storage: ${backendActivo()} · ángulos: ${ANGLES} · slug: ${SLUG} · modo: ${MODO}`);
  const { url, close } = await servidor(meshPath, tipo);
  const browser = await puppeteer.launch({
    executablePath: EDGE, headless: true,
    args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 1100, deviceScaleFactor: 1 });
  const errs: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
  page.on("requestfailed", (r) => console.error("REQFAIL:", r.url(), r.failure()?.errorText));
  await page.goto(`${url}/index.html`, { waitUntil: "domcontentloaded", timeout: 30000 });
  try { await page.waitForFunction("window.__ready === true || window.__error", { timeout: 90000 }); }
  catch { console.error("Timeout esperando la malla.", errs.slice(0, 3)); }
  const err = await page.evaluate("window.__error");
  if (err) { console.error("Error loader:", err, errs.slice(0, 3)); await browser.close(); close(); process.exit(1); }

  const urls: string[] = [];
  for (let i = 0; i < ANGLES; i++) {
    const dataUrl = (await page.evaluate(`window.renderAngle(${i}, ${ANGLES})`)) as string;
    const buf = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
    const r = await subirImagen(`render/${SLUG}/${i + 1}.png`, buf, { contentType: "image/png" });
    urls.push(r.url);
    process.stdout.write(`  ✅ ángulo ${i + 1}/${ANGLES} → ${r.url}\n`);
  }
  await browser.close();
  close();

  if (MODELO_ID) {
    const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
    const m = await prisma.modelo.findUnique({ where: { id: MODELO_ID } });
    const reales = (m?.imagenes ?? []).filter((u) => !u.startsWith("/render/") && !u.includes("/render/"));
    const nuevas = MODO === "portada" ? [...urls, ...reales] : [...reales, ...urls];
    await prisma.modelo.update({ where: { id: MODELO_ID }, data: { imagenes: nuevas } });
    await prisma.$disconnect();
    console.log(`\nModelo ${MODELO_ID}: ${urls.length} renders (${MODO}). Total imágenes: ${nuevas.length}.`);
  }
  console.log(`\n✅ ${urls.length} renders (slug: ${SLUG}, ${tipo.toUpperCase()}).`);
}

main().catch((e) => { console.error(e); process.exit(1); });

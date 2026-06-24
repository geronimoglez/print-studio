// PDF de inventario Dragon Ball para que Blas palomee cuáles publicar (decisión de riesgo IP).
// Lee pack-mallas/_dragonball.tsv (MB\tPersonaje), agrupa por tier de tamaño→precio, render con Edge.
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { subirImagen } from "../src/lib/storage";

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const TSV = path.join(process.cwd(), "..", "pack-mallas", "_dragonball.tsv");

type Row = { mb: number; nombre: string };
const TIERS = [
  { key: "XL", label: "XL · Estatuas / Dioramas gigantes", min: 500, precio: "$1,500 – $3,500", color: "#b91c1c" },
  { key: "G", label: "Grande · Figuras grandes", min: 200, max: 500, precio: "$700 – $1,500", color: "#c2410c" },
  { key: "M", label: "Mediano · Figuras estándar", min: 50, max: 200, precio: "$350 – $700", color: "#a16207" },
  { key: "C", label: "Chico · Bustos / figuras chicas", max: 50, precio: "$150 – $350", color: "#15803d" },
];

async function main() {
  const rows: Row[] = fs.readFileSync(TSV, "utf8").trim().split("\n").map((l) => {
    const [mb, nombre] = l.split("\t");
    return { mb: parseInt(mb, 10) || 0, nombre: (nombre || "").trim() };
  }).filter((r) => r.nombre);

  const secciones = TIERS.map((t) => {
    const items = rows.filter((r) => r.mb >= (t.min ?? 0) && r.mb < (t.max ?? Infinity)).sort((a, b) => b.mb - a.mb);
    const li = items.map((r) => `<div class="it">☐ <b>${r.nombre}</b> <span class="mb">${r.mb}MB</span></div>`).join("");
    return `<section><h2 style="color:${t.color}">${t.label} <span class="precio">~${t.precio} c/u · ${items.length} modelos</span></h2><div class="grid">${li}</div></section>`;
  }).join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    *{font-family:Segoe UI,Arial,sans-serif;box-sizing:border-box}
    body{margin:0;padding:26px;color:#0f172a}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#475569;font-size:12px;margin:0 0 12px}
    .warn{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;font-size:11.5px;margin:0 0 14px;line-height:1.5}
    h2{font-size:13px;margin:16px 0 6px;border-bottom:2px solid #e2e8f0;padding-bottom:3px}
    .precio{font-size:11px;font-weight:400;color:#64748b}
    .grid{column-count:3;column-gap:14px}
    .it{font-size:10.5px;break-inside:avoid;padding:1.5px 0;line-height:1.35}
    .mb{color:#94a3b8;font-size:9px}
  </style></head><body>
    <h1>Lab 3D Brothers — Inventario Dragon Ball (${rows.length} modelos)</h1>
    <p class="sub">Palomea ☐ los que quieras publicar · precio = estimado de venta del impreso (a afinar al rebanar)</p>
    <div class="warn"><b>⚠️ Nota legal:</b> son figuras de <b>IP de terceros</b> (Dragon Ball). Vender es zona gris
    (igual que el Trofeo FIFA / estampas Panini que ya vendes). Demanda y precio ALTOS, riesgo legal bajo-pero-existe.
    <b>Decisión de Blas:</b> marca solo los que quieras asumir y esos publicamos. Sugerencia: arranca con pocos
    top-demanda (Goku/Vegeta/Broly/Freezer grandes + dioramas) para probar.</div>
    ${secciones}
  </body></html>`;

  fs.mkdirSync(path.join(process.cwd(), "_preview"), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "8mm", bottom: "8mm", left: "8mm", right: "8mm" } });
  await browser.close();
  const local = path.join(process.cwd(), "_preview", "inventario-dragonball.pdf");
  fs.writeFileSync(local, pdf);
  const r = await subirImagen("docs/inventario-dragonball.pdf", Buffer.from(pdf), { contentType: "application/pdf" });
  console.log(`✅ PDF inventario (${rows.length} modelos) · ${local}`);
  console.log(`   compartible: ${r.url}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

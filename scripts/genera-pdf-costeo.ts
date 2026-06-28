// Genera un PDF de costeo (para revisar): actualiza comisión a 15%, costea N modelos
// y arma un reporte con el desglose real (costo → precio → comisión ML 15% → envío → margen neto).
// Render del PDF con Edge (puppeteer-core). Sube a Blob y deja copia local.
//
// Uso: npx tsx scripts/genera-pdf-costeo.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { costearModelo } from "../src/lib/costeo";
import { mxn } from "../src/lib/dinero";
import { subirImagen } from "../src/lib/storage";

const EDGE = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const EJEMPLOS = ["Calavera", "Cobra", "Gato Flex", "Cubo Infinito", "Soporte de vino - Fenix", "Percha Armario", "Tarjetero - Billetera", "Jabonera Salpicadura"];

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
  // 1) comisión real 15% en BD
  await prisma.config.update({ where: { id: 1 }, data: { comisionMlPct: 0.15 } });
  const [config, filamentos, impresoras] = await Promise.all([
    prisma.config.findFirstOrThrow(),
    prisma.filamento.findMany(),
    prisma.impresora.findMany(),
  ]);
  const modelos = await prisma.modelo.findMany({ where: { nombre: { in: EJEMPLOS } } });

  const filas = modelos.map((m) => {
    const c = costearModelo(m, config, filamentos, impresoras);
    return { m, c };
  });

  const td = (s: string | number, extra = "") => `<td style="${extra}">${s}</td>`;
  const rows = filas
    .map(({ m, c }) => `<tr>
      <td style="text-align:left;font-weight:600">${m.nombre}</td>
      ${td(mxn(c.costoTotal))}
      ${td(mxn(c.precioVenta), "font-weight:700;color:#0f766e")}
      ${td(mxn(c.comisionMl), "color:#b45309")}
      ${td(c.envioGratis ? mxn(c.costoEnvioVendedor) : "comprador", "color:#b45309")}
      ${td(mxn(c.margen), `font-weight:700;color:${c.margen > 0 ? "#15803d" : "#b91c1c"}`)}
      ${td(c.margenPct.toFixed(0) + "%")}
      ${td(mxn(c.rentabilidadHora) + "/h")}
    </tr>`)
    .join("");

  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
    *{font-family:Segoe UI,Arial,sans-serif;box-sizing:border-box}
    body{margin:0;padding:32px;color:#0f172a}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#475569;font-size:13px;margin:0 0 18px}
    .box{background:#f1f5f9;border-radius:10px;padding:14px 16px;font-size:12.5px;margin:0 0 18px;line-height:1.5}
    table{width:100%;border-collapse:collapse;font-size:12.5px}
    th,td{padding:9px 8px;text-align:right;border-bottom:1px solid #e2e8f0}
    th{background:#0f172a;color:#fff;font-weight:600;text-align:right}
    th:first-child,td:first-child{text-align:left}
    .foot{margin-top:16px;font-size:11px;color:#64748b;line-height:1.5}
    .tag{display:inline-block;background:#0f766e;color:#fff;border-radius:6px;padding:2px 8px;font-size:11px}
  </style></head><body>
    <h1>Lab 3D Brothers — Costeo real por modelo</h1>
    <p class="sub">Para revisar · valores en pesos mexicanos (MXN) · generado por el sistema</p>
    <div class="box">
      <b>Cómo se calcula el precio:</b> costo de producción (filamento + energía + desgaste de impresora +
      mano de obra + postproceso, ajustado por <b>${(config.tasaFallos * 100).toFixed(0)}%</b> de fallos) ×
      <b>markup ${config.markup}×</b>, y se "despeja" para que después de la
      <b>comisión de Mercado Libre (${(config.comisionMlPct * 100).toFixed(0)}%)</b> y el
      <b>envío</b> aún quede utilidad. <span class="tag">Envío gratis obligatorio arriba de $299 → lo paga el vendedor (~${mxn(config.costoEnvio)}, real ~$60)</span>
    </div>
    <table>
      <thead><tr>
        <th>Modelo</th><th>Costo prod.</th><th>Precio venta</th><th>Comisión ML 15%</th>
        <th>Envío</th><th>Margen neto</th><th>Margen %</th><th>Utilidad/hora</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="foot">
      <b>Notas:</b> "Margen neto" = lo que queda por pieza tras pagar producción, la comisión de ML y el envío.
      "Utilidad/hora" = margen ÷ horas de impresión (métrica para priorizar qué imprimir).
      El costo de envío real de Mercado Envíos para estos paquetes es ~$60 (subsidiado); en el costeo usamos
      ${mxn(config.costoEnvio)} como colchón. Si un precio quedara debajo de $299, el comprador paga el envío.
    </p>
  </body></html>`;

  fs.mkdirSync(path.join(process.cwd(), "_preview"), { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  const pdf = await page.pdf({ format: "A4", landscape: true, printBackground: true, margin: { top: "10mm", bottom: "10mm", left: "8mm", right: "8mm" } });
  await browser.close();
  const local = path.join(process.cwd(), "_preview", "costeo.pdf");
  fs.writeFileSync(local, pdf);
  const r = await subirImagen("docs/costeo.pdf", Buffer.from(pdf), { contentType: "application/pdf" });
  console.log(`✅ PDF: ${filas.length} modelos · local: ${local}`);
  console.log(`   compartible: ${r.url}`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

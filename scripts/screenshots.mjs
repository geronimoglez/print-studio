// Captura screenshots reales de la app desplegada (para el manual en PowerPoint).
// Usa puppeteer-core + el Microsoft Edge instalado (sin descargar navegador).
// Correr: node scripts/screenshots.mjs
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const EDGE =
  process.env.EDGE_PATH ||
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const MODELO_ID = process.env.MODELO_ID || "cmq5szcuy0009zkfef3mwstxa"; // Soporte de Vino - Dragon
const OUT = path.join(process.cwd(), "..", "materiales", "screenshots");

const PAGINAS = [
  { nombre: "01-dashboard", url: `${BASE}/`, full: false },
  { nombre: "02-catalogo", url: `${BASE}/modelos`, full: true },
  { nombre: "02b-catalogo-top", url: `${BASE}/modelos`, full: false },
  { nombre: "03-copiloto", url: `${BASE}/modelos/${MODELO_ID}`, full: true },
  { nombre: "04-tablero", url: `${BASE}/tablero`, full: true },
  { nombre: "05-pedidos", url: `${BASE}/pedidos`, full: true },
  { nombre: "05b-pedidos-top", url: `${BASE}/pedidos`, full: false },
  { nombre: "06-config", url: `${BASE}/config`, full: true },
  { nombre: "07-integraciones", url: `${BASE}/integraciones`, full: false },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=2"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  for (const p of PAGINAS) {
    try {
      await page.goto(p.url, { waitUntil: "networkidle2", timeout: 60000 });
      await sleep(1800); // dejar cargar imágenes/fuentes
      // forzar carga de imágenes lazy: scroll al fondo y regresar
      await page.evaluate(async () => {
        await new Promise((res) => {
          let y = 0;
          const t = setInterval(() => {
            window.scrollBy(0, 600);
            y += 600;
            if (y >= document.body.scrollHeight) {
              clearInterval(t);
              window.scrollTo(0, 0);
              res();
            }
          }, 100);
        });
      });
      await sleep(900);
      const file = path.join(OUT, `${p.nombre}.png`);
      await page.screenshot({ path: file, fullPage: p.full });
      console.log(`✅ ${p.nombre}  ${p.url}`);
    } catch (e) {
      console.error(`❌ ${p.nombre}  ${p.url}\n   ${e.message}`);
    }
  }
  await browser.close();
  console.log(`\nScreenshots en: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

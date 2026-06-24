import fs from "node:fs";
import path from "node:path";

/**
 * Ruta al navegador para render headless (puppeteer-core). Orden de preferencia:
 *  1) EDGE_PATH del entorno (si existe el archivo).
 *  2) chrome-headless-shell descargado con `@puppeteer/browsers install chrome-headless-shell`
 *     (en la raíz del proyecto). NO choca con un Edge abierto (el Edge del sistema, si ya está
 *     corriendo, hace "hand-off" y mata el proceso → puppeteer falla con "Code: 0").
 *  3) Edge del sistema (default Windows) como último recurso.
 */
export function navegadorPath(): string {
  const env = process.env.EDGE_PATH;
  if (env && fs.existsSync(env)) return env;

  const base = path.join(process.cwd(), "chrome-headless-shell");
  if (fs.existsSync(base)) {
    const stack = [base];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: fs.Dirent[] = [];
      try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) stack.push(p);
        else if (e.name === "chrome-headless-shell.exe" || e.name === "chrome-headless-shell") return p;
      }
    }
  }
  return env || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
}

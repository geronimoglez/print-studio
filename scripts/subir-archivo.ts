// Sube un archivo local a Vercel Blob y devuelve su URL pública.
// Uso: npx tsx scripts/subir-archivo.ts <ruta-local> <clave-destino> [contentType]
//   ej: npx tsx scripts/subir-archivo.ts ../catalogo-futbol/Catalogo-FUTBOL-Lab3D.pdf docs/Catalogo-FUTBOL-Lab3D.pdf application/pdf
import "dotenv/config";
import fs from "node:fs";
import { subirImagen, backendActivo } from "../src/lib/storage";

async function main() {
  const [ruta, clave, ct] = process.argv.slice(2);
  if (!ruta || !clave) { console.error("Uso: subir-archivo.ts <ruta-local> <clave-destino> [contentType]"); process.exit(1); }
  const buf = fs.readFileSync(ruta);
  const contentType = ct || (clave.endsWith(".pdf") ? "application/pdf" : clave.endsWith(".png") ? "image/png" : "application/octet-stream");
  console.log(`backend: ${backendActivo()} · subiendo ${(buf.length / 1024 / 1024).toFixed(2)} MB → ${clave}`);
  const r = await subirImagen(clave, buf, { contentType });
  console.log("URL:", r.url);
}
main().then(() => process.exit(0)).catch((e) => { console.error("FALLO:", e); process.exit(1); });

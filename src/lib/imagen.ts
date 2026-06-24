import sharp from "sharp";

/**
 * Analiza un frame renderizado (fondo blanco) y devuelve:
 *  - fill: fracción del cuadro ocupada por el objeto (no-blanco).
 *  - blobs: número de OBJETOS SEPARADOS significativos (componentes conexas).
 *
 * Sirve para decidir si un modelo es "de una sola pieza" (blobs === 1) o multi-pieza/placa de
 * impresión con partes regadas (blobs > 1). Es la base para SOLO generar clip/render de los modelos
 * de los que estamos seguros (1 pieza) y descartar el resto automáticamente.
 */
export async function analizarFrame(input: Buffer | string): Promise<{ fill: number; blobs: number; areaMax: number }> {
  const { data, info } = await sharp(input).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, N = W * H;
  const obj = new Uint8Array(N);
  let objCount = 0;
  for (let i = 0; i < N; i++) if (data[i * info.channels] < 248) { obj[i] = 1; objCount++; }

  const minArea = Math.max(80, Math.floor(N * 0.004)); // ignora motas: < 0.4% del cuadro
  const seen = new Uint8Array(N);
  const stack = new Int32Array(N);
  let blobs = 0, areaMax = 0;
  for (let i = 0; i < N; i++) {
    if (!obj[i] || seen[i]) continue;
    let sp = 0; stack[sp++] = i; seen[i] = 1; let area = 0;
    while (sp > 0) {
      const p = stack[--sp]; area++;
      const x = p % W, y = (p - x) / W;
      if (x > 0) { const q = p - 1; if (obj[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } }
      if (x < W - 1) { const q = p + 1; if (obj[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } }
      if (y > 0) { const q = p - W; if (obj[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } }
      if (y < H - 1) { const q = p + W; if (obj[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } }
    }
    if (area >= minArea) { blobs++; if (area > areaMax) areaMax = area; }
  }
  return { fill: objCount / N, blobs, areaMax: areaMax / N };
}

/** ¿El modelo es "seguro" de una sola pieza para llevarlo a clip/video? Conservador: exactamente
 *  1 objeto separado y que llene razonablemente el cuadro. Multi-pieza o muy chico → false. */
export function esUnaPiezaSeguro(a: { fill: number; blobs: number; areaMax: number }): boolean {
  return a.blobs === 1 && a.areaMax >= 0.08;
}

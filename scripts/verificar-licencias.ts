// Verifica la LICENCIA REAL de cada modelo leyéndola del 3MF (metadata 3D/3dmodel.model:
// "License", "Designer", "Origin"). Normaliza a la vocabulario del sistema (esAptoVenta) y la guarda
// en Modelo.licencia → el gate de publicación bloquea automáticamente lo no-vendible.
// Con --pausar, además PAUSA en ML los anuncios YA publicados que resulten no-vendibles (riesgo legal).
//
// Uso: npx tsx scripts/verificar-licencias.ts [--pausar]
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { esAptoVenta } from "../src/lib/licencias";
import { getAccessTokenValido } from "../src/lib/mercadolibre";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });
const MAN = path.join(process.cwd(), "..", "pack-mallas", "_mallas.json");
const PAUSAR = process.argv.includes("--pausar");

/** Normaliza la licencia real → vocabulario del sistema (lo que entiende esAptoVenta). */
function normalizar(raw: string): string {
  const l = (raw || "").toLowerCase().trim();
  if (!l || l === "?") return "Revisar";
  if (/\bnc\b|non.?commercial|no.?comercial/.test(l)) return "CC-BY-NC"; // no vendible
  if (/standard digital file/.test(l)) return "Personal"; // no vendible
  if (/exclusive/.test(l)) return "Revisar-Exclusive"; // requiere membresía comercial → no vendible por default
  if (/cc0|public domain|dominio p/.test(l)) return "Dominio publico"; // vendible
  if (/commercial|comercial/.test(l)) return "Comercial"; // vendible
  if (/by-nd|by-sa|attribution|^by\b|^cc-by\b/.test(l)) return "CC-BY"; // vendible (con atribución)
  return "Revisar";
}

function licenciaDe3mf(meshPath: string): { license: string; designer: string } {
  try {
    const xml = execSync(`unzip -p "${meshPath}" "3D/3dmodel.model"`, { encoding: "utf8", maxBuffer: 1 << 26 });
    const license = (/name="License">([^<]*)/.exec(xml)?.[1] || "?").trim();
    const designer = (/name="Designer">([^<]*)/.exec(xml)?.[1] || "?").trim();
    return { license, designer };
  } catch {
    return { license: "?", designer: "?" };
  }
}

async function main() {
  const man = JSON.parse(fs.readFileSync(MAN, "utf8")) as Record<string, { path: string; tipo: "stl" | "3mf" }>;
  const modelos = await prisma.modelo.findMany({ where: { notas: { startsWith: "Pack " } } });
  const token = PAUSAR ? await getAccessTokenValido() : null;

  const cnt: Record<string, number> = {};
  let pausados = 0;
  for (const m of modelos) {
    const slug = (m.imagenes ?? []).find((u) => u.startsWith("/pack/"))?.split("/")[2]
      ?? (m.imagenes ?? []).find((u) => u.includes("/render/"))?.match(/render\/([^/]+)\//)?.[1];
    const e = slug ? man[slug] : undefined;
    let licReal = "(sin malla/STL)";
    let designer = "?";
    if (e && e.tipo === "3mf") {
      const r = licenciaDe3mf(e.path);
      licReal = r.license;
      designer = r.designer;
    }
    const norm = normalizar(licReal);
    cnt[norm] = (cnt[norm] ?? 0) + 1;
    const apto = esAptoVenta(norm);

    // Guardar licencia real + normalizada (limpia marcas previas).
    const notasBase = (m.notas ?? "").replace(/\s*\[Licencia[^\]]*\]/g, "");
    await prisma.modelo.update({
      where: { id: m.id },
      data: {
        licencia: norm,
        creador: designer !== "?" ? designer : m.creador,
        notas: `${notasBase} [Licencia real: ${licReal} → ${norm} (${apto ? "vendible" : "NO vendible"})]`.slice(0, 1000),
      },
    });

    // Pausar en ML si está publicado y no es vendible.
    if (PAUSAR && !apto && m.publicadoMl && m.mlItemId && token) {
      try {
        const r = await fetch(`https://api.mercadolibre.com/items/${m.mlItemId}`, {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paused" }),
        });
        if (r.ok) { pausados++; console.log(`  ⏸️  ${m.nombre.padEnd(26)} ${m.mlItemId} [${licReal}]`); }
        else console.log(`  ⚠️  no se pudo pausar ${m.nombre} (${r.status})`);
      } catch { /* sigue */ }
    }
  }
  console.log("\n=== Licencias normalizadas ===");
  for (const [k, v] of Object.entries(cnt)) console.log(`  ${k}: ${v}${esAptoVenta(k) ? " (vendible)" : ""}`);
  console.log(`\n>>> pausados en ML: ${pausados}`);
  await prisma.$disconnect();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });

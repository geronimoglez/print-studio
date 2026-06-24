// Hermes · bot de MONITOREO (referencia para Railway/openclaw).
// Llama la API del sistema (sync-then-report) y arma un reporte legible del estado.
// Es solo lectura: NO reimplementa lógica, NO toca la DB ni los tokens de ML.
//
// Uso:  SISTEMA_URL=https://lab3d.apps.minka.one BOT_API_KEY=xxxx node scripts/hermes-monitor.mjs
import "dotenv/config";

const BASE = (process.env.SISTEMA_URL || "https://lab3d.apps.minka.one").replace(/\/+$/, "");
const KEY = process.env.BOT_API_KEY;
const H = { "x-bot-key": KEY ?? "" };
const EMOJI = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
const mxn = (n) => `$${Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;

async function main() {
  if (!KEY) throw new Error("Falta BOT_API_KEY");

  // 1) Sincronizar (que el tablero esté fresco). Fallo no fatal.
  let syncWarn = "";
  try {
    const s = await fetch(`${BASE}/api/bot/sync`, { method: "POST", headers: H });
    const sb = await s.json().catch(() => ({}));
    if (!s.ok || sb?.ok === false) syncWarn = sb?.error || `sync HTTP ${s.status}`;
  } catch (e) {
    syncWarn = String(e.message || e);
  }

  // 2) Resumen
  const r = await fetch(`${BASE}/api/bot/resumen`, { headers: H });
  if (r.status === 401) throw new Error("BOT_API_KEY inválida (401)");
  const d = await r.json();
  if (!d?.ok) throw new Error("Resumen no disponible");

  console.log(formatReport(d, syncWarn));
}

function formatReport(d, syncWarn) {
  const sm = d.semaforo;
  const L = [];
  L.push(`${EMOJI[sm.global] || "•"} *Lab 3D Brothers* — estado: *${sm.global.toUpperCase()}*  (${d.generadoEn})`);
  L.push("");
  L.push(`🖨️ Impresión ${EMOJI[sm.impresion.color]}: ${sm.impresion.porImprimir} por imprimir · ${sm.impresion.enProceso} en proceso · ${sm.impresion.vencidos} vencidos`);
  L.push(`   ${sm.impresion.mensaje}`);
  L.push(`🧑 Clientes ${EMOJI[sm.clientes.color]}: ${sm.clientes.pendientes} pendientes · ${sm.clientes.urgentes} urgentes`);
  L.push(`   ${sm.clientes.mensaje}`);
  L.push("");
  L.push(`💰 Ventas (7d): ${d.ventas.recientes7d} · ${mxn(d.ventas.ingresos7d)}   |   total: ${d.ventas.total} · ${mxn(d.ventas.ingresosTotal)}`);
  L.push(`📦 Modelos: ${d.modelos.aptos}/${d.modelos.total} aptos · ${d.modelos.publicados} en ML`);
  L.push(`🧾 Pedidos: ${Object.entries(d.pedidos.porEstado).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  if (d.alertas?.length) {
    L.push("");
    L.push("⚠️ Alertas:");
    for (const a of d.alertas) L.push(`   [${String(a.nivel).toUpperCase()}] ${a.area}: ${a.mensaje}`);
  } else {
    L.push("");
    L.push("✅ Sin alertas — todo en verde.");
  }
  if (syncWarn) L.push(`\n⚠️ datos quizá no frescos (sync: ${syncWarn})`);
  return L.join("\n");
}

main().catch((e) => {
  console.error("Hermes monitor falló:", e.message);
  process.exit(1);
});

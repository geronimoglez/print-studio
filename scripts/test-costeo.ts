// Test del motor de costeo: reproduce el ejemplo numérico del doc 04.
// Corre con: npm run test
import { calcularCosteo } from "../src/lib/costeo";
import { esAptoVenta } from "../src/lib/licencias";

let fallos = 0;

function approx(label: string, got: number, esperado: number, tol = 0.01) {
  const ok = Math.abs(got - esperado) <= tol;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${got} (esperado ≈ ${esperado})`);
  if (!ok) fallos++;
}

function igual(label: string, got: unknown, esperado: unknown) {
  const ok = got === esperado;
  console.log(`${ok ? "✓" : "✗"} ${label}: ${got} (esperado ${esperado})`);
  if (!ok) fallos++;
}

console.log("=== Motor de costeo — ejemplo del doc 04 ===");
const r = calcularCosteo({
  gramosFilamento: 80,
  tiempoImpresionMin: 360, // 6 h
  tiempoOperacionMin: 20,
  costoPostproceso: 10,
  costoLicencia: 0,
  costoPorKg: 450,
  potenciaW: 150, // 0.15 kW
  depreciacionPorHora: 3,
  tarifaKwh: 2.5,
  costoHoraManoObra: 60,
  tasaFallos: 0.1,
  markup: 3.0,
  costoEnvio: 70,
  comisionMlPct: 0.14,
  tiempoColaHoras: 0,
  horasProductivasDia: 8,
  diasEnvio: 3,
  colchonDias: 1,
});

approx("costo filamento", r.costoFilamento, 36.0);
approx("costo energía", r.costoEnergia, 2.25);
approx("costo depreciación", r.costoDepreciacion, 18.0);
approx("costo mano de obra", r.costoManoObra, 20.0);
approx("costo directo", r.costoDirecto, 86.25);
approx("costo total (ajustado por fallos)", r.costoTotal, 95.83);
approx("precio de venta", r.precioVenta, 415.7, 0.05);
igual("tiempo de entrega (días)", r.tiempoEntregaDias, 5);

console.log("\n=== Reglas de licencia (doc 02) ===");
igual("Propia → vendible", esAptoVenta("Propia"), true);
igual("Comercial → vendible", esAptoVenta("Comercial"), true);
igual("CC-BY → vendible", esAptoVenta("CC-BY"), true);
igual("CC-BY-NC → NO vendible", esAptoVenta("CC-BY-NC"), false);
igual("Personal → NO vendible", esAptoVenta("Personal"), false);

console.log(`\n${fallos === 0 ? "✅ TODO OK" : `❌ ${fallos} fallo(s)`}`);
process.exit(fallos === 0 ? 0 : 1);

// Datos de ejemplo para probar el sistema (catálogo, costeo y filtro legal).
// Cubre categorías y una MEZCLA de licencias para demostrar el filtro legal:
// algunos modelos quedan bloqueados (CC-BY-NC, Personal) y no se podrán publicar.
// Corre con: npm run seed
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está definida");
const prisma = new PrismaClient({ adapter: new PrismaPg(url) });

async function main() {
  // Limpieza (idempotente)
  await prisma.pedido.deleteMany();
  await prisma.modelo.deleteMany();
  await prisma.venta.deleteMany();
  await prisma.filamento.deleteMany();
  await prisma.impresora.deleteMany();
  await prisma.config.deleteMany();

  // Config: valores de ejemplo. Edítalos en el wizard /setup o en /config (rigen todo el costeo).
  await prisma.config.create({
    data: {
      id: 1,
      tarifaKwh: 4,
      comisionMlPct: 0.14,
      costoEnvio: 70,
      tasaFallos: 0.1,
      costoHoraManoObra: 200,
      markup: 3.0,
      costoPorKgDefault: 330,
      potenciaWDefault: 100,
      depreciacionPorHora: 2,
      horasProductivasDia: 20,
      tiempoColaHoras: 0,
      diasEnvio: 3,
      colchonDias: 1,
    },
  });

  // Filamentos — PLA y PETG básico (rango de ejemplo $280–$380/kg)
  await prisma.filamento.createMany({
    data: [
      { tipo: "PLA", marca: "Básico", color: "Negro", costoPorKg: 300, densidad: 1.24, stockGramos: 3000 },
      { tipo: "PLA", marca: "Básico", color: "Blanco", costoPorKg: 300, densidad: 1.24, stockGramos: 2500 },
      { tipo: "PETG", marca: "Básico", color: "Negro", costoPorKg: 360, densidad: 1.27, stockGramos: 2000 },
    ],
  });

  // Impresoras — parque de ejemplo: 2 A1 con AMS, 2 A1, 1 A1 mini.
  // (costoEquipo y depreciación son estimados; potencia = promedio durante impresión.)
  const a1ams1 = await prisma.impresora.create({
    data: { modelo: "Bambu Lab A1 (AMS) #1", potenciaW: 100, costoEquipo: 9500, depreciacionPorHora: 2, horasUso: 0, disponible: true },
  });
  await prisma.impresora.create({
    data: { modelo: "Bambu Lab A1 (AMS) #2", potenciaW: 100, costoEquipo: 9500, depreciacionPorHora: 2, horasUso: 0, disponible: true },
  });
  const a1_1 = await prisma.impresora.create({
    data: { modelo: "Bambu Lab A1 #1", potenciaW: 100, costoEquipo: 6500, depreciacionPorHora: 1.5, horasUso: 0, disponible: true },
  });
  await prisma.impresora.create({
    data: { modelo: "Bambu Lab A1 #2", potenciaW: 100, costoEquipo: 6500, depreciacionPorHora: 1.5, horasUso: 0, disponible: true },
  });
  const a1mini = await prisma.impresora.create({
    data: { modelo: "Bambu Lab A1 mini", potenciaW: 70, costoEquipo: 4500, depreciacionPorHora: 1, horasUso: 0, disponible: true },
  });

  // Alias para asignar a los modelos de ejemplo:
  const a1 = a1_1; // A1 sin AMS (monocolor)
  const p1s = a1ams1; // los multicolor van a una con AMS
  void a1mini;

  // Modelos — mezcla de categorías, tiempos y LICENCIAS (incluye no-vendibles)
  const modelos = [
    {
      nombre: "Llavero personalizado con nombre", fuente: "Propio", licencia: "Propia",
      categoria: "Regalo", nicho: "personalizado", tiempoImpresionMin: 45, gramosFilamento: 12,
      tipoFilamento: "PLA", multicolorAms: true, requiereSoportes: false, dificultad: "Baja",
      tiempoOperacionMin: 8, costoPostproceso: 2, rating: 4.8, popularidad: 320,
      impresoraId: a1.id, estadoValidacion: "Validado", publicadoMl: true,
    },
    {
      nombre: "Organizador de cables de escritorio", fuente: "Propio", licencia: "Propia",
      categoria: "Organizador", nicho: "hogar", tiempoImpresionMin: 95, gramosFilamento: 35,
      tipoFilamento: "PETG", dificultad: "Baja", tiempoOperacionMin: 10, costoPostproceso: 0,
      rating: 4.6, popularidad: 210, impresoraId: a1.id, estadoValidacion: "Validado",
    },
    {
      nombre: "Maceta geométrica", fuente: "MakerWorld", creador: "studio_planta",
      urlFuente: "https://makerworld.com/models/ejemplo-maceta", licencia: "CC-BY",
      categoria: "Decoracion", nicho: "hogar", tiempoImpresionMin: 180, gramosFilamento: 90,
      tipoFilamento: "PLA", dificultad: "Media", tiempoOperacionMin: 12, costoPostproceso: 5,
      rating: 4.7, popularidad: 1500, impresoraId: a1.id, estadoValidacion: "Validado",
    },
    {
      nombre: "Figura articulada dragón (flexi)", fuente: "MakerWorld", creador: "dragon_maker",
      urlFuente: "https://makerworld.com/models/ejemplo-dragon", licencia: "CC-BY-NC",
      categoria: "Figura", nicho: "juguetes", tiempoImpresionMin: 320, gramosFilamento: 110,
      tipoFilamento: "PLA", multicolorAms: true, dificultad: "Media", tiempoOperacionMin: 15,
      costoPostproceso: 8, rating: 4.9, popularidad: 8000, impresoraId: p1s.id,
      estadoValidacion: "Pendiente",
      notas: "Muy popular pero CC-BY-NC: NO se puede vender sin licencia comercial.",
    },
    {
      nombre: "Topper de pastel XV años", fuente: "Propio", licencia: "Propia",
      categoria: "Evento", nicho: "XV años", tiempoImpresionMin: 140, gramosFilamento: 40,
      tipoFilamento: "PLA", requiereSoportes: true, dificultad: "Media", tiempoOperacionMin: 18,
      costoPostproceso: 12, rating: 4.5, popularidad: 60, impresoraId: a1.id,
      estadoValidacion: "Validado",
    },
    {
      nombre: "Soporte para audífonos gamer", fuente: "Propio", licencia: "Propia",
      categoria: "Organizador", nicho: "gaming", tiempoImpresionMin: 240, gramosFilamento: 130,
      tipoFilamento: "PETG", dificultad: "Baja", tiempoOperacionMin: 10, costoPostproceso: 3,
      rating: 4.4, popularidad: 95, impresoraId: p1s.id, estadoValidacion: "Validado",
    },
    {
      nombre: "Miniatura D&D — pack héroes", fuente: "MakerWorld", creador: "mini_forge",
      urlFuente: "https://makerworld.com/models/ejemplo-mini", licencia: "Comercial",
      categoria: "Miniatura", nicho: "juegos de mesa", tiempoImpresionMin: 200, gramosFilamento: 25,
      tipoFilamento: "PLA", requiereSoportes: true, dificultad: "Alta", tiempoOperacionMin: 25,
      costoPostproceso: 15, costoLicencia: 8, rating: 4.9, popularidad: 5400, impresoraId: p1s.id,
      estadoValidacion: "Validado", notas: "Creador con membresía comercial; costoLicencia = prorrateo.",
    },
    {
      nombre: "Engrane refacción licuadora", fuente: "Propio", licencia: "Propia",
      categoria: "Refaccion", nicho: "refacciones", tiempoImpresionMin: 60, gramosFilamento: 18,
      tipoFilamento: "PETG", dificultad: "Media", tiempoOperacionMin: 8, costoPostproceso: 1,
      rating: 4.3, popularidad: 40, impresoraId: a1.id, estadoValidacion: "Validado",
      notas: "Nicho poco explotado y rentable.",
    },
    {
      nombre: "Lámpara litofanía con foto", fuente: "Propio", licencia: "Propia",
      categoria: "Regalo", nicho: "personalizado", tiempoImpresionMin: 300, gramosFilamento: 75,
      tipoFilamento: "PLA", dificultad: "Media", tiempoOperacionMin: 20, costoPostproceso: 10,
      rating: 4.8, popularidad: 130, impresoraId: a1.id, estadoValidacion: "Validado", publicadoMl: true,
    },
    {
      nombre: "Cactus decorativo flexi", fuente: "MakerWorld", creador: "flexi_world",
      urlFuente: "https://makerworld.com/models/ejemplo-cactus", licencia: "Personal",
      categoria: "Decoracion", nicho: "hogar", tiempoImpresionMin: 110, gramosFilamento: 30,
      tipoFilamento: "PLA", multicolorAms: true, dificultad: "Baja", rating: 4.6, popularidad: 2200,
      estadoValidacion: "Pendiente", notas: "Licencia Personal: NO vendible.",
    },
    {
      nombre: "Porta gafetes para evento", fuente: "Propio", licencia: "Propia",
      categoria: "Evento", nicho: "corporativo", tiempoImpresionMin: 70, gramosFilamento: 22,
      tipoFilamento: "PETG", dificultad: "Baja", tiempoOperacionMin: 6, costoPostproceso: 1,
      rating: 4.2, popularidad: 15, impresoraId: a1.id, estadoValidacion: "Validado",
    },
    {
      nombre: "Soporte de celular plegable", fuente: "MakerWorld", creador: "open_designs",
      urlFuente: "https://makerworld.com/models/ejemplo-soporte", licencia: "Dominio publico",
      categoria: "Organizador", nicho: "oficina", tiempoImpresionMin: 85, gramosFilamento: 28,
      tipoFilamento: "PLA", dificultad: "Baja", tiempoOperacionMin: 7, costoPostproceso: 0,
      rating: 4.5, popularidad: 900, impresoraId: a1.id, estadoValidacion: "Validado",
    },
    {
      nombre: "Calaverita Día de Muertos", fuente: "Propio", licencia: "Propia",
      categoria: "Decoracion", nicho: "Día de Muertos", tiempoImpresionMin: 130, gramosFilamento: 45,
      tipoFilamento: "PLA", multicolorAms: true, dificultad: "Media", tiempoOperacionMin: 12,
      costoPostproceso: 6, rating: 4.7, popularidad: 80, impresoraId: a1.id, estadoValidacion: "Validado",
      notas: "Estacional: campaña octubre-noviembre.",
    },
    {
      nombre: "Caja organizadora modular grande", fuente: "Propio", licencia: "Propia",
      categoria: "Organizador", nicho: "hogar", tiempoImpresionMin: 420, gramosFilamento: 220,
      tipoFilamento: "PETG", dificultad: "Baja", tiempoOperacionMin: 10, costoPostproceso: 0,
      rating: 4.6, popularidad: 50, impresoraId: p1s.id, estadoValidacion: "Validado",
      notas: "Pieza lenta y pesada: contrastar su rentabilidad/hora contra las rápidas.",
    },
  ];

  for (const m of modelos) {
    await prisma.modelo.create({ data: m });
  }

  // Pedidos demo para el tablero semáforo (se reemplazan por órdenes reales de ML al conectar).
  const ahora = Date.now();
  const dias = (d: number) => new Date(ahora + d * 86400000);
  const horas = (h: number) => new Date(ahora + h * 3600000);
  await prisma.pedido.createMany({
    data: [
      { modeloNombre: "Llavero personalizado con nombre", tiempoImpresionMin: 45, estado: "Vendido", fechaVenta: horas(-2), fechaLimite: dias(4), clienteAtendido: true },
      { modeloNombre: "Topper de pastel XV años", tiempoImpresionMin: 140, estado: "Vendido", fechaVenta: horas(-20), fechaLimite: horas(20), clienteAtendido: false },
      { modeloNombre: "Lámpara litofanía con foto", tiempoImpresionMin: 300, estado: "Vendido", fechaVenta: horas(-1), fechaLimite: dias(3), clienteAtendido: false },
      { modeloNombre: "Maceta geométrica", tiempoImpresionMin: 180, estado: "Imprimiendo", fechaVenta: dias(-1), fechaLimite: dias(2), clienteAtendido: true },
      { modeloNombre: "Soporte para audífonos gamer", tiempoImpresionMin: 240, estado: "EnCola", fechaVenta: horas(-30), fechaLimite: dias(2), clienteAtendido: true },
      { modeloNombre: "Organizador de cables de escritorio", tiempoImpresionMin: 95, estado: "Impreso", fechaVenta: dias(-2), fechaLimite: dias(1), clienteAtendido: true },
      { modeloNombre: "Engrane refacción licuadora", tiempoImpresionMin: 60, estado: "Entregado", fechaVenta: dias(-3), clienteAtendido: true },
      { modeloNombre: "Porta gafetes para evento", tiempoImpresionMin: 70, estado: "Entregado", fechaVenta: dias(-4), clienteAtendido: true },
    ],
  });

  const [nFil, nImp] = await Promise.all([prisma.filamento.count(), prisma.impresora.count()]);
  console.log(`✅ Seed: ${modelos.length} modelos, ${nFil} filamentos, ${nImp} impresoras, 1 config.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

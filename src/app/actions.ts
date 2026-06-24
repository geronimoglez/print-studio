"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fetchMakerWorld } from "@/lib/importar/makerworld";
import {
  sincronizarOrdenes,
  publicarModelo,
  actualizarPublicacion,
  validarPublicacion,
  sincronizarEstatusMl,
} from "@/lib/mercadolibre";

// --- Helpers de parseo de FormData ---
function str(fd: FormData, k: string): string {
  return (fd.get(k) as string | null)?.trim() ?? "";
}
function strOpt(fd: FormData, k: string): string | null {
  const v = str(fd, k);
  return v === "" ? null : v;
}
function num(fd: FormData, k: string, def = 0): number {
  const v = fd.get(k);
  if (v === null || v === "") return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function numOpt(fd: FormData, k: string): number | null {
  const v = fd.get(k);
  if (v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function bool(fd: FormData, k: string): boolean {
  return fd.get(k) != null;
}

function datosModelo(fd: FormData) {
  return {
    nombre: str(fd, "nombre"),
    fuente: str(fd, "fuente") || "Propio",
    urlFuente: strOpt(fd, "urlFuente"),
    creador: strOpt(fd, "creador"),
    licencia: str(fd, "licencia") || "Propia",
    categoria: str(fd, "categoria") || "Otro",
    nicho: strOpt(fd, "nicho"),
    tiempoImpresionMin: Math.round(num(fd, "tiempoImpresionMin")),
    gramosFilamento: num(fd, "gramosFilamento"),
    tipoFilamento: str(fd, "tipoFilamento") || "PLA",
    multicolorAms: bool(fd, "multicolorAms"),
    requiereSoportes: bool(fd, "requiereSoportes"),
    dificultad: str(fd, "dificultad") || "Media",
    tiempoOperacionMin: Math.round(num(fd, "tiempoOperacionMin", 20)),
    costoPostproceso: num(fd, "costoPostproceso"),
    costoLicencia: num(fd, "costoLicencia"),
    rating: numOpt(fd, "rating"),
    popularidad: numOpt(fd, "popularidad"),
    impresoraId: strOpt(fd, "impresoraId"),
    estadoValidacion: str(fd, "estadoValidacion") || "Pendiente",
    publicadoMl: bool(fd, "publicadoMl"),
    mlItemId: strOpt(fd, "mlItemId"),
    archivoUrl: strOpt(fd, "archivoUrl"),
    archivoTipo: strOpt(fd, "archivoTipo"),
    notas: strOpt(fd, "notas"),
  };
}

export async function crearModelo(fd: FormData) {
  await prisma.modelo.create({ data: datosModelo(fd) });
  revalidatePath("/modelos");
  revalidatePath("/");
  redirect("/modelos");
}

export async function actualizarModelo(fd: FormData) {
  const id = str(fd, "id");
  await prisma.modelo.update({ where: { id }, data: datosModelo(fd) });
  revalidatePath("/modelos");
  revalidatePath("/");
  redirect("/modelos");
}

export async function eliminarModelo(fd: FormData) {
  const id = str(fd, "id");
  await prisma.modelo.delete({ where: { id } });
  revalidatePath("/modelos");
  revalidatePath("/");
  redirect("/modelos");
}

export async function guardarConfig(fd: FormData) {
  await prisma.config.update({
    where: { id: 1 },
    data: {
      tarifaKwh: num(fd, "tarifaKwh", 2.5),
      comisionMlPct: num(fd, "comisionMlPct", 0.15),
      costoEnvio: num(fd, "costoEnvio", 70),
      tasaFallos: num(fd, "tasaFallos", 0.1),
      costoHoraManoObra: num(fd, "costoHoraManoObra", 60),
      markup: num(fd, "markup", 3.0),
      costoPorKgDefault: num(fd, "costoPorKgDefault", 450),
      potenciaWDefault: num(fd, "potenciaWDefault", 150),
      depreciacionPorHora: num(fd, "depreciacionPorHora", 3),
      horasProductivasDia: num(fd, "horasProductivasDia", 8),
      tiempoColaHoras: num(fd, "tiempoColaHoras", 0),
      diasEnvio: Math.round(num(fd, "diasEnvio", 3)),
      colchonDias: Math.round(num(fd, "colchonDias", 1)),
    },
  });
  // La config afecta TODO el catálogo: refrescar todo el árbol.
  revalidatePath("/", "layout");
  redirect("/config?ok=1");
}

// --- Marca / white-label (Fase 1D) ---
// Guarda el override de branding (JSON) + preferencias de idioma/moneda en Config (fila 1).
function datosBranding(fd: FormData) {
  const campos = [
    "appName",
    "appShortName",
    "tagline",
    "appDescription",
    "mlSellerName",
    "logoUrl",
    "colorPrimary",
    "colorAccent",
    "colorBgDark",
    "themeColor",
  ] as const;
  const branding: Record<string, string> = {};
  for (const k of campos) {
    const v = str(fd, k);
    if (v) branding[k] = v;
  }
  return {
    branding,
    localeUi: str(fd, "localeUi") || "es",
    localeContenido: str(fd, "localeContenido") || "es-MX",
    monedaNegocio: str(fd, "monedaNegocio") || "MXN",
  };
}

export async function guardarBranding(fd: FormData) {
  await prisma.config.update({ where: { id: 1 }, data: datosBranding(fd) });
  // La marca/colores afectan el layout completo: refrescar todo el árbol.
  revalidatePath("/", "layout");
  redirect("/config?ok=1");
}

export async function completarSetup(fd: FormData) {
  await prisma.config.update({
    where: { id: 1 },
    data: { ...datosBranding(fd), setupCompletado: true },
  });
  revalidatePath("/", "layout");
  redirect("/");
}

export async function crearFilamento(fd: FormData) {
  await prisma.filamento.create({
    data: {
      tipo: str(fd, "tipo") || "PLA",
      marca: strOpt(fd, "marca"),
      color: strOpt(fd, "color"),
      costoPorKg: num(fd, "costoPorKg", 450),
      densidad: numOpt(fd, "densidad") ?? 1.24,
      stockGramos: numOpt(fd, "stockGramos") ?? 0,
    },
  });
  revalidatePath("/filamentos");
  revalidatePath("/modelos");
}

export async function eliminarFilamento(fd: FormData) {
  await prisma.filamento.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/filamentos");
  revalidatePath("/modelos");
}

export async function crearImpresora(fd: FormData) {
  await prisma.impresora.create({
    data: {
      modelo: str(fd, "modelo") || "Impresora",
      potenciaW: num(fd, "potenciaW", 150),
      costoEquipo: num(fd, "costoEquipo", 0),
      depreciacionPorHora: num(fd, "depreciacionPorHora", 0),
      horasUso: num(fd, "horasUso", 0),
      disponible: fd.get("disponible") != null,
    },
  });
  revalidatePath("/impresoras");
  revalidatePath("/modelos");
}

export async function eliminarImpresora(fd: FormData) {
  await prisma.impresora.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/impresoras");
  revalidatePath("/modelos");
}

// --- Gestión de datos de prueba ---
// Borran SOLO datos de catálogo/ventas. NUNCA tocan filamentos ni impresoras (infra real de Blas).
// El respaldo se descarga como archivo desde el cliente ANTES de borrar (ver GestionDatos.tsx).

export async function borrarTodosLosModelos() {
  const total = await prisma.modelo.count();
  await prisma.modelo.deleteMany();
  revalidatePath("/modelos");
  revalidatePath("/");
  return { borrados: total };
}

export async function borrarVentas() {
  const total = await prisma.venta.count();
  await prisma.venta.deleteMany();
  revalidatePath("/");
  return { borrados: total };
}

// --- Mercado Libre ---
export async function sincronizarMl() {
  const r = await sincronizarOrdenes();
  revalidatePath("/integraciones");
  revalidatePath("/");
  return r;
}

// --- Publicación ML (copiloto) ---
export async function agregarImagen(fd: FormData) {
  const id = str(fd, "id");
  const url = str(fd, "url");
  if (!url) return;
  const m = await prisma.modelo.findUnique({ where: { id } });
  if (!m || m.imagenes.includes(url)) return;
  await prisma.modelo.update({ where: { id }, data: { imagenes: { push: url } } });
  revalidatePath(`/modelos/${id}`);
}

export async function quitarImagen(fd: FormData) {
  const id = str(fd, "id");
  const url = str(fd, "url");
  const m = await prisma.modelo.findUnique({ where: { id } });
  if (!m) return;
  await prisma.modelo.update({
    where: { id },
    data: { imagenes: m.imagenes.filter((u) => u !== url) },
  });
  revalidatePath(`/modelos/${id}`);
}

export async function aplicarMakerWorld(fd: FormData) {
  const id = str(fd, "id");
  const urlMw = str(fd, "url");
  const imagen = strOpt(fd, "imagen");
  const creador = strOpt(fd, "creador");
  const m = await prisma.modelo.findUnique({ where: { id } });
  if (!m) return;
  await prisma.modelo.update({
    where: { id },
    data: {
      fuente: "MakerWorld",
      urlFuente: urlMw || m.urlFuente,
      creador: m.creador ?? creador,
      ...(imagen && !m.imagenes.includes(imagen) ? { imagenes: { push: imagen } } : {}),
    },
  });
  revalidatePath(`/modelos/${id}`);
}

export async function aplicarCatalogo(fd: FormData) {
  const id = str(fd, "id");
  const productId = strOpt(fd, "productId"); // null = desenganchar
  await prisma.modelo.update({ where: { id }, data: { mlCatalogProductId: productId } });
  revalidatePath(`/modelos/${id}`);
}

export async function publicarEnMl(fd: FormData) {
  const id = str(fd, "id");
  const r = await publicarModelo(id);
  revalidatePath(`/modelos/${id}`);
  revalidatePath("/modelos");
  const q = r.ok
    ? `pub=ok&item=${encodeURIComponent(r.mlItemId ?? "")}`
    : `pub=fail&msg=${encodeURIComponent(r.error ?? "error")}`;
  redirect(`/modelos/${id}?${q}`);
}

// Aprobación por LOTE desde la Sala de Revisión (/revision). Mismo motor que el botón individual:
// publicar reusa publicarModelo() (gate fail-closed: un 🔴 nunca se publica) y descartar marca Rechazado.
export async function accionLote(fd: FormData) {
  const ids = fd.getAll("ids").map((v) => String(v)).filter(Boolean);
  const accion = str(fd, "accion"); // "publicar" | "descartar"
  let ok = 0, fail = 0, desc = 0;
  if (accion === "publicar") {
    for (const id of ids) {
      const r = await publicarModelo(id);
      if (r.ok) ok++;
      else fail++;
    }
  } else if (accion === "descartar" && ids.length) {
    const r = await prisma.modelo.updateMany({ where: { id: { in: ids } }, data: { estadoValidacion: "Rechazado" } });
    desc = r.count;
  }
  revalidatePath("/revision");
  revalidatePath("/modelos");
  redirect(`/revision?ok=${ok}&fail=${fail}&desc=${desc}`);
}

// Refresca el estatus de salud de TODOS los anuncios publicados (lo usa el botón del panel /salud).
export async function refrescarEstatusMl() {
  await sincronizarEstatusMl();
  revalidatePath("/salud");
  redirect("/salud?ref=ok");
}

export async function actualizarEnMl(fd: FormData) {
  const id = str(fd, "id");
  const pausar = fd.get("pausar") != null;
  const r = await actualizarPublicacion(id, { pausar });
  revalidatePath(`/modelos/${id}`);
  redirect(`/modelos/${id}?pub=${r.ok ? "upd" : "fail"}&msg=${encodeURIComponent(r.error ?? "")}`);
}

export async function validarEnMl(fd: FormData) {
  const id = str(fd, "id");
  const r = await validarPublicacion(id);
  revalidatePath(`/modelos/${id}`);
  let msg = "";
  if (!r.ok) msg = r.error ?? "error";
  else if (!r.valido) {
    const d = r.detalle as { cause?: Array<{ code?: string; message?: string }>; message?: string } | undefined;
    const causes = (d?.cause ?? []).map((c) => c.message || c.code).filter(Boolean);
    msg = causes.length
      ? causes.join(" · ")
      : d
        ? JSON.stringify(d).slice(0, 400)
        : "ML reportó problemas en el anuncio.";
  }
  const estado = r.ok && r.valido ? "val_ok" : "val_fail";
  redirect(`/modelos/${id}?pub=${estado}&msg=${encodeURIComponent(msg)}`);
}

// --- Estado de pedidos (tablero operativo) ---
export async function avanzarPedido(fd: FormData) {
  const id = str(fd, "id");
  const estado = str(fd, "estado");
  await prisma.pedido.update({ where: { id }, data: { estado } });
  revalidatePath("/pedidos");
  revalidatePath("/tablero");
  revalidatePath("/");
}

export async function marcarAtendido(fd: FormData) {
  const id = str(fd, "id");
  await prisma.pedido.update({ where: { id }, data: { clienteAtendido: true } });
  revalidatePath("/pedidos");
  revalidatePath("/tablero");
}

// --- Edición de filamentos / impresoras ---
export async function actualizarFilamento(fd: FormData) {
  await prisma.filamento.update({
    where: { id: str(fd, "id") },
    data: {
      tipo: str(fd, "tipo") || "PLA",
      marca: strOpt(fd, "marca"),
      color: strOpt(fd, "color"),
      costoPorKg: num(fd, "costoPorKg", 450),
      densidad: numOpt(fd, "densidad") ?? 1.24,
      stockGramos: numOpt(fd, "stockGramos") ?? 0,
    },
  });
  revalidatePath("/filamentos");
  revalidatePath("/modelos");
  redirect("/filamentos");
}

export async function actualizarImpresora(fd: FormData) {
  await prisma.impresora.update({
    where: { id: str(fd, "id") },
    data: {
      modelo: str(fd, "modelo") || "Impresora",
      potenciaW: num(fd, "potenciaW", 150),
      costoEquipo: num(fd, "costoEquipo", 0),
      depreciacionPorHora: num(fd, "depreciacionPorHora", 0),
      horasUso: num(fd, "horasUso", 0),
      disponible: fd.get("disponible") != null,
    },
  });
  revalidatePath("/impresoras");
  revalidatePath("/modelos");
  redirect("/impresoras");
}

// --- Enriquecer un modelo desde MakerWorld (opcional, NO destructivo) ---
// Solo rellena campos vacíos; nunca sobreescribe lo que ya tienes.
export async function enriquecerModelo(fd: FormData) {
  const id = str(fd, "id");
  const url = str(fd, "mwUrl");
  const datos = await fetchMakerWorld(url);
  if (!datos) {
    redirect(`/modelos/${id}?mw=fail`);
  }
  const actual = await prisma.modelo.findUnique({ where: { id } });
  if (!actual) redirect("/modelos");
  await prisma.modelo.update({
    where: { id },
    data: {
      fuente: "MakerWorld",
      urlFuente: actual!.urlFuente ?? url,
      creador: actual!.creador ?? datos!.creador ?? null,
      rating: actual!.rating ?? datos!.rating ?? null,
      popularidad: actual!.popularidad ?? datos!.popularidad ?? null,
    },
  });
  revalidatePath("/modelos");
  redirect(`/modelos/${id}?mw=ok`);
}

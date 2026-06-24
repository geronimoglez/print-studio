// Integración con la API de Mercado Libre (OAuth + lectura de órdenes + publicación).
import { prisma } from "@/lib/prisma";
import type { Modelo } from "@/generated/prisma/client";
import { costearModelo, type CosteoResultado } from "./costeo";
import { esAptoVenta } from "./licencias";
import { esPublicable } from "./riesgo";
import { getConfig } from "./datos";
import { getBranding } from "./branding";
import { construirTitulo, generarDescripcion, sanitizarDescripcion, asegurarMedidas, construirPayloadItem, construirPayloadCatalogo, pesoPaqueteG, PAQ, STOCK_ML_DEFAULT, type Atributo } from "./publicacion";
import {
  categoriaPorDominio,
  terminoCategoriaFallback,
  categoriaOverride,
  CATEGORIAS_PROHIBIDAS,
} from "./ml-categorias";
import { noEsImpresion3D } from "./filtro-calidad";
import { compararProductos } from "./vision";

const AUTH = "https://auth.mercadolibre.com.mx/authorization";
const API = "https://api.mercadolibre.com";
const PROVEEDOR = "mercadolibre";

function appId() {
  return process.env.ML_APP_ID ?? "";
}
function secret() {
  return process.env.ML_CLIENT_SECRET ?? "";
}
function redirectUri() {
  return process.env.ML_REDIRECT_URI ?? "";
}

/** URL a la que se manda al vendedor para autorizar la app (clic de Blas). */
export function urlAutorizacion(state = "lab3d"): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: appId(),
    redirect_uri: redirectUri(),
    state,
  });
  return `${AUTH}?${p.toString()}`;
}

type TokenResp = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number | string;
};

async function pedirToken(body: Record<string, string>): Promise<TokenResp> {
  const r = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(body).toString(),
  });
  if (!r.ok) throw new Error(`ML token ${r.status}: ${await r.text()}`);
  return (await r.json()) as TokenResp;
}

/** Intercambia el `code` del OAuth por tokens y los guarda. */
export async function intercambiarCodigo(code: string) {
  const t = await pedirToken({
    grant_type: "authorization_code",
    client_id: appId(),
    client_secret: secret(),
    code,
    redirect_uri: redirectUri(),
  });
  await guardarTokens(t, true);
  return t;
}

async function guardarTokens(t: TokenResp, conectando = false) {
  const expiraEn = new Date(Date.now() + (t.expires_in - 60) * 1000);
  const data = {
    mlUserId: String(t.user_id),
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiraEn,
    ...(conectando ? { conectadoEn: new Date() } : {}),
  };
  await prisma.integracion.upsert({
    where: { proveedor: PROVEEDOR },
    create: { proveedor: PROVEEDOR, ...data },
    update: data,
  });
}

export async function getIntegracion() {
  return prisma.integracion.findUnique({ where: { proveedor: PROVEEDOR } });
}

/** Devuelve un access token válido (refresca si está por expirar). null si no hay conexión. */
export async function getAccessTokenValido(): Promise<string | null> {
  const i = await getIntegracion();
  if (!i?.refreshToken) return null;
  if (i.accessToken && i.expiraEn && i.expiraEn.getTime() > Date.now()) return i.accessToken;
  const t = await pedirToken({
    grant_type: "refresh_token",
    client_id: appId(),
    client_secret: secret(),
    refresh_token: i.refreshToken,
  });
  await guardarTokens(t);
  return t.access_token;
}

async function mlGet(path: string, token: string) {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`ML GET ${path} → ${r.status}`);
  return r.json();
}

/**
 * Sincroniza órdenes pagadas de ML → tabla `Venta` (refresco simple).
 * Devuelve cuántas ventas quedaron. Requiere conexión (post-autorización).
 */
export async function sincronizarOrdenes(): Promise<{ ok: boolean; ventas: number; pedidos?: number; error?: string }> {
  try {
    const token = await getAccessTokenValido();
    const i = await getIntegracion();
    if (!token || !i?.mlUserId) return { ok: false, ventas: 0, error: "Mercado Libre no está conectado" };

    const data = await mlGet(
      `/orders/search?seller=${i.mlUserId}&order.status=paid&sort=date_desc&limit=50`,
      token,
    );
    const resultados: Array<Record<string, unknown>> = data.results ?? [];

    // Para estimar la carga de cada pedido (tiempo de impresión) cruzamos por nombre.
    const modelos = await prisma.modelo.findMany({ select: { nombre: true, tiempoImpresionMin: true } });
    const ventas: Array<{ mlItemId: string | null; fecha: Date; unidades: number; precio: number; visitas: number }> = [];
    let nPedidos = 0;

    for (const o of resultados) {
      const items = (o.order_items as Array<Record<string, unknown>>) ?? [];
      const fecha = new Date((o.date_created as string) ?? Date.now());
      const ship = (o.shipping ?? {}) as Record<string, unknown>;
      const shipStatus = String(ship.status ?? "");
      const ageDays = (Date.now() - fecha.getTime()) / 86400000;
      // Estado de cumplimiento derivado del envío / antigüedad (heurística hasta tener estado interno).
      let estado = "Vendido";
      if (shipStatus === "delivered" || ageDays > 10) estado = "Entregado";
      else if (shipStatus === "shipped" || shipStatus === "ready_to_ship") estado = "Impreso";
      const atendido = estado === "Entregado" || estado === "Impreso";
      const fechaLimite = new Date(fecha.getTime() + 5 * 86400000);

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const item = (it.item as Record<string, unknown>) ?? {};
        const titulo = String(item.title ?? "Producto");
        ventas.push({
          mlItemId: item.id ? String(item.id) : null,
          fecha,
          unidades: Number(it.quantity ?? 1),
          precio: Number(it.unit_price ?? 0),
          visitas: 0,
        });
        const tiempo =
          modelos.find((m) => titulo.toLowerCase().includes(m.nombre.toLowerCase()))?.tiempoImpresionMin ?? 120;
        const key = `${o.id}-${idx}`;
        // Find + update/create (preserva el estado interno si el pedido ya existe; no pisa avances manuales).
        const existente = await prisma.pedido.findFirst({ where: { mlOrderId: key } });
        if (existente) {
          await prisma.pedido.update({
            where: { id: existente.id },
            data: { modeloNombre: titulo, fechaVenta: fecha },
          });
        } else {
          await prisma.pedido.create({
            data: {
              mlOrderId: key,
              modeloNombre: titulo,
              tiempoImpresionMin: tiempo,
              estado,
              fechaVenta: fecha,
              fechaLimite,
              clienteAtendido: atendido,
            },
          });
        }
        nPedidos++;
      }
    }

    await prisma.venta.deleteMany();
    if (ventas.length) await prisma.venta.createMany({ data: ventas });
    // Limpia los pedidos demo (sin orden de ML) para que el tablero refleje SOLO datos reales.
    await prisma.pedido.deleteMany({ where: { mlOrderId: null } });

    return { ok: true, ventas: ventas.length, pedidos: nPedidos };
  } catch (e) {
    return { ok: false, ventas: 0, error: e instanceof Error ? e.message : "error desconocido" };
  }
}

// ===================== PUBLICACIÓN =====================

async function mlPost(path: string, token: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}
async function mlPut(path: string, token: string, body: unknown) {
  const r = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: r.ok, body: (await r.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Predictor de categoría de ML por título (la más probable, para mostrar en la vista previa). */
async function predecirCategoria(title: string, token: string): Promise<{ id: string; name?: string } | null> {
  const c = (await categoriasCandidatas(title, token))[0];
  return c ?? null;
}

/**
 * Resuelve la category_id para una publicación de CATÁLOGO (caso "dragón").
 * Cascada: (1) category_id directo del producto → (2) mapa confirmado domain_id→categoría →
 * (3) predictor con el NOMBRE del producto → (4) predictor con un TÉRMINO genérico de respaldo
 * derivado del nombre del modelo (lib/ml-categorias). Así, si el predictor no reconoce el nombre
 * específico del producto de catálogo, igual conseguimos una categoría válida.
 */
async function categoriaParaCatalogo(
  catalogProductId: string,
  modelo: Modelo,
  token: string,
): Promise<string | undefined> {
  let prod: { category_id?: string; domain_id?: string; name?: string } = {};
  try {
    prod = (await mlGet(`/products/${catalogProductId}`, token)) as typeof prod;
  } catch {
    /* ignore */
  }
  if (prod?.category_id) return prod.category_id;
  const porDominio = categoriaPorDominio(prod?.domain_id);
  if (porDominio) return porDominio;
  if (prod?.name) {
    const p = await predecirCategoria(prod.name, token);
    if (p?.id) return p.id;
  }
  // Respaldo: término genérico que el predictor sí reconoce.
  const termino = terminoCategoriaFallback(modelo.nombre, modelo.categoria);
  const p2 = await predecirCategoria(termino, token);
  return p2?.id ?? undefined;
}

/** Varias categorías sugeridas por el predictor (la primera = más probable). */
async function categoriasCandidatas(title: string, token: string): Promise<Array<{ id: string; name?: string }>> {
  try {
    const data = await mlGet(`/sites/MLM/domain_discovery/search?limit=8&q=${encodeURIComponent(title)}`, token);
    if (!Array.isArray(data)) return [];
    return data
      .map((d: Record<string, unknown>) => ({ id: d.category_id as string, name: d.category_name as string }))
      .filter((c) => !!c.id);
  } catch {
    return [];
  }
}

/**
 * Elige la primera categoría (la fija del modelo, o de las sugeridas) que PASE /items/validate.
 * Así evita las de catálogo-obligatorio (que piden family_name) sin tener que detectarlas a mano.
 * Devuelve la categoría + el payload ya validado, listo para publicar.
 */
async function elegirCategoriaPublicable(
  modelo: Modelo,
  costeo: CosteoResultado,
  token: string,
): Promise<{
  ok: boolean;
  categoriaId?: string;
  categoriaNombre?: string;
  payload?: Record<string, unknown>;
  error?: string;
  detalle?: unknown;
}> {
  const title = construirTitulo(modelo);
  let candidatos: Array<{ id: string; name?: string }>;
  if (modelo.mlCategoriaId) {
    candidatos = [{ id: modelo.mlCategoriaId }];
  } else {
    // Predecir con un TÉRMINO LIMPIO del producto (no el título de marketing): el título
    // lleva "Impresión 3D" y el predictor lo manda a "Impresoras 3D" (vender impresoras).
    // El término limpio apunta a la categoría real del producto. Título queda de respaldo.
    const queryCat = terminoCategoriaFallback(modelo.nombre, modelo.categoria ?? undefined);
    const limpios = await categoriasCandidatas(queryCat, token);
    const porTitulo = await categoriasCandidatas(title, token);
    const vistos = new Set<string>();
    candidatos = [...limpios, ...porTitulo].filter((c) => c.id && !vistos.has(c.id) && vistos.add(c.id));
    // Override: familias donde el predictor choca con la moderación → anteponer la categoría que ML acepta.
    const ov = categoriaOverride(modelo.nombre);
    if (ov && !candidatos.some((c) => c.id === ov.categoriaId)) {
      candidatos = [{ id: ov.categoriaId, name: ov.nombre }, ...candidatos];
    }
  }
  // Excluir categorías que la moderación de ML prohíbe para anuncios libres (las anula post-publicación).
  candidatos = candidatos.filter((c) => !CATEGORIAS_PROHIBIDAS.has(c.id));
  if (candidatos.length === 0) return { ok: false, error: "No se encontró categoría para este título." };

  let ultimo: unknown = null;
  for (const c of candidatos) {
    try {
      const cat = (await mlGet(`/categories/${c.id}`, token)) as { settings?: { listing_allowed?: boolean } };
      if (cat?.settings?.listing_allowed === false) continue; // categoría que no permite listar
    } catch {
      /* si no se puede leer, intentamos validar igual */
    }
    let atributos = await atributosMinimos(c.id, token, title, modelo);
    let res = await intentarValidar(c.id, title, modelo, costeo, atributos, token);
    // Bucle: si ML reporta atributos faltantes, los rellenamos (valor permitido) y reintentamos.
    let intentos = 0;
    while (!res.ok && intentos < 2) {
      const faltan = atributosFaltantes(res.body);
      if (!faltan.length) break;
      const extra = await rellenarFaltantes(c.id, faltan, modelo, token);
      if (!extra.length) break;
      const ids = new Set(atributos.map((a) => a.id));
      atributos = [...atributos, ...extra.filter((a) => !ids.has(a.id))];
      res = await intentarValidar(c.id, title, modelo, costeo, atributos, token);
      intentos++;
    }
    if (res.ok) return { ok: true, categoriaId: c.id, categoriaNombre: c.name, payload: res.payload };
    ultimo = res.body;
  }
  return { ok: false, error: "Ninguna categoría sugerida pasó la validación de ML.", detalle: ultimo };
}

type AttrML = {
  id: string;
  value_type?: string;
  tags?: Record<string, unknown>;
  values?: Array<{ id?: string; name?: string }>;
  default_unit?: string;
  allowed_units?: Array<{ id?: string }>;
};

function norm(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Candidatos de valor para atributos tipo lista (COLOR, MATERIAL), derivados del modelo. */
function candidatosLista(attrId: string, modelo: Modelo): string[] {
  const id = attrId.toUpperCase();
  if (/MATERIAL/.test(id)) {
    const fil = (modelo.tipoFilamento || "PLA").toUpperCase();
    const map: Record<string, string[]> = {
      PLA: ["Plástico", "PLA"],
      PETG: ["Plástico", "PETG"],
      ABS: ["Plástico", "ABS"],
      TPU: ["Plástico", "TPU", "Goma"],
      ASA: ["Plástico", "ASA"],
    };
    return [...(map[fil] ?? []), "Plástico", "Plastico"]; // "Plástico" es el valor casi universal en ML
  }
  if (/COLOR/.test(id)) {
    return modelo.multicolorAms ? ["Varios", "Multicolor"] : ["Negro", "Blanco"];
  }
  return [];
}

/** Elige un valor válido de la lista de la categoría: match por candidato → primer valor permitido. */
function elegirValorLista(attr: AttrML, modelo: Modelo): Atributo | null {
  const values = attr.values ?? [];
  const cands = candidatosLista(attr.id, modelo);
  for (const c of cands) {
    const nc = norm(c);
    const hit =
      values.find((v) => v.name && norm(v.name) === nc) ||
      values.find((v) => v.name && norm(v.name).includes(nc));
    if (hit?.name) return { id: attr.id, value_id: hit.id, value_name: hit.name };
  }
  // Respaldo: primer valor permitido (válido-genérico > requerido vacío) → valida en verde.
  if (values[0]?.name) return { id: attr.id, value_id: values[0].id, value_name: values[0].name };
  // Lista abierta (sin values): texto libre desde el candidato.
  if (!values.length && cands.length) return { id: attr.id, value_name: cands[0] };
  return null;
}

/**
 * Motor de auto-llenado de atributos REQUERIDOS para publicación LIBRE.
 * Llena BRAND, MODEL/FAMILY, listas (COLOR/MATERIAL con respaldo), number_unit (peso/medidas) y string.
 * Los atributos genuinamente inadivinables se dejan a ML (el humano los completa).
 */
async function atributosMinimos(
  categoriaId: string,
  token: string,
  title: string,
  modelo: Modelo,
): Promise<Atributo[]> {
  const out: Atributo[] = [];
  try {
    const attrs = (await mlGet(`/categories/${categoriaId}/attributes`, token)) as AttrML[];
    for (const a of attrs) {
      const tags = (a.tags ?? {}) as Record<string, unknown>;
      const req = !!(tags.required || tags.catalog_required);
      const rec = !!tags.recommended;
      // Requeridos SIEMPRE; recomendados cuando podemos inferir un valor confiable (marca/modelo/lista/
      // dimensiones). Así ML no pide "completa la ficha" tras publicar (waiting_for_patch).
      if (!req && !rec) continue;
      const id = a.id;
      const up = id.toUpperCase();
      const vt = a.value_type;
      if (up === "BRAND" || up === "MANUFACTURER") {
        out.push({ id, value_name: getBranding().mlSellerName });
      } else if (up === "MODEL" || up === "MODEL_NAME" || up === "FAMILY_NAME") {
        out.push({ id, value_name: modelo.nombre.slice(0, 60) });
      } else if (vt === "list" || vt === "boolean") {
        const v = elegirValorLista(a, modelo);
        if (v) out.push(v);
      } else if (vt === "number_unit") {
        const unit = a.default_unit ?? a.allowed_units?.[0]?.id ?? "cm";
        let number: number | undefined;
        if (/WEIGHT|PESO/.test(up)) number = pesoPaqueteG(modelo);
        else if (/HEIGHT|ALTO/.test(up)) number = PAQ.alto;
        else if (/WIDTH|ANCHO/.test(up)) number = PAQ.ancho;
        else if (/LENGTH|LARGO|DEPTH|PROF|DIAM/.test(up)) number = PAQ.largo;
        else if (req && unit === "cm") number = 10; // requerido numérico (cm) desconocido → default razonable, evita dejarlo vacío
        if (number != null) out.push({ id, value_struct: { number, unit } });
      } else if (vt === "string" && req) {
        out.push({ id, value_name: title.slice(0, 60) });
      }
    }
  } catch {
    /* si falla, ML reportará los faltantes */
  }
  return out;
}

/** Una respuesta de /items/validate con SOLO warnings (sin errores) igual se publicaría → la tratamos como verde. */
function soloWarnings(body: unknown): boolean {
  const causes = (body as { cause?: Array<{ type?: string }> } | null)?.cause;
  return Array.isArray(causes) && causes.length > 0 && causes.every((c) => c.type !== "error");
}

/** Extrae los IDs de atributos que ML reporta como faltantes (mensajes tipo "...[MIN_RECOMMENDED_AGE]..."). */
function atributosFaltantes(body: unknown): string[] {
  const causes = (body as { cause?: Array<{ code?: string; message?: string }> } | null)?.cause ?? [];
  const ids = new Set<string>();
  for (const c of causes) {
    if (!/missing/i.test(c.code ?? "")) continue;
    const m = (c.message ?? "").match(/\[([A-Z0-9_,\s]+)\]/); // solo IDs en MAYÚSCULAS (no seller_package_*)
    if (m) m[1].split(",").map((s) => s.trim()).filter(Boolean).forEach((id) => ids.add(id));
  }
  return [...ids];
}

/** Trae los valores permitidos de los atributos faltantes y los rellena (derivado del modelo / primer valor). */
async function rellenarFaltantes(
  categoriaId: string,
  ids: string[],
  modelo: Modelo,
  token: string,
): Promise<Atributo[]> {
  if (!ids.length) return [];
  const out: Atributo[] = [];
  try {
    const attrs = (await mlGet(`/categories/${categoriaId}/attributes`, token)) as AttrML[];
    const byId = new Map(attrs.map((a) => [a.id.toUpperCase(), a]));
    for (const id of ids) {
      const a = byId.get(id.toUpperCase());
      if (!a) continue;
      if (a.value_type === "list" || a.value_type === "boolean") {
        const v = elegirValorLista(a, modelo);
        if (v) out.push(v);
      } else if (a.value_type === "number_unit") {
        const unit = a.default_unit ?? a.allowed_units?.[0]?.id ?? "cm";
        const n = 10; // estimado neutro (ajustable luego por el humano)
        out.push({ id: a.id, value_name: `${n} ${unit}`, value_struct: { number: n, unit } });
      } else if (a.value_type === "number") {
        out.push({ id: a.id, value_name: "1" });
      } else {
        out.push({ id: a.id, value_name: modelo.nombre.slice(0, 60) });
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Valida un payload (con el reintento family_name si aplica). Acepta 204 o "solo warnings". */
async function intentarValidar(
  categoriaId: string,
  title: string,
  modelo: Modelo,
  costeo: CosteoResultado,
  atributos: Atributo[],
  token: string,
): Promise<{ ok: boolean; body: unknown; payload: Record<string, unknown> }> {
  const payload = construirPayloadItem({ modelo, costeo, categoriaId, title, atributos });
  const r = await mlPost("/items/validate", token, payload);
  if (r.ok || soloWarnings(r.body)) return { ok: true, body: r.body, payload };
  // Catálogo-obligatorio: ML pide family_name a nivel raíz y genera el título desde family + atributos.
  if (/family_name/i.test(JSON.stringify(r.body ?? {}))) {
    const payloadFam: Record<string, unknown> = { ...payload, family_name: title };
    delete payloadFam.title;
    const rf = await mlPost("/items/validate", token, payloadFam);
    if (rf.ok || soloWarnings(rf.body)) return { ok: true, body: rf.body, payload: payloadFam };
    return { ok: false, body: rf.body, payload: payloadFam };
  }
  return { ok: false, body: r.body, payload };
}

export type VistaPreviaPublicacion = {
  title: string;
  categoriaId: string | null;
  categoriaNombre?: string;
  precio: number;
  tiempoEntregaDias: number;
  descripcion: string;
  imagenes: string[];
  apto: boolean;
  faltantes: string[];
  yaPublicado: boolean;
  mlItemId: string | null;
};

/** Vista previa SIN publicar (para el copiloto). */
export async function previsualizarPublicacion(
  modeloId: string,
): Promise<{ ok: boolean; error?: string; preview?: VistaPreviaPublicacion }> {
  const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } });
  if (!modelo) return { ok: false, error: "Modelo no encontrado" };
  const config = await getConfig();
  const [filamentos, impresoras] = await Promise.all([
    prisma.filamento.findMany(),
    prisma.impresora.findMany(),
  ]);
  const costeo = costearModelo(modelo, config, filamentos, impresoras);
  const apto = esAptoVenta(modelo.licencia);
  const token = await getAccessTokenValido();
  let categoriaId = modelo.mlCategoriaId ?? null;
  let categoriaNombre: string | undefined;
  if (!categoriaId && token) {
    const pred = await predecirCategoria(construirTitulo(modelo), token);
    categoriaId = pred?.id ?? null;
    categoriaNombre = pred?.name;
  }
  const faltantes: string[] = [];
  if (!apto) faltantes.push("Bloqueado por licencia (no vendible)");
  if (!modelo.imagenes?.length) faltantes.push("Sin fotos");
  if (!categoriaId) faltantes.push("Sin categoría");
  if (!token) faltantes.push("Mercado Libre no conectado");

  return {
    ok: true,
    preview: {
      title: construirTitulo(modelo),
      categoriaId,
      categoriaNombre,
      precio: costeo.precioVenta,
      tiempoEntregaDias: costeo.tiempoEntregaDias,
      descripcion: modelo.descripcionMl ?? generarDescripcion(modelo),
      imagenes: modelo.imagenes ?? [],
      apto,
      faltantes,
      yaPublicado: modelo.publicadoMl && !!modelo.mlItemId,
      mlItemId: modelo.mlItemId,
    },
  };
}

/** Publica el modelo en ML (crea el item). Acción real — la dispara el humano o Hermes. */
export async function publicarModelo(
  modeloId: string,
): Promise<{ ok: boolean; mlItemId?: string; permalink?: string; error?: string; detalle?: unknown }> {
  const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } });
  if (!modelo) return { ok: false, error: "Modelo no encontrado" };
  if (!esPublicable(modelo.marcaIp, modelo.licencia))
    return { ok: false, error: "Bloqueado: es MARCA/IP de terceros (personaje o marca registrada). No se publica sin decisión explícita." };
  if (modelo.publicadoMl && modelo.mlItemId)
    return { ok: false, error: `Ya está publicado (${modelo.mlItemId}).` };
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "Mercado Libre no está conectado." };
  if (!modelo.imagenes?.length) return { ok: false, error: "Agrega al menos una foto antes de publicar." };

  const config = await getConfig();
  const [filamentos, impresoras] = await Promise.all([
    prisma.filamento.findMany(),
    prisma.impresora.findMany(),
  ]);
  const costeo = costearModelo(modelo, config, filamentos, impresoras);

  // Publicación de CATÁLOGO (enganchada a un producto del catálogo de ML).
  if (modelo.mlCatalogProductId) {
    // Guard de calidad del enganche a catálogo. Dos capas:
    //  1) por NOMBRE (barato): el producto no debe ser de un material no-3D (peluche, hierro…).
    //  2) VISUAL (VLM): nuestra foto impresa vs la del catálogo → ¿es el MISMO objeto?
    try {
      const prod = (await mlGet(`/products/${modelo.mlCatalogProductId}`, token)) as {
        name?: string;
        pictures?: Array<{ url?: string; secure_url?: string }>;
      };
      const s = noEsImpresion3D(prod?.name);
      if (s.sospechoso)
        return {
          ok: false,
          error: `El producto de catálogo "${prod?.name ?? modelo.mlCatalogProductId}" parece NO ser un impreso 3D (${s.razon}). Revisa la foto y confirma, o desengancha el catálogo antes de publicar.`,
        };
      // Capa visual: comparar nuestra foto local contra la del producto de catálogo.
      const base = getBranding().appUrl;
      const fotoLocalRel = modelo.imagenes?.find((u) => !!u);
      const fotoLocal = fotoLocalRel
        ? fotoLocalRel.startsWith("http")
          ? fotoLocalRel
          : `${base}${fotoLocalRel}`
        : undefined;
      const fotoCatalogo = prod?.pictures?.[0]?.secure_url ?? prod?.pictures?.[0]?.url;
      const vis = await compararProductos(fotoLocal, fotoCatalogo);
      if (vis.evaluado && vis.mismo === false)
        return {
          ok: false,
          error: `La foto del catálogo "${prod?.name ?? ""}" NO parece el mismo objeto que tu modelo (${vis.razon ?? "verificación visual"}). Revisa ambas fotos y confirma, o desengancha el catálogo antes de publicar.`,
        };
    } catch {
      /* si no se puede leer/comparar, seguimos con el flujo normal (no bloquea) */
    }
    const categoriaId = await categoriaParaCatalogo(modelo.mlCatalogProductId, modelo, token);
    const payload = construirPayloadCatalogo({
      modelo,
      costeo,
      catalogProductId: modelo.mlCatalogProductId,
      categoriaId,
    });
    const rc = await mlPost("/items", token, payload);
    if (!rc.ok)
      return { ok: false, error: "Mercado Libre rechazó la publicación de catálogo.", detalle: rc.body };
    const idc = rc.body.id as string;
    // publicado = validado: el ciclo queda Pendiente → Validado (publicado) | Rechazado (descartado).
    await prisma.modelo.update({ where: { id: modeloId }, data: { mlItemId: idc, publicadoMl: true, estadoValidacion: "Validado", mlPermalink: (rc.body.permalink as string) ?? null } });
    return { ok: true, mlItemId: idc, permalink: rc.body.permalink as string | undefined };
  }

  const elec = await elegirCategoriaPublicable(modelo, costeo, token);
  if (!elec.ok || !elec.payload || !elec.categoriaId)
    return { ok: false, error: elec.error ?? "No se pudo preparar la publicación.", detalle: elec.detalle };

  const r = await mlPost("/items", token, elec.payload);
  if (!r.ok) return { ok: false, error: "Mercado Libre rechazó la publicación.", detalle: r.body };

  const itemId = r.body.id as string;
  const permalink = r.body.permalink as string | undefined;
  const desc = sanitizarDescripcion(asegurarMedidas(modelo.descripcionMl ?? generarDescripcion(modelo), modelo));
  await mlPost(`/items/${itemId}/description`, token, { plain_text: desc }).catch(() => null);

  await prisma.modelo.update({
    where: { id: modeloId },
    data: { mlItemId: itemId, publicadoMl: true, mlCategoriaId: elec.categoriaId, estadoValidacion: "Validado", mlPermalink: permalink ?? null },
  });
  return { ok: true, mlItemId: itemId, permalink };
}

/** Actualiza precio/stock o pausa una publicación existente (payload válido, no solo precio). */
export async function actualizarPublicacion(
  modeloId: string,
  opts?: { pausar?: boolean; activar?: boolean },
): Promise<{ ok: boolean; error?: string; detalle?: unknown }> {
  const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } });
  if (!modelo?.mlItemId) return { ok: false, error: "El modelo no está publicado." };
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "Mercado Libre no conectado." };

  const config = await getConfig();
  const [filamentos, impresoras] = await Promise.all([
    prisma.filamento.findMany(),
    prisma.impresora.findMany(),
  ]);
  const costeo = costearModelo(modelo, config, filamentos, impresoras);
  const payload: Record<string, unknown> = {
    price: Math.max(1, Math.round(costeo.precioVenta)),
    available_quantity: STOCK_ML_DEFAULT,
  };
  if (opts?.pausar) payload.status = "paused";
  if (opts?.activar) payload.status = "active";

  const r = await mlPut(`/items/${modelo.mlItemId}`, token, payload);
  if (!r.ok) return { ok: false, error: "Mercado Libre rechazó la actualización.", detalle: r.body };
  return { ok: true };
}

/** Valida la publicación contra ML SIN crear el anuncio (POST /items/validate → 204 si OK). */
export async function validarPublicacion(
  modeloId: string,
): Promise<{ ok: boolean; valido?: boolean; error?: string; detalle?: unknown }> {
  const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } });
  if (!modelo) return { ok: false, error: "Modelo no encontrado" };
  if (!esPublicable(modelo.marcaIp, modelo.licencia)) return { ok: false, error: "Bloqueado: MARCA/IP de terceros." };
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "Mercado Libre no conectado." };
  if (!modelo.imagenes?.length) return { ok: false, error: "Agrega al menos una foto." };

  const config = await getConfig();
  const [filamentos, impresoras] = await Promise.all([
    prisma.filamento.findMany(),
    prisma.impresora.findMany(),
  ]);
  const costeo = costearModelo(modelo, config, filamentos, impresoras);
  if (modelo.mlCatalogProductId) {
    const categoriaId = await categoriaParaCatalogo(modelo.mlCatalogProductId, modelo, token);
    const payload = construirPayloadCatalogo({
      modelo,
      costeo,
      catalogProductId: modelo.mlCatalogProductId,
      categoriaId,
    });
    const rc = await mlPost("/items/validate", token, payload);
    if (rc.ok) return { ok: true, valido: true };
    return { ok: true, valido: false, detalle: rc.body };
  }
  const elec = await elegirCategoriaPublicable(modelo, costeo, token);
  if (elec.ok) {
    // Guardamos la categoría que SÍ valida, para que publicar sea directo y consistente.
    if (elec.categoriaId && elec.categoriaId !== modelo.mlCategoriaId) {
      await prisma.modelo.update({ where: { id: modeloId }, data: { mlCategoriaId: elec.categoriaId } }).catch(() => null);
    }
    return { ok: true, valido: true };
  }
  console.error("ML /items/validate rechazó:", JSON.stringify(elec.detalle));
  return { ok: true, valido: false, detalle: elec.detalle ?? { message: elec.error } };
}

/** Predictor público (para reportes/diagnóstico): top categoría sugerida por ML para una consulta. */
export async function predecirCategoriaPublica(
  q: string,
): Promise<{ id: string; name?: string } | null> {
  const token = await getAccessTokenValido();
  if (!token) return null;
  return predecirCategoria(q, token);
}

/** Diagnóstico: para una consulta, dice cuáles categorías sugeridas permiten publicación LIBRE. */
export async function diagnosticarCategorias(q: string): Promise<{
  ok: boolean;
  categorias?: Array<{ id: string; name?: string; listingAllowed?: boolean; libre: boolean; nota: string }>;
  error?: string;
}> {
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "Mercado Libre no conectado" };
  const candidatos = await categoriasCandidatas(q, token);
  const categorias: Array<{ id: string; name?: string; listingAllowed?: boolean; libre: boolean; nota: string }> = [];
  for (const c of candidatos) {
    let listingAllowed: boolean | undefined;
    let nombre = c.name;
    try {
      const cat = (await mlGet(`/categories/${c.id}`, token)) as {
        name?: string;
        settings?: { listing_allowed?: boolean };
      };
      listingAllowed = cat?.settings?.listing_allowed;
      nombre = nombre ?? cat?.name;
    } catch {
      /* ignore */
    }
    const payload = {
      title: q.slice(0, 60),
      category_id: c.id,
      price: 199,
      currency_id: "MXN",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      listing_type_id: "bronze",
      condition: "new",
      pictures: [{ source: "https://picsum.photos/seed/diag/800/800" }],
    };
    const r = await mlPost("/items/validate", token, payload);
    const body = r.body as { cause?: Array<{ message?: string }>; error?: string };
    const esCatalogo = /family_name/.test(JSON.stringify(body ?? {}));
    categorias.push({
      id: c.id,
      name: nombre,
      listingAllowed,
      libre: !esCatalogo,
      nota: r.ok
        ? "VALIDA OK"
        : esCatalogo
          ? "catálogo obligatorio"
          : (body?.cause?.[0]?.message || body?.error || "otros ajustes").slice(0, 90),
    });
  }
  return { ok: true, categorias };
}

/** Diagnóstico: trae las publicaciones reales de Blas para ver cómo están armadas (categoría, catálogo, tipo). */
export async function misItems(): Promise<{
  ok: boolean;
  items?: Array<Record<string, unknown>>;
  error?: string;
}> {
  const token = await getAccessTokenValido();
  const i = await getIntegracion();
  if (!token || !i?.mlUserId) return { ok: false, error: "Mercado Libre no conectado" };
  try {
    const search = (await mlGet(`/users/${i.mlUserId}/items/search?limit=6`, token)) as { results?: string[] };
    const ids = search.results ?? [];
    const items: Array<Record<string, unknown>> = [];
    for (const id of ids.slice(0, 6)) {
      try {
        const it = (await mlGet(`/items/${id}`, token)) as Record<string, unknown>;
        let categoriaNombre: string | undefined;
        try {
          const cat = (await mlGet(`/categories/${it.category_id}`, token)) as { name?: string };
          categoriaNombre = cat?.name;
        } catch {
          /* ignore */
        }
        items.push({
          id: it.id,
          title: it.title,
          category_id: it.category_id,
          categoria: categoriaNombre,
          catalog_listing: it.catalog_listing,
          catalog_product_id: it.catalog_product_id,
          listing_type_id: it.listing_type_id,
          condition: it.condition,
          status: it.status,
          permalink: it.permalink,
        });
      } catch {
        /* ignore */
      }
    }
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

/** Inspecciona un producto del catálogo para ver su estructura (dónde viene category_id). */
export async function inspeccionarProducto(id: string): Promise<Record<string, unknown>> {
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "no conectado" };
  try {
    const p = (await mlGet(`/products/${id}`, token)) as Record<string, unknown>;
    return {
      ok: true,
      category_id: p.category_id,
      domain_id: p.domain_id,
      name: p.name,
      buy_box_winner: p.buy_box_winner,
      settings: p.settings,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

/** Busca productos en el CATÁLOGO de ML (para publicación de catálogo). */
export type ProductoCatalogo = {
  id: string;
  name: string;
  domain_id?: string;
  status?: string;
  foto?: string;
  marca?: string;
  modelo?: string;
  sospechoso?: boolean; // el nombre apunta a algo que NO es impresión 3D (peluche, hierro, vinil…)
  razonSospecha?: string;
};

export async function buscarCatalogo(q: string): Promise<{
  ok: boolean;
  productos?: ProductoCatalogo[];
  error?: string;
}> {
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, error: "Mercado Libre no conectado" };
  try {
    const data = (await mlGet(
      `/products/search?site_id=MLM&status=active&q=${encodeURIComponent(q)}`,
      token,
    )) as { results?: Array<Record<string, unknown>> };
    const results = (data.results ?? []).slice(0, 8);
    // Enriquecer cada candidato con su FOTO + marca/modelo (para comparar visualmente y NO romper reglas).
    const productos = await Promise.all(
      results.map(async (p) => {
        const base: ProductoCatalogo = {
          id: String(p.id),
          name: String(p.name ?? ""),
          domain_id: p.domain_id as string | undefined,
          status: p.status as string | undefined,
        };
        try {
          const full = (await mlGet(`/products/${p.id}`, token)) as {
            pictures?: Array<{ url?: string; secure_url?: string }>;
            attributes?: Array<{ id?: string; value_name?: string }>;
          };
          base.foto = full.pictures?.[0]?.secure_url ?? full.pictures?.[0]?.url;
          base.marca = full.attributes?.find((a) => a.id === "BRAND")?.value_name;
          base.modelo = full.attributes?.find((a) => a.id === "MODEL")?.value_name;
        } catch {
          /* si falla, se muestra sin foto */
        }
        // Filtro de calidad: ¿el nombre del producto de catálogo apunta a algo que no es impreso 3D?
        const s = noEsImpresion3D(`${base.name} ${base.marca ?? ""}`);
        base.sospechoso = s.sospechoso;
        base.razonSospecha = s.razon;
        return base;
      }),
    );
    // Mostrar primero los compatibles; los sospechosos (peluche/hierro/vinil…) al final.
    productos.sort((a, b) => Number(a.sospechoso ?? false) - Number(b.sospechoso ?? false));
    return { ok: true, productos };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "error" };
  }
}

/**
 * Sincroniza el ESTADO de salud (active/paused/under_review/closed + sub_status) de todos los anuncios
 * publicados, usando el multiget de ML (/items?ids=...). Guarda mlEstado/mlSubEstado/mlEstadoAt en cada
 * Modelo. Alimenta el panel /salud. Devuelve la distribución por estado.
 */
export async function sincronizarEstatusMl(): Promise<{ ok: boolean; actualizados: number; dist: Record<string, number>; error?: string }> {
  const token = await getAccessTokenValido();
  if (!token) return { ok: false, actualizados: 0, dist: {}, error: "Mercado Libre no conectado" };
  const modelos = await prisma.modelo.findMany({ where: { publicadoMl: true, mlItemId: { not: null } }, select: { id: true, mlItemId: true } });
  const porItem = new Map(modelos.map((m) => [m.mlItemId as string, m.id]));
  const ids = [...porItem.keys()];
  const dist: Record<string, number> = {};
  let actualizados = 0;
  const ahora = new Date();
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20);
    try {
      const r = await fetch(`https://api.mercadolibre.com/items?ids=${lote.join(",")}&attributes=id,status,sub_status,permalink`, { headers: { Authorization: `Bearer ${token}` } });
      const arr = (await r.json()) as Array<{ code?: number; body?: { id?: string; status?: string; sub_status?: unknown; permalink?: string } }>;
      for (const it of arr) {
        const b = it.body;
        if (!b?.id) continue;
        const modeloId = porItem.get(b.id);
        if (!modeloId) continue;
        const estado = b.status ?? null;
        const sub = Array.isArray(b.sub_status) ? (b.sub_status as string[]).join(",") : "";
        const clave = sub ? `${estado} [${sub}]` : estado ?? "?";
        dist[clave] = (dist[clave] ?? 0) + 1;
        await prisma.modelo.update({ where: { id: modeloId }, data: { mlEstado: estado, mlSubEstado: sub || null, mlEstadoAt: ahora, ...(b.permalink ? { mlPermalink: b.permalink } : {}) } });
        actualizados++;
      }
    } catch { /* sigue con el resto */ }
  }
  return { ok: true, actualizados, dist };
}

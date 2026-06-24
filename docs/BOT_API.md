# Contrato del bot (`/api/bot/*`)

Este documento describe el **contrato HTTP** que un bot (Telegram u otro canal) usa para operar el sistema.
El bot **no vive en este repositorio**: es un cliente externo que llama estos endpoints. Así, cada
despliegue conecta su propio bot con su propia clave. (Modelos de hosting del bot y recomendaciones: ver
la sección final.)

## Autenticación

Todos los endpoints `/api/bot/*` requieren la cabecera:

```
x-bot-key: <BOT_API_KEY>
```

donde `BOT_API_KEY` es la variable de entorno del servidor. Sin ella (o si no coincide) responden
`401 { "ok": false, "error": "no autorizado" }`. El worker de webhooks `/api/ml/procesar` acepta además
`Authorization: Bearer <CRON_SECRET>` para cron.

Base URL = `NEXT_PUBLIC_APP_URL` (p. ej. `https://tu-dominio` o `http://localhost:3000`).

> En SaaS multi-tenant, `BOT_API_KEY` global se reemplaza por **claves por tenant** (tabla `ApiKey`,
> revocables) sin cambiar la cabecera ni los endpoints. Ver la capa overlay.

## Convención de respuesta

JSON con `{ "ok": true, ... }` en éxito o `{ "ok": false, "error": "..." }` en fallo.

## Endpoints

### Aprobación / revisión (flujo "aprobar por Telegram")

| Método | Ruta | Cuerpo | Qué hace |
|---|---|---|---|
| `GET` | `/api/bot/lote-revision` | query: `?incluirRojo=1`, `?fuente=...` | Devuelve el lote PENDIENTE + publicable (no 🔴) que aún no está en ML, numerado y con nivel 🟢🟡🔴, para mostrarlo al usuario. Solo lectura. |
| `POST` | `/api/bot/aprobar` | `{ "publicarIds": string[], "descartarIds": string[] }` | Publica los `publicarIds` (gate _fail-closed_: un 🔴 nunca se publica) y marca `Rechazado` los `descartarIds`. Devuelve `{ publicados, descartados, resumen }`. |
| `GET` | `/api/bot/resumen` | — | Resumen del catálogo (conteos, KPIs). |

### Publicación / mantenimiento de anuncios

| Método | Ruta | Qué hace |
|---|---|---|
| `POST` | `/api/bot/publicar` | Publica modelo(s) en Mercado Libre. |
| `POST` | `/api/bot/actualizar` | Actualiza una publicación existente. |
| `POST` | `/api/bot/validar` | Valida un anuncio contra ML (pre-publicación). |
| `POST` | `/api/bot/recorregir` | Re-corrige/parcha un anuncio reportado. |
| `GET`  | `/api/bot/sync-estatus` | Refresca el estatus de salud de todos los anuncios. |
| `GET`  | `/api/bot/sync` | Sincroniza órdenes de ML → Pedidos. |

### IA / contenido

| Método | Ruta | Cuerpo | Qué hace |
|---|---|---|---|
| `POST` | `/api/bot/clasificar-vision` | `{ "solo"?: string[], "limit"?: number }` | Corre el VLM sobre las fotos para detectar IP que el nombre no ve; pausa en ML lo que deje de ser publicable. |
| `POST` | `/api/bot/mejorar-descripcion` | `{ "solo"?: string[], "limit"?: number, "soloVacias"?: boolean }` | Genera/mejora descripciones con IA y las sincroniza a ML (solo descripción → no re-modera). |
| `POST` | `/api/bot/limpiar-watermarks` | `{ "solo"?: string[], "limit"?: number }` | Reporta (no borra) fotos sospechosas de marca de agua, para revisión. |

### Consulta (read-only)

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/bot/modelo` | Datos de un modelo. |
| `GET` | `/api/bot/catalogo` | Búsqueda en el catálogo. |
| `GET` | `/api/bot/categorias` | Categorías de ML. |
| `GET` | `/api/bot/mis-items` | Publicaciones del vendedor. |
| `GET` | `/api/bot/producto` | Producto del catálogo de ML. |

### Webhooks / worker (Mercado Libre)

| Método | Ruta | Auth | Qué hace |
|---|---|---|---|
| `POST` | `/api/ml/callbacknotice` | (sin auth, por diseño) | Recibe webhooks de ML y los encola (`Notificacion`). |
| `POST`/`GET` | `/api/ml/procesar` | `x-bot-key` **o** `Bearer CRON_SECRET` | Procesa la cola: sincroniza órdenes y revisa estatus; alerta por Telegram. |

> Los **cuerpos exactos** de cada endpoint son la fuente de verdad en `src/app/api/bot/*/route.ts`.

## Modelos de hosting del bot (recomendación)

1. **Solo contrato (BYO-bot)** — cada quien conecta su propio bot y token. Riesgo/costo para el operador del
   software: nulo. **Recomendado para empezar.**
2. **Bot de referencia self-host** — publicar un bot que el usuario corra con SUS llaves de Telegram e IA
   (los costos son suyos).
3. **Bot gestionado (SaaS de pago)** — el operador lo corre y paga IA/Telegram. Mayor upside comercial pero
   mayor exposición a costos/abuso. Habilitar **solo** con guardarraíles: claves por tenant revocables,
   **cuotas/topes de gasto por plan**, rate-limiting + idempotencia (anti-loops), opción "trae tu propia
   llave de IA" y kill-switch.

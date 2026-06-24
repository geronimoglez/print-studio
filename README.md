<!-- El nombre "Taller 3D" es un placeholder de marca: es 100% personalizable (white-label) en el
     asistente /setup, sin tocar código. Renómbralo libremente. -->
# Taller 3D — Catálogo, costeo y venta para impresión 3D

Plataforma web **open source** para un taller de **impresión 3D bajo demanda**: importa modelos, calcula
su **costeo** real, controla el **riesgo legal (IP + licencia)** con un semáforo 🟢🟡🔴, publica en
**Mercado Libre** con descripciones generadas por IA, y monitorea la **salud** de los anuncios — todo
operable por una persona no técnica, desde el navegador o por un bot.

✨ **White-label de fábrica:** al primer arranque, un asistente (`/setup`) te deja poner tu **nombre,
logo y colores** — a mano o **generados con IA** (fal.ai, OpenAI o Claude, con tu propio token). Sin tocar código.

> ⚠️ Este repositorio contiene **solo el software**. No incluye modelos 3D, mallas ni imágenes de
> catálogo. No está afiliado a Mercado Libre, BambuLab/MakerWorld ni a ninguna marca mencionada.

---

## Qué hace

- **Catálogo + costeo en vivo.** Cada modelo calcula costo (filamento + luz + depreciación + mano de
  obra + post-proceso + tasa de fallos), precio (markup + comisión + envío), margen y **rentabilidad por
  hora-impresora**. Cambiar la config recalcula todo el catálogo.
- **Semáforo de riesgo legal (pieza central).** Capa 1 — **IP**: ¿marca/personaje de terceros? (por
  nombre en `lib/riesgo.ts` y por **visión** con un VLM). Capa 2 — **Licencia** del archivo
  (`lib/licencias.ts`). Combinadas: 🟢 limpio + licencia comercial · 🟡 limpio, licencia restringida ·
  🔴 marca/IP (bloqueado, _fail-closed_).
- **Publicación a Mercado Libre** con auto-atributos, predicción de categoría, fotos/video y
  descripciones de venta generadas por IA que mira la foto.
- **Aprobación por lote** (`/revision`) por UI o por bot (mismo backend).
- **Salud de anuncios** (`/salud`) + notificaciones tipo digest.
- **Importador self-serve** (`/importar`): subes un ZIP → crea los modelos solos.
- **Marca personalizable (white-label)** + asistente de configuración con IA opcional.

## Stack

| Capa | Tecnología |
|---|---|
| Web + API | **Next.js 16** (App Router, Server Actions) |
| Datos | **Prisma 7** (driver adapter `pg`) + **PostgreSQL** |
| Assets | **Vercel Blob** o **filesystem local** (`public/`) — intercambiable |
| IA / Visión | **OpenRouter / OpenAI / Anthropic** (texto) · **fal.ai / OpenAI** (imágenes) — todo opcional |
| Marketplace | **Mercado Libre API** |
| Bot | gateway HTTP externo (header `x-bot-key`) — ver [`docs/BOT_API.md`](./docs/BOT_API.md) |
| UI | Tailwind CSS v4 |

---

## Arranque rápido (Docker)

```bash
cp .env.example .env        # rellena lo que uses (solo DATABASE_URL es obligatoria si NO usas Docker)
docker compose up --build   # levanta Postgres + la app, aplica migraciones
# abre http://localhost:3000  → te lleva al asistente /setup
```

## Desarrollo local (sin Docker)

Necesitas un **PostgreSQL** accesible (local o en la nube).

```bash
npm install
cp .env.example .env                 # define DATABASE_URL (local: ...?sslmode=disable)
npx prisma migrate deploy            # crea/actualiza el esquema
npm run dev                          # http://localhost:3000
npm run build                        # build de producción + chequeo de tipos
npm test                             # test del motor de costeo
```

### Variables de entorno

Todas están documentadas en [`.env.example`](./.env.example). Solo `DATABASE_URL` es obligatoria; el
resto es por integración y **degrada con gracia** (sin IA → manual/plantillas; sin Blob → `public/`; sin
Telegram → no alerta). La **marca** (`BRAND_*`) puede fijarse por env o editarse en `/setup`.

---

## Documentación

- [`DEPLOY.md`](./DEPLOY.md) — despliegue (Docker self-host y Vercel).
- [`docs/BOT_API.md`](./docs/BOT_API.md) — contrato HTTP del bot (`/api/bot/*`).
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — cómo contribuir (incluye el CLA).
- [`SECURITY.md`](./SECURITY.md) — reporte de vulnerabilidades y nota de seguridad del modo self-host.
- [`docs/legal/`](./docs/legal/) — plantillas de Términos, Uso Aceptable y Descargo.

## Arquitectura open-core

El repo público es la app **single-tenant auto-hospedable**. Las capas de **multi-tenant, autenticación
y cobros** (SaaS) se montan aparte sobre "costuras" (`src/lib/{tenant,auth,bot-auth,secretos,db}.ts`) sin
modificar este código. Convención: el acceso a datos pasa por `@/lib/db` / `@/lib/datos` (ver `CONTRIBUTING.md`).

## Licencia

**GNU AGPL-3.0** (ver [`LICENSE`](./LICENSE) y [`NOTICE`](./NOTICE)). Si modificas el software y lo ofreces
como servicio de red, debes publicar el código fuente correspondiente (AGPL §13). Las marcas, productos de
terceros y datos de catálogo **no** forman parte de este repositorio.

# Despliegue

La base de datos es **PostgreSQL** y el cliente Prisma usa el driver adapter `@prisma/adapter-pg`
(sin engine nativo). Las migraciones viven en `prisma/migrations/`.

## Opción A — Self-host con Docker (recomendado para probar)

Incluye un PostgreSQL local; no necesitas Neon ni Vercel.

```bash
cp .env.example .env          # rellena lo que uses
docker compose up --build     # levanta db + app y aplica migraciones (prisma migrate deploy)
# http://localhost:3000 → asistente /setup
```

- El compose **sobreescribe `DATABASE_URL`** para apuntar a su Postgres (`db:5432`).
- El logo subido se persiste en el volumen `branding`. Para persistir TODAS las imágenes de catálogo,
  configura `BLOB_READ_WRITE_TOKEN` (Vercel Blob) o añade volúmenes para `public/import`, `public/render`.
- Sembrar datos de ejemplo: `SEED_ON_START=1` en `.env`.
- Imagen más liviana (opcional, avanzado): activar `output: "standalone"` en `next.config.ts` y ajustar
  el `Dockerfile`. Por defecto se usa `next start` con `node_modules` completo (más simple y robusto).

## Opción B — Vercel + Postgres gestionado (Neon)

1. Crea una base Postgres (p. ej. Neon) y copia su connection string a `DATABASE_URL` (con `?sslmode=require`).
2. Aplica el esquema una vez: `npx prisma migrate deploy` (apuntando a esa `DATABASE_URL`).
3. En Vercel: Root Directory = `sistema/`, e inyecta las variables de entorno (ver `.env.example`).
4. Deploy: `vercel deploy --prod` (build = `next build`; `postinstall` regenera el cliente Prisma).

> El render pipeline (Chromium headless + ffmpeg) NO corre en serverless: úsalo como CLI local/opcional
> (`scripts/`). El core (catálogo, costeo, ML, UI, white-label) funciona sin él.

## Migraciones (cambios de esquema)

```bash
# Desarrollo (crea una migración nueva contra una DB de desarrollo):
npx prisma migrate dev --name <descripcion>

# Producción / self-host (aplica las migraciones pendientes, sin generar nuevas):
npx prisma migrate deploy
```

Tras editar `prisma/schema.prisma`, regenera el cliente: `npx prisma generate` (también corre en `postinstall`).

## Migrar un despliegue existente al código nuevo (sin disrupción)

Para un sistema ya en uso (con datos reales) que actualiza a esta versión (white-label + i18n):

1. **Respalda / clona la base.** En Neon, crea una *branch* de la base de prod (copia instantánea). Apunta
   ahí primero para probar; la prod no se toca hasta validar.
2. **Verifica el estado de migraciones** contra esa copia:
   ```bash
   DATABASE_URL="<branch-neon>" npx prisma migrate status
   ```
   Si dice que faltan por aplicar solo las nuevas → todo bien. Si la base no tiene historial de migraciones
   (se creó con `db push`), primero baselínea las ya aplicadas con `prisma migrate resolve --applied <id>`.
3. **Aplica la migración** (es aditiva: solo agrega columnas a `Config`, no toca tus datos):
   ```bash
   DATABASE_URL="<branch-neon>" npx prisma migrate deploy
   ```
4. **Conserva la marca y evita el asistente.** En las variables del despliegue, define la marca por env y
   desactiva el wizard para no interrumpir:
   ```
   SKIP_SETUP=1
   BRAND_NAME="<tu marca>"
   BRAND_LOGO_URL="<url de tu logo>"     # el logo se sirve por URL (Blob o estático); ya no se versiona en el repo
   BRAND_COLOR_PRIMARY="#..."            # y los colores que uses
   NEXT_PUBLIC_APP_URL="https://<tu-dominio>"
   ```
   Así el sistema arranca directo al dashboard con tu marca, sin pasar por `/setup`. Tus datos
   (modelos, ventas, pedidos, etc.) quedan intactos: viven en la base, no en el código.
5. **Despliega y verifica** en la copia; si todo bien, repite los pasos 3–5 contra la base real (o promueve
   la branch). Riesgo de datos: nulo (migración aditiva); lo único ajustable es cosmético (marca por env).

## Checklist antes de publicar el repo como open source

- [ ] **Rotar** cualquier secreto que haya estado en `.env` (DB, Mercado Libre, Blob, IA, Firecrawl).
- [ ] Confirmar que `git ls-files` no incluye `.env`, bases de datos ni imágenes/STL con copyright.
- [ ] Reemplazar `public/logo.png` y `src/app/icon.png` por un placeholder neutro (la UI ya usa monograma
      por defecto; el icono PWA aún referencia `/icon.png`).
- [ ] Considerar empezar con **historia git nueva** (`git checkout --orphan`) para un repo público limpio.
- [ ] Completar los `<...>` en `docs/legal/*` y hacerlos revisar por un abogado antes de operar un SaaS.

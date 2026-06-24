#!/bin/sh
# Build de Vercel: aplica migraciones (con la conexión DIRECTA/no-pooled si existe) y luego compila.
# Hace que un despliegue nuevo (p.ej. con el botón "Deploy to Vercel" que provisiona Postgres) quede
# listo sin pasos manuales. En una DB ya migrada, `migrate deploy` es no-op (idempotente).
set -e

URL="${DATABASE_URL_UNPOOLED:-${POSTGRES_URL_NON_POOLING:-$DATABASE_URL}}"
if [ -n "$URL" ]; then
  echo "→ Aplicando migraciones (prisma migrate deploy)…"
  DATABASE_URL="$URL" npx prisma migrate deploy
else
  echo "→ Sin DATABASE_URL; omito migraciones."
fi

echo "→ next build"
npx next build

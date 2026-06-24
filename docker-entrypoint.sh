#!/bin/sh
set -e

echo "→ Aplicando migraciones de base de datos..."
npx prisma migrate deploy

if [ "${SEED_ON_START}" = "1" ]; then
  echo "→ Sembrando datos de ejemplo..."
  npm run seed || echo "  (seed falló; se ignora)"
fi

echo "→ Iniciando la aplicación en el puerto 3000..."
exec npx next start -p 3000

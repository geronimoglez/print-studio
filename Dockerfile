# Imagen self-host: Next.js 16 + Prisma 7 (driver adapter pg) + PostgreSQL.
# Ver DEPLOY.md. Multi-stage para no arrastrar herramientas de build al runtime.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Dependencias (cacheables)
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) Build (genera el cliente Prisma y compila Next)
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El cliente Prisma solo se CONSTRUYE en build (no conecta); una URL dummy basta y el branding
# cae a defaults si no hay DB. La DB real se inyecta en runtime (docker-compose / env).
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?sslmode=disable"
RUN npx prisma generate && npm run build

# 3) Runtime
FROM base AS runner
ENV NODE_ENV=production
RUN groupadd -r app && useradd -r -g app -m app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x docker-entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 3000
# Aplica migraciones y arranca (ver docker-entrypoint.sh).
CMD ["./docker-entrypoint.sh"]

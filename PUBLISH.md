# Publicar como open source + desplegar en Vercel

Guía paso a paso. El repo público = **el contenido de `sistema/`** (los packs/modelos del proyecto viven un
nivel arriba y quedan fuera por construcción).

## 0. Pre-vuelo (ya resuelto en el código)
- `.env` y bases de datos: **gitignored** (no se publican).
- Binarios de marca (`logo.png`, `icon.png`): **eliminados**; el ícono por defecto es `src/app/icon.svg` (neutro).
- Marca configurable (white-label) por env o en `/setup`.

Verifica que no se cuele nada sensible:
```bash
cd sistema
git add -A
git ls-files | grep -iE "\.env|\.db$|logo\.png|icon\.png" || echo "limpio ✓"
```

## 1. Secretos — qué hacer YA
El repo público NO llevará secretos (están en `.env`, ignorado). Aun así:
- Para el **nuevo despliegue público**, crea **credenciales nuevas** (no reutilices las de tu prod actual):
  una base Postgres nueva (paso 3) y, si las usas, llaves nuevas de IA/Mercado Libre/Blob.
- Como tus secretos actuales aparecieron en logs/conversación, por higiene **rótalos** en sus paneles:
  Neon (password de la DB), Mercado Libre (client secret), Vercel Blob (token), Firecrawl, OpenRouter.
  Rotar = generar uno nuevo y actualizar tu `.env` / variables de Vercel del proyecto viejo.

## 2. Historia git limpia + repo en GitHub
La historia actual tiene commits con la marca vieja. Publicamos con **historia nueva** (un solo commit):
```bash
cd sistema
git checkout --orphan oss      # rama nueva sin historia previa
git add -A
git commit -m "Initial open-source release"
```
Crea un repo **nuevo y vacío** en GitHub (sin README/licencia), copia su URL y:
```bash
git remote add oss https://github.com/<usuario>/<repo>.git
git push -u oss oss:main        # publica la rama 'oss' como 'main' en el repo nuevo
```
Tu rama `main` local (con la historia vieja) queda intacta y **no** se sube. Para volver a tu trabajo:
`git checkout main`.

## 3. Base de datos (Postgres nueva)
Crea un proyecto gratis en **Neon** (o Vercel Postgres) y copia el connection string (incluye `?sslmode=require`).
Aplica el esquema una vez:
```bash
DATABASE_URL="postgresql://...neon...?sslmode=require" npx prisma migrate deploy
```

## 4. Desplegar en Vercel
**Vía dashboard (recomendado):** Vercel → *Add New Project* → importa tu repo de GitHub →
- **Root Directory:** `.` (la raíz del repo ya ES la app).
- **Environment Variables:** al menos `DATABASE_URL`. Opcionales: `BRAND_NAME`, `NEXT_PUBLIC_APP_URL`
  (la URL que te dé Vercel), llaves de IA/ML/Blob (ver `.env.example`).
- Deploy.

**Vía CLI:**
```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production   # pega el string de Neon
vercel --prod
```

## 5. Post-despliegue
- Abre la URL de Vercel → te lleva al asistente **`/setup`** (primer arranque).
- Pon nombre, logo y colores (o genera con IA pegando tu token).
- Verifica `/` (dashboard) y el toggle de idioma (arriba a la derecha).

## 6. Checklist legal antes de operar comercialmente
- Completar los `<...>` de `docs/legal/{TERMS,ACCEPTABLE_USE,DISCLAIMER,PRIVACY}.md`.
- Revisión por abogado de los puntos `[revisar con abogado]` (privacidad, arbitraje, topes, consumidor).
- Activar el CLA (cla-assistant.io) en el repo si aceptarás contribuciones.

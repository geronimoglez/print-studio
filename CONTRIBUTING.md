# Cómo contribuir

¡Gracias por tu interés! Este proyecto es open source bajo **AGPL-3.0**.

## Acuerdo de Contribución (CLA)

Para que el proyecto pueda mantener flexibilidad de licenciamiento (incluida la posibilidad de ofrecer
una versión comercial/hospedada), las contribuciones requieren firmar un **CLA** (Contributor License
Agreement). El bot de [cla-assistant.io](https://cla-assistant.io) te pedirá la firma automáticamente en
tu primer Pull Request. Alternativamente, las contribuciones pueden requerir un `Signed-off-by`
([DCO](https://developercertificate.org)) — se indicará en el repositorio.

## Flujo

1. Abre un issue para discutir el cambio (sobre todo si es grande).
2. Crea una rama desde `main`.
3. Asegúrate de que pasa: `npm run build`, `npm run lint`, `npm test`.
4. Abre el PR (firma el CLA cuando se solicite).

## Convenciones del código

- **Acceso a datos por el choke point.** Importa `prisma` desde `@/lib/db` (o usa los helpers de
  `@/lib/datos`), **nunca** desde `@/lib/prisma` directamente — salvo en `lib/prisma.ts` y `lib/datos.ts`.
  Esto mantiene un único punto donde el overlay SaaS inyecta el scoping por tenant.
- **Costuras open-core.** No metas lógica de multi-tenant/auth/cobros en este repo. Usa las costuras
  (`@/lib/{tenant,auth,bot-auth,secretos,branding}`); su implementación real vive en el overlay privado.
- **Marca.** Nada de nombres/marcas hardcodeadas. Usa `@/lib/branding` (`getBranding` / `getBrandingResuelto`).
- **Secretos.** Pídelos vía `@/lib/secretos` (`secretoDe`), no leas `process.env` directo en libs de dominio.
- **i18n (en progreso).** Evita strings nuevos hardcodeados donde haya catálogos de mensajes.

## Notas de stack (Next 16 / Prisma 7)

Esta versión de Next tiene **breaking changes** respecto a versiones previas (Server Actions, convenciones
de archivos, `proxy.ts` en vez de `middleware.ts`, cliente Prisma en `src/generated/prisma`). La
documentación versionada de Next vive en `node_modules/next/dist/docs/` — léela antes de tocar APIs de framework.

## Reportar bugs / seguridad

Bugs normales: issues. Vulnerabilidades de seguridad: ver [`SECURITY.md`](./SECURITY.md) (reporte privado).

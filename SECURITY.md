# Política de seguridad

## Reportar una vulnerabilidad

Por favor **no** abras un issue público para vulnerabilidades. Repórtalas en privado a
`<correo de seguridad>` (o vía *GitHub Security Advisories* si el repo lo tiene habilitado). Incluye pasos
de reproducción y el impacto. Procuraremos responder en un plazo razonable y coordinar la divulgación.

## Nota importante sobre el modo self-host

La interfaz web de este software **no incluye autenticación multi-usuario** en su versión auto-hospedable
(single-tenant): está pensada para que un único negocio la opere.

- **Gate por contraseña (incluido).** Define `APP_PASSWORD` y **toda la instancia** queda detrás de una sola
  contraseña compartida (cookie firmada; ver `src/proxy.ts` y `src/lib/gate.ts`). Es la forma rápida de que la
  UI **no quede abierta a cualquiera**. Si lo dejas vacío, la app queda abierta (útil para una demo).
- Para entornos más exigentes, despliégala además detrás de una red privada, VPN o un reverse proxy con
  autenticación (Basic Auth / OAuth proxy / Cloudflare Access). **No expongas la UI sensible sin alguna de estas.**

- Los endpoints del bot (`/api/bot/*`) sí se protegen con el header `x-bot-key` == `BOT_API_KEY`.
- Los webhooks de Mercado Libre (`/api/ml/callbacknotice`) reciben sin auth por diseño (patrón
  "recibir y encolar"); no expongas datos sensibles en sus respuestas.
- Define un `BOT_API_KEY` y un `CRON_SECRET` fuertes si usas el bot o cron.

La autenticación multiusuario y el aislamiento por tenant son parte de la capa SaaS (overlay), no de este repo.

## Manejo de secretos

Nunca commitees `.env`. Usa `.env.example` como referencia. Si un secreto se expone, **rótalo** en el panel
del proveedor correspondiente (base de datos, Mercado Libre, almacenamiento, IA).

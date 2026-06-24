# Política de seguridad

## Reportar una vulnerabilidad

Por favor **no** abras un issue público para vulnerabilidades. Repórtalas en privado a
`<correo de seguridad>` (o vía *GitHub Security Advisories* si el repo lo tiene habilitado). Incluye pasos
de reproducción y el impacto. Procuraremos responder en un plazo razonable y coordinar la divulgación.

## Nota importante sobre el modo self-host

La interfaz web de este software **no incluye autenticación** en su versión auto-hospedable (single-tenant):
está pensada para que un único negocio la opere. **No expongas la UI directamente a internet.** Despliégala
detrás de una red privada, VPN o un reverse proxy con autenticación (Basic Auth / OAuth proxy / Cloudflare Access).

- Los endpoints del bot (`/api/bot/*`) sí se protegen con el header `x-bot-key` == `BOT_API_KEY`.
- Los webhooks de Mercado Libre (`/api/ml/callbacknotice`) reciben sin auth por diseño (patrón
  "recibir y encolar"); no expongas datos sensibles en sus respuestas.
- Define un `BOT_API_KEY` y un `CRON_SECRET` fuertes si usas el bot o cron.

La autenticación multiusuario y el aislamiento por tenant son parte de la capa SaaS (overlay), no de este repo.

## Manejo de secretos

Nunca commitees `.env`. Usa `.env.example` como referencia. Si un secreto se expone, **rótalo** en el panel
del proveedor correspondiente (base de datos, Mercado Libre, almacenamiento, IA).

## Por qué Lovable no tiene "conector Zapier" y qué hacemos en su lugar

Zapier no es un servicio con una API única; es una plataforma que conecta dos aplicaciones. En Lovable podemos consumir cualquiera de los dos extremos:

- **Recibir un webhook de Zapier** → creamos un endpoint `/api/public/clickfunnels-webhook` y tu Zap de ClickFunnels lo llama.
- **Llamar directamente a ClickFunnels** → nuestro backend usa la API oficial de CF 2.0, sin intermediarios.

Tú has elegido la **API directa**, que es más rápida, sin costo extra y conserva el vínculo lead ↔ auditoría.

## Plan de implementación

### 1. Datos que necesito de ti

ClickFunnels 2.0 se autentica con **Personal API Token**. Necesito tres valores:

1. **`CLICKFUNNELS_API_TOKEN`** — lo generas en tu perfil de ClickFunnels 2.0 → *Personal API Tokens* → *Generate New Token*.
2. **`CLICKFUNNELS_SUBDOMAIN`** — tu workspace de CF (ej. si tu URL es `https://miempresa.myclickfunnels.com`, el subdominio es `miempresa`).
3. **`CLICKFUNNELS_WORKSPACE_ID`** — el número que aparece en la URL del dashboard (`/workspaces/{id}/...`). Si no lo tienes, lo detecto automáticamente en la primera llamada a `/workspaces` y te lo devuelvo para que lo confirmes.

Los tres se guardan como secretos de runtime (nunca en el código). El token se envía como `Authorization: Bearer <token>`.

### 2. Cambios en backend

#### Nueva función `subscribeToClickFunnels` — `src/lib/clickfunnels.functions.ts`
- Determina el `workspace_id` si no está configurado llamando a `GET /workspaces`.
- Crea o actualiza el contacto con `POST /workspaces/{id}/contacts`.
- Body:
  ```json
  {
    "contact": {
      "email_addresses": [{ "email": "..." }],
      "first_name": "...",
      "last_name": "..."
    }
  }
  ```
- Si me indicas un tag/lista, aplica el tag con `POST /contacts/{id}/tags`.
- Failsafe: cualquier error de CF (email duplicado, rate limit, token inválido) se captura y guarda, pero **no bloquea** el desbloqueo del mockup. El lead ya quedó en nuestra base de datos.

#### Modificación de `captureLead` — `src/lib/funnel.functions.ts`
- Después del `update` a `funnel_audits`, invoca `subscribeToClickFunnels` con `first_name`, `last_name`, `email`.
- Guarda el `contact_id` devuelto por CF y la fecha de sincronización para poder reconciliar o debuggear.

### 3. Migración de base de datos

Añadir a la tabla `funnel_audits`:
- `clickfunnels_contact_id text` (nullable)
- `clickfunnels_synced_at timestamptz` (nullable)
- `clickfunnels_error text` (nullable, para debugging desde `/admin`)

### 4. Sin cambios en la UI

El formulario actual (nombre, apellido, email) sigue igual. El envío a ClickFunnels ocurre en el servidor; el usuario no ve nada distinto.

## Ventajas de este enfoque

- **Sin Zapier**: sin suscripción extra, sin latencia de 1–15 minutos.
- **Vínculo intacto**: `audit_id` ↔ lead en nuestra DB se mantiene para mockup, PDF y panel admin.
- **Failsafe**: si CF falla, el lead no se pierde; queda en `funnel_audits` y el error se guarda para revisión.
- **Compatible con Cloudflare Workers**: usa `fetch` estándar, sin SDK de Node.

## Próximos pasos

1. Si apruebas, primero pido los tres secretos con `add_secret`.
2. Corro la migración para las nuevas columnas.
3. Implemento `clickfunnels.functions.ts` y modifico `captureLead`.
4. Probamos con un email real y verificamos que aparece en tu workspace de ClickFunnels.

¿Confirmamos este plan?
## Aclaración del flujo

- **Mockup visual**: se muestra **por defecto** en la página (sin gate). Se mantiene el comportamiento actual salvo por el gate.
- **Formulario nombre/email**: sigue existiendo como paso para desbloquear el mockup y el PDF (ya sincroniza con ClickFunnels Contacts vía API).
- **Scheduler de ClickFunnels**: reemplaza a Calendly en todos los CTAs de "agendar llamada".
- **Replicar el mockup en ClickFunnels como página real**: se dispara **solo después** de que la persona agende la llamada (vía el `postMessage` del iframe del scheduler).

## Flujo completo

```text
[Landing]
   │
[URL → análisis → auditoría + mockup]
   │
[Reporte + CTA principal apuntando al scheduler CF]
   │
[Mockup con blur + form nombre/email]  ← igual que hoy
   │  submit → captureLead (guarda + sync a CF Contacts)
   ▼
[Mockup DESBLOQUEADO + PDF + bloque "Agenda tu llamada" con iframe del scheduler embebido]
   │  el usuario agenda
   │  postMessage {id:'redirectFromIframe'} desde jesusesalazar.com
   ▼
[markBooked(auditId) en server]
   │  UPDATE call_status = 'booked'
   │  dispara replicateMockupToClickFunnels(auditId)  ← fire-and-forget
   ▼
[Mensaje de confirmación: "Tu llamada está agendada y estamos preparando tu página en ClickFunnels"]
```

## Cambios en el código

### 1. `src/routes/index.tsx`
- Reemplazar la constante `CALENDLY` por `SCHEDULER_URL = "https://www.jesusesalazar.com/schedule/funnel-audit"`. Actualizar los CTAs "book_call" y `cta_pre_mockup_btn` para apuntar ahí (target `_blank` sigue funcionando como fallback).
- En `phase === "captured"` (mockup ya desbloqueado, hoy sólo muestra "Descargar PDF" y "Agendar llamada" enlazando a Calendly), sustituir el botón de agendar por un **bloque con el iframe del scheduler CF embebido**. Ese bloque:
  - Renderiza `<ClickFunnelsScheduler auditId={auditId} onBooked={...} />` (nuevo componente).
  - Al recibir `onBooked`, muestra el estado final "Llamada agendada + estamos preparando tu página" y llama `markBooked({ id: auditId })`.
- La sección `phase === "report"` (mockup con blur + form) se mantiene tal cual, con los mismos textos.

### 2. Nuevo componente `src/components/ClickFunnelsScheduler.tsx`
- Renderiza un `<iframe src={SCHEDULER_URL}>` con `min-height: 900px`, `width: 100%`, `bg: white`.
- Sin `sandbox` (necesita `postMessage`). Sin `iframe-resizer` de cdnjs — usamos altura mínima generosa.
- Añade `window.addEventListener('message', handler)` que:
  - Filtra estrictamente `event.origin === 'https://www.jesusesalazar.com'`.
  - Si `event.data?.id === 'redirectFromIframe'`, dispara `onBooked()` una sola vez.
- Cleanup del listener en unmount.

### 3. Nueva server fn `markBooked` en `src/lib/funnel.functions.ts`
- `POST`, input `{ id: uuid }`, sin auth (usa el `id` como token igual que `captureLead`).
- `UPDATE funnel_audits SET call_status = 'booked' WHERE id = ?` con `supabaseAdmin`.
- Tras el update, invoca `replicateMockupToClickFunnels(id)` **sin await** (fire-and-forget) y captura errores en logs.
- Idempotente: si `call_status` ya es `booked`, no re-dispara la replicación (comprobación previa).

### 4. Nueva server fn `replicateMockupToClickFunnels` en `src/lib/clickfunnels.functions.ts` (nuevo archivo)
Alcance realista para MVP — crear una página estática dentro de un funnel nuevo en la cuenta ClickFunnels del admin, replicando el mockup HTML que ya guardamos en `funnel_audits.mockup_html`.

Pasos internos:
1. Leer `funnel_audits` (id, first_name, last_name, email, mockup_html, url_submitted, brand_colors).
2. Resolver `workspace_id` (env var o `GET /workspaces` como ya hacemos en `captureLead`).
3. `POST /workspaces/{id}/funnels` con `{ funnel: { name: "Audit Mockup — {first_name} {last_name}" } }` → obtener `funnel_id`.
4. `POST /funnels/{funnel_id}/pages` con `{ page: { name: "Landing", slug: "landing" } }` → `page_id`.
5. `PATCH /pages/{page_id}` (o el endpoint correspondiente de CF 2.0 para setear HTML custom) con el `mockup_html` como contenido. Si CF 2.0 no permite HTML raw a nivel de page (probable), guardamos el HTML como un **bloque de código embed** dentro de la primera sección. Confirmamos el endpoint exacto en la primera ejecución y ajustamos si CF devuelve un error de campo.
6. Guardar en `funnel_audits`:
   - `clickfunnels_funnel_id text`
   - `clickfunnels_page_url text`
   - `clickfunnels_replicated_at timestamptz`
   - `clickfunnels_replicate_error text` (para debug si algo falla)
- Toda la función es tolerante a fallos: si CF rechaza cualquier paso, se guarda el error y no rompe el flujo del usuario (ya agendó, ya tiene su PDF).

### 5. Migración de base de datos
Añadir a `funnel_audits`:
- `clickfunnels_funnel_id text`
- `clickfunnels_page_url text`
- `clickfunnels_replicated_at timestamptz`
- `clickfunnels_replicate_error text`

`call_status` ya existe.

### 6. Admin `/admin`
- Añadir columna "CF Page" que muestra un link a `clickfunnels_page_url` cuando existe.
- Añadir chip de error si `clickfunnels_replicate_error` no es null.
- (Sin cambios en las server fns de admin; sólo lectura extra en la UI.)

### 7. i18n (`src/lib/i18n.tsx`)
- `schedule_block_title` — "Agenda tu llamada de estrategia" / "Book your strategy call"
- `schedule_block_sub` — "Al agendar, replicamos automáticamente el mockup en ClickFunnels para que puedas lanzarlo." / "…"
- `booked_title` — "Llamada agendada ✅"
- `booked_sub` — "Estamos preparando tu página en ClickFunnels. Te avisamos por email cuando esté lista."

## Consideraciones técnicas

- **postMessage origin**: validamos estrictamente `https://www.jesusesalazar.com`. Cualquier otro origen se ignora.
- **Idempotencia**: `markBooked` chequea `call_status` antes de replicar para evitar duplicar el funnel si el iframe manda el mensaje dos veces.
- **CF API endpoints**: los exactos para crear funnels/pages y setear HTML pueden variar. La función maneja errores por paso y los persiste, así podemos ajustar sobre datos reales sin re-desplegar código en cascada.
- **Sin bloqueo**: la replicación es fire-and-forget desde `markBooked`. La UI muestra "estamos preparando…" y confía en que el admin recibirá el link vía `/admin` o vía el email de CF cuando la página quede publicada.
- **Sin script externo**: no cargamos `iframe-resizer` de cdnjs.

## Preguntas mínimas

1. **Slug / naming del funnel en CF**: ¿te parece bien `Audit Mockup — {first_name} {last_name}`, o prefieres incluir el dominio auditado (`Audit — {domain}`)?
2. **Estado inicial de la página en CF**: ¿creamos la página **en borrador** (más seguro, tú la revisas y publicas), o **publicada** directamente en el subdominio de CF?

Con esas dos respuestas procedo a implementar.

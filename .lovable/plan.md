## Diagnóstico

Miré la base de datos y el último audit (`Jesus / jesb.salazarus@gmail.com`, hace ~1 hora) sigue en `call_status = pending` y sin `clickfunnels_funnel_id`. Es decir, dos problemas separados:

### 1. La etiqueta "Funnel Analyzer" nunca se aplicó al contacto
En `pushToClickFunnels` (dentro de `src/lib/funnel.functions.ts`) hacemos el upsert del contacto, pero **nunca aplicamos ningún tag**. Por eso en ClickFunnels ves el contacto sin la etiqueta.

### 2. La replicación del funnel nunca se disparó
La replicación depende de que `markBooked` se ejecute, y `markBooked` sólo se llama cuando `ClickFunnelsScheduler` recibe un `postMessage` con `{id: 'redirectFromIframe'}` desde `https://www.jesusesalazar.com`.

Ese `postMessage` era **código custom que tú tenías en jesusesalazar.com** envolviendo el iframe del scheduler, no algo que CF envíe por defecto. Como ahora incrustamos directamente la URL del scheduler de CF en nuestra app, ese mensaje **no se emite nunca** → `markBooked` nunca corre → nada se replica.

## Solución

### A. Aplicar tag "Funnel Analyzer" al contacto (fix inmediato)

En `pushToClickFunnels`, después del upsert exitoso:

1. Extraer `contact_id` de la respuesta del upsert.
2. Resolver el `tag_id` de "Funnel Analyzer":
   - `GET /workspaces/{workspaceId}/contacts/tags?filter[name]=Funnel Analyzer` para buscar el existente.
   - Si no existe, `POST /workspaces/{workspaceId}/contacts/tags` con `{ contacts_tag: { name: "Funnel Analyzer", color: "#1E90FF" } }`.
   - Cachear el `tag_id` en memoria del worker para no repetir la consulta.
3. Aplicar el tag: `POST /contacts/{contact_id}/applied_tags` con `{ applied_tag: { contacts_tag_id: tag_id } }`.
4. Todo dentro de try/catch: si el tag falla, el lead ya está guardado y sincronizado como contacto — no rompemos el flujo.

Además, cuando el audit tenga `call_status = 'booked'`, aplicaremos también un segundo tag **"Funnel Analyzer — Booked"** dentro de `markBooked`, para que en tu CRM/automations puedas segmentar quién agendó.

### B. Detectar el booking de forma confiable

El `postMessage` desde el iframe de CF **no es viable** (cross-origin, CF no lo emite). Cambiamos a un modelo de dos capas:

**Capa 1 — Webhook oficial de ClickFunnels (fuente de verdad):**
- Creamos un endpoint público en `src/routes/api/public/cf-appointment.ts` que reciba el webhook `appointment.created` (o el evento equivalente que CF dispara al agendar).
- Verificamos la firma HMAC de CF con un secreto compartido (`CLICKFUNNELS_WEBHOOK_SECRET`, generado con `generate_secret` y pegado en la config del webhook en CF).
- El webhook trae el email del contacto. Buscamos el audit más reciente `pending` con ese email y llamamos internamente a la misma lógica que `markBooked` (marcar `booked` + replicar mockup + tag "Booked").
- Idempotente: si ya está `booked`, no hace nada.

Te daré los pasos exactos para configurar el webhook en la UI de ClickFunnels una vez el endpoint esté desplegado (URL del endpoint + secreto).

**Capa 2 — Botón "Ya agendé mi llamada" como respaldo:**
- En `src/routes/index.tsx`, debajo del iframe del scheduler, añadimos un botón discreto tipo *"Ya agendé — muéstrame los siguientes pasos"* que llama a `markBooked` directamente.
- Cubre el caso raro de que el webhook falle o tarde: el usuario puede autoconfirmar y ver el mensaje de "estamos preparando tu página".
- Textos i18n: `already_booked_cta`, `already_booked_help`.

Con las dos capas, el booking se registra sí o sí: la ruta principal es el webhook (100% pasivo), y el botón manual es la red de seguridad.

### C. Verificación

Después de implementar:
1. Confirmo con una llamada de prueba a `pushToClickFunnels` (via `captureLead`) que el contacto queda con tag "Funnel Analyzer" en tu CF.
2. Configuramos el webhook en CF y verificamos con una reserva de prueba que llega al endpoint, marca `booked` y crea el funnel.
3. Si algo del webhook no cuadra con la API real de CF (los nombres exactos del evento y del payload varían por plan), el botón manual sigue funcionando y ajustamos.

## Detalles técnicos

- **Archivos a tocar:**
  - `src/lib/funnel.functions.ts` — añadir helpers `ensureCfTag(name)` y `applyCfTag(contactId, tagId)`; llamarlos tras el upsert.
  - `src/lib/clickfunnels.functions.ts` — refactor: extraer la lógica de `markBooked` a una función interna `markAuditBooked(id)` reutilizable; añadir aplicación del tag "Funnel Analyzer — Booked".
  - **Nuevo** `src/routes/api/public/cf-appointment.ts` — endpoint webhook con verificación HMAC.
  - `src/routes/index.tsx` — botón "Ya agendé mi llamada" bajo el scheduler.
  - `src/lib/i18n.tsx` — nuevas strings EN/ES.
- **Nuevo secreto:** `CLICKFUNNELS_WEBHOOK_SECRET` (generado con `generate_secret`, 32 chars). Te lo doy para pegar en la config del webhook de CF.
- **Migración:** ninguna. Todos los campos ya existen.
- **Idempotencia:** `markAuditBooked` sigue chequeando `call_status !== 'booked'` antes de replicar, así webhook + botón manual + doble postMessage no duplican el funnel.

## Preguntas antes de implementar

1. **Nombre del tag**: ¿"Funnel Analyzer" para todos los que capturamos, y "Funnel Analyzer — Booked" adicional cuando agendan? ¿O prefieres un único tag y que Booked se distinga por otra vía (ej: una lista/segmento en CF)?
2. **Webhook de CF**: ¿tu plan de ClickFunnels 2.0 tiene acceso a webhooks configurables desde la UI? (Settings → Webhooks / Integrations). Si no, saltamos la Capa 1 y nos quedamos sólo con el botón manual + un pequeño polling opcional de la API de appointments.

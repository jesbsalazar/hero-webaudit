## Objetivo
Reemplazar el formulario nativo de captura (nombre + email que desbloquea el mockup) por el formulario embed de ClickFunnels, manteniendo el lead vinculado a su auditoría en nuestra base de datos — sin depender de Zapier.

## Recomendación: doble envío desde el cliente (no Zapier)

Zapier funcionaría, pero añade:
- Otra suscripción mensual.
- Latencia de 1–15 min entre "usuario se registra" y "aparece en tu DB".
- Riesgo de desincronización si Zapier falla.
- Complejidad para vincular el lead con su `audit_id` (Zapier no lo sabe).

**Mejor:** al enviar el formulario de ClickFunnels, en paralelo llamamos a nuestro `captureLead` con los mismos datos + el `audit_id`. Un solo submit del usuario, dos destinos, cero drift, cero costo extra. ClickFunnels queda como la fuente de verdad del newsletter; nuestra DB conserva el vínculo lead ↔ auditoría (para mostrarle el mockup, para el PDF, y para el panel admin).

## Cambios

### 1. Nuevo componente `ClickFunnelsForm`
- Renderiza inputs propios (nombre, apellido, email) con nuestro estilo actual (mantiene la UI dorada sobre el mockup — un iframe/embed de CF rompería el diseño y bloquearía sandbox).
- Al submit:
  1. `POST` al endpoint del formulario de CF (form action URL que tú me pasarás) usando `fetch` con `mode: "no-cors"` y `application/x-www-form-urlencoded` — así CF crea el contacto y lo mete en tu newsletter/follow-up.
  2. En paralelo, `await captureLead({ id, first_name, last_name, email })` para guardar en nuestra DB y desbloquear el mockup.
- Si el paso 2 falla, mostramos error; si el paso 1 falla silenciosamente (no-cors no permite leer respuesta), no bloqueamos al usuario — el registro en CF se puede reconciliar después vía export.

### 2. Configuración
- Nueva constante `CLICKFUNNELS_FORM_ACTION` en `src/routes/index.tsx` (o en un archivo de config). Necesito de ti la **URL de acción del formulario** de ClickFunnels y los **nombres exactos de los campos** (`contact[first_name]`, `contact[email]`, etc. — varían entre CF Classic y CF 2.0).
- Opcional: añadir campos ocultos que CF acepte como tags para segmentar estos leads como "HERO OS Audit".

### 3. Sin cambios en backend
- `funnel_audits`, `captureLead` y el flujo de mockup/PDF quedan igual.
- No hace falta secreto ni API token de CF — el form action es público por diseño.

## Lo que necesito de ti para implementar

1. **URL de acción** del formulario de ClickFunnels (algo tipo `https://myfunnel.myclickfunnels.com/forms/...` o `.../submit`).
2. **Nombres de los campos** del formulario CF (primer nombre, apellido, email). Puedes inspeccionar el form en CF con click derecho → Inspect y copiar los `name="..."`.
3. (Opcional) Si quieres tag/segmento específico en CF, dime cuál.

## Alternativa si prefieres Zapier igual
CF form nativo (sin nuestros inputs) → Zapier webhook → nuestro server route `/api/public/clickfunnels-webhook` que hace upsert en `funnel_audits` por email. Pierdes el vínculo con `audit_id` a menos que pasemos ese ID como hidden field y Zapier lo reenvíe. Puedo hacerlo, pero es más frágil.

---

Confírmame el enfoque y pásame la URL + campos del form de CF, y lo implemento.
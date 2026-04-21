
# HERO OS — Funnel Analyzer

Plan aprobado. Calendly: `https://calendly.com/jsbusinesscoach/web-page-redesign`. Construyo todo en una sola entrega.

## Entregables

### Frontend público (`/`)
- Navbar fijo con logo HERO OS (escudo) + toggle EN/ES (default EN, persistido en localStorage)
- Hero con logo grande, headline bilingüe, input de URL + botón "Analyze my page"
- Loader animado de 4 pasos (Fetching → Analyzing → Building audit → Designing mockup)
- Reporte de auditoría visible y gratis:
  - Gauge animado del Score 0–100 (verde/naranja/rojo)
  - Oferta detectada y audiencia
  - "What's working" (checks verdes) y "Opportunities" (banderas naranjas)
  - Brunson checks (Big Domino, Opportunity Switch, Epiphany Bridge)
  - Headline Clarity Score y CTA Strength
- Maqueta rediseñada en iframe con blur + overlay "Enter your details to unlock"
- Form de captura (Nombre, Apellido, Email) → desbloquea maqueta completa
- Thank you con botón **Download PDF** y **Book my free call** (link Calendly)

### Admin (`/admin/login` y `/admin`)
- Auth email/contraseña con Lovable Cloud (cuenta de Jesús creada manual desde panel)
- Tabla de leads: fecha, nombre, email, URL, score, idioma, estado de llamada
- Drawer con auditoría JSON, maqueta renderizada, descarga de PDF
- Toggle "call booked / closed" por lead

### Backend (Lovable Cloud)
- Tabla `funnel_audits`: `id, created_at, first_name, last_name, email, url_submitted, language, overall_score, audit_json, mockup_html, brand_colors, call_status`
- Tabla `user_roles` + función `has_role()` para gatekeeping admin
- RLS: insert/update públicos por `id`, select sólo admin
- Server functions:
  1. `analyzePage` — fetch HTML, llama Lovable AI (Gemini 3 Flash + tool calling para JSON estructurado), guarda fila inicial
  2. `generateMockup` — genera HTML de landing rediseñada con colores extraídos
  3. `captureLead` — añade nombre/email a la fila
  4. `getLeads` / `updateCallStatus` — sólo admin

### PDF
- Generación client-side con `jspdf` + `html2canvas`
- Portada con logo + score, secciones de auditoría, captura de la maqueta
- Descarga directa, sin email

### i18n
- Diccionarios `en` y `es`, hook `useT()` con contexto
- Idioma seleccionado se pasa al system prompt para que la IA responda en EN/ES

### Diseño
- Dark navy `#0A1628` fondo, paneles `#0D2244`, acento azul eléctrico `#1E90FF`, dorado `#C9A84C` para premium
- Inter, mobile-first, gauge animado, cards con borde dorado sutil

## Notas técnicas
- Validación con Zod en todos los inputs; URL con regex y límite de tamaño del HTML descargado
- Hex colors validados con fallback a paleta default
- Lovable AI vía gateway, modelo `google/gemini-3-flash-preview`, tool calling para garantizar JSON
- Manejo de errores 429/402 con toasts
- Rutas en `src/routes/`: `index.tsx`, `admin.login.tsx`, `_admin.tsx` (layout protegido), `_admin/admin.tsx`

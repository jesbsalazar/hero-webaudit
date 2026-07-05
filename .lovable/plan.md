# Diagnóstico

`www.simplementerico.com` está protegida con Cloudflare "Bot Fight / Challenge" y devuelve **HTTP 403** ante cualquier `fetch` directo desde el servidor (probé con UA de bot y con UA de Chrome real — ambos bloqueados). Nuestro `fetchPage` en `src/server/funnel.functions.ts` no puede resolver el JS challenge de Cloudflare, así que nunca ve el HTML real y la auditoría falla o queda vacía.

Esto le va a pasar con **cualquier página** detrás de Cloudflare Bot Management, Akamai, DataDome, PerimeterX, etc. — no es específico de esta URL.

# Solución propuesta

Usar **Firecrawl** como fallback (o motor principal) para el scraping. Firecrawl resuelve challenges de Cloudflare, ejecuta JS, y devuelve HTML renderizado — es el connector estándar de Lovable para esto.

## Cambios

1. **Conectar Firecrawl** (te lo pediré con el botón de connector; toma 10 segundos).
2. **`src/server/funnel.functions.ts` → `fetchPage`**:
   - Intentar primero `fetch` directo (rápido, gratis).
   - Si devuelve 403/challenge/status no-OK, hacer fallback a Firecrawl `scrape` con `formats: ['html','markdown']` y `onlyMainContent: false`.
   - Guardar `finalUrl` y el HTML devuelto por Firecrawl para el pipeline actual (auditoría + extracción de imágenes para el mockup).
3. **Mensajes de error**: si tanto fetch como Firecrawl fallan, devolver un error i18n claro tipo *"No pudimos leer esta página (protección anti-bot). Intenta con la URL exacta de la landing o una versión sin login."* en vez del `fetch_failed` genérico actual.
4. **Sin cambios de UI**, salvo el string de error nuevo en `src/lib/i18n.tsx`.

## Notas técnicas

- Firecrawl se llama server-side leyendo `FIRECRAWL_API_KEY` de `process.env` dentro del `.handler()` — compatible con el runtime Worker de TanStack Start.
- Uso el SDK oficial `@mendable/firecrawl-js` (una dependencia nueva).
- Coste: 1 crédito Firecrawl por scrape que caiga en fallback; los fetch directos siguen gratis.
- No toco el flujo de auditoría, IA, mockup, PDF ni admin.

## Alternativa que descarto

Añadir Puppeteer/Playwright en el servidor: **no funciona** en el runtime Cloudflare Worker de este proyecto (sin binarios nativos ni filesystem). Firecrawl es la ruta correcta.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureCfTag, applyCfTag } from "@/lib/clickfunnels-tags";
import type { AuditJson } from "@/lib/audit-types";

const HEX = /^#[0-9A-Fa-f]{6}$/;
const safeHex = (v: unknown, fallback: string) =>
  typeof v === "string" && HEX.test(v) ? v : fallback;

const urlSchema = z
  .string()
  .trim()
  .min(4)
  .max(2000)
  .regex(/^https?:\/\/[^\s]+\.[^\s]+$/i, "Invalid URL");

async function fetchDirect(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const txt = await res.text();
    return { html: txt.slice(0, 600_000), finalUrl: res.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchViaFirecrawl(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        timeout: 30000,
      }),
    });
    if (!res.ok) {
      console.error("Firecrawl fetch failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as {
      data?: { html?: string; rawHtml?: string; metadata?: { sourceURL?: string; url?: string } };
    };
    const html = json.data?.html || json.data?.rawHtml;
    if (!html) return null;
    const finalUrl = json.data?.metadata?.sourceURL || json.data?.metadata?.url || url;
    return { html: html.slice(0, 600_000), finalUrl };
  } catch (e) {
    console.error("Firecrawl exception", e);
    return null;
  }
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const direct = await fetchDirect(url);
  if (direct && direct.html.length > 500) return direct;
  const fc = await fetchViaFirecrawl(url);
  if (fc) return fc;
  const err = new Error("fetch_blocked");
  (err as Error & { code?: string }).code = "fetch_blocked";
  throw err;
}

function stripHtmlForLLM(html: string): string {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 40_000);
}

const auditTool = {
  type: "function",
  function: {
    name: "submit_funnel_audit",
    description: "Submit a structured funnel audit using the HERO Method.",
    parameters: {
      type: "object",
      properties: {
        page_title: { type: "string" },
        detected_offer: { type: "string", description: "What is being sold or offered." },
        target_audience: { type: "string" },
        overall_score: { type: "number", description: "0-100 overall funnel quality." },
        headline_clarity: { type: "number", description: "0-100 clarity of main headline." },
        cta_strength: { type: "string", enum: ["weak", "medium", "strong"] },
        big_domino: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"], additionalProperties: false,
        },
        opportunity_switch: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"], additionalProperties: false,
        },
        epiphany_bridge: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"], additionalProperties: false,
        },
        whats_working: { type: "array", items: { type: "string" }, description: "3-5 concrete strengths." },
        opportunities: { type: "array", items: { type: "string" }, description: "3-6 actionable improvements." },
        brand_colors: {
          type: "object",
          properties: {
            primary: { type: "string", description: "Hex like #1E90FF" },
            accent: { type: "string" },
            background: { type: "string" },
          },
          required: ["primary", "accent", "background"], additionalProperties: false,
        },
      },
      required: [
        "page_title", "detected_offer", "target_audience", "overall_score",
        "headline_clarity", "cta_strength", "big_domino", "opportunity_switch",
        "epiphany_bridge", "whats_working", "opportunities", "brand_colors",
      ],
      additionalProperties: false,
    },
  },
} as const;

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  tools?: unknown[],
  toolChoice?: unknown,
  maxTokens = 12000,
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase AI proxy not configured");

  const body: Record<string, unknown> = {
    model: "gemini-3.6-flash",
    systemPrompt,
    userPrompt,
    maxTokens,
    temperature: 0.4,
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.toolChoice = toolChoice;

  const res = await fetch(`${supabaseUrl}/functions/v1/hero-web-audit-ai`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) { const e = new Error("rate_limit"); (e as Error & { code?: string }).code = "rate_limit"; throw e; }
  if (res.status === 402) { const e = new Error("credits"); (e as Error & { code?: string }).code = "credits"; throw e; }
  if (!res.ok) {
    const txt = await res.text();
    console.error("Supabase AI proxy error", res.status, txt);
    throw new Error("ai_error");
  }
  return res.json();
}

export const analyzePage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; language: "en" | "es" }) => ({
    url: urlSchema.parse(input.url), language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { html, finalUrl } = await fetchPage(data.url).catch((err) => {
      console.error("fetch error", err);
      const code = (err as Error & { code?: string })?.code;
      throw new Error(code === "fetch_blocked" ? "fetch_blocked" : "fetch_failed");
    });
    const cleaned = stripHtmlForLLM(html);
    const langInstr = data.language === "es"
      ? "Responde TODO el contenido (notas, fortalezas, oportunidades, oferta, audiencia) en español."
      : "Respond with ALL content (notes, strengths, opportunities, offer, audience) in English.";
    const system = `You are a senior conversion strategist and direct-response copywriter applying the HERO Method — a proprietary funnel framework focused on Headline clarity, Engagement of the right audience, Resonant offer mechanics, and Optimized calls-to-action.

Your job: audit a landing/sales page HTML and return a structured score using the submit_funnel_audit tool.

Scoring rubric (0-100):
- Headline clarity (specific outcome, customer-centric)
- Offer clarity (what they get, for whom, why now)
- Core mechanics (Big Domino statement, Opportunity Switch, Epiphany Bridge)
- CTA strength (singular, action-driving, above the fold)
- Trust (social proof, testimonials, guarantees)
- Visual hierarchy

Be brutally honest but constructive. Quote concrete improvements. Extract brand colors from the HTML when possible.

${langInstr}`;
    const aiRes = await callAI(system, `URL: ${finalUrl}\n\nHTML (truncated):\n${cleaned}`, [auditTool], { type: "function", function: { name: "submit_funnel_audit" } }, 6000);
    const toolCall = aiRes?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("ai_invalid_response");
    let audit: AuditJson;
    try { audit = JSON.parse(toolCall.function.arguments); } catch { throw new Error("ai_invalid_response"); }
    audit.brand_colors = {
      primary: safeHex(audit.brand_colors?.primary, "#1E90FF"),
      accent: safeHex(audit.brand_colors?.accent, "#C9A84C"),
      background: safeHex(audit.brand_colors?.background, "#0A1628"),
    };
    audit.overall_score = Math.max(0, Math.min(100, Math.round(Number(audit.overall_score) || 0)));
    audit.headline_clarity = Math.max(0, Math.min(100, Math.round(Number(audit.headline_clarity) || 0)));
    const { data: row, error } = await supabaseAdmin.from("funnel_audits").insert({
      url_submitted: finalUrl, language: data.language, overall_score: audit.overall_score,
      audit_json: audit as never, brand_colors: audit.brand_colors as never,
    }).select("id").single();
    if (error || !row) { console.error("DB insert error", error); throw new Error("db_error"); }
    return { id: row.id, audit };
  });

export const generateMockup = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; language: "en" | "es" }) => ({
    id: z.string().uuid().parse(input.id), language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin.from("funnel_audits")
      .select("audit_json, brand_colors, url_submitted, mockup_html").eq("id", data.id).single();
    if (error || !row) throw new Error("not_found");
    if (row.mockup_html) return { html: row.mockup_html };

    const audit = row.audit_json as AuditJson;
    const colors = row.brand_colors as AuditJson["brand_colors"];
    let originalSnippet = "";
    let originalImages: string[] = [];
    try {
      const { html: originalHtml, finalUrl } = await fetchPage(row.url_submitted);
      originalSnippet = stripHtmlForLLM(originalHtml).slice(0, 24_000);
      const origin = new URL(finalUrl).origin;
      const imgMatches = Array.from(originalHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi));
      const seen = new Set<string>();
      for (const m of imgMatches) {
        let src = m[1];
        if (src.startsWith("data:")) continue;
        if (src.startsWith("//")) src = "https:" + src;
        else if (src.startsWith("/")) src = origin + src;
        else if (!/^https?:\/\//i.test(src)) continue;
        if (!seen.has(src)) { seen.add(src); originalImages.push(src); if (originalImages.length >= 12) break; }
      }
    } catch (e) { console.warn("re-fetch for mockup failed", e); }

    const lang = data.language === "es"
      ? "Todo el copy del HTML debe estar en español, natural, específico y persuasivo."
      : "All HTML copy must be in English, natural, specific and persuasive.";

    const system = `You are the creative director, senior conversion strategist and elite front-end engineer behind a premium CRO agency.

Your task is NOT to generate a generic AI landing-page template. Your task is to take the REAL page, understand its business, audience, offer, visual identity and conversion weaknesses, and create a convincing HIGH-FIDELITY redesign that a professional agency could present to the client as the proposed replacement.

Think like a combination of a world-class art director, CRO strategist, UX designer, direct-response copywriter and senior frontend engineer. The result must feel intentionally designed for THIS business, not for "a business".

DESIGN INTELLIGENCE:
1. First infer the page's visual language: brand personality, premium/mass-market position, typography, color hierarchy, imagery, spacing rhythm, button treatment, density and tone.
2. Preserve recognizable brand DNA while fixing conversion problems identified by the HERO audit. Do not blindly redesign into a dark SaaS template.
3. Build a deliberate visual hierarchy: one dominant promise, one primary CTA, supporting proof, objection handling and a clear path to action.
4. Use the real product/service, brand name, vocabulary and facts found in the original HTML. Never replace them with placeholders such as "Your Brand", "Lorem ipsum", "John Doe" or fake statistics.
5. Do NOT invent testimonials, reviews, awards, guarantees, prices, credentials, client logos or numerical claims. If the source does not contain proof, create a tasteful "proof opportunity" section using neutral explanatory copy rather than fabricated proof.
6. Do not simply rearrange the original text. Rewrite weak copy using the audit insights: sharpen the Big Domino, make the Opportunity Switch explicit, strengthen the Epiphany Bridge, clarify the offer and create a stronger CTA.
7. Make the page visually impressive above the fold. The first viewport should look like a finished campaign page, not a wireframe.

HIGH-CONVERSION PAGE ARCHITECTURE:
Use the following structure when appropriate, but adapt it to the actual business instead of mechanically forcing every section:
- Announcement/trust bar when useful
- Premium sticky navigation with recognizable logo/brand and one dominant CTA
- Hero: eyebrow, powerful outcome-led headline, concise subheadline, CTA, micro-trust and a strong visual composition using original imagery
- Problem/recognition section that makes the right visitor feel understood
- Benefits/outcomes section with 3-4 distinctive visual cards, not generic icon boxes
- Mechanism / "why this works" section that communicates the Opportunity Switch
- Proof section using ONLY real proof from the source
- Offer stack / what you get, with hierarchy and visual value framing when the source supports it
- Process / how it works when relevant
- Objection handling / FAQ with 4-6 substantive questions
- Final CTA section with a strong emotional close
- Minimal, polished footer

VISUAL QUALITY BAR:
- Aim for the quality level of a top-tier Webflow/Framer agency concept, not a basic Tailwind starter.
- Use strong editorial composition, asymmetry where appropriate, layered cards, image crops, subtle gradients, borders, texture, whitespace and depth.
- Use CSS variables and a coherent spacing/type scale.
- Use responsive CSS for desktop, tablet and mobile.
- Use inline SVG icons and decorative shapes when useful; never rely on emoji for UI.
- Use hover states, focus states, subtle transitions and polished buttons.
- Use CSS gradients/noise-like overlays only when they improve the visual system.
- Hero headline should normally be 52-76px desktop and 34-44px mobile, but adapt to the brand.
- Body copy should normally be 16-19px with generous line-height.
- Avoid excessive rounded cards. Not every section should look like a dashboard.
- Avoid giant empty areas, repetitive three-column grids and generic purple/blue AI aesthetics unless the source brand actually uses them.
- Use the supplied brand colors as the foundation, but derive accessible shades and neutrals around them.

IMAGE STRATEGY:
- Reuse the real source images whenever possible. Select them intentionally: hero, product/service, team, environment, proof, etc.
- Use the real logo if an image URL appears to be a logo.
- Do not use the same image repeatedly unless it is genuinely a hero asset.
- Never invent image URLs. If there are no usable images, create a sophisticated visual treatment with CSS, gradients and inline SVG rather than fake stock-photo URLs.

COPY RULES:
- Copy must be specific to the detected offer and audience.
- Use concrete outcomes and language from the original page.
- The CTA must be specific and action-oriented, not "Learn More" unless that is genuinely the correct action.
- Keep one primary CTA concept and repeat it strategically.
- Preserve factual accuracy. Do not invent claims.
- The redesign should make the business sound more valuable, clear and credible without changing what it actually sells.

TECHNICAL REQUIREMENTS:
- Output ONE complete self-contained HTML document beginning with <!doctype html>.
- No <script> tags and no external JavaScript.
- A single Google Fonts <link> is allowed. Choose typography based on the original brand.
- All CSS must be inside the document. No external CSS dependencies.
- Use semantic HTML and accessible labels, contrast, focus states and alt text.
- Include responsive breakpoints and ensure the entire page works in a narrow mobile viewport.
- Use CSS variables in :root for primary, accent, background, text and surface colors.
- The page must be visually complete even if JavaScript is disabled; FAQ can use native <details>.
- Total output target: 70KB-110KB of polished HTML/CSS when the content warrants it. Do not intentionally make it short.
- Never output explanations, markdown fences or commentary. Return raw HTML only.

${lang}`;

    const user = `BRAND COLORS — use these as the core palette:
${JSON.stringify(colors)}

ORIGINAL URL:
${row.url_submitted}

SOURCE IMAGES — these are real absolute URLs extracted from the page. Use only the ones that genuinely fit the redesign:
${originalImages.map((u, i) => `${i + 1}. ${u}`).join("\n") || "(No usable images extracted. Use an art-directed CSS/SVG composition instead.)"}

HERO AUDIT — treat this as the conversion strategy brief:
${JSON.stringify(audit, null, 2).slice(0, 10000)}

ORIGINAL PAGE CONTENT — use this to understand the actual company, offer, audience, tone, vocabulary and factual claims. Do not invent facts that are not supported here:
${originalSnippet}

DELIVERABLE:
Create the redesigned production-quality landing page now. It should be immediately recognizable as a stronger version of the original business, while visibly fixing the highest-impact conversion problems identified by the HERO audit.`;

    const aiRes = await callAI(system, user, undefined, undefined, 20000);
    let html: string = aiRes?.choices?.[0]?.message?.content ?? "";
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) throw new Error("invalid_mockup");
    if (html.length > 140_000) html = html.slice(0, 140_000);

    const { error: updateError } = await supabaseAdmin.from("funnel_audits")
      .update({ mockup_html: html }).eq("id", data.id);
    if (updateError) { console.error("Mockup DB update error", updateError); throw new Error("db_error"); }
    return { html };
  });

const leadSchema = z.object({
  id: z.string().uuid(), first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(200),
});

async function pushToClickFunnels(lead: { first_name: string; last_name: string; email: string }) {
  const token = process.env.CLICKFUNNELS_API_TOKEN;
  const subdomain = process.env.CLICKFUNNELS_SUBDOMAIN;
  let workspaceId = process.env.CLICKFUNNELS_WORKSPACE_ID;
  if (!token || !subdomain) { console.warn("ClickFunnels not configured; skipping"); return; }
  const base = `https://${subdomain}.myclickfunnels.com/api/v2`;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
  if (!workspaceId) {
    try {
      const wsRes = await fetch(`${base}/workspaces`, { headers });
      if (wsRes.ok) {
        const list = (await wsRes.json()) as Array<{ id: number | string }>;
        if (Array.isArray(list) && list[0]?.id) workspaceId = String(list[0].id);
      } else console.error("ClickFunnels workspaces fetch failed", wsRes.status, await wsRes.text());
    } catch (e) { console.error("ClickFunnels workspace lookup error", e); }
  }
  if (!workspaceId) { console.error("ClickFunnels workspace_id not resolved"); return; }
  const body = { contact: { first_name: lead.first_name, last_name: lead.last_name, email_addresses: [{ email: lead.email }] } };
  let contactId: string | null = null;
  try {
    const res = await fetch(`${base}/workspaces/${workspaceId}/contacts/upsert`, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) { console.error("ClickFunnels upsert failed", res.status, await res.text()); return; }
    const json = (await res.json()) as { id?: number | string; contact?: { id?: number | string } };
    const rawId = json.id ?? json.contact?.id;
    if (rawId) contactId = String(rawId);
  } catch (e) { console.error("ClickFunnels upsert error", e); return; }
  if (!contactId) { console.warn("ClickFunnels upsert returned no contact id"); return; }
  try {
    const tagId = await ensureCfTag(base, headers, workspaceId, "Funnel Analyzer", "#1E90FF");
    if (tagId) await applyCfTag(base, headers, contactId, tagId);
  } catch (e) { console.error("ClickFunnels tag apply error", e); }
}

export const captureLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("funnel_audits").update({
      first_name: data.first_name, last_name: data.last_name, email: data.email,
    }).eq("id", data.id);
    if (error) { console.error("captureLead error", error); throw new Error("db_error"); }
    await pushToClickFunnels({ first_name: data.first_name, last_name: data.last_name, email: data.email });
    return { success: true };
  });

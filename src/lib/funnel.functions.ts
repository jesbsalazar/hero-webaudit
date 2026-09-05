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
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, timeout: 30000 }),
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
        big_domino: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        opportunity_switch: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        epiphany_bridge: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        whats_working: { type: "array", items: { type: "string" }, description: "3-5 concrete strengths." },
        opportunities: { type: "array", items: { type: "string" }, description: "3-6 actionable improvements." },
        brand_colors: {
          type: "object",
          properties: { primary: { type: "string" }, accent: { type: "string" }, background: { type: "string" } },
          required: ["primary", "accent", "background"], additionalProperties: false,
        },
      },
      required: ["page_title", "detected_offer", "target_audience", "overall_score", "headline_clarity", "cta_strength", "big_domino", "opportunity_switch", "epiphany_bridge", "whats_working", "opportunities", "brand_colors"],
      additionalProperties: false,
    },
  },
} as const;

async function callAI(systemPrompt: string, userPrompt: string, tools?: unknown[], toolChoice?: unknown, maxTokens = 12000) {
  // AI runs on the user's own Supabase project (edge function hero-web-audit-ai),
  // which may differ from the Lovable Cloud backend URL in env.
  const proxyUrl = process.env.AI_PROXY_URL
    ?? (process.env.SUPABASE_URL ? `${process.env.SUPABASE_URL}/functions/v1/hero-web-audit-ai` : undefined);
  const proxyKey = process.env.AI_PROXY_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!proxyUrl || !proxyKey) throw new Error("Supabase AI proxy not configured");
  const body: Record<string, unknown> = { model: "gemini-3.6-flash", systemPrompt, userPrompt, maxTokens, temperature: 0.4 };
  if (tools) body.tools = tools;
  if (toolChoice) body.toolChoice = toolChoice;
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${proxyKey}`, apikey: proxyKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) { const e = new Error("rate_limit"); (e as Error & { code?: string }).code = "rate_limit"; throw e; }
  if (res.status === 402) { const e = new Error("credits"); (e as Error & { code?: string }).code = "credits"; throw e; }
  if (!res.ok) { const txt = await res.text(); console.error("Supabase AI proxy error", res.status, txt); throw new Error("ai_error"); }
  return res.json();
}

export const analyzePage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; language: "en" | "es" }) => ({ url: urlSchema.parse(input.url), language: input.language === "es" ? "es" : "en" }))
  .handler(async ({ data }) => {
    const { html, finalUrl } = await fetchPage(data.url).catch((err) => {
      console.error("fetch error", err);
      const code = (err as Error & { code?: string })?.code;
      throw new Error(code === "fetch_blocked" ? "fetch_blocked" : "fetch_failed");
    });
    const cleaned = stripHtmlForLLM(html);
    const langInstr = data.language === "es" ? "Responde TODO el contenido (notas, fortalezas, oportunidades, oferta, audiencia) en español." : "Respond with ALL content (notes, strengths, opportunities, offer, audience) in English.";
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
    audit.brand_colors = { primary: safeHex(audit.brand_colors?.primary, "#1E90FF"), accent: safeHex(audit.brand_colors?.accent, "#C9A84C"), background: safeHex(audit.brand_colors?.background, "#0A1628") };
    audit.overall_score = Math.max(0, Math.min(100, Math.round(Number(audit.overall_score) || 0)));
    audit.headline_clarity = Math.max(0, Math.min(100, Math.round(Number(audit.headline_clarity) || 0)));
    const { data: row, error } = await supabaseAdmin.from("funnel_audits").insert({ url_submitted: finalUrl, language: data.language, overall_score: audit.overall_score, audit_json: audit as never, brand_colors: audit.brand_colors as never }).select("id").single();
    if (error || !row) { console.error("DB insert error", error); throw new Error("db_error"); }
    return { id: row.id, audit };
  });

export const generateMockup = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; language: "en" | "es" }) => ({ id: z.string().uuid().parse(input.id), language: input.language === "es" ? "es" : "en" }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin.from("funnel_audits").select("audit_json, brand_colors, url_submitted, mockup_html").eq("id", data.id).single();
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

    const lang = data.language === "es" ? "Todo el copy del HTML debe estar en español, natural, específico y persuasivo." : "All HTML copy must be in English, natural, specific and persuasive.";

    const system = `You are the conversion creative director behind a CRO agency. You combine conversion strategy, direct-response copywriting and clean landing-page design.

THE GOAL IS COMMERCIAL, NOT TECHNICAL:
Create a redesign that makes the business owner think: “This message is much clearer. I want this page. I want someone to build it for me.”
The mockup is a SALES DEMO of what better conversion could look like. It is not a coding showcase and it is not an exercise in adding more sections.

FIRST THINK, THEN DESIGN:
Before writing HTML, silently determine:
- What this business actually sells.
- Who is most likely to buy it.
- The visitor's strongest problem/desire.
- The most compelling outcome supported by the source.
- The strongest reason to believe.
- The clearest next action.
- The single biggest conversion mistake on the original page.
Then build the page around those decisions.

COPY IS THE PRIMARY DESIGN:
1. Lead with a specific, customer-centered promise. Avoid vague “transform your life/business” language.
2. Make the visitor recognize themselves and their problem quickly.
3. Explain the offer in plain language before adding detail.
4. Make the Opportunity Switch clear: explain the better way to get the desired result, using the HERO audit and real business facts.
5. Use the Epiphany Bridge to move from problem → realization → solution → action.
6. Use one primary CTA concept throughout the page. Make the CTA concrete and desirable.
7. Rewrite weak source copy when necessary. Do not merely rearrange it.
8. Favor short, punchy headlines and useful subheads over walls of copy.
9. Every section must earn its place by moving the visitor closer to action.
10. The final section should make the next step feel obvious, low-friction and valuable.

DO NOT FABRICATE:
- No fake testimonials, reviews, awards, logos, credentials, guarantees, prices, percentages, customer counts or performance claims.
- Use only facts and proof found in the source.
- If proof is missing, do not invent it. Instead, strengthen clarity, mechanism, process and offer framing.

VISUAL DIRECTION:
- Make it polished, modern and clearly better than the original, but keep the design proportional to the business.
- Preserve recognizable brand DNA: colors, tone, imagery and positioning.
- Do not default to dark SaaS aesthetics, purple gradients, giant dashboards or excessive glassmorphism.
- Do not turn every section into a rounded card.
- Use whitespace, typography, contrast, image composition and a few strong visual moments.
- The hero must immediately communicate the new positioning and show the real offer.
- Use real source images when they help sell the offer.
- Prefer one strong visual over five decorative ones.
- Use subtle interaction states only where useful; the page must work without JavaScript.

RECOMMENDED STRUCTURE — ADAPT, DON'T FORCE:
1. Simple header with brand and one primary CTA.
2. Hero: eyebrow + strong outcome/problem headline + concise subheadline + CTA + relevant visual.
3. Recognition/problem section: make the right visitor feel understood.
4. Opportunity/mechanism: explain the better way and why it makes sense.
5. Outcomes/benefits: 3-4 specific benefits tied to the actual offer.
6. Proof: only real proof from the source.
7. Offer/process: make what happens next easy to understand.
8. Objection handling: only useful objections/FAQs.
9. Final CTA: restate the value of taking action now.

IMPORTANT:
A shorter page with exceptional messaging is better than a long page with filler. Do not add sections just to make the HTML bigger.
Do not optimize for HTML size. Optimize for the moment when the owner sees the redesign and wants to buy the implementation.

TECHNICAL REQUIREMENTS:
- Output ONE complete self-contained HTML document beginning with <!doctype html>.
- No <script> tags and no external JavaScript.
- A single Google Fonts <link> is allowed.
- All CSS must be inside the document.
- Use semantic HTML, accessible labels, alt text, focus states and responsive breakpoints.
- Use CSS variables for the palette, typography and spacing.
- Native <details> may be used for FAQs.
- Never use placeholders such as “Your Brand”, “Lorem ipsum”, “John Doe” or “Your Headline”.
- Never output explanations, markdown fences or commentary. Return raw HTML only.

${lang}`;

    const user = `BRAND COLORS:
${JSON.stringify(colors)}

ORIGINAL URL:
${row.url_submitted}

SOURCE IMAGES — use only those that genuinely fit:
${originalImages.map((u, i) => `${i + 1}. ${u}`).join("\n") || "(No usable images extracted.)"}

HERO AUDIT — THIS IS THE STRATEGIC BRIEF:
${JSON.stringify(audit, null, 2).slice(0, 10000)}

ORIGINAL PAGE CONTENT — use this to understand the real business, offer, audience, voice and factual claims:
${originalSnippet}

DELIVERABLE:
Create the redesigned landing page now. The most important improvement should be obvious in the first screen: clearer positioning, stronger message, stronger offer framing and a compelling next action. Make it look like a credible redesign that a CRO agency would show a client — polished, focused and persuasive, not over-engineered.`;

    const aiRes = await callAI(system, user, undefined, undefined, 16000);
    let html: string = aiRes?.choices?.[0]?.message?.content ?? "";
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) throw new Error("invalid_mockup");
    if (html.length > 140_000) html = html.slice(0, 140_000);

    const { error: updateError } = await supabaseAdmin.from("funnel_audits").update({ mockup_html: html }).eq("id", data.id);
    if (updateError) { console.error("Mockup DB update error", updateError); throw new Error("db_error"); }
    return { html };
  });

const leadSchema = z.object({ id: z.string().uuid(), first_name: z.string().trim().min(1).max(80), last_name: z.string().trim().min(1).max(80), email: z.string().trim().email().max(200) });

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
    const { error } = await supabaseAdmin.from("funnel_audits").update({ first_name: data.first_name, last_name: data.last_name, email: data.email }).eq("id", data.id);
    if (error) { console.error("captureLead error", error); throw new Error("db_error"); }
    await pushToClickFunnels({ first_name: data.first_name, last_name: data.last_name, email: data.email });
    return { success: true };
  });
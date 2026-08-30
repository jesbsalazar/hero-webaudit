import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AuditJson } from "@/lib/audit-types";

const SUPABASE_URL = "https://gulqtribvatpvfptqmqr.supabase.co";

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
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (html.length < 500) return null;
    return { html: html.slice(0, 600_000), finalUrl: res.url };
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
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, timeout: 30000 }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { html?: string; rawHtml?: string; metadata?: { sourceURL?: string; url?: string } } };
    const html = json.data?.html || json.data?.rawHtml;
    if (!html) return null;
    return { html: html.slice(0, 600_000), finalUrl: json.data?.metadata?.sourceURL || json.data?.metadata?.url || url };
  } catch {
    return null;
  }
}

async function fetchPage(url: string) {
  const direct = await fetchDirect(url);
  if (direct) return direct;
  const firecrawl = await fetchViaFirecrawl(url);
  if (firecrawl) return firecrawl;
  const err = new Error("fetch_blocked");
  (err as Error & { code?: string }).code = "fetch_blocked";
  throw err;
}

function stripHtmlForLLM(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40_000);
}

function detectPageLanguage(html: string, fallback: "en" | "es"): "en" | "es" {
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (lang?.startsWith("es")) return "es";
  if (lang?.startsWith("en")) return "en";
  const text = stripHtmlForLLM(html).slice(0, 12000).toLowerCase();
  const spanish = (text.match(/\b(el|la|los|las|para|que|con|una|por|tu|tus|cómo|qué|más|clientes|servicios|negocio)\b/g) || []).length;
  const english = (text.match(/\b(the|and|for|with|your|you|how|what|more|customers|business|services)\b/g) || []).length;
  if (spanish >= english + 3) return "es";
  if (english >= spanish + 3) return "en";
  return fallback;
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
        detected_offer: { type: "string" },
        target_audience: { type: "string" },
        overall_score: { type: "number" },
        headline_clarity: { type: "number" },
        cta_strength: { type: "string", enum: ["weak", "medium", "strong"] },
        big_domino: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        opportunity_switch: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        epiphany_bridge: { type: "object", properties: { present: { type: "boolean" }, note: { type: "string" } }, required: ["present", "note"], additionalProperties: false },
        whats_working: { type: "array", items: { type: "string" } },
        opportunities: { type: "array", items: { type: "string" } },
        brand_colors: { type: "object", properties: { primary: { type: "string" }, accent: { type: "string" }, background: { type: "string" } }, required: ["primary", "accent", "background"], additionalProperties: false },
      },
      required: ["page_title", "detected_offer", "target_audience", "overall_score", "headline_clarity", "cta_strength", "big_domino", "opportunity_switch", "epiphany_bridge", "whats_working", "opportunities", "brand_colors"],
      additionalProperties: false,
    },
  },
} as const;

async function callGemini(systemPrompt: string, userPrompt: string, maxTokens = 6000) {
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (publishableKey) {
    headers.apikey = publishableKey;
    headers.Authorization = `Bearer ${publishableKey}`;
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/hero-web-audit-ai`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "gemini-3.6-flash",
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature: 0.4,
      tools: [auditTool],
      toolChoice: { type: "function", function: { name: "submit_funnel_audit" } },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    console.error("Supabase Gemini error", res.status, body);
    if (res.status === 429) throw new Error("rate_limit");
    if (res.status === 402) throw new Error("credits");
    throw new Error("ai_error");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new Error("ai_invalid_response");
  }
}

export const analyzePage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; language: "en" | "es" }) => ({
    url: urlSchema.parse(input.url),
    language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { html, finalUrl } = await fetchPage(data.url).catch((err) => {
      console.error("fetch error", err);
      const code = (err as Error & { code?: string }).code;
      throw new Error(code === "fetch_blocked" ? "fetch_blocked" : "fetch_failed");
    });

    const cleaned = stripHtmlForLLM(html);
    const pageLanguage = detectPageLanguage(html, data.language);
    const langInstr = pageLanguage === "es"
      ? "IDIOMA OBLIGATORIO: español nativo. Responde TODO en español. No uses frases en inglés ni spanglish."
      : "REQUIRED LANGUAGE: native English. Respond ALL content in English. Do not mix languages.";

    const system = `You are a senior conversion strategist and direct-response copywriter applying the HERO Method — Headline clarity, Engagement of the right audience, Resonant offer mechanics, and Optimized calls-to-action.

Audit this landing/sales page and return the structured audit using submit_funnel_audit.

Score 0-100 using: headline clarity, offer clarity, Big Domino, Opportunity Switch, Epiphany Bridge, CTA strength, trust and visual hierarchy.

Be brutally honest but constructive. Make the roast sharp, specific and useful — never generic or insulting. Give concrete improvements.

${langInstr}`;

    const aiRes = await callGemini(system, `URL: ${finalUrl}\n\nHTML (truncated):\n${cleaned}`);
    const toolCall = aiRes?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) throw new Error("ai_invalid_response");

    let audit: AuditJson;
    try {
      audit = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("ai_invalid_response");
    }

    audit.brand_colors = {
      primary: safeHex(audit.brand_colors?.primary, "#1E90FF"),
      accent: safeHex(audit.brand_colors?.accent, "#C9A84C"),
      background: safeHex(audit.brand_colors?.background, "#0A1628"),
    };
    audit.overall_score = Math.max(0, Math.min(100, Math.round(Number(audit.overall_score) || 0)));
    audit.headline_clarity = Math.max(0, Math.min(100, Math.round(Number(audit.headline_clarity) || 0)));

    const { data: row, error } = await supabaseAdmin
      .from("funnel_audits")
      .insert({ url_submitted: finalUrl, language: pageLanguage, overall_score: audit.overall_score, audit_json: audit as never, brand_colors: audit.brand_colors as never })
      .select("id")
      .single();

    if (error || !row) {
      console.error("DB insert error", error);
      throw new Error("db_error");
    }

    return { id: row.id, audit, language: pageLanguage };
  });

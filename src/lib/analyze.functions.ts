import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
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
    if (txt.length < 500) return null;
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
    if (!res.ok) return null;
    const json = (await res.json()) as {
      data?: {
        html?: string;
        rawHtml?: string;
        metadata?: { sourceURL?: string; url?: string };
      };
    };
    const html = json.data?.html || json.data?.rawHtml;
    if (!html) return null;
    return {
      html: html.slice(0, 600_000),
      finalUrl: json.data?.metadata?.sourceURL || json.data?.metadata?.url || url,
    };
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const direct = await fetchDirect(url);
  if (direct) return direct;
  const firecrawl = await fetchViaFirecrawl(url);
  if (firecrawl) return firecrawl;
  const err = new Error("fetch_blocked");
  (err as Error & { code?: string }).code = "fetch_blocked";
  throw err;
}

function stripHtmlForLLM(html: string): string {
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
        big_domino: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"],
          additionalProperties: false,
        },
        opportunity_switch: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"],
          additionalProperties: false,
        },
        epiphany_bridge: {
          type: "object",
          properties: { present: { type: "boolean" }, note: { type: "string" } },
          required: ["present", "note"],
          additionalProperties: false,
        },
        whats_working: { type: "array", items: { type: "string" } },
        opportunities: { type: "array", items: { type: "string" } },
        brand_colors: {
          type: "object",
          properties: {
            primary: { type: "string" },
            accent: { type: "string" },
            background: { type: "string" },
          },
          required: ["primary", "accent", "background"],
          additionalProperties: false,
        },
      },
      required: [
        "page_title",
        "detected_offer",
        "target_audience",
        "overall_score",
        "headline_clarity",
        "cta_strength",
        "big_domino",
        "opportunity_switch",
        "epiphany_bridge",
        "whats_working",
        "opportunities",
        "brand_colors",
      ],
      additionalProperties: false,
    },
  },
} as const;

function normalizeError(status: number, body: string) {
  const e = new Error("ai_error");
  const code = (e as Error & { code?: string }).code;
  void code;
  if (status === 429) (e as Error & { code?: string }).code = "rate_limit";
  else if (status === 402) (e as Error & { code?: string }).code = "credits";
  else if (status === 404 && /gemini-2\.5-flash|model.*not.*available/i.test(body)) {
    (e as Error & { code?: string }).code = "stale_ai_proxy";
  }
  return e;
}

async function callSupabaseAI(systemPrompt: string, userPrompt: string, maxTokens: number) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("supabase_ai_not_configured");

  const res = await fetch(`${supabaseUrl}/functions/v1/hero-web-audit-ai`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
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

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Supabase AI proxy error", res.status, body);
    throw normalizeError(res.status, body);
  }
  return res.json();
}

async function callOpenAI(systemPrompt: string, userPrompt: string, maxTokens: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("openai_not_configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [auditTool],
      tool_choice: { type: "function", function: { name: "submit_funnel_audit" } },
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("OpenAI direct error", res.status, body);
    throw normalizeError(res.status, body);
  }
  return res.json();
}

async function callLovableAI(systemPrompt: string, userPrompt: string) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("lovable_ai_not_configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [auditTool],
      tool_choice: { type: "function", function: { name: "submit_funnel_audit" } },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("Lovable AI fallback error", res.status, body);
    throw normalizeError(res.status, body);
  }
  return res.json();
}

async function callAI(systemPrompt: string, userPrompt: string, maxTokens: number) {
  try {
    return await callSupabaseAI(systemPrompt, userPrompt, maxTokens);
  } catch (err) {
    const code = (err as Error & { code?: string })?.code;
    if (code === "rate_limit" || code === "credits") throw err;
    console.warn("Primary Supabase AI path failed; trying server-side fallback", code || (err as Error).message);
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      return await callOpenAI(systemPrompt, userPrompt, maxTokens);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "rate_limit" || code === "credits") throw err;
      console.warn("Direct OpenAI fallback failed", code || (err as Error).message);
    }
  }

  if (process.env.LOVABLE_API_KEY) return callLovableAI(systemPrompt, userPrompt);
  throw new Error("ai_error");
}

export const analyzePage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; language: "en" | "es" }) => ({
    url: urlSchema.parse(input.url),
    language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { html, finalUrl } = await fetchPage(data.url).catch((err) => {
      console.error("fetch error", err);
      const code = (err as Error & { code?: string })?.code;
      throw new Error(code === "fetch_blocked" ? "fetch_blocked" : "fetch_failed");
    });

    const cleaned = stripHtmlForLLM(html);
    const pageLanguage = detectPageLanguage(html, data.language);
    const langInstr =
      pageLanguage === "es"
        ? "IDIOMA OBLIGATORIO: español nativo. Responde TODO en español. No uses frases en inglés ni spanglish. Conserva únicamente nombres propios, marcas o términos técnicos que aparezcan literalmente en la página."
        : "REQUIRED LANGUAGE: native English. Respond ALL content in English. Do not mix languages. Preserve only proper names, brands or technical terms that literally appear on the page.";

    const system = `You are a senior conversion strategist and direct-response copywriter applying the HERO Method — a proprietary funnel framework focused on Headline clarity, Engagement of the right audience, Resonant offer mechanics, and Optimized calls-to-action.

Your job: audit a landing/sales page HTML and return a structured score using the submit_funnel_audit tool.

Scoring rubric (0-100):
- Headline clarity (specific outcome, customer-centric)
- Offer clarity (what they get, for whom, why now)
- Core mechanics (Big Domino statement, Opportunity Switch, Epiphany Bridge)
- CTA strength (singular, action-driving, above the fold)
- Trust (social proof, testimonials, guarantees)
- Visual hierarchy

Be brutally honest but constructive. Write like an elite conversion strategist speaking directly to the business owner. Make the roast sharp, specific and useful — never generic or insulting.

${langInstr}`;

    const aiRes = await callAI(
      system,
      `URL: ${finalUrl}\n\nHTML (truncated):\n${cleaned}`,
      6000,
    );
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
      .insert({
        url_submitted: finalUrl,
        language: pageLanguage,
        overall_score: audit.overall_score,
        audit_json: audit as never,
        brand_colors: audit.brand_colors as never,
      })
      .select("id")
      .single();

    if (error || !row) {
      console.error("DB insert error", error);
      throw new Error("db_error");
    }

    return { id: row.id, audit, language: pageLanguage };
  });

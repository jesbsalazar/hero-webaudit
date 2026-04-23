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

async function fetchPage(url: string): Promise<{ html: string; finalUrl: string }> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HeroOSBot/1.0; +https://hero-os.lovable.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const reader = res.body?.getReader();
    if (!reader) {
      const txt = await res.text();
      return { html: txt.slice(0, 200_000), finalUrl: res.url };
    }
    const decoder = new TextDecoder();
    let html = "";
    const MAX = 600_000;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      if (html.length > MAX) {
        html = html.slice(0, MAX);
        break;
      }
    }
    return { html, finalUrl: res.url };
  } finally {
    clearTimeout(timeout);
  }
}

function stripHtmlForLLM(html: string): string {
  // Strip scripts, styles, noscript; collapse whitespace; cap length
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
    description:
      "Submit a structured funnel audit using the HERO Method.",
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
          properties: {
            present: { type: "boolean" },
            note: { type: "string", description: "1-2 sentence assessment." },
          },
          required: ["present", "note"],
          additionalProperties: false,
        },
        opportunity_switch: {
          type: "object",
          properties: {
            present: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["present", "note"],
          additionalProperties: false,
        },
        epiphany_bridge: {
          type: "object",
          properties: {
            present: { type: "boolean" },
            note: { type: "string" },
          },
          required: ["present", "note"],
          additionalProperties: false,
        },
        whats_working: {
          type: "array",
          items: { type: "string" },
          description: "3-5 concrete strengths.",
        },
        opportunities: {
          type: "array",
          items: { type: "string" },
          description: "3-6 actionable improvements.",
        },
        brand_colors: {
          type: "object",
          properties: {
            primary: { type: "string", description: "Hex like #1E90FF" },
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

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  tools?: unknown[],
  toolChoice?: unknown,
) {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI gateway not configured");

  const body: Record<string, unknown> = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 429) {
    const e = new Error("rate_limit");
    (e as Error & { code?: string }).code = "rate_limit";
    throw e;
  }
  if (res.status === 402) {
    const e = new Error("credits");
    (e as Error & { code?: string }).code = "credits";
    throw e;
  }
  if (!res.ok) {
    const txt = await res.text();
    console.error("AI gateway error", res.status, txt);
    throw new Error("ai_error");
  }
  return res.json();
}

export const analyzePage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string; language: "en" | "es" }) => ({
    url: urlSchema.parse(input.url),
    language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { html, finalUrl } = await fetchPage(data.url).catch((err) => {
      console.error("fetch error", err);
      throw new Error("fetch_failed");
    });

    const cleaned = stripHtmlForLLM(html);

    const langInstr =
      data.language === "es"
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

Be brutally honest but constructive. Quote concrete improvements (e.g., "Replace 'Welcome to our company' with 'Get [specific outcome] in [timeframe]'").

Brand colors: extract the dominant primary, accent, and background hex colors from inline styles, classes, or visual cues in the HTML. If unsure, default primary #1E90FF, accent #C9A84C, background #0A1628.

${langInstr}`;

    const user = `URL: ${finalUrl}

HTML (truncated):
${cleaned}`;

    const aiRes = await callAI(system, user, [auditTool], {
      type: "function",
      function: { name: "submit_funnel_audit" },
    });

    const toolCall = aiRes?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(aiRes).slice(0, 1000));
      throw new Error("ai_invalid_response");
    }

    let audit: AuditJson;
    try {
      audit = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Failed to parse tool args", e);
      throw new Error("ai_invalid_response");
    }

    // Sanitize
    audit.brand_colors = {
      primary: safeHex(audit.brand_colors?.primary, "#1E90FF"),
      accent: safeHex(audit.brand_colors?.accent, "#C9A84C"),
      background: safeHex(audit.brand_colors?.background, "#0A1628"),
    };
    audit.overall_score = Math.max(
      0,
      Math.min(100, Math.round(Number(audit.overall_score) || 0)),
    );
    audit.headline_clarity = Math.max(
      0,
      Math.min(100, Math.round(Number(audit.headline_clarity) || 0)),
    );

    const { data: row, error } = await supabaseAdmin
      .from("funnel_audits")
      .insert({
        url_submitted: finalUrl,
        language: data.language,
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

    return { id: row.id, audit };
  });

export const generateMockup = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string; language: "en" | "es" }) => ({
    id: z.string().uuid().parse(input.id),
    language: input.language === "es" ? "es" : "en",
  }))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("funnel_audits")
      .select("audit_json, brand_colors, url_submitted, mockup_html")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("not_found");

    if (row.mockup_html) return { html: row.mockup_html };

    const audit = row.audit_json as AuditJson;
    const colors = row.brand_colors as AuditJson["brand_colors"];

    const lang =
      data.language === "es"
        ? "Todo el copy del HTML debe estar en español."
        : "All HTML copy must be in English.";

    const system = `You are an elite landing-page designer applying StoryBrand + Russell Brunson principles. Output a SINGLE complete, self-contained HTML document (no external CSS/JS, no <script>) that redesigns a sales page.

Strict rules:
- Use the provided brand colors as CSS custom properties.
- Mobile-first, modern, clean. System fonts only.
- Sections in order: Hero (clear headline + subheadline + single CTA), 3 benefit cards, Social proof placeholder, Offer breakdown, FAQ (3 items), Final CTA.
- ONE primary CTA repeated, no navigation, no external links.
- Keep total HTML under 25KB.
- ${lang}`;

    const user = `Audit JSON:
${JSON.stringify(audit).slice(0, 8000)}

Brand colors: ${JSON.stringify(colors)}
Original URL: ${row.url_submitted}

Return ONLY raw HTML starting with <!doctype html>. No markdown fences, no explanation.`;

    const aiRes = await callAI(system, user);
    let html: string = aiRes?.choices?.[0]?.message?.content ?? "";
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
      throw new Error("invalid_mockup");
    }
    if (html.length > 60_000) html = html.slice(0, 60_000);

    await supabaseAdmin
      .from("funnel_audits")
      .update({ mockup_html: html })
      .eq("id", data.id);

    return { html };
  });

const leadSchema = z.object({
  id: z.string().uuid(),
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
});

export const captureLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leadSchema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("funnel_audits")
      .update({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
      })
      .eq("id", data.id);
    if (error) {
      console.error("captureLead error", error);
      throw new Error("db_error");
    }
    return { success: true };
  });

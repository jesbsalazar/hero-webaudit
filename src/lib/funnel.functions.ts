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

    // Re-fetch the original page to give the designer real visual context
    let originalSnippet = "";
    let originalImages: string[] = [];
    try {
      const { html: originalHtml, finalUrl } = await fetchPage(row.url_submitted);
      const cleaned = stripHtmlForLLM(originalHtml);
      originalSnippet = cleaned.slice(0, 18_000);

      // Extract up to 6 absolute image URLs to reuse in the mockup
      const origin = new URL(finalUrl).origin;
      const imgMatches = Array.from(
        originalHtml.matchAll(/<img[^>]+src=["']([^"']+)["']/gi),
      );
      const seen = new Set<string>();
      for (const m of imgMatches) {
        let src = m[1];
        if (src.startsWith("data:")) continue;
        if (src.startsWith("//")) src = "https:" + src;
        else if (src.startsWith("/")) src = origin + src;
        else if (!/^https?:\/\//i.test(src)) continue;
        if (!seen.has(src)) {
          seen.add(src);
          originalImages.push(src);
          if (originalImages.length >= 6) break;
        }
      }
    } catch (e) {
      console.warn("re-fetch for mockup failed", e);
    }

    const lang =
      data.language === "es"
        ? "Todo el copy del HTML debe estar en español, natural y persuasivo."
        : "All HTML copy must be in English, natural and persuasive.";

    const system = `You are an elite landing-page designer and front-end engineer. Your job is to RECREATE the look and feel of an existing page but with a stronger, HERO-Method-aligned funnel structure (clear headline, right-audience engagement, resonant offer, optimized CTA).

The output MUST look like a real, polished, production-ready website — NOT a generic template.

Strict rules:
- Output ONE complete, self-contained HTML document. No <script> tags, no external JS.
- You MAY use Google Fonts via a single <link> in <head>. Pick fonts that match the original brand vibe (e.g. Inter, Poppins, Playfair, Montserrat, DM Serif, Manrope).
- Define CSS variables in :root for the brand palette (use the provided brand colors AS-IS for primary, accent, background) plus derived neutrals.
- Reuse the original images provided in the IMAGES list — pick the most relevant ones for hero background, product shots, logos, testimonials, etc. Use them with proper object-fit and srcset where helpful. If an image looks like a logo, use it as a logo.
- Layout: Sticky top nav with logo + single CTA button. Sections: large Hero (image or gradient background, big headline, subheadline, primary CTA, trust strip), 3 benefit cards with icons (use inline SVG), social-proof / testimonial section with avatars from the original images if available, detailed offer / features section, FAQ (3-4 items, accordion-style with <details>), final dark CTA section, simple footer.
- Use modern CSS: gradients, soft shadows, rounded corners (12-20px), generous spacing, responsive grid/flex, hover transitions. Mobile-first with media queries.
- Typography: hero headline 48-72px desktop / 32-40px mobile, body 16-18px, line-height 1.5+.
- Match the visual personality of the original (luxury, tech, friendly, bold, minimal — infer from the snippet) while improving clarity and conversion.
- The single primary CTA text should be specific and action-driven (use audit data for context). Repeat it 3-4 times.
- Total HTML can be up to 55KB. Make it rich and detailed, not minimal.
- ${lang}

Return ONLY raw HTML starting with <!doctype html>. No markdown fences, no explanation.`;

    const user = `BRAND COLORS (use exactly): ${JSON.stringify(colors)}

ORIGINAL URL: ${row.url_submitted}

ORIGINAL IMAGES (absolute URLs you can reuse in <img src="...">):
${originalImages.map((u, i) => `${i + 1}. ${u}`).join("\n") || "(none extracted — use CSS gradients and inline SVG instead)"}

AUDIT INSIGHTS (offer, audience, opportunities — use to write better copy):
${JSON.stringify(audit).slice(0, 6000)}

ORIGINAL PAGE HTML SNIPPET (for tone, fonts, vocabulary, real product/brand names — extract real text, do not invent generic placeholders):
${originalSnippet}

Now produce the redesigned, realistic landing page.`;

    const aiRes = await callAI(system, user);
    let html: string = aiRes?.choices?.[0]?.message?.content ?? "";
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
      throw new Error("invalid_mockup");
    }
    if (html.length > 120_000) html = html.slice(0, 120_000);

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

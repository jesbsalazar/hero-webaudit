import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AuditJson } from "@/lib/audit-types";

async function fetchSourceImages(url: string): Promise<string[]> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/122 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: ctrl.signal,
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = (await res.text()).slice(0, 250_000);
    const finalUrl = res.url || url;
    const origin = new URL(finalUrl).origin;
    const seen = new Set<string>();
    const images: string[] = [];
    for (const match of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      let src = match[1];
      if (src.startsWith("data:")) continue;
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) src = origin + src;
      else if (!/^https?:\/\//i.test(src)) continue;
      if (!seen.has(src)) {
        seen.add(src);
        images.push(src);
        if (images.length >= 6) break;
      }
    }
    return images;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function callFastAI(systemPrompt: string, userPrompt: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase AI proxy not configured");
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
      maxTokens: 9000,
      temperature: 0.35,
    }),
  });
  if (!res.ok) throw new Error("ai_error");
  return res.json();
}

export const generateFastMockup = createServerFn({ method: "POST" })
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
    const images = await fetchSourceImages(row.url_submitted);
    const lang = data.language === "es"
      ? "Write all visible copy in natural, persuasive Spanish."
      : "Write all visible copy in natural, persuasive English.";

    const system = `You are the creative director of a high-end CRO agency. Build a LIGHTWEIGHT sales-demo landing page that makes the business owner think: “That message is much better. I want this page built.”

This is a visual conversion concept, not a production website. Prioritize clarity, hierarchy, offer framing and a beautiful first screen over quantity of sections.

RULES:
- Use the real business facts in the audit. Never invent testimonials, awards, statistics, prices, logos or credentials.
- Keep the page concise: hero + problem/recognition + mechanism + benefits + proof/process if supported + final CTA.
- The hero must be exceptional: specific promise, clear audience/problem, concise subhead, strong CTA and one strong visual.
- Preserve the original brand colors and use source images when available.
- Use whitespace, typography and image composition. Avoid generic SaaS dashboards, purple gradients, excessive cards and over-engineering.
- Make the redesign obviously better than a plain AI-generated page.
- Use CSS only. No scripts. No external JavaScript.
- One Google Fonts link is allowed.
- Return ONLY one complete HTML document beginning with <!doctype html>.

${lang}`;

    const user = `BRAND COLORS:\n${JSON.stringify(colors)}\n\nSOURCE IMAGES:\n${images.join("\n") || "No source images available."}\n\nHERO AUDIT:\n${JSON.stringify(audit, null, 2).slice(0, 9000)}\n\nBUSINESS URL:\n${row.url_submitted}\n\nCreate the redesign now. Keep the HTML reasonably small so it renders quickly inside an iframe. Make the first screen strong enough that the owner immediately sees why the original page could convert better.`;

    const aiRes = await callFastAI(system, user);
    let html = aiRes?.choices?.[0]?.message?.content ?? "";
    html = html.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
    if (!html.toLowerCase().includes("<html") && !html.toLowerCase().includes("<!doctype")) {
      throw new Error("invalid_mockup");
    }
    if (html.length > 90_000) html = html.slice(0, 90_000);

    const { error: updateError } = await supabaseAdmin
      .from("funnel_audits")
      .update({ mockup_html: html })
      .eq("id", data.id);
    if (updateError) throw new Error("db_error");

    return { html };
  });
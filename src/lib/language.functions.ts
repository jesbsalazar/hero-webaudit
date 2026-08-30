import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const urlSchema = z
  .string()
  .trim()
  .min(4)
  .max(2000)
  .regex(/^https?:\/\/[^\s]+\.[^\s]+$/i, "Invalid URL");

type PageLanguage = "en" | "es";

async function fetchDirect(url: string): Promise<string | null> {
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
    return (await res.text()).slice(0, 600_000);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchViaFirecrawl(url: string): Promise<string | null> {
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
      data?: { html?: string; rawHtml?: string };
    };
    return (json.data?.html || json.data?.rawHtml || "").slice(0, 600_000) || null;
  } catch {
    return null;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectFromHtml(html: string): PageLanguage | null {
  const htmlLang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (htmlLang?.startsWith("es")) return "es";
  if (htmlLang?.startsWith("en")) return "en";

  const contentLanguage = html.match(
    /<meta[^>]+(?:http-equiv|name)=["'](?:content-language|language)["'][^>]+content=["']([^"']+)["']/i,
  )?.[1]?.toLowerCase();
  if (contentLanguage?.startsWith("es")) return "es";
  if (contentLanguage?.startsWith("en")) return "en";

  const text = stripHtml(html).slice(0, 16000).toLowerCase();
  const spanish =
    (text.match(/\b(el|la|los|las|para|que|con|una|por|tu|tus|cómo|qué|más|clientes|servicios|negocio|página|ventas|oferta|empresa)\b/g) || [])
      .length;
  const english =
    (text.match(/\b(the|and|for|with|your|you|how|what|more|customers|business|services|page|sales|offer|company)\b/g) || [])
      .length;

  if (spanish >= english + 3) return "es";
  if (english >= spanish + 3) return "en";
  return null;
}

export const detectPageLanguage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => ({ url: urlSchema.parse(input.url) }))
  .handler(async ({ data }) => {
    const html = (await fetchDirect(data.url)) || (await fetchViaFirecrawl(data.url));
    if (!html) throw new Error("language_detection_failed");

    return { language: detectFromHtml(html) ?? "en" };
  });

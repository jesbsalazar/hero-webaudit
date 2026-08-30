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

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractVisibleText(html: string): string {
  const content = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const copyMatches = content.match(/<(?:title|h1|h2|h3|h4|p|li|button|a|label|span)[^>]*>([\s\S]*?)<\/(?:title|h1|h2|h3|h4|p|li|button|a|label|span)>/gi) || [];
  const prioritized = copyMatches.join(" ").replace(/<[^>]+>/g, " ");

  return decodeEntities(prioritized || content.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 30000)
    .toLowerCase();
}

function countWords(text: string, words: string[]): number {
  const pattern = new RegExp(`\\b(?:${words.join("|")})\\b`, "gi");
  return (text.match(pattern) || []).length;
}

function detectFromHtml(html: string): PageLanguage | null {
  const text = extractVisibleText(html);

  // Use visitor-facing copy as the primary signal. Do not trust <html lang>
  // first: page builders frequently leave lang="en" on Spanish pages.
  const spanishWords = [
    "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "para", "por",
    "con", "que", "como", "cómo", "qué", "más", "tu", "tus", "su", "sus", "te", "se",
    "clientes", "cliente", "servicios", "servicio", "negocio", "negocios", "página", "paginas",
    "ventas", "venta", "oferta", "empresa", "empresas", "gratis", "ahora", "puedes", "quieres",
    "necesitas", "ayudamos", "descubre", "reserva", "agenda", "contacto", "solución", "problema",
  ];
  const englishWords = [
    "the", "and", "your", "you", "yourself", "how", "what", "more", "clients", "client", "services",
    "service", "business", "businesses", "page", "pages", "sales", "sale", "offer", "company", "companies",
    "free", "now", "want", "need", "help", "discover", "book", "schedule", "contact", "solution", "problem",
    "learn", "results", "about", "get", "today", "start", "choose", "better", "people",
  ];

  const spanish = countWords(text, spanishWords);
  const english = countWords(text, englishWords);

  if (spanish >= 5 && spanish >= english * 1.2) return "es";
  if (english >= 5 && english >= spanish * 1.2) return "en";

  // Metadata is only a fallback when copy evidence is weak or unavailable.
  const htmlLang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (htmlLang?.startsWith("es")) return "es";
  if (htmlLang?.startsWith("en")) return "en";

  const contentLanguage = html.match(
    /<meta[^>]+(?:http-equiv|name)=["'](?:content-language|language)["'][^>]+content=["']([^"']+)["']/i,
  )?.[1]?.toLowerCase();
  if (contentLanguage?.startsWith("es")) return "es";
  if (contentLanguage?.startsWith("en")) return "en";

  return null;
}

export const detectPageLanguage = createServerFn({ method: "POST" })
  .inputValidator((input: { url: string }) => ({ url: urlSchema.parse(input.url) }))
  .handler(async ({ data }) => {
    const html = (await fetchDirect(data.url)) || (await fetchViaFirecrawl(data.url));
    if (!html) throw new Error("language_detection_failed");

    const language = detectFromHtml(html);
    console.info("HERO OS language detection", { url: data.url, language });
    return { language: language ?? "en" };
  });

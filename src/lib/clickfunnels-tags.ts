// Shared ClickFunnels tag helpers. Pure fetch-based; no Supabase or secrets
// coupling. Safe to import from any *.functions.ts module or server route.

// Simple in-memory cache of tag name -> id per worker instance.
const cfTagCache = new Map<string, string>();

export async function ensureCfTag(
  base: string,
  headers: Record<string, string>,
  workspaceId: string,
  name: string,
  color = "#1E90FF",
): Promise<string | null> {
  const cacheKey = `${workspaceId}:${name}`;
  const cached = cfTagCache.get(cacheKey);
  if (cached) return cached;

  try {
    const url = `${base}/workspaces/${workspaceId}/contacts/tags?filter[name]=${encodeURIComponent(name)}`;
    const res = await fetch(url, { headers });
    if (res.ok) {
      const list = (await res.json()) as Array<{ id?: number | string; name?: string }>;
      const match = Array.isArray(list)
        ? list.find((t) => (t.name ?? "").toLowerCase() === name.toLowerCase())
        : null;
      if (match?.id) {
        const id = String(match.id);
        cfTagCache.set(cacheKey, id);
        return id;
      }
    } else {
      console.warn("CF tag list failed", res.status);
    }
  } catch (e) {
    console.warn("CF tag list exception", e);
  }

  try {
    const res = await fetch(`${base}/workspaces/${workspaceId}/contacts/tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ contacts_tag: { name, color } }),
    });
    if (!res.ok) {
      console.error("CF tag create failed", res.status, await res.text().catch(() => ""));
      return null;
    }
    const json = (await res.json()) as { id?: number | string };
    if (json.id) {
      const id = String(json.id);
      cfTagCache.set(cacheKey, id);
      return id;
    }
  } catch (e) {
    console.error("CF tag create exception", e);
  }
  return null;
}

export async function applyCfTag(
  base: string,
  headers: Record<string, string>,
  contactId: string,
  tagId: string,
): Promise<void> {
  try {
    const res = await fetch(`${base}/contacts/${contactId}/applied_tags`, {
      method: "POST",
      headers,
      body: JSON.stringify({ applied_tag: { contacts_tag_id: Number(tagId) || tagId } }),
    });
    if (!res.ok) {
      console.error("CF applied_tag failed", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error("CF applied_tag exception", e);
  }
}

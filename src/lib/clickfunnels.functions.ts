import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ensureCfTag, applyCfTag } from "@/lib/clickfunnels-tags";

type CFCreds = { token: string; subdomain: string; workspaceId: string; base: string };

async function resolveCreds(): Promise<CFCreds | null> {
  const token = process.env.CLICKFUNNELS_API_TOKEN;
  const subdomain = process.env.CLICKFUNNELS_SUBDOMAIN;
  let workspaceId = process.env.CLICKFUNNELS_WORKSPACE_ID;
  if (!token || !subdomain) return null;
  const base = `https://${subdomain}.myclickfunnels.com/api/v2`;

  if (!workspaceId) {
    try {
      const wsRes = await fetch(`${base}/workspaces`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
      if (wsRes.ok) {
        const list = (await wsRes.json()) as Array<{ id: number | string }>;
        if (Array.isArray(list) && list[0]?.id) workspaceId = String(list[0].id);
      }
    } catch (e) {
      console.error("CF workspace lookup error", e);
    }
  }
  if (!workspaceId) return null;
  return { token, subdomain, workspaceId, base };
}

/**
 * Look up a contact by email in ClickFunnels and return its id (or null).
 */
async function findCfContactIdByEmail(
  creds: CFCreds,
  email: string,
): Promise<string | null> {
  const headers = {
    Authorization: `Bearer ${creds.token}`,
    Accept: "application/json",
  };
  try {
    const url = `${creds.base}/workspaces/${creds.workspaceId}/contacts?filter[email]=${encodeURIComponent(email)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn("CF contact lookup failed", res.status);
      return null;
    }
    const list = (await res.json()) as Array<{ id?: number | string }>;
    if (Array.isArray(list) && list[0]?.id) return String(list[0].id);
  } catch (e) {
    console.warn("CF contact lookup exception", e);
  }
  return null;
}

/**
 * Attempts to replicate the audit mockup as a real funnel + page in ClickFunnels 2.0.
 * Best-effort: if any step fails we record the error and stop; we never throw.
 */
async function replicateMockupToClickFunnels(id: string): Promise<void> {
  try {
    const { data: row, error } = await supabaseAdmin
      .from("funnel_audits")
      .select(
        "id, first_name, last_name, url_submitted, mockup_html, clickfunnels_funnel_id",
      )
      .eq("id", id)
      .single();
    if (error || !row) {
      console.error("CF replicate: audit not found", error);
      return;
    }
    if (row.clickfunnels_funnel_id) {
      // Already replicated — idempotent no-op.
      return;
    }

    const creds = await resolveCreds();
    if (!creds) {
      await supabaseAdmin
        .from("funnel_audits")
        .update({ clickfunnels_replicate_error: "cf_not_configured" })
        .eq("id", id);
      return;
    }

    const headers = {
      Authorization: `Bearer ${creds.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    let domain = "audit";
    try {
      domain = new URL(row.url_submitted).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    const namePerson =
      [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || "Lead";
    const funnelName = `Audit — ${domain} (${namePerson})`;

    // 1) Create the funnel in the workspace.
    const funnelRes = await fetch(
      `${creds.base}/workspaces/${creds.workspaceId}/funnels`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({ funnel: { name: funnelName } }),
      },
    );

    if (!funnelRes.ok) {
      const errBody = await funnelRes.text().catch(() => "");
      console.error("CF funnel create failed", funnelRes.status, errBody);
      await supabaseAdmin
        .from("funnel_audits")
        .update({
          clickfunnels_replicate_error: `funnel_create_${funnelRes.status}: ${errBody.slice(0, 400)}`,
        })
        .eq("id", id);
      return;
    }

    const funnelJson = (await funnelRes.json()) as {
      id?: number | string;
      public_id?: string;
    };
    const funnelId = funnelJson.id ? String(funnelJson.id) : null;
    if (!funnelId) {
      await supabaseAdmin
        .from("funnel_audits")
        .update({ clickfunnels_replicate_error: "funnel_create_no_id" })
        .eq("id", id);
      return;
    }

    // Dashboard URL where the admin can find and edit the funnel.
    const dashUrl = `https://${creds.subdomain}.myclickfunnels.com/workspaces/${creds.workspaceId}/funnels/${funnelId}`;

    // 2) Best-effort: create a page inside the funnel. If CF rejects, we still
    //    keep the funnel record so the admin can finish it in the CF editor.
    let pageCreateNote: string | null = null;
    try {
      const pageRes = await fetch(`${creds.base}/funnels/${funnelId}/pages`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          page: { name: "Landing", slug: "landing" },
        }),
      });
      if (!pageRes.ok) {
        pageCreateNote = `page_create_${pageRes.status}`;
        console.warn("CF page create failed", pageRes.status, await pageRes.text().catch(() => ""));
      }
    } catch (e) {
      pageCreateNote = "page_create_exception";
      console.warn("CF page create exception", e);
    }

    await supabaseAdmin
      .from("funnel_audits")
      .update({
        clickfunnels_funnel_id: funnelId,
        clickfunnels_page_url: dashUrl,
        clickfunnels_replicated_at: new Date().toISOString(),
        clickfunnels_replicate_error: pageCreateNote,
      })
      .eq("id", id);
  } catch (e) {
    console.error("CF replicate exception", e);
    try {
      await supabaseAdmin
        .from("funnel_audits")
        .update({
          clickfunnels_replicate_error: `exception: ${(e as Error).message?.slice(0, 400) ?? "unknown"}`,
        })
        .eq("id", id);
    } catch {
      /* swallow */
    }
  }
}

/**
 * Applies the "Funnel Analyzer — Booked" tag to the contact in ClickFunnels
 * so it can be segmented in CRM/automations. Best-effort; never throws.
 */
async function tagContactBooked(email: string | null): Promise<void> {
  if (!email) return;
  const creds = await resolveCreds();
  if (!creds) return;
  const headers = {
    Authorization: `Bearer ${creds.token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const contactId = await findCfContactIdByEmail(creds, email);
  if (!contactId) return;
  const tagId = await ensureCfTag(
    creds.base,
    headers,
    creds.workspaceId,
    "Funnel Analyzer — Booked",
    "#C9A84C",
  );
  if (tagId) await applyCfTag(creds.base, headers, contactId, tagId);
}

/**
 * Marks an audit as booked (idempotent), triggers ClickFunnels replication,
 * and applies the "Booked" tag to the contact. Returns whether the state
 * transitioned from non-booked to booked.
 */
export async function markAuditBooked(id: string): Promise<boolean> {
  const { data: row, error: readErr } = await supabaseAdmin
    .from("funnel_audits")
    .select("id, call_status, clickfunnels_funnel_id, email")
    .eq("id", id)
    .single();
  if (readErr || !row) throw new Error("not_found");

  const wasBooked = row.call_status === "booked";
  if (!wasBooked) {
    const { error: updErr } = await supabaseAdmin
      .from("funnel_audits")
      .update({ call_status: "booked" })
      .eq("id", id);
    if (updErr) {
      console.error("markAuditBooked update error", updErr);
      throw new Error("db_error");
    }
  }

  // Tag the contact as booked (idempotent on CF side; tag apply is a no-op
  // if it already exists — the CF API returns 200 or 422 either way).
  await tagContactBooked(row.email).catch((e) =>
    console.error("tagContactBooked error", e),
  );

  if (!row.clickfunnels_funnel_id) {
    await replicateMockupToClickFunnels(id);
  }

  return !wasBooked;
}

/**
 * Finds the most recent pending audit for the given email and marks it as
 * booked. Used by the ClickFunnels appointment webhook.
 */
export async function markBookedByEmail(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  const { data: rows, error } = await supabaseAdmin
    .from("funnel_audits")
    .select("id, call_status")
    .ilike("email", normalized)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.error("markBookedByEmail lookup error", error);
    return false;
  }
  const row = rows?.[0];
  if (!row) return false;
  await markAuditBooked(row.id);
  return true;
}

/**
 * Called from the client when the user confirms they've booked their call.
 * Marks the audit as booked and (once) fires the mockup replication into
 * ClickFunnels + applies the Booked tag.
 */
export const markBooked = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await markAuditBooked(data.id);
    return { success: true };
  });

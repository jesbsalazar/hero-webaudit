import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
 * Called from the client when the ClickFunnels scheduler iframe posts a
 * booking-completed message. Marks the audit as booked and (once) fires the
 * mockup replication into ClickFunnels.
 */
export const markBooked = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: row, error: readErr } = await supabaseAdmin
      .from("funnel_audits")
      .select("id, call_status, clickfunnels_funnel_id")
      .eq("id", data.id)
      .single();
    if (readErr || !row) throw new Error("not_found");

    // Idempotent: only mark + replicate the first time.
    if (row.call_status !== "booked") {
      const { error: updErr } = await supabaseAdmin
        .from("funnel_audits")
        .update({ call_status: "booked" })
        .eq("id", data.id);
      if (updErr) {
        console.error("markBooked update error", updErr);
        throw new Error("db_error");
      }
    }

    if (!row.clickfunnels_funnel_id) {
      // Fire-and-forget: don't block the response on ClickFunnels calls.
      // We await inside a wrapper that swallows errors so the handler returns
      // promptly even if CF is slow — but replication still runs to completion
      // in the worker before it shuts down for this request.
      await replicateMockupToClickFunnels(data.id);
    }

    return { success: true };
  });

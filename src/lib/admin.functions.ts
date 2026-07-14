import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error("role_check_failed");
  if (!data) throw new Error("forbidden");
}

export const getLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("funnel_audits")
      .select(
        "id, created_at, first_name, last_name, email, url_submitted, language, overall_score, call_status, audit_json, mockup_html, brand_colors, clickfunnels_funnel_id, clickfunnels_page_url, clickfunnels_replicated_at, clickfunnels_replicate_error",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error("db_error");
    return { leads: data ?? [] };
  });

export const updateCallStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["pending", "booked", "closed"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("funnel_audits")
      .update({ call_status: data.status })
      .eq("id", data.id);
    if (error) throw new Error("db_error");
    return { success: true };
  });

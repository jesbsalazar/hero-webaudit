import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

/**
 * ClickFunnels appointment webhook.
 *
 * Configure in ClickFunnels → Settings → Webhooks with URL:
 *   https://<your-domain>/api/public/cf-appointment
 * and shared secret matching env `CLICKFUNNELS_WEBHOOK_SECRET`.
 *
 * The handler expects either:
 *   - an `x-cf-signature` header containing an HMAC-SHA256 hex of the raw body
 *     using the shared secret, OR
 *   - a `secret` query parameter equal to the shared secret (fallback for
 *     platforms that don't sign payloads).
 *
 * Payload shape is tolerated loosely: we extract the contact email from any
 * of the common CF payload locations and mark the most recent pending audit
 * for that email as booked.
 */

const payloadSchema = z.object({
  event: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  contact: z
    .object({
      email: z.string().optional(),
      email_addresses: z
        .array(z.object({ email: z.string().optional() }).passthrough())
        .optional(),
    })
    .passthrough()
    .optional(),
  appointment: z.record(z.string(), z.unknown()).optional(),
  email: z.string().optional(),
});

function extractEmail(payload: unknown): string | null {
  try {
    const p = payloadSchema.safeParse(payload);
    if (!p.success) return null;
    const d = p.data;
    if (d.email && typeof d.email === "string") return d.email;
    if (d.contact?.email) return d.contact.email;
    const emails = d.contact?.email_addresses;
    if (Array.isArray(emails) && emails[0]?.email) return emails[0].email;
    const inner = d.data as { email?: string; contact?: { email?: string } } | undefined;
    if (inner?.email) return inner.email;
    if (inner?.contact?.email) return inner.contact.email;
    const apt = d.appointment as
      | { email?: string; contact?: { email?: string } }
      | undefined;
    if (apt?.email) return apt.email;
    if (apt?.contact?.email) return apt.contact.email;
  } catch {
    /* ignore */
  }
  return null;
}

function verifySignature(secret: string, rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/cf-appointment")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CLICKFUNNELS_WEBHOOK_SECRET;
        if (!secret) {
          console.error("CF webhook: CLICKFUNNELS_WEBHOOK_SECRET not set");
          return new Response("Webhook not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const url = new URL(request.url);
        const querySecret = url.searchParams.get("secret");
        const sigHeader =
          request.headers.get("x-cf-signature") ||
          request.headers.get("x-clickfunnels-signature") ||
          request.headers.get("x-signature");

        const bySig = verifySignature(secret, rawBody, sigHeader);
        const byQuery =
          !!querySecret &&
          querySecret.length === secret.length &&
          timingSafeEqual(Buffer.from(querySecret), Buffer.from(secret));
        if (!bySig && !byQuery) {
          console.warn("CF webhook: invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: unknown = null;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const email = extractEmail(payload);
        if (!email) {
          console.warn("CF webhook: no email in payload", rawBody.slice(0, 500));
          return Response.json({ ok: true, skipped: "no_email" });
        }

        try {
          const { markBookedByEmail } = await import("@/lib/clickfunnels.functions");
          const matched = await markBookedByEmail(email);
          return Response.json({ ok: true, matched });
        } catch (e) {
          console.error("CF webhook: markBookedByEmail failed", e);
          return Response.json({ ok: false, error: "internal" }, { status: 500 });
        }
      },
    },
  },
});

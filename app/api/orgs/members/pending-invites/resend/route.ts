import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { uuidSchema } from "@/lib/validation/schemas";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { withRetry } from "@/lib/api/retry";
import { orgInviteSignupEmailHtml, orgInviteSignupEmailText } from "@/lib/email/templates/org-invite-signup";
import {
  createWorkspaceInviteActionLink,
  createWorkspaceMagicActionLink,
  ensureProfileForAuthUser,
  lookupAuthUserForInvite,
  upsertPendingWorkspaceInvite,
} from "@/lib/orgs/workspace-invite-helpers";

function siteOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

/** POST /api/orgs/members/pending-invites/resend — owners only; resend invite email for a pending row. */
export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const id = (body as { id?: string })?.id?.trim() ?? "";
    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Invalid pending invite id" }, { status: 400 });
    }

    let orgId = await getActiveOrgId(authClient as any, userId);
    if (!orgId) {
      try {
        orgId = await ensureActiveOrgForUser(userId);
      } catch {
        orgId = null;
      }
    }
    if (!orgId) {
      return NextResponse.json({ error: "No active workspace" }, { status: 400 });
    }

    const { data: membership, error: memErr } = await (authClient as any)
      .from("org_memberships")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (memErr || membership?.role !== "owner") {
      return NextResponse.json({ error: "Only workspace owners can resend invites" }, { status: 403 });
    }

    const svc = createSupabaseServiceClient();
    const { data: row, error: rowErr } = await (svc as any)
      .from("org_pending_invites")
      .select("id, email, org_id")
      .eq("id", id)
      .eq("org_id", orgId)
      .maybeSingle();

    if (rowErr || !row?.email) {
      return NextResponse.json({ error: "Pending invite not found" }, { status: 404 });
    }

    const email = String(row.email).trim().toLowerCase();
    const origin = siteOrigin(req);

    let resendClient: ReturnType<typeof getResendClient>;
    try {
      resendClient = getResendClient();
    } catch {
      return NextResponse.json({ error: "Email is not configured" }, { status: 503 });
    }

    const { data: orgRow } = await (svc as any).from("orgs").select("name").eq("id", orgId).maybeSingle();
    const orgName = typeof orgRow?.name === "string" && orgRow.name.trim() ? orgRow.name.trim() : "Workspace";

    const { data: inviterProfile } = await (svc as any)
      .from("profiles")
      .select("display_name, email, first_name")
      .eq("id", userId)
      .maybeSingle();
    const inviterLabel =
      (typeof inviterProfile?.display_name === "string" && inviterProfile.display_name.trim()) ||
      (typeof inviterProfile?.first_name === "string" && inviterProfile.first_name.trim()) ||
      (typeof inviterProfile?.email === "string" && inviterProfile.email.trim()) ||
      "A teammate";

    const authHitEarly = await lookupAuthUserForInvite(svc, email);
    if (authHitEarly) {
      const { data: alreadyMember } = await (svc as any)
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("user_id", authHitEarly.userId)
        .maybeSingle();
      if (alreadyMember) {
        await (svc as any).from("org_pending_invites").delete().eq("id", id);
        return NextResponse.json({ ok: true, resolved: "already_member" as const });
      }
    }

    const inviteOutcome = await createWorkspaceInviteActionLink(svc, email, orgId, origin);

    if ("actionLink" in inviteOutcome) {
      await upsertPendingWorkspaceInvite(svc, {
        orgId,
        emailLower: email,
        invitedBy: userId,
      });
      try {
        const sendPromise = resendClient.emails.send({
          from: getFromAddress(),
          to: email,
          subject: `You’re invited to ${orgName} on Expense Terminal`,
          html: orgInviteSignupEmailHtml({
            orgName,
            inviterLabel,
            actionLink: inviteOutcome.actionLink,
          }),
          text: orgInviteSignupEmailText({
            orgName,
            inviterLabel,
            actionLink: inviteOutcome.actionLink,
          }),
          headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
        );
        await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
          maxRetries: 2,
          initialMs: 1000,
          maxMs: 10_000,
        });
        return NextResponse.json({ ok: true });
      } catch (mailErr) {
        console.warn("[pending-invites/resend] email failed", mailErr);
        return NextResponse.json(
          { error: "Could not send email. Try again in a moment." },
          { status: 502 }
        );
      }
    }

    const authHit = await lookupAuthUserForInvite(svc, email);
    if (authHit) {
      try {
        await ensureProfileForAuthUser(svc, authHit.userId, authHit.userEmail);
      } catch (pe) {
        return NextResponse.json(
          { error: safeErrorMessage(pe instanceof Error ? pe.message : String(pe), "Could not sync profile") },
          { status: 500 }
        );
      }
    }

    const magicOutcome = await createWorkspaceMagicActionLink(svc, email, orgId, origin);
    if ("actionLink" in magicOutcome) {
      await upsertPendingWorkspaceInvite(svc, {
        orgId,
        emailLower: email,
        invitedBy: userId,
      });
      try {
        const sendPromise = resendClient.emails.send({
          from: getFromAddress(),
          to: email,
          subject: `Sign in to join ${orgName} on Expense Terminal`,
          html: orgInviteSignupEmailHtml({
            orgName,
            inviterLabel,
            actionLink: magicOutcome.actionLink,
          }),
          text: orgInviteSignupEmailText({
            orgName,
            inviterLabel,
            actionLink: magicOutcome.actionLink,
          }),
          headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
        );
        await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
          maxRetries: 2,
          initialMs: 1000,
          maxMs: 10_000,
        });
        return NextResponse.json({ ok: true });
      } catch (mailErr) {
        console.warn("[pending-invites/resend] magic email failed", mailErr);
        return NextResponse.json(
          { error: "Could not send email. Try again in a moment." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      {
        error: safeErrorMessage(
          magicOutcome.error?.message ?? inviteOutcome.error?.message ?? "",
          "Could not create a new link for this address"
        ),
      },
      { status: 400 }
    );
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Resend failed" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import crypto from "crypto";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { isValidEmail } from "@/lib/validation/email";
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

function parseEmailList(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => (typeof x === "string" ? x.split(/[\s,;]+/) : []));
  }
  if (typeof raw === "string") {
    return raw.split(/[\s,;]+/);
  }
  return [];
}

function siteOrigin(req: Request): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return new URL(req.url).origin;
}

/**
 * POST /api/orgs/members/invite
 * Owners only. Everyone who is not already in the workspace gets a pending row plus an email
 * (invite link for new auth users, magic link for existing). Membership is granted only after
 * they complete the link and sign in (claimPendingOrgMembershipsForSessionUser + handle_new_user).
 */
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
    const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const roleRaw = typeof obj.role === "string" ? obj.role : "member";
    const role = roleRaw === "owner" ? "owner" : "member";
    if (role === "owner") {
      return NextResponse.json({ error: "Inviting as owner is not supported" }, { status: 400 });
    }

    const emails = [...new Set(parseEmailList(obj.emails).map((e) => e.trim().toLowerCase()))].filter(Boolean);
    if (emails.length === 0) {
      return NextResponse.json({ error: "Enter at least one email address" }, { status: 400 });
    }
    if (emails.length > 25) {
      return NextResponse.json({ error: "Too many addresses (max 25 per request)" }, { status: 400 });
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
      return NextResponse.json({ error: "Only workspace owners can invite people" }, { status: 403 });
    }

    const svc = createSupabaseServiceClient();
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

    const origin = siteOrigin(req);

    const results: Array<{ email: string; ok: boolean; error?: string; pending?: boolean }> = [];
    let resend: ReturnType<typeof getResendClient> | null = null;
    try {
      resend = getResendClient();
    } catch {
      resend = null;
    }

    for (const email of emails) {
      if (!isValidEmail(email)) {
        results.push({ email, ok: false, error: "Invalid email" });
        continue;
      }
      if (email === (inviterProfile?.email as string | undefined)?.trim().toLowerCase()) {
        results.push({ email, ok: false, error: "You’re already in this workspace" });
        continue;
      }

      const { data: profile, error: pErr } = await (svc as any)
        .from("profiles")
        .select("id, email")
        .ilike("email", email)
        .maybeSingle();

      if (pErr) {
        results.push({ email, ok: false, error: safeErrorMessage(pErr.message, "Lookup failed") });
        continue;
      }

      const existingUserId = (profile?.id as string | undefined) ?? null;
      if (existingUserId) {
        const { data: existing } = await (svc as any)
          .from("org_memberships")
          .select("user_id")
          .eq("org_id", orgId)
          .eq("user_id", existingUserId)
          .maybeSingle();

        if (existing) {
          await (svc as any).from("org_pending_invites").delete().eq("org_id", orgId).eq("email", email);
          results.push({ email, ok: true, error: "Already a member" });
          continue;
        }
      }

      if (!resend) {
        results.push({
          email,
          ok: false,
          error:
            "Cannot invite people until outbound email is configured (Resend).",
        });
        continue;
      }

      const inviteLinkOutcome = await createWorkspaceInviteActionLink(svc, email, orgId, origin);

      if ("actionLink" in inviteLinkOutcome) {
        try {
          await upsertPendingWorkspaceInvite(svc, {
            orgId,
            emailLower: email,
            invitedBy: userId,
          });
          const sendPromise = resend.emails.send({
            from: getFromAddress(),
            to: email,
            subject: `You’re invited to ${orgName} on Expense Terminal`,
            html: orgInviteSignupEmailHtml({
              orgName,
              inviterLabel,
              actionLink: inviteLinkOutcome.actionLink,
            }),
            text: orgInviteSignupEmailText({
              orgName,
              inviterLabel,
              actionLink: inviteLinkOutcome.actionLink,
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
          results.push({ email, ok: true, pending: true });
        } catch (mailErr) {
          console.warn("[orgs/members/invite] invite email failed", mailErr);
          results.push({
            email,
            ok: false,
            error: "Invitation is saved as pending but the email could not be sent. Use Resend on the list below.",
          });
        }
        continue;
      }

      const authHit = await lookupAuthUserForInvite(svc, email);
      if (authHit) {
        try {
          await ensureProfileForAuthUser(svc, authHit.userId, authHit.userEmail);
        } catch (pe) {
          results.push({
            email,
            ok: false,
            error: safeErrorMessage(pe instanceof Error ? pe.message : String(pe), "Could not sync profile"),
          });
          continue;
        }
      }

      const magicOutcome = await createWorkspaceMagicActionLink(svc, email, orgId, origin);
      if ("actionLink" in magicOutcome) {
        try {
          await upsertPendingWorkspaceInvite(svc, {
            orgId,
            emailLower: email,
            invitedBy: userId,
          });
          const sendPromise = resend.emails.send({
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
          results.push({ email, ok: true, pending: true });
        } catch (mailErr) {
          console.warn("[orgs/members/invite] magic-link email failed", mailErr);
          results.push({
            email,
            ok: false,
            error: "Invitation is saved as pending but the email could not be sent. Use Resend on the list below.",
          });
        }
        continue;
      }

      const raw =
        magicOutcome.error?.message ?? inviteLinkOutcome.error?.message ?? "Could not create invitation link";
      results.push({
        email,
        ok: false,
        error: safeErrorMessage(raw, "Could not invite this email"),
      });
    }

    const invited = results.filter((r) => r.ok).length;
    return NextResponse.json({ results, invited });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invite failed" },
      { status: 500 }
    );
  }
}

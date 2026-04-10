import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { generateAuthInviteLink } from "@/lib/org-invite/generate-auth-invite-link";
import { sendOrgInviteEmail } from "@/lib/email/send-org-invite";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function parseEmailList(raw: string): string[] {
  const parts = raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export async function POST(req: Request) {
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
  const supabase = authClient as any;

  let orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) {
    orgId = await ensureActiveOrgForUser(userId);
  }

  const { data: membership, error: mErr } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();

  if (mErr || !membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only workspace owners can invite members" }, { status: 403 });
  }

  let body: { emails?: unknown; role?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const role = typeof body.role === "string" ? body.role : "member";
  if (role !== "member") {
    return NextResponse.json(
      { error: "Invites can only add members with the Member role. Ownership cannot be granted by invite." },
      { status: 400 },
    );
  }

  let emails: string[];
  if (Array.isArray(body.emails)) {
    emails = body.emails.flatMap((e) => (typeof e === "string" ? parseEmailList(e) : []));
  } else if (typeof body.emails === "string") {
    emails = parseEmailList(body.emails);
  } else {
    return NextResponse.json({ error: "emails must be a string or string array" }, { status: 400 });
  }

  if (emails.length === 0) {
    return NextResponse.json({ error: "Provide at least one email address" }, { status: 400 });
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: "You can invite at most 50 addresses per request" }, { status: 400 });
  }

  for (const e of emails) {
    if (!EMAIL_RE.test(e)) {
      return NextResponse.json({ error: `Invalid email: ${e}` }, { status: 400 });
    }
  }

  const { data: orgRow } = await supabase.from("orgs").select("name").eq("id", orgId).single();
  const orgName = orgRow?.name ?? "Workspace";

  const { data: inviterProfile } = await supabase
    .from("profiles")
    .select("email, display_name, first_name")
    .eq("id", userId)
    .maybeSingle();

  const inviterEmail = (inviterProfile?.email as string | null)?.toLowerCase() ?? null;

  const inviterDisplay =
    (inviterProfile?.display_name as string | null)?.trim() ||
    (inviterProfile?.first_name as string | null)?.trim() ||
    inviterProfile?.email ||
    "A teammate";

  const admin = createSupabaseServiceClient();
  const results: Array<{ email: string; ok: boolean; error?: string }> = [];

  for (const email of emails) {
    if (inviterEmail && email === inviterEmail) {
      results.push({ email, ok: false, error: "You cannot invite yourself" });
      continue;
    }

    const { actionLink, userId: invitedUserId, error: linkErr } = await generateAuthInviteLink(
      admin,
      email,
    );

    if (linkErr || !actionLink || !invitedUserId) {
      results.push({
        email,
        ok: false,
        error: linkErr ?? "Could not create or resolve account for this email",
      });
      continue;
    }

    const { data: existingMembership } = await supabase
      .from("org_memberships")
      .select("id")
      .eq("org_id", orgId)
      .eq("user_id", invitedUserId)
      .maybeSingle();

    if (existingMembership) {
      results.push({ email, ok: false, error: "Already a member" });
      continue;
    }

    const { error: insErr } = await supabase.from("org_memberships").insert({
      org_id: orgId,
      user_id: invitedUserId,
      role,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        results.push({ email, ok: false, error: "Already a member" });
      } else {
        results.push({
          email,
          ok: false,
          error: safeErrorMessage(insErr.message, "Failed to add membership"),
        });
      }
      continue;
    }

    try {
      await sendOrgInviteEmail({
        to: email,
        orgName,
        inviterDisplay,
        actionLink,
      });
      results.push({ email, ok: true });
    } catch (e) {
      results.push({
        email,
        ok: false,
        error: e instanceof Error ? e.message : "Failed to send invite email",
      });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  return NextResponse.json({ results, invited: okCount });
}

import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { claimPendingOrgMembershipsForSessionUser } from "@/lib/orgs/claim-pending-invites";

/**
 * POST /api/orgs/claim-pending-invites
 * Adds the signed-in user to any workspace that has a pending invite for their email.
 * (Password login does not hit /auth/callback, so we call this after signInWithPassword.)
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

    const {
      data: { user },
    } = await authClient.auth.getUser();
    const email = user?.email ?? "";
    if (!email) {
      return NextResponse.json({ ok: true });
    }

    const svc = createSupabaseServiceClient();
    await claimPendingOrgMembershipsForSessionUser(svc, userId, email);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    console.warn("[claim-pending-invites]", e);
    return NextResponse.json({ ok: true });
  }
}

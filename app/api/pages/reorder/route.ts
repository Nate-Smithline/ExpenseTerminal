import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

export async function POST(req: Request) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });

    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const supabase = authClient;
    const orgId = await resolveOrgId(supabase, userId);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const idsRaw = (body as any)?.page_ids;
    if (!Array.isArray(idsRaw)) {
      return NextResponse.json({ error: "page_ids must be an array" }, { status: 400 });
    }
    const page_ids = idsRaw.map((v: unknown) => String(v)).filter(Boolean);
    if (page_ids.length === 0) return NextResponse.json({ ok: true });
    if (page_ids.length > 250) {
      return NextResponse.json({ error: "Too many pages" }, { status: 400 });
    }
    const uniq = new Set(page_ids);
    if (uniq.size !== page_ids.length) {
      return NextResponse.json({ error: "Duplicate page ids" }, { status: 400 });
    }

    const now = new Date().toISOString();
    // Keep wide gaps to support future inserts without rewriting everything.
    for (let i = 0; i < page_ids.length; i++) {
      const id = page_ids[i]!;
      const position = i * 1000;
      const { error } = await (supabase as any)
        .from("pages")
        .update({ position, updated_at: now })
        .eq("id", id)
        .eq("org_id", orgId)
        .is("deleted_at", null);
      if (error) {
        return NextResponse.json(
          { error: safeErrorMessage(error.message, "Failed to reorder pages") },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to reorder pages" },
      { status: 500 }
    );
  }
}


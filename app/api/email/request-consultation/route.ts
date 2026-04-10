/* eslint-disable @typescript-eslint/no-explicit-any -- route uses Supabase client typing */
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { sendConsultationRequestEmail } from "@/lib/email/send-consultation-request";

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

  try {
    const supabase = authClient as any;
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, first_name, last_name, display_name")
      .eq("id", userId)
      .maybeSingle();

    const fromEmail = (profile?.email as string | null) ?? null;
    const fromName =
      ((profile?.display_name as string | null) ??
        [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim()) ||
      null;

    await sendConsultationRequestEmail({
      fromUserId: userId,
      fromEmail,
      fromName,
    });

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: safeErrorMessage(e instanceof Error ? e.message : String(e), "Failed to send consultation request") },
      { status: 500 },
    );
  }
}


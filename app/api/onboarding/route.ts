import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { computeTrialStatus } from "@/lib/billing/trial";

const VALID_STEPS = ["connect", "tag", "tax", "budget", "sub"] as const;
type OnbStep = (typeof VALID_STEPS)[number];

export async function GET() {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  const [profileResult, subResult, dsResult] = await Promise.all([
    (authClient as any)
      .from("profiles")
      .select("first_name, created_at, onboarding_progress")
      .eq("id", userId)
      .single(),
    (authClient as any)
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (authClient as any)
      .from("data_sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const profile = profileResult.data ?? {};
  const sub = subResult.data ?? null;
  const dsCount = (dsResult.count as number) ?? 0;

  const progress = (profile.onboarding_progress as Record<string, boolean> | null) ?? {};
  const subStatus = sub?.status ?? null;
  const periodEnd = sub?.current_period_end ?? null;

  const steps: Record<OnbStep, boolean> = {
    connect: dsCount > 0 || progress.connect === true,
    tag:     progress.tag === true,
    tax:     progress.tax === true,
    budget:  progress.budget === true,
    sub:     subStatus === "active" || subStatus === "trialing" || subStatus === "past_due" || progress.sub === true,
  };

  const trial = computeTrialStatus(
    profile.created_at ?? new Date().toISOString(),
    subStatus,
    periodEnd
  );

  return NextResponse.json({
    firstName: profile.first_name ?? null,
    steps,
    trial,
  });
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;

  let body: { step?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const step = body.step as OnbStep | undefined;
  if (!step || !VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  // Fetch current progress
  const { data: profile } = await (authClient as any)
    .from("profiles")
    .select("onboarding_progress")
    .eq("id", userId)
    .single();

  const current = (profile?.onboarding_progress as Record<string, boolean> | null) ?? {};
  const updated = { ...current, [step]: true };

  const supabase = createSupabaseServiceClient();
  await (supabase as any)
    .from("profiles")
    .update({ onboarding_progress: updated, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return NextResponse.json({ ok: true, step });
}

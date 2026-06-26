import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { computeTrialStatus } from "@/lib/billing/trial";

const VALID_STEPS = ["email", "profile", "reminders", "industry", "connect"] as const;
type OnbStep = (typeof VALID_STEPS)[number];

const ENTITY_TYPES = new Set(["sole_prop", "llc", "s_corp", "partnership", "other"]);
const FILING_STATUSES = new Set([
  "single",
  "married_joint",
  "married_separate",
  "head_of_household",
  "qualifying_surviving_spouse",
]);
const REMINDER_FREQUENCIES = new Set(["daily", "weekly", "biweekly", "monthly"]);

type QueryResult<T = unknown> = {
  data?: T | null;
  count?: number | null;
  error?: { message?: string } | null;
};

type QueryBuilder<T = unknown> = PromiseLike<QueryResult<T>> & {
  select: (columns?: string, options?: unknown) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  order: (column: string, options?: unknown) => QueryBuilder<T>;
  limit: (count: number) => QueryBuilder<T>;
  single: () => Promise<QueryResult<T>>;
  maybeSingle: () => Promise<QueryResult<T>>;
  update: (values: Record<string, unknown>) => QueryBuilder<T>;
};

type LooseSupabase = {
  from: <T = unknown>(table: string) => QueryBuilder<T>;
};

type ProfileRow = {
  first_name?: string | null;
  created_at?: string | null;
  onboarding_progress?: Record<string, boolean> | null;
  expected_income?: number | null;
  entity_type?: string | null;
  filing_status?: string | null;
  triage_reminder_frequency?: string | null;
  industry?: string | null;
  industry_custom?: string | null;
  onboarding_completed_at?: string | null;
};

type SubscriptionRow = {
  status?: string | null;
  current_period_end?: string | null;
};

function isEmailVerified(user: User): boolean {
  const meta = user.user_metadata as { email_confirm?: boolean } | null;
  return user.email_confirmed_at != null || meta?.email_confirm === true;
}

async function getSignedInUser() {
  const authClient = await createSupabaseRouteClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  return { authClient, user };
}

function profileStepComplete(profile: ProfileRow): boolean {
  return (
    profile.expected_income != null &&
    Boolean(profile.entity_type) &&
    Boolean(profile.filing_status)
  );
}

export async function GET() {
  const { authClient, user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
  const emailVerified = isEmailVerified(user);

  const [profileResult, subResult, dsResult] = await Promise.all([
    (authClient as unknown as LooseSupabase)
      .from<ProfileRow>("profiles")
      .select(`
        first_name,
        created_at,
        onboarding_progress,
        expected_income,
        entity_type,
        filing_status,
        triage_reminder_frequency,
        industry,
        industry_custom,
        onboarding_completed_at
      `)
      .eq("id", userId)
      .single(),
    (authClient as unknown as LooseSupabase)
      .from<SubscriptionRow>("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    (authClient as unknown as LooseSupabase)
      .from("data_sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
  ]);

  const profile: ProfileRow = profileResult.data ?? {};
  const sub = subResult.data ?? null;
  const dsCount = (dsResult.count as number) ?? 0;

  const progress = (profile.onboarding_progress as Record<string, boolean> | null) ?? {};
  const subStatus = sub?.status ?? null;
  const periodEnd = sub?.current_period_end ?? null;

  const steps: Record<OnbStep, boolean> = {
    email: emailVerified || progress.email === true,
    profile: profileStepComplete(profile) || progress.profile === true,
    reminders: Boolean(profile.triage_reminder_frequency) || progress.reminders === true,
    industry: Boolean(profile.industry) || progress.industry === true,
    connect: dsCount > 0 || progress.connect === true,
  };
  const legacyCompleted =
    steps.connect &&
    (progress.tag === true ||
      progress.tax === true ||
      progress.budget === true ||
      progress.sub === true);
  const completed =
    Boolean(profile.onboarding_completed_at) ||
    progress.completed === true ||
    legacyCompleted ||
    VALID_STEPS.every((step) => steps[step]);

  const trial = computeTrialStatus(
    profile.created_at ?? new Date().toISOString(),
    subStatus,
    periodEnd
  );

  return NextResponse.json({
    userId,
    email: user.email ?? null,
    emailVerified,
    firstName: profile.first_name ?? null,
    profile: {
      expectedIncome: profile.expected_income ?? null,
      entityType: profile.entity_type ?? null,
      filingStatus: profile.filing_status ?? null,
      triageReminderFrequency: profile.triage_reminder_frequency ?? null,
      industry: profile.industry ?? null,
      industryCustom: profile.industry_custom ?? null,
      onboardingCompletedAt: profile.onboarding_completed_at ?? null,
    },
    steps,
    completed,
    trial,
  });
}

export async function POST(req: Request) {
  const { authClient, user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
  const emailVerified = isEmailVerified(user);

  let body: {
    step?: string;
    expectedIncome?: number | string | null;
    entityType?: string | null;
    filingStatus?: string | null;
    triageReminderFrequency?: string | null;
    industry?: string | null;
    industryCustom?: string | null;
    complete?: boolean;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const step = body.step as OnbStep | undefined;
  if (!step || !VALID_STEPS.includes(step)) {
    return NextResponse.json({ error: "Invalid step" }, { status: 400 });
  }

  const { data: profile } = await (authClient as unknown as LooseSupabase)
    .from<Pick<ProfileRow, "onboarding_progress">>("profiles")
    .select("onboarding_progress")
    .eq("id", userId)
    .single();

  const current = (profile?.onboarding_progress as Record<string, boolean> | null) ?? {};
  const updated = { ...current, [step]: true };
  if (emailVerified) updated.email = true;

  const patch: Record<string, unknown> = {
    onboarding_progress: updated,
    updated_at: new Date().toISOString(),
  };

  if (step === "profile") {
    const expectedIncome =
      typeof body.expectedIncome === "string"
        ? Number(body.expectedIncome.replace(/[$,\s]/g, ""))
        : body.expectedIncome;

    if (typeof expectedIncome !== "number" || !Number.isFinite(expectedIncome) || expectedIncome < 0) {
      return NextResponse.json({ error: "Expected income must be a positive number" }, { status: 400 });
    }
    if (!body.entityType || !ENTITY_TYPES.has(body.entityType)) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    if (!body.filingStatus || !FILING_STATUSES.has(body.filingStatus)) {
      return NextResponse.json({ error: "Invalid filing status" }, { status: 400 });
    }

    patch.expected_income = expectedIncome;
    patch.entity_type = body.entityType;
    patch.filing_status = body.filingStatus;
  }

  if (step === "reminders") {
    if (!body.triageReminderFrequency || !REMINDER_FREQUENCIES.has(body.triageReminderFrequency)) {
      return NextResponse.json({ error: "Invalid reminder frequency" }, { status: 400 });
    }
    patch.triage_reminder_frequency = body.triageReminderFrequency;
  }

  if (step === "industry") {
    const industry = body.industry?.trim();
    const custom = body.industryCustom?.trim() || null;
    if (!industry) {
      return NextResponse.json({ error: "Industry is required" }, { status: 400 });
    }
    patch.industry = industry;
    patch.industry_custom = industry === "custom" ? custom : null;
  }

  if (body.complete) {
    patch.onboarding_completed_at = new Date().toISOString();
    updated.completed = true;
  }

  const supabase = createSupabaseServiceClient();
  await (supabase as unknown as LooseSupabase)
    .from("profiles")
    .update(patch)
    .eq("id", userId);

  return NextResponse.json({ ok: true, step });
}

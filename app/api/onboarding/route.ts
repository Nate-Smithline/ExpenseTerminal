import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { computeTrialStatus } from "@/lib/billing/trial";
import { INCOME_BRACKETS, parseFilingStatus, type FilingStatus } from "@/lib/tax/filing-status";

const VALID_STEPS = ["email", "profile", "reminders", "industry", "connect"] as const;
type OnbStep = (typeof VALID_STEPS)[number];

const ENTITY_TYPES = new Set(["sole_prop", "llc", "s_corp", "partnership", "other"]);
const FILING_STATUSES = new Set([
  "single",
  "married_joint",
  "married_filing_jointly",
  "married_separate",
  "married_filing_separately",
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
  upsert: (values: Record<string, unknown>, options?: unknown) => QueryBuilder<T>;
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

type TaxYearSettingsRow = {
  expected_income_range?: string | null;
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

function normalizeFilingStatus(value: string | null | undefined): FilingStatus | null {
  if (value === "married_joint") return "married_filing_jointly";
  if (value === "married_separate") return "married_filing_separately";
  return parseFilingStatus(value);
}

function estimatedIncomeFromRange(rangeId: string): number {
  const [, rawRange] = rangeId.split(":");
  if (!rawRange) return 0;
  if (rawRange.endsWith("-plus")) {
    const min = Number(rawRange.replace("-plus", ""));
    return Number.isFinite(min) ? min : 0;
  }
  const [min, max] = rawRange.split("-").map((value) => Number(value));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.round((min + max) / 2);
}

function currentTaxYear(): number {
  return new Date().getFullYear();
}

export async function GET() {
  const { authClient, user } = await getSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = user.id;
  const emailVerified = isEmailVerified(user);
  const taxYear = currentTaxYear();

  const [profileResult, subResult, dsResult, taxSettingsResult] = await Promise.all([
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
    (authClient as unknown as LooseSupabase)
      .from<TaxYearSettingsRow>("tax_year_settings")
      .select("expected_income_range")
      .eq("user_id", userId)
      .eq("tax_year", taxYear)
      .maybeSingle(),
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
      expectedIncomeRange: taxSettingsResult.data?.expected_income_range ?? null,
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
    expectedIncomeRange?: string | null;
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

  let selectedFilingStatus: FilingStatus | null = null;
  let selectedBracket: { id: string; taxRate: number } | null = null;

  if (step === "profile") {
    if (!body.entityType || !ENTITY_TYPES.has(body.entityType)) {
      return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
    }
    if (!body.filingStatus || !FILING_STATUSES.has(body.filingStatus)) {
      return NextResponse.json({ error: "Invalid filing status" }, { status: 400 });
    }
    selectedFilingStatus = normalizeFilingStatus(body.filingStatus);
    if (!selectedFilingStatus) {
      return NextResponse.json({ error: "Invalid filing status" }, { status: 400 });
    }
    selectedBracket = INCOME_BRACKETS[selectedFilingStatus]?.find((option) => option.id === body.expectedIncomeRange) ?? null;
    if (!selectedBracket) {
      return NextResponse.json({ error: "Select an IRS income range" }, { status: 400 });
    }

    patch.expected_income = estimatedIncomeFromRange(selectedBracket.id);
    patch.entity_type = body.entityType;
    patch.filing_status = selectedFilingStatus;
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

  if (step === "profile" && selectedBracket) {
    await (supabase as unknown as LooseSupabase)
      .from("org_settings")
      .upsert(
        {
          user_id: userId,
          filing_type: body.entityType,
          personal_filing_status: selectedFilingStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    await (supabase as unknown as LooseSupabase)
      .from("tax_year_settings")
      .upsert(
        {
          user_id: userId,
          tax_year: currentTaxYear(),
          tax_rate: selectedBracket.taxRate,
          expected_income_range: selectedBracket.id,
        },
        { onConflict: "user_id,tax_year" }
      );
  }

  return NextResponse.json({ ok: true, step });
}

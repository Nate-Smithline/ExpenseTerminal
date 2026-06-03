import type { SupabaseClient } from "@supabase/supabase-js";
import type { Marker } from "@/components/MarkerPill";
import { getTriageTaxRate, deductionFromMarker, taxableIncomeFromMarker } from "@/lib/triage/tax-rate";

export const TRIAGE_BADGES = {
  first_sort: { id: "first_sort", label: "First sort", description: "Tagged your first transaction" },
  sorted_10: { id: "sorted_10", label: "Getting warm", description: "Sorted 10 transactions" },
  sorted_50: { id: "sorted_50", label: "On a roll", description: "Sorted 50 transactions" },
  streak_3: { id: "streak_3", label: "3-day streak", description: "Sorted on 3 days in a row" },
  streak_7: { id: "streak_7", label: "Week warrior", description: "Sorted on 7 days in a row" },
  first_rule: { id: "first_rule", label: "Rule maker", description: "Created your first auto-rule" },
  saved_1k: { id: "saved_1k", label: "Tax hero", description: "Saved $1,000+ in estimated taxes" },
} as const;

export type TriageBadgeId = keyof typeof TRIAGE_BADGES;

export type TriageProgressRow = {
  user_id: string;
  total_sorted: number;
  rules_created: number;
  lifetime_deductions: number;
  lifetime_tax_saved: number;
  current_streak: number;
  longest_streak: number;
  last_triage_date: string | null;
  badges: string[];
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function computeStreak(
  lastDate: string | null,
  currentStreak: number,
): { currentStreak: number; longestStreakBump: number } {
  const today = todayUtc();
  const yesterday = yesterdayUtc();
  if (lastDate === today) {
    return { currentStreak, longestStreakBump: 0 };
  }
  if (lastDate === yesterday) {
    return { currentStreak: currentStreak + 1, longestStreakBump: currentStreak + 1 };
  }
  return { currentStreak: 1, longestStreakBump: 1 };
}

function awardBadges(
  existing: string[],
  stats: {
    totalSorted: number;
    rulesCreated: number;
    currentStreak: number;
    lifetimeTaxSaved: number;
  },
): string[] {
  const badges = new Set(existing);
  if (stats.totalSorted >= 1) badges.add("first_sort");
  if (stats.totalSorted >= 10) badges.add("sorted_10");
  if (stats.totalSorted >= 50) badges.add("sorted_50");
  if (stats.currentStreak >= 3) badges.add("streak_3");
  if (stats.currentStreak >= 7) badges.add("streak_7");
  if (stats.rulesCreated >= 1) badges.add("first_rule");
  if (stats.lifetimeTaxSaved >= 1000) badges.add("saved_1k");
  return [...badges];
}

export async function getOrCreateTriageProgress(
  supabase: SupabaseClient,
  userId: string,
): Promise<TriageProgressRow> {
  const { data, error } = await (supabase as any)
    .from("triage_progress")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data) {
    return normalizeProgressRow(data);
  }

  const { data: inserted, error: insertErr } = await (supabase as any)
    .from("triage_progress")
    .insert({ user_id: userId })
    .select("*")
    .single();

  if (insertErr) {
    throw new Error(insertErr.message);
  }

  return normalizeProgressRow(inserted);
}

function normalizeProgressRow(row: Record<string, unknown>): TriageProgressRow {
  const badges = row.badges;
  return {
    user_id: String(row.user_id),
    total_sorted: Number(row.total_sorted ?? 0),
    rules_created: Number(row.rules_created ?? 0),
    lifetime_deductions: Number(row.lifetime_deductions ?? 0),
    lifetime_tax_saved: Number(row.lifetime_tax_saved ?? 0),
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_triage_date: row.last_triage_date ? String(row.last_triage_date) : null,
    badges: Array.isArray(badges) ? badges.map(String) : [],
  };
}

export async function recordTriageDecision(
  supabase: SupabaseClient,
  userId: string,
  input: {
    amount: number;
    marker: Marker;
    businessPct: number;
    transactionType: "income" | "expense";
  },
): Promise<{ progress: TriageProgressRow; newBadges: string[] }> {
  if (!input.marker) {
    throw new Error("Marker required");
  }

  const progress = await getOrCreateTriageProgress(supabase, userId);
  const rate = getTriageTaxRate(userId);

  let deltaDeduction = 0;
  let deltaTax = 0;
  if (input.transactionType === "expense") {
    deltaDeduction = deductionFromMarker(input.amount, input.marker, input.businessPct);
    deltaTax = deltaDeduction * rate;
  } else {
    const taxable = taxableIncomeFromMarker(input.amount, input.marker, input.businessPct);
    deltaTax = taxable * rate;
    deltaDeduction = taxable;
  }

  const { currentStreak, longestStreakBump } = computeStreak(
    progress.last_triage_date,
    progress.current_streak,
  );
  const longestStreak = Math.max(progress.longest_streak, longestStreakBump);

  const totalSorted = progress.total_sorted + 1;
  const lifetimeDeductions = progress.lifetime_deductions + deltaDeduction;
  const lifetimeTaxSaved = progress.lifetime_tax_saved + deltaTax;

  const badges = awardBadges(progress.badges, {
    totalSorted,
    rulesCreated: progress.rules_created,
    currentStreak,
    lifetimeTaxSaved,
  });

  const newBadges = badges.filter((b) => !progress.badges.includes(b));

  const { data: updated, error } = await (supabase as any)
    .from("triage_progress")
    .update({
      total_sorted: totalSorted,
      lifetime_deductions: lifetimeDeductions,
      lifetime_tax_saved: lifetimeTaxSaved,
      current_streak: currentStreak,
      longest_streak: longestStreak,
      last_triage_date: todayUtc(),
      badges,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { progress: normalizeProgressRow(updated), newBadges };
}

export async function recordTriageRuleCreated(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ progress: TriageProgressRow; newBadges: string[] }> {
  const progress = await getOrCreateTriageProgress(supabase, userId);
  const rulesCreated = progress.rules_created + 1;
  const badges = awardBadges(progress.badges, {
    totalSorted: progress.total_sorted,
    rulesCreated,
    currentStreak: progress.current_streak,
    lifetimeTaxSaved: progress.lifetime_tax_saved,
  });
  const newBadges = badges.filter((b) => !progress.badges.includes(b));

  const { data: updated, error } = await (supabase as any)
    .from("triage_progress")
    .update({
      rules_created: rulesCreated,
      badges,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { progress: normalizeProgressRow(updated), newBadges };
}

/** Revert a single decision from progress stats (undo). Best-effort. */
export async function revertTriageDecision(
  supabase: SupabaseClient,
  userId: string,
  input: {
    amount: number;
    marker: Marker;
    businessPct: number;
    transactionType: "income" | "expense";
  },
): Promise<TriageProgressRow> {
  if (!input.marker) {
    return getOrCreateTriageProgress(supabase, userId);
  }

  const progress = await getOrCreateTriageProgress(supabase, userId);
  const rate = getTriageTaxRate(userId);

  let deltaDeduction = 0;
  let deltaTax = 0;
  if (input.transactionType === "expense") {
    deltaDeduction = deductionFromMarker(input.amount, input.marker, input.businessPct);
    deltaTax = deltaDeduction * rate;
  } else {
    const taxable = taxableIncomeFromMarker(input.amount, input.marker, input.businessPct);
    deltaTax = taxable * rate;
    deltaDeduction = taxable;
  }

  const totalSorted = Math.max(0, progress.total_sorted - 1);
  const lifetimeDeductions = Math.max(0, progress.lifetime_deductions - deltaDeduction);
  const lifetimeTaxSaved = Math.max(0, progress.lifetime_tax_saved - deltaTax);

  const { data: updated, error } = await (supabase as any)
    .from("triage_progress")
    .update({
      total_sorted: totalSorted,
      lifetime_deductions: lifetimeDeductions,
      lifetime_tax_saved: lifetimeTaxSaved,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return normalizeProgressRow(updated);
}

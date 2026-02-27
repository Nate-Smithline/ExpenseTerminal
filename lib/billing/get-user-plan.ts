import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlanDefinition } from "@/lib/billing/plans";
import type { PlanId } from "@/lib/billing/plans";

const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

export type PlanLimits = {
  plan: PlanId;
  maxCsvTransactionsForAi: number;
  subscription?: { status: string | null };
};

/**
 * Returns effective plan for the user from subscriptions table.
 * Canceled or missing subscription -> "free".
 */
export async function getUserPlan(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanId> {
  const { data } = await (supabase as any)
    .from("subscriptions")
    .select("plan, status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.plan || !data?.status) return "free";
  if (data.status === "canceled") return "free";
  if (ACTIVE_STATUSES.includes(data.status)) {
    if (data.plan === "starter" || data.plan === "plus") return data.plan;
  }
  return "free";
}

/**
 * Static limits for a plan (no DB). Used by tests and for consistent cap logic.
 */
export function getPlanLimitsStatic(planId: PlanId): {
  maxCsvTransactionsForAi: number;
  aiEnabled: boolean;
} {
  const def = getPlanDefinition(planId);
  const maxCsv =
    def.maxCsvTransactionsForAi == null
      ? Number.POSITIVE_INFINITY
      : def.maxCsvTransactionsForAi;
  return {
    maxCsvTransactionsForAi: maxCsv,
    aiEnabled: def.aiEnabled,
  };
}

/**
 * Full limits for the user: plan, CSV cap, and subscription status for display.
 */
export async function getPlanLimitsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PlanLimits> {
  const plan = await getUserPlan(supabase, userId);
  const staticLimits = getPlanLimitsStatic(plan);

  const { data: sub } = await (supabase as any)
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    plan,
    maxCsvTransactionsForAi: staticLimits.maxCsvTransactionsForAi,
    subscription: sub ? { status: sub.status } : undefined,
  };
}

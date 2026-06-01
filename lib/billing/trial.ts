export const TRIAL_DAYS = 15;

export type TrialStatus = "trial" | "subscribed" | "expired";

export type TrialStatusResult = {
  status: TrialStatus;
  daysLeft: number;
  trialEndsAt: string | null;
};

/**
 * Compute the user's trial / subscription status from raw DB data.
 * - subscriptionStatus: value from subscriptions.status (active, trialing, canceled, null)
 * - currentPeriodEnd: subscriptions.current_period_end (ISO string or null)
 * - profileCreatedAt: profiles.created_at (ISO string)
 */
export function computeTrialStatus(
  profileCreatedAt: string,
  subscriptionStatus: string | null,
  currentPeriodEnd: string | null
): TrialStatusResult {
  const now = new Date();

  if (subscriptionStatus === "active" || subscriptionStatus === "past_due") {
    return { status: "subscribed", daysLeft: 0, trialEndsAt: currentPeriodEnd };
  }

  if (subscriptionStatus === "trialing" && currentPeriodEnd) {
    const endsAt = new Date(currentPeriodEnd);
    const daysLeft = Math.max(
      0,
      Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000)
    );
    return {
      status: daysLeft > 0 ? "trial" : "expired",
      daysLeft,
      trialEndsAt: currentPeriodEnd,
    };
  }

  // No subscription or canceled → check account age
  const trialEnd = new Date(profileCreatedAt);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);
  const daysLeft = Math.max(
    0,
    Math.ceil((trialEnd.getTime() - now.getTime()) / 86_400_000)
  );

  if (subscriptionStatus === "canceled") {
    return { status: "expired", daysLeft: 0, trialEndsAt: trialEnd.toISOString() };
  }

  return {
    status: daysLeft > 0 ? "trial" : "expired",
    daysLeft,
    trialEndsAt: trialEnd.toISOString(),
  };
}

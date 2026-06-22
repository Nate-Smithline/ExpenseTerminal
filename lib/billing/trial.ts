export const TRIAL_DAYS = 15;

/**
 * Trial / subscription states.
 * - "none": no payment method on file yet — the user must add a card via Stripe
 *   Checkout to start their 15-day free trial. This is the default for brand-new
 *   accounts now that the trial is card-required.
 * - "trial": inside the 15-day Stripe trial (card on file, not yet charged).
 * - "subscribed": active paid subscription.
 * - "expired": trial ended / subscription canceled.
 */
export type TrialStatus = "none" | "trial" | "subscribed" | "expired";

export type TrialStatusResult = {
  status: TrialStatus;
  daysLeft: number;
  trialEndsAt: string | null;
};

/**
 * Compute the user's trial / subscription status from raw DB data.
 *
 * The free trial is card-required: a user only has trial access once they've
 * gone through Stripe Checkout, which creates a `trialing` subscription with a
 * card on file. Without a subscription the user is in the "none" state and must
 * add a card before they can use the app — there is no account-age free trial.
 *
 * - subscriptionStatus: value from subscriptions.status (active, trialing, canceled, null)
 * - currentPeriodEnd: subscriptions.current_period_end (ISO string or null)
 * - profileCreatedAt: profiles.created_at (kept for compatibility; no longer grants access)
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

  // A canceled subscription means the user previously had access and lost it.
  if (subscriptionStatus === "canceled") {
    return { status: "expired", daysLeft: 0, trialEndsAt: currentPeriodEnd };
  }

  // No subscription on file → the card-required trial has not started yet.
  return { status: "none", daysLeft: 0, trialEndsAt: null };
}

export const TRIAL_DAYS = 15;

/**
 * Trial / subscription states.
 * - "none": account creation date is missing or invalid.
 * - "trial": inside the 15-day free access window from account creation.
 * - "subscribed": active paid subscription.
 * - "expired": account trial ended / subscription canceled.
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
 * Free access is account-age based: a user gets at most TRIAL_DAYS from account
 * creation, whether or not they start Stripe Checkout. Checkout may add billing,
 * but it cannot create a second free period beyond the account window.
 *
 * - subscriptionStatus: value from subscriptions.status (active, trialing, canceled, null)
 * - currentPeriodEnd: subscriptions.current_period_end (ISO string or null)
 * - profileCreatedAt: profiles.created_at
 */
export function computeTrialStatus(
  profileCreatedAt: string,
  subscriptionStatus: string | null,
  currentPeriodEnd: string | null
): TrialStatusResult {
  const now = new Date();
  const accountTrialEndsAt = getAccountTrialEndsAt(profileCreatedAt);

  if (subscriptionStatus === "active" || subscriptionStatus === "past_due") {
    return { status: "subscribed", daysLeft: 0, trialEndsAt: currentPeriodEnd };
  }

  // A canceled subscription means the user previously had access and lost it.
  if (subscriptionStatus === "canceled") {
    return { status: "expired", daysLeft: 0, trialEndsAt: currentPeriodEnd };
  }

  if (!accountTrialEndsAt) {
    return { status: "none", daysLeft: 0, trialEndsAt: null };
  }

  const daysLeft = Math.max(
    0,
    Math.ceil((accountTrialEndsAt.getTime() - now.getTime()) / 86_400_000)
  );

  return {
    status: daysLeft > 0 ? "trial" : "expired",
    daysLeft,
    trialEndsAt: accountTrialEndsAt.toISOString(),
  };
}

export function getAccountTrialEndsAt(profileCreatedAt: string): Date | null {
  const createdAt = new Date(profileCreatedAt);
  if (Number.isNaN(createdAt.getTime())) return null;
  return new Date(createdAt.getTime() + TRIAL_DAYS * 86_400_000);
}

export function remainingAccountTrialDaysForCheckout(profileCreatedAt: string): number {
  const endsAt = getAccountTrialEndsAt(profileCreatedAt);
  if (!endsAt) return 0;
  const msLeft = endsAt.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.floor(msLeft / 86_400_000);
}

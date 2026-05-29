import type { BillingInterval } from "@/lib/billing/plans";
import type { StripeMode } from "@/lib/stripe";

/** Resolve Stripe Price ID for Pro — test keys on localhost, live in production. */
export function getStripePriceId(interval: BillingInterval, mode: StripeMode): string | null {
  if (interval === "month") {
    return mode === "test"
      ? process.env.STRIPE_PRICE_ID_MONTHLY_TEST ??
          process.env.STRIPE_PRICE_ID_MONTHLY_LOCAL ??
          null
      : process.env.STRIPE_PRICE_ID_MONTHLY ??
          process.env.STRIPE_PRICE_ID_MONTHLY_LIVE ??
          null;
  }
  return mode === "test"
    ? process.env.STRIPE_PRICE_ID_ANNUAL_TEST ??
        process.env.STRIPE_PRICE_ID_ANNUAL_LOCAL ??
        null
    : process.env.STRIPE_PRICE_ID_ANNUAL ??
        process.env.STRIPE_PRICE_ID_ANNUAL_LIVE ??
        null;
}

export function assertStripePriceEnv(interval: BillingInterval, mode: StripeMode): void {
  const id = getStripePriceId(interval, mode);
  if (!id) {
    const suffix = mode === "test" ? "_TEST or _LOCAL" : " or _LIVE";
    const key =
      interval === "month"
        ? `STRIPE_PRICE_ID_MONTHLY${suffix}`
        : `STRIPE_PRICE_ID_ANNUAL${suffix}`;
    throw new Error(`Stripe price is not configured for ${mode} mode. Set ${key} in env.`);
  }
}

/** Map a subscribed Stripe price back to app plan (Pro only for new checkout). */
export function planForStripePriceId(
  priceId: string,
  mode: StripeMode
): "plus" | null {
  const monthly = getStripePriceId("month", mode);
  const yearly = getStripePriceId("year", mode);
  if (priceId && (priceId === monthly || priceId === yearly)) return "plus";
  return null;
}

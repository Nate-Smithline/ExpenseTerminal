import Stripe from "stripe";
import type { PlanId } from "@/lib/billing/plans";

export type StripeMode = "live" | "test";

const STRIPE_SECRET_TEST = process.env.STRIPE_SECRET_KEY_TEST ?? "";
const STRIPE_SECRET_LIVE = process.env.STRIPE_SECRET_KEY ?? "";

const STARTER_PRODUCT_ID_TEST = process.env.STRIPE_STARTER_PRODUCT_ID_TEST ?? null;
const PLUS_PRODUCT_ID_TEST = process.env.STRIPE_PLUS_PRODUCT_ID_TEST ?? null;
const STARTER_PRODUCT_ID_LIVE = process.env.STRIPE_STARTER_PRODUCT_ID ?? null;
const PLUS_PRODUCT_ID_LIVE = process.env.STRIPE_PLUS_PRODUCT_ID ?? null;

/**
 * Use test mode on localhost/127.0.0.1 so Stripe CLI and test cards work;
 * use live on production host (e.g. expenseterminal.com).
 */
export function getStripeModeForHostname(hostname: string): StripeMode {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return "test";
  return "live";
}

function getSecretKey(mode: StripeMode): string {
  return mode === "test" ? STRIPE_SECRET_TEST : STRIPE_SECRET_LIVE;
}

export function getStripeClient(mode: StripeMode): Stripe {
  const key = getSecretKey(mode);
  if (!key) {
    throw new Error(`Stripe secret key not configured for mode: ${mode}`);
  }
  return new Stripe(key);
}

export function getStripeProductIdForPlan(plan: "starter" | "plus", mode: StripeMode): string | null {
  if (plan === "starter") return mode === "test" ? STARTER_PRODUCT_ID_TEST : STARTER_PRODUCT_ID_LIVE;
  return mode === "test" ? PLUS_PRODUCT_ID_TEST : PLUS_PRODUCT_ID_LIVE;
}

/**
 * Throws if the given plan's Stripe product ID is not set for the given mode.
 * Call before creating checkout so we return a clear error instead of Stripe API error.
 */
export function assertStripeProductEnv(plan: "starter" | "plus", mode: StripeMode): void {
  const id = getStripeProductIdForPlan(plan, mode);
  if (!id) {
    throw new Error(
      `Stripe product for plan "${plan}" is not configured for ${mode} mode. Set STRIPE_${plan === "starter" ? "STARTER" : "PLUS"}_PRODUCT_ID${mode === "test" ? "_TEST" : ""} in env.`
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseRouteClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import {
  getStripeClient,
  getStripeModeForHostname,
  getStripeProductIdForPlan,
} from "@/lib/stripe";

function planForProductId(productId: string, mode: "test" | "live"): "starter" | "plus" | null {
  if (productId === getStripeProductIdForPlan("starter", mode)) return "starter";
  if (productId === getStripeProductIdForPlan("plus", mode)) return "plus";
  return null;
}

/**
 * Sync subscription state from Stripe into our DB. Call when the user returns from
 * the billing portal or when loading the billing page so we pick up cancellations
 * and other changes.
 */
export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const url = new URL(req.url);
  const mode = getStripeModeForHostname(url.hostname);
  const stripe = getStripeClient(mode);

  let supabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    supabase = authClient as any;
  }

  const { data: ourRow } = await (supabase as any)
    .from("subscriptions")
    .select("id, stripe_customer_id, stripe_subscription_id, plan")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!ourRow?.stripe_customer_id) {
    return NextResponse.json({ ok: true, updated: false });
  }

  const customerId = ourRow.stripe_customer_id as string;
  const ourSubId = ourRow.stripe_subscription_id as string | null;
  const existingPlan = ourRow.plan as string | null;

  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  let subscription = ourSubId ? list.data.find((s) => s.id === ourSubId) : null;
  if (!subscription && list.data.length > 0) {
    subscription =
      list.data.find((s) => ["active", "trialing", "past_due"].includes(s.status ?? "")) ??
      list.data[0];
  }

  if (!subscription) {
    const { error: updateError } = await (supabase as any)
      .from("subscriptions")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.userId);
    if (updateError) {
      console.error("[billing/sync-subscription] update canceled error", updateError);
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, updated: true, status: "canceled" });
  }

  const item = subscription.items?.data?.[0];
  const productId = item?.price?.product
    ? (typeof item.price.product === "string" ? item.price.product : item.price.product.id)
    : null;
  const plan = productId ? planForProductId(productId, mode) : null;
  const priceId = item?.price?.id ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const status = subscription.status ?? "active";
  const finalPlan = plan ?? (existingPlan === "plus" ? "plus" : "starter");

  const { error: updateError } = await (supabase as any)
    .from("subscriptions")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_product_id: productId,
      stripe_price_id: priceId,
      plan: finalPlan,
      status,
      current_period_end: currentPeriodEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.userId);

  if (updateError) {
    console.error("[billing/sync-subscription] update error", updateError);
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: true, status });
}
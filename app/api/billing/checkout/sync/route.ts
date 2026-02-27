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

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  const url = new URL(req.url);
  const mode = getStripeModeForHostname(url.hostname);
  const stripe = getStripeClient(mode);

  let sessionId: string | null = url.searchParams.get("session_id");

  if (!sessionId) {
    try {
      const body = await req.json().catch(() => ({}));
      sessionId = (body.session_id ?? body.sessionId) ?? null;
    } catch {
      // body already consumed or not JSON
    }
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "Missing session_id (query or body)" },
      { status: 400 }
    );
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  const subscriptionId =
    typeof session.subscription === "object" && session.subscription?.id
      ? session.subscription.id
      : typeof session.subscription === "string"
        ? session.subscription
        : null;

  if (!subscriptionId) {
    return NextResponse.json(
      { error: "Checkout session has no subscription" },
      { status: 400 }
    );
  }

  const subscription =
    typeof session.subscription === "object"
      ? session.subscription
      : await stripe.subscriptions.retrieve(subscriptionId);

  if (!subscription) {
    return NextResponse.json(
      { error: "Could not load subscription" },
      { status: 400 }
    );
  }

  const item = subscription.items?.data?.[0];
  const productId = item?.price?.product
    ? (typeof item.price.product === "string" ? item.price.product : item.price.product.id)
    : null;

  if (!productId) {
    return NextResponse.json(
      { error: "Subscription has no product" },
      { status: 400 }
    );
  }

  const plan = planForProductId(productId, mode);
  if (!plan) {
    return NextResponse.json(
      { error: "Product not mapped to a plan" },
      { status: 400 }
    );
  }

  const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  const priceId = item?.price?.id ?? null;
  const currentPeriodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toISOString()
    : null;
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const status = subscription.status ?? "active";

  // Prefer service-role client so the write isn't blocked by RLS (session may not
  // be available in this request). We've already verified the user via requireAuth.
  let supabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    supabase = authClient as any;
  }

  const { data: existing } = await (supabase as any)
    .from("subscriptions")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (existing?.id) {
    const { error: updateError } = await (supabase as any)
      .from("subscriptions")
      .update({
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        plan,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.userId);
    if (updateError) {
      console.error("[billing/sync] update error", updateError);
      return NextResponse.json(
        { error: "Failed to save subscription", details: updateError.message },
        { status: 500 }
      );
    }
  } else {
    const { error: insertError } = await (supabase as any)
      .from("subscriptions")
      .insert({
        user_id: auth.userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        plan,
        status,
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
      });
    if (insertError) {
      console.error("[billing/sync] insert error", insertError);
      return NextResponse.json(
        { error: "Failed to save subscription", details: insertError.message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, plan });
}

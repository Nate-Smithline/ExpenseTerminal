import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getStripeClient, getStripeModeForHostname } from "@/lib/stripe";

const STRIPE_WEBHOOK_SECRET =
  process.env.NODE_ENV === "production"
    ? process.env.STRIPE_WEBHOOK_SECRET
    : process.env.STRIPE_WEBHOOK_SECRET_LOCAL ?? process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[webhooks/stripe] Missing STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_LOCAL");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient(process.env.NODE_ENV === "production" ? "live" : "test");
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    console.error("[webhooks/stripe]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let supabase: ReturnType<typeof createSupabaseServiceClient>;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    const status = subscription.status ?? "canceled";
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;

    const { error } = await (supabase as any)
      .from("subscriptions")
      .update({
        status: status === "active" || status === "trialing" || status === "past_due" ? status : "canceled",
        current_period_end: currentPeriodEnd,
        cancel_at_period_end: cancelAtPeriodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", subscription.id);

    if (error) {
      console.error("[webhooks/stripe] subscription update error", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}

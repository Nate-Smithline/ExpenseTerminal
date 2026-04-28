import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getStripeClient, getStripeMode } from "@/lib/stripe";

function getBaseUrl(req: Request): string {
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (origin) {
    try {
      const o = new URL(origin);
      return `${o.protocol}//${o.host}`;
    } catch {
      // fall through
    }
  }
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  let body: { interval?: "month" | "year" } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const interval = body.interval;
  if (interval !== "month" && interval !== "year") {
    return NextResponse.json({ error: 'interval must be "month" or "year"' }, { status: 400 });
  }

  const url = new URL(req.url);
  const mode = getStripeMode(url.hostname);
  const stripe = getStripeClient(mode);

  const priceId =
    interval === "month" ? process.env.STRIPE_PRICE_ID_MONTHLY : process.env.STRIPE_PRICE_ID_ANNUAL;

  const base = getBaseUrl(req);
  const successUrl = `${base}/settings?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/pricing`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [
      priceId && priceId.startsWith("price_")
        ? { price: priceId, quantity: 1 }
        : {
            price_data: {
              currency: "usd",
              unit_amount:
                interval === "month"
                  ? Math.round(Number(process.env.STRIPE_PRICE_ID_MONTHLY ?? "18") * 100)
                  : Math.round(Number(process.env.STRIPE_PRICE_ID_ANNUAL ?? "180") * 100),
              recurring: { interval },
              product_data: { name: interval === "month" ? "ExpenseTerminal (Monthly)" : "ExpenseTerminal (Annual)" },
            },
            quantity: 1,
          },
    ],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: auth.userId,
  });

  return NextResponse.json({ url: session.url });
}

import { NextResponse } from "next/server";
import { getStripe, PRICES } from "@/lib/stripe/config";
import { createServerSupabase } from "@/lib/supabase/server";
import { headers } from "next/headers";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const stripe = getStripe(host);
  if (!stripe) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  const { interval } = (await request.json()) as { interval?: "month" | "year" };
  const price =
    interval === "year" ? PRICES.annual : PRICES.monthly;
  if (!price) {
    return NextResponse.json({ error: "STRIPE_PRICE_ID_* not set" }, { status: 500 });
  }
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  let customerId = sub?.stripe_customer_id;
  if (!customerId) {
    const c = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_id: user.id },
    });
    customerId = c.id;
    await supabase
      .from("subscriptions")
      .upsert({ user_id: user.id, stripe_customer_id: customerId, status: "incomplete" });
  }
  const session = await stripe.checkout.sessions.create({
    customer: customerId!,
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?checkout=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
  });
  return NextResponse.json({ url: session.url });
}

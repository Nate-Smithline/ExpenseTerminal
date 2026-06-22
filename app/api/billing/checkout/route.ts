import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import type { BillingInterval } from "@/lib/billing/plans";
import {
  assertStripePriceEnv,
  getStripePriceId,
} from "@/lib/billing/stripe-prices";
import { getStripeClient, getStripeMode } from "@/lib/stripe";
import { TRIAL_DAYS } from "@/lib/billing/trial";

function getBaseUrl(req: Request, hostname: string): string {
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1";

  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (isLocal) {
    try {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "http://localhost:3000";
    }
  }

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
    const url = new URL(req.url);
    return url.protocol === "https" ? `https://${url.host}` : `http://${url.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

function parseInterval(value: unknown): BillingInterval {
  return value === "month" ? "month" : "year";
}

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  let body: { plan?: string; interval?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = body.plan as string | undefined;
  if (!plan) {
    return NextResponse.json({ error: "Missing plan" }, { status: 400 });
  }
  if (plan !== "plus") {
    return NextResponse.json(
      { error: "Invalid plan. Only Pro (plus) is available. Use plan: plus." },
      { status: 400 }
    );
  }

  const interval = parseInterval(body.interval);
  const url = new URL(req.url);
  const mode = getStripeMode(url.hostname);

  try {
    assertStripePriceEnv(interval, mode);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe price not configured";
    return NextResponse.json(
      { error: message, code: "STRIPE_PRICE_MISSING" },
      { status: 500 }
    );
  }

  const priceId = getStripePriceId(interval, mode);
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe price ID not set", code: "STRIPE_PRICE_MISSING" },
      { status: 500 }
    );
  }

  const stripe = getStripeClient(mode);
  const base = getBaseUrl(req, url.hostname);
  const successUrl = `${base}/settings/billing?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/settings/billing`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: auth.userId,
    customer_email: undefined,
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
    },
    metadata: {
      plan: "plus",
      interval,
      stripe_mode: mode,
    },
  });

  const payload: { url: string | null; success_url?: string; mode: typeof mode } = {
    url: session.url,
    mode,
  };
  if (process.env.NODE_ENV !== "production") {
    payload.success_url = successUrl;
  }
  return NextResponse.json(payload);
}

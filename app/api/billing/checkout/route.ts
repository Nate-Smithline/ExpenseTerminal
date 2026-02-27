import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import {
  getStripeClient,
  getStripeModeForHostname,
  getStripeProductIdForPlan,
  assertStripeProductEnv,
} from "@/lib/stripe";

type PlanBody = "starter" | "plus";

function getBaseUrl(req: Request, hostname: string): string {
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1";

  // Explicit env wins (e.g. NEXT_PUBLIC_APP_URL=http://localhost:3001)
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  // On localhost: use the request’s own origin so the return URL matches the app (and port).
  if (isLocal) {
    try {
      const url = new URL(req.url);
      return `${url.protocol}//${url.host}`;
    } catch {
      return "http://localhost:3000";
    }
  }

  // Production: prefer Origin/Referer so we get the correct public URL.
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

export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }

  let body: { plan?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const plan = body.plan as string | undefined;
  if (!plan) {
    return NextResponse.json({ error: "Missing plan" }, { status: 400 });
  }
  if (plan !== "starter" && plan !== "plus") {
    return NextResponse.json({ error: "Invalid plan. Use starter or plus." }, { status: 400 });
  }

  const url = new URL(req.url);
  const mode = getStripeModeForHostname(url.hostname);

  try {
    assertStripeProductEnv(plan as PlanBody, mode);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe product not configured";
    return NextResponse.json(
      { error: message, code: "STRIPE_PRODUCT_MISSING" },
      { status: 500 }
    );
  }

  const stripe = getStripeClient(mode);
  const productId = getStripeProductIdForPlan(plan as PlanBody, mode);
  if (!productId) {
    return NextResponse.json(
      { error: "Stripe product ID not set", code: "STRIPE_PRODUCT_MISSING" },
      { status: 500 }
    );
  }

  const base = getBaseUrl(req, url.hostname);
  const successUrl = `${base}/settings/billing?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${base}/settings/billing`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price_data: { currency: "usd", product: productId, unit_amount: plan === "starter" ? 12000 : 30000, recurring: { interval: "year" } }, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: auth.userId,
    customer_email: undefined,
  });

  const payload: { url: string | null; success_url?: string } = { url: session.url };
  if (process.env.NODE_ENV !== "production") {
    payload.success_url = successUrl;
  }
  return NextResponse.json(payload);
}

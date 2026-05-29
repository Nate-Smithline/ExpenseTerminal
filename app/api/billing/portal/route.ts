import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getStripeClient, getStripeModeForHostname, type StripeMode } from "@/lib/stripe";

function getReturnUrl(req: Request): string {
  const url = new URL(req.url);
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (origin) {
    try {
      const o = new URL(origin);
      return `${o.protocol}//${o.host}/settings/billing`;
    } catch {
      // fall through
    }
  }
  const protocol =
    url.hostname === "localhost" || url.hostname === "127.0.0.1"
      ? "http"
      : "https";
  return `${protocol}://${url.host}/settings/billing`;
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

  // 1. Try local subscriptions table
  let customerId: string | null = null;
  const { data: sub } = await (authClient as any)
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  customerId = sub?.stripe_customer_id ?? null;

  // 2. Fallback: look up by org_settings stripe_customer_id (legacy stack)
  if (!customerId) {
    const { data: org } = await (authClient as any)
      .from("org_settings")
      .select("stripe_customer_id")
      .eq("user_id", auth.userId)
      .maybeSingle();
    customerId = org?.stripe_customer_id ?? null;
  }

  // 3. Fallback: search Stripe by the user's email
  if (!customerId) {
    try {
      const { data: userData } = await authClient.auth.getUser();
      const email = userData?.user?.email;
      if (email) {
        const customers = await stripe.customers.list({ email, limit: 5 });
        // Pick the most recently created customer that has a subscription
        const match = customers.data.find(c => !c.deleted) ?? customers.data[0];
        if (match) customerId = match.id;
      }
    } catch {
      // ignore — fall through to error below
    }
  }

  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Please contact support." },
      { status: 400 }
    );
  }

  const returnUrl = getReturnUrl(req);

  const createPortalSession = async (stripeMode: StripeMode, cid: string) => {
    const client = getStripeClient(stripeMode);
    return client.billingPortal.sessions.create({ customer: cid, return_url: returnUrl });
  };

  try {
    const session = await createPortalSession(mode, customerId);
    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    // If Stripe says "no such customer", the ID was created in the other mode
    // (e.g. test customer ID stored but now running against live keys).
    // Automatically retry with the opposite mode so the user can still reach
    // their portal during a test→live (or live→test) transition.
    const isNoSuchCustomer =
      err instanceof Stripe.errors.StripeError &&
      (err.code === "resource_missing" || (err.message ?? "").toLowerCase().includes("no such customer"));

    if (isNoSuchCustomer) {
      const altMode: StripeMode = mode === "live" ? "test" : "live";
      try {
        const session = await createPortalSession(altMode, customerId);
        return NextResponse.json({ url: session.url });
      } catch {
        // alt mode also failed — fall through to original error
      }
    }

    const msg = err instanceof Error ? err.message : "Failed to open billing portal";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

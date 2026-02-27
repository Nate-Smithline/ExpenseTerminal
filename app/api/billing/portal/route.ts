import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getStripeClient, getStripeModeForHostname } from "@/lib/stripe";

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

  const { data: sub } = await (authClient as any)
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", auth.userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerId = sub?.stripe_customer_id ?? null;
  if (!customerId) {
    return NextResponse.json(
      { error: "No billing account found. Subscribe to a plan first." },
      { status: 400 }
    );
  }

  const stripe = getStripeClient(mode);
  const returnUrl = getReturnUrl(req);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return NextResponse.json({ url: session.url });
}

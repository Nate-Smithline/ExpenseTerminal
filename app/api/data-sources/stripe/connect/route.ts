import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { getStripeClient, getStripeMode } from "@/lib/stripe";

/**
 * Start Stripe Financial Connections flow for bank pulling.
 * Creates an FC session and returns client_secret for Stripe.js or a return_url for redirect.
 * Requires Stripe Customer for the user (created at checkout or here).
 */
export async function POST(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: { lookback?: string; start_date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = new URL(req.url);
  const mode = getStripeMode(url.hostname);
  const stripe = getStripeClient(mode);

  let baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (url.protocol + "//" + url.host);
  baseUrl = baseUrl.replace(/\/$/, "");

  // Stripe Financial Connections requires return_url to be HTTPS. On localhost (http)
  // use HTTPS so Stripe accepts it. For local dev you can run with HTTPS
  // (e.g. next dev --experimental-https) or set NEXT_PUBLIC_APP_URL to an https tunnel (e.g. ngrok).
  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (isLocalhost && baseUrl.startsWith("http://")) {
    baseUrl = "https://" + baseUrl.slice(7);
  }
  const returnUrl = `${baseUrl}/api/data-sources/stripe/callback`;

  // Always create a customer in the current Stripe mode for Financial Connections.
  // Reusing stripe_customer_id from subscriptions can mix sandbox vs live (e.g. customer
  // created in live, user on localhost uses test mode → "No such customer").
  const customer = await stripe.customers.create({
    email: undefined,
    metadata: { user_id: userId, purpose: "financial_connections" },
  });
  const customerId = customer.id;

  try {
    const session = await (stripe as any).financialConnections?.sessions?.create({
      account_holder: { type: "customer", customer: customerId },
      permissions: ["transactions"],
      prefetch: ["transactions"],
      return_url: returnUrl,
    });
    if (!session?.client_secret) {
      return NextResponse.json(
        { error: "Stripe Financial Connections is not configured for this account. Please contact support." },
        { status: 501 }
      );
    }
    return NextResponse.json({
      client_secret: session.client_secret,
      url: session.url ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start connection";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { getStripeClient, getStripeModeForHostname } from "@/lib/stripe";

export type InvoiceItem = {
  id: string;
  date: string;
  amountPaid: number;
  currency: string;
  status: string;
  hostedInvoiceUrl: string | null;
  number: string | null;
};

export async function GET(req: Request) {
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
    return NextResponse.json({ invoices: [] });
  }

  const stripe = getStripeClient(mode);
  const list = await stripe.invoices.list({
    customer: customerId,
    limit: 24,
    status: "paid",
  });

  const invoices: InvoiceItem[] = list.data.map((inv) => {
    const paidAt = (inv.status_transitions as { paid?: number } | null)?.paid ?? inv.created;
    return {
    id: inv.id,
    date: new Date((Number(paidAt) || 0) * 1000).toISOString().slice(0, 10),
    amountPaid: inv.amount_paid ?? 0,
    currency: (inv.currency ?? "usd").toUpperCase(),
    status: inv.status ?? "paid",
    hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    number: inv.number ?? null,
  };
  });

  return NextResponse.json({ invoices });
}

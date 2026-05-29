import type { BillingInterval } from "@/lib/billing/plans";

export async function startProCheckout(
  interval: BillingInterval
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan: "plus", interval }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok && data.url) {
    window.location.href = data.url;
    return { ok: true, url: data.url };
  }
  return { ok: false, error: data.error ?? "Checkout failed" };
}

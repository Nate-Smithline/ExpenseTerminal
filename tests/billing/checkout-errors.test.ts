import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseRouteClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1", email: "u@example.com" } } }) },
    })
  ),
}));

vi.mock("@/lib/middleware/auth", () => ({
  requireAuth: vi.fn(() => Promise.resolve({ authorized: true as const, userId: "user-1" })),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: vi.fn(),
  assertStripeProductEnv: vi.fn(),
}));

describe("POST /api/billing/checkout error paths", () => {
  it("returns 400 when plan is missing", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it("returns 400 when plan is invalid", async () => {
    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "enterprise" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when assertStripeProductEnv throws", async () => {
    const stripe = await import("@/lib/stripe");
    vi.mocked(stripe.assertStripeProductEnv).mockImplementationOnce(() => {
      throw new Error("Starter product is not configured.");
    });

    const { POST } = await import("@/app/api/billing/checkout/route");
    const res = await POST(
      new Request("http://localhost/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "starter" }),
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("STRIPE_PRODUCT_MISSING");
  });
});

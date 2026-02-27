import { describe, it, expect, vi } from "vitest";
import { getUserPlan } from "@/lib/billing/get-user-plan";

function createMockSupabase(rows: { plan: string; status: string } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: rows, error: null }),
        }),
      }),
    }),
  };
}

describe("getUserPlan", () => {
  it("returns free when no subscription row", async () => {
    const supabase = createMockSupabase(null);
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("free");
  });

  it("returns free when status is canceled", async () => {
    const supabase = createMockSupabase({ plan: "starter", status: "canceled" });
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("free");
  });

  it("returns starter when status is active", async () => {
    const supabase = createMockSupabase({ plan: "starter", status: "active" });
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("starter");
  });

  it("returns plus when status is active", async () => {
    const supabase = createMockSupabase({ plan: "plus", status: "active" });
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("plus");
  });

  it("returns starter when status is trialing", async () => {
    const supabase = createMockSupabase({ plan: "starter", status: "trialing" });
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("starter");
  });

  it("returns free when status is past_due but we treat past_due as active for plan", async () => {
    const supabase = createMockSupabase({ plan: "starter", status: "past_due" });
    const plan = await getUserPlan(supabase as any, "user-1");
    expect(plan).toBe("starter");
  });
});

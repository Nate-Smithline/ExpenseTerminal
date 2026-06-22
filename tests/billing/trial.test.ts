import { describe, it, expect } from "vitest";
import { computeTrialStatus, TRIAL_DAYS } from "@/lib/billing/trial";

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const createdAt = isoDaysFromNow(-3); // account is 3 days old

describe("computeTrialStatus (card-required trial)", () => {
  it("returns 'none' when there is no subscription — account age never grants access", () => {
    const result = computeTrialStatus(createdAt, null, null);
    expect(result.status).toBe("none");
    expect(result.daysLeft).toBe(0);
    expect(result.trialEndsAt).toBeNull();
  });

  it("stays 'none' even for a brand-new account (no free no-card trial)", () => {
    const result = computeTrialStatus(isoDaysFromNow(0), null, null);
    expect(result.status).toBe("none");
  });

  it("returns 'trial' while a Stripe trial subscription is active", () => {
    const periodEnd = isoDaysFromNow(10);
    const result = computeTrialStatus(createdAt, "trialing", periodEnd);
    expect(result.status).toBe("trial");
    expect(result.daysLeft).toBeGreaterThan(0);
    expect(result.daysLeft).toBeLessThanOrEqual(TRIAL_DAYS);
    expect(result.trialEndsAt).toBe(periodEnd);
  });

  it("returns 'expired' when a trial subscription's period has passed", () => {
    const result = computeTrialStatus(createdAt, "trialing", isoDaysFromNow(-1));
    expect(result.status).toBe("expired");
    expect(result.daysLeft).toBe(0);
  });

  it("returns 'subscribed' for an active paid subscription", () => {
    const periodEnd = isoDaysFromNow(20);
    const result = computeTrialStatus(createdAt, "active", periodEnd);
    expect(result.status).toBe("subscribed");
    expect(result.trialEndsAt).toBe(periodEnd);
  });

  it("treats past_due as subscribed (keep access while payment retries)", () => {
    const result = computeTrialStatus(createdAt, "past_due", isoDaysFromNow(5));
    expect(result.status).toBe("subscribed");
  });

  it("returns 'expired' when the subscription is canceled", () => {
    const result = computeTrialStatus(createdAt, "canceled", isoDaysFromNow(-2));
    expect(result.status).toBe("expired");
    expect(result.daysLeft).toBe(0);
  });
});

import { describe, it, expect } from "vitest";
import {
  computeTrialStatus,
  remainingAccountTrialDaysForCheckout,
  TRIAL_DAYS,
} from "@/lib/billing/trial";

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

const createdAt = isoDaysFromNow(-3); // account is 3 days old

describe("computeTrialStatus (account-age trial)", () => {
  it("returns 'trial' when there is no subscription and the account is inside the free window", () => {
    const result = computeTrialStatus(createdAt, null, null);
    expect(result.status).toBe("trial");
    expect(result.daysLeft).toBeGreaterThan(0);
    expect(result.daysLeft).toBeLessThanOrEqual(TRIAL_DAYS);
    expect(result.trialEndsAt).not.toBeNull();
  });

  it("starts the free window immediately for a brand-new account", () => {
    const result = computeTrialStatus(isoDaysFromNow(0), null, null);
    expect(result.status).toBe("trial");
    expect(result.daysLeft).toBe(TRIAL_DAYS);
  });

  it("returns 'expired' for no subscription after the account trial window", () => {
    const result = computeTrialStatus(isoDaysFromNow(-(TRIAL_DAYS + 1)), null, null);
    expect(result.status).toBe("expired");
    expect(result.daysLeft).toBe(0);
  });

  it("returns 'trial' while a Stripe trial subscription is active", () => {
    const periodEnd = isoDaysFromNow(10);
    const result = computeTrialStatus(createdAt, "trialing", periodEnd);
    expect(result.status).toBe("trial");
    expect(result.daysLeft).toBeGreaterThan(0);
    expect(result.daysLeft).toBeLessThanOrEqual(TRIAL_DAYS);
    expect(result.trialEndsAt).not.toBe(periodEnd);
  });

  it("returns 'expired' when the account trial window has passed, even for Stripe trialing", () => {
    const result = computeTrialStatus(isoDaysFromNow(-(TRIAL_DAYS + 1)), "trialing", isoDaysFromNow(10));
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

  it("caps checkout trials to remaining whole account-trial days", () => {
    const result = remainingAccountTrialDaysForCheckout(isoDaysFromNow(-3));
    expect(result).toBeGreaterThanOrEqual(11);
    expect(result).toBeLessThanOrEqual(12);
  });
});

import { describe, it, expect } from "vitest";
import { getPlanDefinition, plans } from "@/lib/billing/plans";
import { getPlanLimitsStatic } from "@/lib/billing/get-user-plan";

describe("getPlanDefinition", () => {
  it("returns free plan with 250 CSV AI cap", () => {
    const def = getPlanDefinition("free");
    expect(def.id).toBe("free");
    expect(def.maxCsvTransactionsForAi).toBe(250);
    expect(def.aiEnabled).toBe(true);
  });

  it("returns starter plan with unlimited CSV AI", () => {
    const def = getPlanDefinition("starter");
    expect(def.id).toBe("starter");
    expect(def.maxCsvTransactionsForAi).toBe(null);
    expect(def.aiEnabled).toBe(true);
  });

  it("returns plus plan with bankSyncComingSoon", () => {
    const def = getPlanDefinition("plus");
    expect(def.id).toBe("plus");
    expect(def.bankSyncComingSoon).toBe(true);
  });
});

describe("getPlanLimitsStatic", () => {
  it("returns numeric cap for free", () => {
    const limits = getPlanLimitsStatic("free");
    expect(limits.maxCsvTransactionsForAi).toBe(250);
    expect(limits.aiEnabled).toBe(true);
  });

  it("returns Infinity for starter and plus", () => {
    expect(getPlanLimitsStatic("starter").maxCsvTransactionsForAi).toBe(Number.POSITIVE_INFINITY);
    expect(getPlanLimitsStatic("plus").maxCsvTransactionsForAi).toBe(Number.POSITIVE_INFINITY);
  });
});

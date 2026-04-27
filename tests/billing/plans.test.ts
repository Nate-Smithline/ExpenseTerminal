import { describe, it, expect } from "vitest";
import { getPlanDefinition } from "@/lib/billing/plans";
import { getPlanLimitsStatic } from "@/lib/billing/get-user-plan";

describe("getPlanDefinition", () => {
  it("returns free plan with unlimited CSV AI (null cap)", () => {
    const def = getPlanDefinition("free");
    expect(def.id).toBe("free");
    expect(def.maxCsvTransactionsForAi).toBe(null);
    expect(def.aiEnabled).toBe(true);
    expect(def.bankSyncIncluded).toBe(true);
  });

  it("returns starter plan with unlimited CSV AI", () => {
    const def = getPlanDefinition("starter");
    expect(def.id).toBe("starter");
    expect(def.maxCsvTransactionsForAi).toBe(null);
    expect(def.aiEnabled).toBe(true);
  });

  it("returns plus plan with live bank sync included", () => {
    const def = getPlanDefinition("plus");
    expect(def.id).toBe("plus");
    expect(def.bankSyncIncluded).toBe(true);
  });
});

describe("getPlanLimitsStatic", () => {
  it("returns Infinity for free (unlimited AI-reviewed CSV in product definition)", () => {
    const limits = getPlanLimitsStatic("free");
    expect(limits.maxCsvTransactionsForAi).toBe(Number.POSITIVE_INFINITY);
    expect(limits.aiEnabled).toBe(true);
  });

  it("returns Infinity for starter and plus", () => {
    expect(getPlanLimitsStatic("starter").maxCsvTransactionsForAi).toBe(Number.POSITIVE_INFINITY);
    expect(getPlanLimitsStatic("plus").maxCsvTransactionsForAi).toBe(Number.POSITIVE_INFINITY);
  });
});

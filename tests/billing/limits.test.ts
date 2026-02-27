import { describe, it, expect } from "vitest";
import { computeCsvAiEligibility } from "@/lib/billing/limits";

describe("computeCsvAiEligibility", () => {
  it("returns all new rows eligible when cap is Infinity", () => {
    const r = computeCsvAiEligibility(100, 50, Number.POSITIVE_INFINITY);
    expect(r.eligibleCount).toBe(50);
    expect(r.ineligibleCount).toBe(0);
    expect(r.overLimit).toBe(false);
  });

  it("returns all new rows eligible when under cap", () => {
    const r = computeCsvAiEligibility(100, 100, 250);
    expect(r.eligibleCount).toBe(100);
    expect(r.ineligibleCount).toBe(0);
    expect(r.overLimit).toBe(false);
  });

  it("caps eligible at slots left and marks rest ineligible", () => {
    const r = computeCsvAiEligibility(240, 20, 250);
    expect(r.eligibleCount).toBe(10);
    expect(r.ineligibleCount).toBe(10);
    expect(r.overLimit).toBe(true);
  });

  it("returns zero eligible when already at cap", () => {
    const r = computeCsvAiEligibility(250, 20, 250);
    expect(r.eligibleCount).toBe(0);
    expect(r.ineligibleCount).toBe(20);
    expect(r.overLimit).toBe(true);
  });

  it("returns zero eligible when over cap", () => {
    const r = computeCsvAiEligibility(260, 10, 250);
    expect(r.eligibleCount).toBe(0);
    expect(r.ineligibleCount).toBe(10);
    expect(r.overLimit).toBe(true);
  });

  it("treats negative cap as unlimited", () => {
    const r = computeCsvAiEligibility(0, 100, -1);
    expect(r.eligibleCount).toBe(100);
    expect(r.ineligibleCount).toBe(0);
    expect(r.overLimit).toBe(false);
  });
});

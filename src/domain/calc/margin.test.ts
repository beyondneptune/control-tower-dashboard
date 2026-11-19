import { describe, it, expect } from "vitest";
import { computeMargin, marginBand, type JobCostBreakdown } from "./margin";

const full = (over: Partial<JobCostBreakdown> = {}): JobCostBreakdown => ({
  material: 100,
  purchases: 50,
  labour: 80,
  machine: 40,
  power: 10,
  jobwork: 0,
  rework: 0,
  logistics: 20,
  ...over,
}); // sum = 300

describe("marginBand", () => {
  it("maps boundaries to traffic-light bands", () => {
    expect(marginBand(-5)).toBe("dark-red");
    expect(marginBand(0)).toBe("red");
    expect(marginBand(9.99)).toBe("red");
    expect(marginBand(10)).toBe("amber");
    expect(marginBand(19.99)).toBe("amber");
    expect(marginBand(20)).toBe("light-green");
    expect(marginBand(30)).toBe("light-green");
    expect(marginBand(30.01)).toBe("green");
    expect(marginBand(45)).toBe("green");
  });
});

describe("computeMargin", () => {
  it("computes a healthy margin", () => {
    const r = computeMargin(500, full()); // cost 300, margin 200 = 40%
    expect(r.actualCost).toBe(300);
    expect(r.marginValue).toBe(200);
    expect(r.marginPercent).toBeCloseTo(40);
    expect(r.band).toBe("green");
    expect(r.incomplete).toBe(false);
  });

  it("flags data-required when a cost component is unknown", () => {
    const r = computeMargin(500, full({ labour: null }));
    expect(r.actualCost).toBeNull();
    expect(r.band).toBe("data-required");
    expect(r.incomplete).toBe(true);
    expect(r.missingComponents).toContain("labour");
  });

  it("does NOT treat unknown cost as zero (no fabricated 100% margin)", () => {
    const r = computeMargin(500, full({ material: null }));
    expect(r.marginPercent).toBeNull();
    expect(r.band).toBe("data-required");
  });

  it("flags a negative margin as dark-red", () => {
    const r = computeMargin(250, full()); // cost 300 > revenue
    expect(r.marginValue).toBe(-50);
    expect(r.band).toBe("dark-red");
  });

  it("returns data-required when revenue is unknown (not yet invoiced)", () => {
    const r = computeMargin(null, full());
    expect(r.band).toBe("data-required");
    expect(r.incomplete).toBe(true);
  });

  it("treats a known zero component as zero, not unknown", () => {
    const r = computeMargin(500, full({ jobwork: 0 }));
    expect(r.incomplete).toBe(false);
    expect(r.actualCost).toBe(300);
  });
});

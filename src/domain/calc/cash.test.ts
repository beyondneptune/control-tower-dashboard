import { describe, it, expect } from "vitest";
import { cashForecast, cashRunwayDays, mustPayWithin, utilisationPercent } from "./cash";

describe("cashForecast", () => {
  it("projects closing cash and reports surplus", () => {
    const r = cashForecast({
      openingCash: 100_000,
      confirmedReceipts: 50_000,
      expectedReceipts: 30_000,
      approvedPayments: 120_000,
    });
    expect(r.projectedClosing).toBe(60_000);
    expect(r.status).toBe("surplus");
  });

  it("reports a gap when payments exceed inflows", () => {
    const r = cashForecast({
      openingCash: 10_000,
      confirmedReceipts: 0,
      expectedReceipts: 0,
      approvedPayments: 50_000,
    });
    expect(r.projectedClosing).toBe(-40_000);
    expect(r.status).toBe("gap");
  });
});

describe("cashRunwayDays", () => {
  const asOf = "2026-05-31";

  it("returns the first day the running balance goes negative", () => {
    const flows = [
      { date: "2026-06-02", amount: -60_000 }, // day 2 → 40,000
      { date: "2026-06-05", amount: -60_000 }, // day 5 → -20,000
    ];
    expect(cashRunwayDays(100_000, flows, asOf, 30)).toBe(5);
  });

  it("returns the horizon when cash never runs out", () => {
    expect(cashRunwayDays(100_000, [{ date: "2026-06-02", amount: -10_000 }], asOf, 30)).toBe(30);
  });

  it("returns 0 when already negative", () => {
    expect(cashRunwayDays(-5, [], asOf, 30)).toBe(0);
  });

  it("ignores flows outside the horizon and in the past", () => {
    const flows = [
      { date: "2026-05-01", amount: -999_999 }, // before asOf, ignored
      { date: "2027-01-01", amount: -999_999 }, // beyond horizon, ignored
    ];
    expect(cashRunwayDays(100_000, flows, asOf, 30)).toBe(30);
  });
});

describe("mustPayWithin", () => {
  it("sums only obligations within the window", () => {
    const asOf = "2026-05-31";
    const obs = [
      { date: "2026-06-02", amount: -20_000 }, // within 7
      { date: "2026-06-10", amount: -30_000 }, // outside 7
    ];
    expect(mustPayWithin(obs, asOf, 7)).toBe(20_000);
  });
});

describe("utilisationPercent", () => {
  it("computes utilisation, null on zero limit", () => {
    expect(utilisationPercent(90, 100)).toBe(90);
    expect(utilisationPercent(50, 0)).toBeNull();
  });
});

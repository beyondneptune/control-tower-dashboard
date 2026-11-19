import { describe, it, expect } from "vitest";
import { generateAlerts, alertsForRole, alertCounts, type AlertSnapshot } from "./alerts";

const snap = (over: Partial<AlertSnapshot> = {}): AlertSnapshot => ({
  asOf: "2026-05-31",
  cashAvailable: 1_000_000,
  mustPay7Day: 0,
  banks: [],
  invoices: [],
  promises: [],
  jobs: [],
  vendorPayables: [],
  payroll: { totalDueWithinWindow: 0 },
  inventory: [],
  estimateOverruns: [],
  uploadsMissed: [],
  ...over,
});

describe("generateAlerts", () => {
  it("raises a red cash-low alert below the floor", () => {
    const alerts = generateAlerts(snap({ cashAvailable: 150_000 }));
    const a = alerts.find((x) => x.alertType === "cash-low");
    expect(a).toBeDefined();
    expect(a?.severity).toBe("red");
    expect(a?.owner).toBe("finance");
  });

  it("raises a material-over-estimate alert above 10%", () => {
    const alerts = generateAlerts(
      snap({ estimateOverruns: [{ jobId: "j1", jobCode: "MER-1", kind: "material", estimate: 1_000, actual: 1_200 }] }),
    );
    expect(alerts.some((a) => a.alertType === "material-over-estimate")).toBe(true);
  });

  it("does NOT raise material-over-estimate at exactly 10%", () => {
    const alerts = generateAlerts(
      snap({ estimateOverruns: [{ jobId: "j1", jobCode: "MER-1", kind: "material", estimate: 1_000, actual: 1_100 }] }),
    );
    expect(alerts.some((a) => a.alertType === "material-over-estimate")).toBe(false);
  });

  it("raises a negative-margin alert", () => {
    const alerts = generateAlerts(
      snap({
        jobs: [
          {
            id: "j1",
            jobCode: "MER-1",
            stage: "Invoiced",
            requiredDispatchDate: "2026-06-30",
            quotedValue: 1_000,
            actualCost: 1_200,
            marginPercent: -20,
          },
        ],
      }),
    );
    expect(alerts.some((a) => a.alertType === "negative-margin")).toBe(true);
  });

  it("raises stock-below-reorder", () => {
    const alerts = generateAlerts(
      snap({ inventory: [{ id: "i1", itemName: "Stellite 6 Powder", closingQty: 5, reorderLevel: 10 }] }),
    );
    expect(alerts.some((a) => a.alertType === "stock-below-reorder")).toBe(true);
  });
});

describe("alertsForRole", () => {
  it("MD sees all; production sees none of the finance alerts; finance sees its own", () => {
    const alerts = generateAlerts(snap({ cashAvailable: 150_000 }));
    expect(alertsForRole(alerts, "md")).toHaveLength(alerts.length);
    expect(alertsForRole(alerts, "production")).toHaveLength(0);
    expect(alertsForRole(alerts, "finance").length).toBeGreaterThan(0);
  });
});

describe("alertCounts", () => {
  it("tallies by severity", () => {
    const counts = alertCounts(generateAlerts(snap({ cashAvailable: 150_000 })));
    expect(counts.red).toBeGreaterThan(0);
    expect(counts.green).toBe(0);
  });
});

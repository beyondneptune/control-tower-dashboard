import { describe, it, expect } from "vitest";
import { ageBucket, buildAgeing } from "./ageing";

describe("ageBucket", () => {
  it("maps days overdue to buckets at the boundaries", () => {
    expect(ageBucket(-5)).toBe("not-due");
    expect(ageBucket(0)).toBe("not-due");
    expect(ageBucket(1)).toBe("0-30");
    expect(ageBucket(30)).toBe("0-30");
    expect(ageBucket(31)).toBe("31-60");
    expect(ageBucket(60)).toBe("31-60");
    expect(ageBucket(61)).toBe("61-90");
    expect(ageBucket(90)).toBe("61-90");
    expect(ageBucket(91)).toBe(">90");
  });
});

describe("buildAgeing", () => {
  const asOf = "2026-05-31";

  it("buckets outstanding, totals, and severities", () => {
    const summary = buildAgeing(
      [
        { id: "a", dueDate: "2026-05-20", outstanding: 10_000 }, // 11 days → 0-30, amber
        { id: "b", dueDate: "2026-04-01", outstanding: 20_000 }, // 60 days → 31-60, red
        { id: "c", dueDate: "2026-06-30", outstanding: 5_000 }, // not due, green
        { id: "d", dueDate: "2026-05-01", outstanding: 0 }, // zero outstanding → excluded
      ],
      asOf,
    );

    expect(summary.totalOutstanding).toBe(35_000);
    expect(summary.buckets["0-30"]).toBe(10_000);
    expect(summary.buckets["31-60"]).toBe(20_000);
    expect(summary.buckets["not-due"]).toBe(5_000);
    expect(summary.overdueTotal).toBe(30_000);
    expect(summary.rows).toHaveLength(3);

    expect(summary.rows.find((r) => r.id === "a")?.severity).toBe("amber");
    expect(summary.rows.find((r) => r.id === "b")?.severity).toBe("red");
    expect(summary.rows.find((r) => r.id === "c")?.severity).toBe("green");
  });
});

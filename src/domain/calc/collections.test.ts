import { describe, it, expect } from "vitest";
import { invoiceOutstanding, isOverCollected, validateCollection } from "./collections";

describe("invoiceOutstanding", () => {
  it("subtracts cash received and accepted deductions", () => {
    expect(invoiceOutstanding(100_000, [{ amountReceived: 60_000, deductionAmount: 5_000 }])).toBe(35_000);
  });

  it("can go negative when over-collected (not clamped)", () => {
    expect(invoiceOutstanding(100_000, [{ amountReceived: 110_000, deductionAmount: 0 }])).toBe(-10_000);
  });
});

describe("isOverCollected", () => {
  it("detects settlements exceeding the invoice", () => {
    expect(isOverCollected(100_000, [{ amountReceived: 100_000, deductionAmount: 1_000 }])).toBe(true);
    expect(isOverCollected(100_000, [{ amountReceived: 90_000, deductionAmount: 0 }])).toBe(false);
  });
});

describe("validateCollection", () => {
  it("rejects a collection over the balance unless marked excess", () => {
    expect(validateCollection(20_000, { amountReceived: 25_000, deductionAmount: 0 }).valid).toBe(false);
    expect(validateCollection(20_000, { amountReceived: 25_000, deductionAmount: 0 }, true).valid).toBe(true);
  });

  it("accepts a collection within the balance", () => {
    expect(validateCollection(20_000, { amountReceived: 15_000, deductionAmount: 0 }).valid).toBe(true);
  });

  it("rejects a non-positive collection", () => {
    expect(validateCollection(20_000, { amountReceived: 0, deductionAmount: 0 }).valid).toBe(false);
  });
});

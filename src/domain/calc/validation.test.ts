import { describe, it, expect } from "vitest";
import {
  isDuplicateInvoice,
  isDuplicateVendorInvoice,
  validatePaymentApproval,
  materialOverEstimate,
  jobNeedsMarginApproval,
  canMoveToStage,
  type StageMoveContext,
} from "./validation";

describe("isDuplicateInvoice", () => {
  const existing = [{ customerId: "c1", invoiceNo: "INV-001" }];
  it("flags same customer + number (case-insensitive)", () => {
    expect(isDuplicateInvoice(existing, { customerId: "c1", invoiceNo: "inv-001" })).toBe(true);
  });
  it("allows the same number for a different customer", () => {
    expect(isDuplicateInvoice(existing, { customerId: "c2", invoiceNo: "INV-001" })).toBe(false);
  });
});

describe("isDuplicateVendorInvoice", () => {
  const existing = [{ vendorId: "v1", invoiceNo: "B-77" }];
  it("flags same vendor + number", () => {
    expect(isDuplicateVendorInvoice(existing, { vendorId: "v1", invoiceNo: "B-77" })).toBe(true);
  });
  it("allows the same number for a different vendor", () => {
    expect(isDuplicateVendorInvoice(existing, { vendorId: "v2", invoiceNo: "B-77" })).toBe(false);
  });
});

describe("validatePaymentApproval", () => {
  it("requires priority, approver, and purpose", () => {
    const r = validatePaymentApproval({ amount: 1_000 });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(3);
  });
  it("passes when all required fields are present", () => {
    expect(
      validatePaymentApproval({ amount: 1_000, priority: "P1", approvedBy: "MD", purpose: "steel" }).valid,
    ).toBe(true);
  });

  it("rejects self-approval (maker === approver)", () => {
    const r = validatePaymentApproval({
      amount: 1_000,
      priority: "P1",
      approvedBy: "u1",
      purpose: "steel",
      makerId: "u1",
      approverId: "u1",
    });
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/segregation/i);
  });
});

describe("materialOverEstimate", () => {
  it("triggers strictly above the threshold", () => {
    expect(materialOverEstimate(1_000, 1_100)).toBe(false); // exactly +10%
    expect(materialOverEstimate(1_000, 1_101)).toBe(true);
    expect(materialOverEstimate(0, 5)).toBe(true); // any spend on zero estimate
  });
});

describe("jobNeedsMarginApproval", () => {
  it("requires approval below 20% or when unknown", () => {
    expect(jobNeedsMarginApproval(15)).toBe(true);
    expect(jobNeedsMarginApproval(25)).toBe(false);
    expect(jobNeedsMarginApproval(null)).toBe(true);
  });
});

describe("canMoveToStage", () => {
  const base: StageMoveContext = {
    hasInvoice: false,
    hasCollection: false,
    qcReleased: true,
    isDelayed: false,
    profitabilityKnownOrFlagged: true,
  };

  it("blocks Invoiced without an invoice", () => {
    expect(canMoveToStage("Invoiced", base).valid).toBe(false);
  });
  it("blocks dispatch without QC release", () => {
    expect(canMoveToStage("Dispatched", { ...base, qcReleased: false }).valid).toBe(false);
  });
  it("requires a delay reason when delayed", () => {
    expect(canMoveToStage("LMD", { ...base, isDelayed: true }).valid).toBe(false);
    expect(canMoveToStage("LMD", { ...base, isDelayed: true, delayReason: "machine down" }).valid).toBe(true);
  });
  it("blocks Collected without collection and profitability", () => {
    expect(canMoveToStage("Collected", { ...base, hasInvoice: true }).valid).toBe(false);
    expect(
      canMoveToStage("Collected", { ...base, hasInvoice: true, hasCollection: true, profitabilityKnownOrFlagged: false }).valid,
    ).toBe(false);
    expect(canMoveToStage("Collected", { ...base, hasInvoice: true, hasCollection: true }).valid).toBe(true);
  });
});

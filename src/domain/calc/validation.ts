/**
 * Validation & maker-checker triggers (pure predicates).
 *
 * These are the gate functions the brief calls out. They return structured
 * results (not throws) so both the UI and the Sprint-3 server actions can call
 * the SAME logic — the UI to warn early, the server to enforce.
 */

import { type JobStage, stageIndex } from "../types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ok: ValidationResult = { valid: true, errors: [] };
function fail(...errors: string[]): ValidationResult {
  return { valid: false, errors };
}

// ── Duplicate prevention ────────────────────────────────────────────────────

/** No duplicate invoice number for the same customer. */
export function isDuplicateInvoice(
  existing: { customerId: string; invoiceNo: string }[],
  candidate: { customerId: string; invoiceNo: string },
): boolean {
  const no = candidate.invoiceNo.trim().toLowerCase();
  return existing.some(
    (e) => e.customerId === candidate.customerId && e.invoiceNo.trim().toLowerCase() === no,
  );
}

/** No duplicate vendor invoice number for the same vendor. */
export function isDuplicateVendorInvoice(
  existing: { vendorId: string; invoiceNo: string }[],
  candidate: { vendorId: string; invoiceNo: string },
): boolean {
  const no = candidate.invoiceNo.trim().toLowerCase();
  return existing.some(
    (e) => e.vendorId === candidate.vendorId && e.invoiceNo.trim().toLowerCase() === no,
  );
}

// ── Payment approval ────────────────────────────────────────────────────────

/**
 * A payment cannot be approved without priority, approver, and purpose — AND the
 * approver must differ from the maker (segregation of duty).
 *
 * NOTE: this is a UX hint only. The REAL control is the Postgres function
 * `approve_vendor_payment` (migration 0005), which rejects self-approval and
 * non-approver roles server-side where the client cannot bypass it.
 */
export function validatePaymentApproval(payment: {
  priority?: string | null;
  approvedBy?: string | null;
  purpose?: string | null;
  amount: number;
  makerId?: string | null;
  approverId?: string | null;
}): ValidationResult {
  const errors: string[] = [];
  if (!payment.priority) errors.push("Payment priority (P1–P5) is required.");
  if (!payment.approvedBy?.trim()) errors.push("An approver is required.");
  if (!payment.purpose?.trim()) errors.push("A payment purpose is required.");
  if (!(payment.amount > 0)) errors.push("Payment amount must be positive.");
  if (payment.makerId && payment.approverId && payment.makerId === payment.approverId) {
    errors.push("Approver must differ from the maker (segregation of duty).");
  }
  return errors.length ? { valid: false, errors } : ok;
}

// ── Estimate-overrun triggers ───────────────────────────────────────────────

/** Material issue exceeding its estimate by more than `thresholdPct`% needs approval. */
export function materialOverEstimate(
  estimate: number,
  actual: number,
  thresholdPct = 10,
): boolean {
  if (estimate <= 0) return actual > 0; // any spend against a zero estimate is an overrun
  return actual > estimate * (1 + thresholdPct / 100);
}

/** Actual powder consumption exceeding the quoted powder by >threshold%. */
export const powderOverEstimate = materialOverEstimate;

/** A job below the margin threshold (default 20%) requires MD approval. */
export function jobNeedsMarginApproval(
  expectedMarginPercent: number | null | undefined,
  threshold = 20,
): boolean {
  if (expectedMarginPercent === null || expectedMarginPercent === undefined) return true; // unknown → require sign-off
  return expectedMarginPercent < threshold;
}

// ── Stage-transition guards ─────────────────────────────────────────────────

export interface StageMoveContext {
  hasInvoice: boolean;
  hasCollection: boolean;
  qcReleased: boolean;
  isDelayed: boolean;
  delayReason?: string | null;
  profitabilityKnownOrFlagged: boolean;
}

/**
 * Guard a job moving to a target stage. Encodes:
 *  - cannot reach "Invoiced" without an invoice
 *  - cannot reach "Collected" without a collection
 *  - QC release required before "Dispatched"
 *  - delay reason mandatory when the job is delayed
 *  - cannot close (Collected) unless profitability is computed or flagged incomplete
 */
export function canMoveToStage(target: JobStage, ctx: StageMoveContext): ValidationResult {
  const errors: string[] = [];

  if (ctx.isDelayed && !ctx.delayReason?.trim()) {
    errors.push("Delay reason is mandatory for a delayed job.");
  }
  if (stageIndex(target) >= stageIndex("Dispatched") && !ctx.qcReleased) {
    errors.push("QC release is required before dispatch.");
  }
  if (target === "Invoiced" && !ctx.hasInvoice) {
    errors.push("Cannot move to Invoiced without an invoice.");
  }
  if (target === "Collected") {
    if (!ctx.hasCollection) errors.push("Cannot move to Collected without a collection.");
    if (!ctx.profitabilityKnownOrFlagged) {
      errors.push("Cannot close job until profitability is calculated or flagged 'data incomplete'.");
    }
  }
  return errors.length ? fail(...errors) : ok;
}

/**
 * Automatic alert engine — the 18 daily rules from the brief.
 *
 * `generateAlerts` takes an explicit, pre-joined snapshot (so the engine stays
 * a pure function of its inputs and is fully unit-testable) and returns typed
 * `Alert[]`, each tagged with the owner role for role-based routing. MD sees
 * every alert; each department sees the ones it owns.
 */

import type { Alert, AlertType, Criticality, JobStage, Role, Severity } from "../types";
import { stageIndex } from "../types";
import { daysBetween } from "@/lib/format";
import { materialOverEstimate } from "./validation";

export interface AlertThresholds {
  cashFloor: number; // ₹2,00,000
  occUtilisationPct: number; // 90
  invoiceOverdueDays: number; // 30
  readyNotDispatchedDays: number; // 2
  dispatchedNotInvoicedDays: number; // 1
  costOverQuotePct: number; // 10
  estimateOverrunPct: number; // 10 (powder + material)
  payrollWindowDays: number; // 3
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  cashFloor: 200_000,
  occUtilisationPct: 90,
  invoiceOverdueDays: 30,
  readyNotDispatchedDays: 2,
  dispatchedNotInvoicedDays: 1,
  costOverQuotePct: 10,
  estimateOverrunPct: 10,
  payrollWindowDays: 3,
};

export interface AlertSnapshot {
  asOf: string;
  cashAvailable: number;
  mustPay7Day: number;
  banks: {
    id: string;
    bankName: string;
    accountType: string;
    used: number;
    limit: number;
    drawingPower: number;
    penalCharges?: number;
  }[];
  invoices: {
    id: string;
    invoiceNo: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    outstanding: number;
    submittedToCustomer: boolean;
  }[];
  /** Customer promise dates (collection follow-ups). */
  promises: { id: string; ref: string; promisedDate: string; satisfied: boolean }[];
  jobs: {
    id: string;
    jobCode: string;
    stage: JobStage;
    requiredDispatchDate: string;
    readySince?: string;
    dispatchedSince?: string;
    quotedValue: number;
    actualCost: number | null;
    marginPercent: number | null;
  }[];
  vendorPayables: {
    vendorId: string;
    vendorName: string;
    criticality: Criticality;
    dueDate: string;
    outstanding: number;
  }[];
  payroll: { totalDueWithinWindow: number; dueDate?: string };
  inventory: { id: string; itemName: string; closingQty: number; reorderLevel: number }[];
  estimateOverruns: {
    jobId: string;
    jobCode: string;
    kind: "powder" | "material";
    estimate: number;
    actual: number;
  }[];
  uploadsMissed: { department: string; module: string; role: Role }[];
}

function makeAlert(
  type: AlertType,
  severity: Severity,
  module: string,
  message: string,
  owner: Role,
  opts: { recordId?: string; dueDate?: string } = {},
): Alert {
  return {
    id: `${type}:${opts.recordId ?? module}`,
    alertDate: "", // stamped by caller (Date.* avoided in pure layer)
    alertType: type,
    severity,
    relatedModule: module,
    relatedRecordId: opts.recordId,
    message,
    owner,
    dueDate: opts.dueDate,
    status: "open",
  };
}

export function generateAlerts(
  snap: AlertSnapshot,
  overrides: Partial<AlertThresholds> = {},
): Alert[] {
  const t = { ...DEFAULT_THRESHOLDS, ...overrides };
  const out: Alert[] = [];

  // 1. Cash below floor
  if (snap.cashAvailable < t.cashFloor) {
    out.push(makeAlert("cash-low", "red", "cash", `Cash ₹${snap.cashAvailable} is below the ₹${t.cashFloor} floor.`, "finance"));
  }
  // 2. Cash below 7-day must-pay
  if (snap.cashAvailable < snap.mustPay7Day) {
    out.push(makeAlert("cash-below-mustpay", "red", "cash", `Cash ₹${snap.cashAvailable} cannot cover 7-day must-pay obligations of ₹${snap.mustPay7Day}.`, "finance"));
  }
  // 3/4/5. Bank-level. OCC utilisation + zero-drawing-power apply only to the
  // revolving OCC line; penal charges can post on any loan account.
  for (const b of snap.banks) {
    if (b.accountType === "occ" && b.limit > 0) {
      const util = (b.used / b.limit) * 100;
      if (util > t.occUtilisationPct) {
        out.push(makeAlert("occ-high", "red", "bank-debt", `${b.bankName} utilisation ${util.toFixed(0)}% exceeds ${t.occUtilisationPct}%.`, "finance", { recordId: b.id }));
      }
      if (b.drawingPower === 0) {
        out.push(makeAlert("drawing-power-zero", "red", "bank-debt", `${b.bankName} drawing power is zero.`, "finance", { recordId: b.id }));
      }
    }
    if ((b.penalCharges ?? 0) > 0) {
      out.push(makeAlert("penal-charge", "red", "bank-debt", `${b.bankName} has penal charges of ₹${b.penalCharges}.`, "finance", { recordId: b.id }));
    }
  }
  // 6. Invoice overdue > N days
  for (const inv of snap.invoices) {
    if (inv.outstanding <= 0) continue;
    const overdue = daysBetween(inv.dueDate, snap.asOf);
    if (overdue > t.invoiceOverdueDays) {
      out.push(makeAlert("invoice-overdue", "red", "collections", `Invoice ${inv.invoiceNo} (${inv.customerName}) is ${overdue} days overdue, ₹${inv.outstanding} outstanding.`, "finance", { recordId: inv.id }));
    }
    // also: not submitted to customer within 24h of invoice date
    if (!inv.submittedToCustomer && daysBetween(inv.invoiceDate, snap.asOf) >= 1) {
      out.push(makeAlert("dispatched-not-invoiced", "red", "dispatch-billing", `Invoice ${inv.invoiceNo} not submitted to customer within 24 hours.`, "sales", { recordId: inv.id }));
    }
  }
  // 7. Promised date missed
  for (const p of snap.promises) {
    if (!p.satisfied && daysBetween(p.promisedDate, snap.asOf) > 0) {
      out.push(makeAlert("promise-missed", "red", "collections", `Promised collection date missed for ${p.ref}.`, "sales", { recordId: p.id }));
    }
  }
  // 8/9/10/11/13. Job-level
  for (const j of snap.jobs) {
    // 8. delayed beyond promised dispatch (not yet dispatched)
    if (stageIndex(j.stage) < stageIndex("Dispatched") && daysBetween(j.requiredDispatchDate, snap.asOf) > 0) {
      out.push(makeAlert("job-delayed", "red", "production", `Job ${j.jobCode} is past its required dispatch date.`, "production", { recordId: j.id }));
    }
    // 9. ready but not dispatched > 2 days
    if (j.stage === "Ready Dispatch" && j.readySince && daysBetween(j.readySince, snap.asOf) > t.readyNotDispatchedDays) {
      out.push(makeAlert("ready-not-dispatched", "red", "dispatch-billing", `Job ${j.jobCode} ready but not dispatched for >${t.readyNotDispatchedDays} days.`, "sales", { recordId: j.id }));
    }
    // 10. dispatched but not invoiced > 1 day
    if (j.stage === "Dispatched" && j.dispatchedSince && daysBetween(j.dispatchedSince, snap.asOf) > t.dispatchedNotInvoicedDays) {
      out.push(makeAlert("dispatched-not-invoiced", "red", "dispatch-billing", `Job ${j.jobCode} dispatched but not invoiced for >${t.dispatchedNotInvoicedDays} day.`, "sales", { recordId: j.id }));
    }
    // 11. actual cost exceeds quote by > 10%
    if (j.actualCost !== null && j.quotedValue > 0 && j.actualCost > j.quotedValue * (1 + t.costOverQuotePct / 100)) {
      out.push(makeAlert("cost-over-quote", "amber", "job-profitability", `Job ${j.jobCode} actual cost exceeds quote by >${t.costOverQuotePct}%.`, "finance", { recordId: j.id }));
    }
    // 13. negative margin
    if (j.marginPercent !== null && j.marginPercent < 0) {
      out.push(makeAlert("negative-margin", "red", "job-profitability", `Job ${j.jobCode} has a negative margin (${j.marginPercent.toFixed(1)}%).`, "finance", { recordId: j.id }));
    }
  }
  // 12/18. Estimate overruns (powder + material)
  for (const e of snap.estimateOverruns) {
    if (materialOverEstimate(e.estimate, e.actual, t.estimateOverrunPct)) {
      const type: AlertType = e.kind === "powder" ? "powder-over-estimate" : "material-over-estimate";
      out.push(makeAlert(type, "amber", "stores", `Job ${e.jobCode}: ${e.kind} consumption exceeds estimate by >${t.estimateOverrunPct}%.`, "stores", { recordId: e.jobId }));
    }
  }
  // 14. Critical vendor overdue
  for (const v of snap.vendorPayables) {
    if (v.outstanding > 0 && v.criticality === "high" && daysBetween(v.dueDate, snap.asOf) > 0) {
      out.push(makeAlert("vendor-overdue", "red", "purchase", `Critical vendor ${v.vendorName} payment overdue, ₹${v.outstanding}.`, "purchase", { recordId: v.vendorId }));
    }
  }
  // 15. Payroll due within window and cash insufficient
  if (snap.payroll.totalDueWithinWindow > 0 && snap.cashAvailable < snap.payroll.totalDueWithinWindow) {
    out.push(makeAlert("payroll-cash-risk", "red", "people-payroll", `Payroll of ₹${snap.payroll.totalDueWithinWindow} due within ${t.payrollWindowDays} days exceeds available cash.`, "finance", { dueDate: snap.payroll.dueDate }));
  }
  // 16. Upload missed
  for (const u of snap.uploadsMissed) {
    out.push(makeAlert("upload-missed", "amber", "uploads", `${u.department} missed the ${u.module} upload deadline.`, u.role, { recordId: `${u.department}-${u.module}` }));
  }
  // 17. Stock below reorder level
  for (const item of snap.inventory) {
    if (item.closingQty < item.reorderLevel) {
      out.push(makeAlert("stock-below-reorder", "amber", "stores", `${item.itemName} stock (${item.closingQty}) is below reorder level (${item.reorderLevel}).`, "stores", { recordId: item.id }));
    }
  }

  return out;
}

/** Alerts visible to a role: MD sees all, others see those they own. */
export function alertsForRole(alerts: Alert[], role: Role): Alert[] {
  if (role === "md") return alerts;
  return alerts.filter((a) => a.owner === role);
}

export function alertCounts(alerts: Alert[]): Record<Severity, number> {
  return alerts.reduce(
    (acc, a) => {
      acc[a.severity] += 1;
      return acc;
    },
    { red: 0, amber: 0, green: 0 } as Record<Severity, number>,
  );
}

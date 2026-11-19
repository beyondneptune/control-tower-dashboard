/**
 * Data-access layer — the single API surface every dashboard consumes.
 *
 * Sprint 1 reads the in-memory seed; Sprint 2 swaps this module's internals for
 * Supabase queries WITHOUT touching any UI, because all reads go through these
 * typed functions. Derived figures route through the verified calc engine, so
 * the UI only ever displays computed results — never re-implements arithmetic.
 */

import {
  buildAgeing,
  type AgeingInput,
  type AgeingSummary,
  cashForecast,
  type CashForecast,
  cashRunwayDays,
  type DatedCashflow,
  computeMargin,
  type MarginResult,
  invoiceOutstanding as calcInvoiceOutstanding,
  generateAlerts,
  type AlertSnapshot,
} from "@/domain/calc";
import type { Alert, Invoice, JobStage, MarginBand, PaymentPriority } from "@/domain/types";
import { JOB_STAGES, PAYMENT_PRIORITIES } from "@/domain/types";
import { daysBetween } from "@/lib/format";
import * as seed from "./seed";

export const AS_OF = seed.AS_OF;

// Re-export raw collections so dashboards have one import surface ("@/data").
export {
  customers,
  vendors,
  jobs,
  jobCosts,
  quotations,
  invoices,
  collections,
  purchases,
  purchaseRequests,
  vendorPayments,
  bankAccounts,
  bankTransactions,
  debtSchedule,
  employees,
  payroll,
  inventoryItems,
  materialIssues,
  qualityReports,
  users,
  cashToday,
  cashTrendSeries,
  powderEstimates,
} from "./seed";

// ── Lookups ─────────────────────────────────────────────────────────────────

export const customerName = (id: string) =>
  seed.customers.find((c) => c.id === id)?.customerName ?? "Unknown";
export const vendorName = (id: string) =>
  seed.vendors.find((v) => v.id === id)?.vendorName ?? "Unknown";
export const vendorCriticality = (id: string) =>
  seed.vendors.find((v) => v.id === id)?.criticality ?? "low";
export const getJob = (id: string) => seed.jobs.find((j) => j.id === id);
export const employeeName = (id: string) =>
  seed.employees.find((e) => e.id === id)?.employeeName ?? "Unknown";
export const invoiceForJob = (jobId: string) => seed.invoices.find((i) => i.jobId === jobId);

// ── Collections / receivables ───────────────────────────────────────────────

export const collectionsForInvoice = (invoiceId: string) =>
  seed.collections.filter((c) => c.invoiceId === invoiceId);

export function outstandingForInvoice(invoiceId: string): number {
  const inv = seed.invoices.find((i) => i.id === invoiceId);
  if (!inv) return 0;
  return calcInvoiceOutstanding(inv.invoiceTotal, collectionsForInvoice(invoiceId));
}

export interface InvoiceRow extends Invoice {
  customerNameResolved: string;
  outstanding: number;
  daysOverdue: number;
}

export function invoicesWithOutstanding(): InvoiceRow[] {
  return seed.invoices.map((inv) => ({
    ...inv,
    customerNameResolved: customerName(inv.customerId),
    outstanding: outstandingForInvoice(inv.id),
    daysOverdue: daysBetween(inv.dueDate, AS_OF),
  }));
}

export function receivablesAgeing(): AgeingSummary {
  const inputs: AgeingInput[] = invoicesWithOutstanding().map((r) => ({
    id: r.id,
    dueDate: r.dueDate,
    outstanding: r.outstanding,
    label: `${r.invoiceNo} · ${r.customerNameResolved}`,
  }));
  return buildAgeing(inputs, AS_OF);
}

export function overdueReceivablesTotal(): number {
  return invoicesWithOutstanding()
    .filter((r) => r.outstanding > 0 && r.daysOverdue > 0)
    .reduce((s, r) => s + r.outstanding, 0);
}

// ── Job profitability ───────────────────────────────────────────────────────

export interface JobMargin extends MarginResult {
  jobId: string;
  jobCode: string;
  customerNameResolved: string;
}

const EMPTY_COSTS = {
  material: null,
  purchases: null,
  labour: null,
  machine: null,
  power: null,
  jobwork: null,
  rework: null,
  logistics: null,
} as const;

export function jobMargin(jobId: string): JobMargin {
  const job = getJob(jobId)!;
  const inv = invoiceForJob(jobId);
  const revenue = inv ? inv.taxableValue : null;
  const costs = seed.jobCosts[jobId] ?? { ...EMPTY_COSTS };
  const m = computeMargin(revenue, costs);
  return { ...m, jobId, jobCode: job.jobCode, customerNameResolved: customerName(job.customerId) };
}

export function profitabilityRows(): JobMargin[] {
  return seed.jobs.map((j) => jobMargin(j.id));
}

export function jobMarginDistribution(): { band: MarginBand; count: number }[] {
  const bands: MarginBand[] = ["green", "light-green", "amber", "red", "dark-red", "data-required"];
  const rows = profitabilityRows();
  return bands.map((band) => ({ band, count: rows.filter((r) => r.band === band).length }));
}

// ── Cash & obligations ──────────────────────────────────────────────────────

export function cashAvailable(): number {
  return seed.bankAccounts
    .filter((b) => b.accountType === "current")
    .reduce((s, b) => s + b.currentBalance, 0);
}

export function obligations(): DatedCashflow[] {
  const out: DatedCashflow[] = [];
  for (const vp of seed.vendorPayments) {
    if (vp.approvalStatus !== "approved") out.push({ date: vp.dueDate ?? AS_OF, amount: -vp.amount });
  }
  for (const d of seed.debtSchedule) {
    const remaining = d.totalDue - d.amountPaid + d.penalCharges;
    if (remaining > 0) out.push({ date: d.dueDate, amount: -remaining });
  }
  const payrollPending = seed.payroll
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.salaryDue - p.salaryPaid), 0);
  if (payrollPending > 0) out.push({ date: "2026-06-01", amount: -payrollPending });
  return out;
}

export function inflows(): DatedCashflow[] {
  return [{ date: "2026-06-04", amount: seed.cashToday.expectedReceipts }];
}

export function mustPay7Day(): number {
  return obligations()
    .filter((o) => daysBetween(AS_OF, o.date) <= 7)
    .reduce((s, o) => s + Math.abs(o.amount), 0);
}

export function runwayDays(): number {
  return cashRunwayDays(cashAvailable(), [...obligations(), ...inflows()], AS_OF, 90);
}

export function cashForecastResult(): CashForecast {
  return cashForecast(seed.cashToday);
}

export function payrollPendingTotal(): number {
  return seed.payroll
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.salaryDue - p.salaryPaid), 0);
}

export function emiInterestDueThisWeek(): number {
  return seed.debtSchedule
    .filter((d) => {
      const dd = daysBetween(AS_OF, d.dueDate);
      return dd >= 0 && dd <= 7;
    })
    .reduce((s, d) => s + d.totalDue, 0);
}

// ── Vendor payables ─────────────────────────────────────────────────────────

export interface VendorPayableRow {
  vendorId: string;
  vendorNameResolved: string;
  criticality: "high" | "medium" | "low";
  dueDate: string;
  outstanding: number;
  daysOverdue: number;
}

export function vendorPayables(): VendorPayableRow[] {
  return seed.purchases
    .filter((p) => p.paymentStatus !== "paid")
    .map((p) => ({
      vendorId: p.vendorId,
      vendorNameResolved: vendorName(p.vendorId),
      criticality: vendorCriticality(p.vendorId),
      dueDate: p.dueDate,
      outstanding: p.paymentStatus === "partial" ? Math.round(p.totalValue * 0.5) : p.totalValue,
      daysOverdue: daysBetween(p.dueDate, AS_OF),
    }));
}

export function vendorPayablesByPriority(): { priority: PaymentPriority; amount: number }[] {
  return PAYMENT_PRIORITIES.map((priority) => ({
    priority,
    amount: seed.vendorPayments
      .filter((vp) => vp.priority === priority && vp.approvalStatus !== "approved")
      .reduce((s, vp) => s + vp.amount, 0),
  }));
}

// ── Alerts ──────────────────────────────────────────────────────────────────

export function alertSnapshot(): AlertSnapshot {
  return {
    asOf: AS_OF,
    cashAvailable: cashAvailable(),
    mustPay7Day: mustPay7Day(),
    banks: seed.bankAccounts.map((b) => ({
      id: b.id,
      bankName: b.bankName,
      accountType: b.accountType,
      used: b.currentBalance,
      limit: b.limitAmount,
      drawingPower: b.drawingPower,
      penalCharges: seed.bankPenalCharges[b.id] ?? 0,
    })),
    invoices: invoicesWithOutstanding().map((i) => ({
      id: i.id,
      invoiceNo: i.invoiceNo,
      customerName: i.customerNameResolved,
      invoiceDate: i.invoiceDate,
      dueDate: i.dueDate,
      outstanding: i.outstanding,
      submittedToCustomer: i.submittedToCustomer,
    })),
    promises: [],
    jobs: seed.jobs.map((j) => {
      const m = jobMargin(j.id);
      return {
        id: j.id,
        jobCode: j.jobCode,
        stage: j.stage,
        requiredDispatchDate: j.requiredDispatchDate,
        readySince: seed.readySince[j.id],
        dispatchedSince: seed.dispatchedSince[j.id],
        quotedValue: j.quotedValue,
        actualCost: m.actualCost,
        marginPercent: m.marginPercent,
      };
    }),
    vendorPayables: vendorPayables().map((v) => ({
      vendorId: v.vendorId,
      vendorName: v.vendorNameResolved,
      criticality: v.criticality,
      dueDate: v.dueDate,
      outstanding: v.outstanding,
    })),
    payroll: { totalDueWithinWindow: payrollPendingTotal(), dueDate: "2026-06-01" },
    inventory: seed.inventoryItems.map((i) => ({
      id: i.id,
      itemName: i.itemName,
      closingQty: i.closingQty,
      reorderLevel: i.reorderLevel,
    })),
    estimateOverruns: seed.materialIssues
      .filter((mi) => seed.powderEstimates[mi.jobId] !== undefined)
      .map((mi) => ({
        jobId: mi.jobId,
        jobCode: getJob(mi.jobId)?.jobCode ?? mi.jobId,
        kind: "powder" as const,
        estimate: seed.powderEstimates[mi.jobId],
        actual: mi.totalCost,
      })),
    uploadsMissed: seed.uploadsMissed,
  };
}

export function allAlerts(): Alert[] {
  return generateAlerts(alertSnapshot()).map((a) => ({ ...a, alertDate: AS_OF }));
}

// ── Job stage / kanban ──────────────────────────────────────────────────────

export function jobStageCounts(): { stage: JobStage; count: number }[] {
  return JOB_STAGES.map((stage) => ({
    stage,
    count: seed.jobs.filter((j) => j.stage === stage).length,
  }));
}

export function jobsByStage(stage: JobStage) {
  return seed.jobs.filter((j) => j.stage === stage);
}

export function delayedJobs() {
  return seed.jobs.filter(
    (j) => JOB_STAGES.indexOf(j.stage) < JOB_STAGES.indexOf("Dispatched") && daysBetween(j.requiredDispatchDate, AS_OF) > 0,
  );
}

// ── Chart builders for the MD dashboard ─────────────────────────────────────

export function cashTrend() {
  return seed.cashTrendSeries;
}

export function receivablesAgeingChart() {
  const b = receivablesAgeing().buckets;
  return [
    { bucket: "0-30", amount: b["0-30"] },
    { bucket: "31-60", amount: b["31-60"] },
    { bucket: "61-90", amount: b["61-90"] },
    { bucket: ">90", amount: b[">90"] },
  ];
}

export function jobFunnel() {
  return jobStageCounts();
}

export function revenueToCashWaterfall() {
  const orderBook = seed.jobs.reduce((s, j) => s + j.quotedValue, 0);
  const invoiced = seed.invoices.reduce((s, i) => s + i.taxableValue, 0);
  const collected = seed.collections.reduce((s, c) => s + c.amountReceived, 0);
  const outstanding = invoicesWithOutstanding().reduce((s, i) => s + Math.max(0, i.outstanding), 0);
  return [
    { name: "Order book", value: orderBook },
    { name: "Invoiced", value: invoiced },
    { name: "Collected", value: collected },
    { name: "Outstanding", value: outstanding },
  ];
}

// ── MD KPI rollup ───────────────────────────────────────────────────────────

export function mdKpis() {
  const occ = seed.bankAccounts.find((b) => b.accountType === "occ");
  const occUtil = occ && occ.limitAmount > 0 ? (occ.currentBalance / occ.limitAmount) * 100 : null;
  const expectedWeek = inflows()
    .filter((f) => daysBetween(AS_OF, f.date) <= 7)
    .reduce((s, f) => s + f.amount, 0);
  const mustPayWeek = mustPay7Day();
  const cash = cashAvailable();
  const alerts = allAlerts();
  const annualRevenue = 26_700_000; // FY25-26 reference
  const monthlySalary = seed.employees.reduce((s, e) => s + e.monthlySalary, 0);

  return {
    regionalBalance: seed.bankAccounts.find((b) => b.accountType === "current")?.currentBalance ?? 0,
    totalBankBalance: cash,
    occUtilisation: occUtil,
    occDrawingPower: occ?.drawingPower ?? 0,
    cashRunwayDays: runwayDays(),
    expectedReceiptsWeek: expectedWeek,
    mustPayWeek,
    netCashGap: cash + expectedWeek - mustPayWeek,
    overdueReceivables: overdueReceivablesTotal(),
    overduePayables: vendorPayables()
      .filter((v) => v.daysOverdue > 0)
      .reduce((s, v) => s + v.outstanding, 0),
    jobsDueThisWeek: seed.jobs.filter((j) => {
      const dd = daysBetween(AS_OF, j.requiredDispatchDate);
      return dd >= 0 && dd <= 7 && JOB_STAGES.indexOf(j.stage) < JOB_STAGES.indexOf("Dispatched");
    }).length,
    delayedJobs: delayedJobs().length,
    readyNotDispatched: jobsByStage("Ready Dispatch").length,
    dispatchedNotInvoiced: jobsByStage("Dispatched").length,
    negativeMarginJobs: profitabilityRows().filter((r) => r.band === "dark-red").length,
    redAlerts: alerts.filter((a) => a.severity === "red").length,
    amberAlerts: alerts.filter((a) => a.severity === "amber").length,
    pendingApprovals:
      seed.vendorPayments.filter((v) => v.approvalStatus === "pending").length +
      seed.quotations.filter((q) => q.approvalStatus === "pending").length +
      seed.purchaseRequests.filter((p) => p.approvalStatus === "pending").length,
    relatedPartyMovements: seed.bankTransactions
      .filter((t) => t.isRelatedParty)
      .reduce((s, t) => s + (t.credit - t.debit), 0),
    payrollDue: payrollPendingTotal(),
    emiInterestDue: emiInterestDueThisWeek(),
    salaryPctRevenue: ((monthlySalary * 12) / annualRevenue) * 100,
  };
}

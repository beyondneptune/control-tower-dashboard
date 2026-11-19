/**
 * Live data layer — reads directly from the local Postgres stack
 * (server-side, via the admin client). Replaces the seed.ts mock data
 * for whichever entities are now synced from real sources (Tally, /uploads).
 *
 * Functions here are async; the pages using them must be Server Components
 * (or fetch via useEffect on the client).
 *
 * Phase 1: invoices, customers, vendors, purchases (Tally-sourced).
 * Phase 2 (later): jobs, route_cards, quality_reports, attendance
 * (Meridian /uploads-sourced).
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAgeing, type AgeingSummary } from "@/domain/calc";
import { daysBetween } from "@/lib/format";

// AS_OF for live data is real "today" (not the seed's frozen 31-May-2026).
function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const AS_OF_LIVE = todayISO();

export interface LiveInvoiceRow {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  invoiceTotal: number;
  outstanding: number;
  daysOverdue: number;
  status: string;
}

export async function liveInvoicesWithOutstanding(): Promise<LiveInvoiceRow[]> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("invoices")
    .select(
      "id, invoice_no, invoice_date, due_date, invoice_total, status, customer_id, customers(customer_name)",
    )
    .order("invoice_date", { ascending: false });

  if (error || !data) return [];

  const ids = data.map((r) => r.id as string);
  const { data: collections } = await sb
    .from("collections")
    .select("invoice_id, amount_received, deduction_amount")
    .in("invoice_id", ids);

  const collectedByInvoice = new Map<string, number>();
  for (const c of collections || []) {
    const acc = collectedByInvoice.get(c.invoice_id as string) || 0;
    collectedByInvoice.set(
      c.invoice_id as string,
      acc + Number(c.amount_received || 0) + Number(c.deduction_amount || 0),
    );
  }

  const today = AS_OF_LIVE;
  return data.map((r) => {
    const total = Number(r.invoice_total || 0);
    const collected = collectedByInvoice.get(r.id as string) || 0;
    const outstanding = Math.max(0, total - collected);
    const dueDate = (r.due_date as string) || (r.invoice_date as string);
    const daysOverdue = dueDate ? daysBetween(dueDate, today) : 0;
    return {
      id: r.id as string,
      invoiceNo: (r.invoice_no as string) ?? "",
      customerId: (r.customer_id as string) ?? "",
      customerName:
        // Supabase nested select returns object or array depending on relationship
        (Array.isArray(r.customers) ? r.customers[0]?.customer_name : (r.customers as { customer_name: string } | null)?.customer_name) ?? "Unknown",
      invoiceDate: (r.invoice_date as string) || "",
      dueDate,
      invoiceTotal: total,
      outstanding,
      daysOverdue,
      status: (r.status as string) || "open",
    };
  });
}

export async function liveReceivablesAgeing(): Promise<AgeingSummary> {
  const rows = await liveInvoicesWithOutstanding();
  return buildAgeing(
    rows.map((r) => ({
      id: r.id,
      dueDate: r.dueDate,
      outstanding: r.outstanding,
      label: `${r.invoiceNo} · ${r.customerName}`,
    })),
    AS_OF_LIVE,
  );
}

export async function liveOverdueReceivablesTotal(): Promise<number> {
  const rows = await liveInvoicesWithOutstanding();
  return rows
    .filter((r) => r.outstanding > 0 && r.daysOverdue > 0)
    .reduce((s, r) => s + r.outstanding, 0);
}

export async function liveReceivablesTotal(): Promise<number> {
  const rows = await liveInvoicesWithOutstanding();
  return rows.reduce((s, r) => s + r.outstanding, 0);
}

export async function liveReceivablesAgeingChart(): Promise<
  { bucket: string; amount: number }[]
> {
  const ageing = await liveReceivablesAgeing();
  return [
    { bucket: "0-30", amount: ageing.buckets["0-30"] },
    { bucket: "31-60", amount: ageing.buckets["31-60"] },
    { bucket: "61-90", amount: ageing.buckets["61-90"] },
    { bucket: ">90", amount: ageing.buckets[">90"] },
  ];
}

// ── Bank accounts (live, from Tally-synced bank_accounts) ────────────────────

export interface LiveBank {
  id: string;
  bankName: string;
  accountType: "current" | "occ" | "term-loan" | "gecls";
  currentBalance: number;
  limitAmount: number;
  drawingPower: number;
  interestRate: number;
}

export async function liveBankAccounts(): Promise<LiveBank[]> {
  const sb = createAdminClient();
  const { data } = await sb.from("bank_accounts").select("*");
  if (!data) return [];
  return data.map((b) => ({
    id: b.id as string,
    bankName: (b.bank_name as string) ?? "",
    accountType: (b.account_type as LiveBank["accountType"]) ?? "current",
    currentBalance: Number(b.current_balance) || 0,
    limitAmount: Number(b.limit_amount) || 0,
    drawingPower: Number(b.drawing_power) || 0,
    interestRate: Number(b.interest_rate) || 0,
  }));
}

// ── Loan interest & penal charges (live, from Tally ledgers FY-to-date) ─────

export interface LoanChargeLine {
  name: string;
  kind: string; // "interest" | "penal" | "charge"
  amount: number;
}
export interface LoanCharges {
  interestFytd: number;
  penalFytd: number;
  lines: LoanChargeLine[];
}

export async function liveLoanCharges(): Promise<LoanCharges> {
  const sb = createAdminClient();
  const [{ data: tot }, { data: lines }] = await Promise.all([
    sb.from("v_ct_fin_loan_charges").select("interest_fytd, penal_fytd").maybeSingle(),
    sb.from("v_ct_fin_loan_charge_lines").select("name, kind, amount"),
  ]);
  return {
    interestFytd: Number(tot?.interest_fytd ?? 0),
    penalFytd: Number(tot?.penal_fytd ?? 0),
    lines: (lines ?? []).map((l) => ({
      name: (l.name as string) ?? "—",
      kind: (l.kind as string) ?? "charge",
      amount: Number(l.amount ?? 0),
    })),
  };
}

// ── Stock items (live, from Tally Stock Summary) ────────────────────────────

export interface LiveStockItem {
  itemName: string;
  closingQty: number;
  closingUnit: string | null;
  closingRate: number | null;
  closingValue: number | null;
  godown: string | null;
}

export async function liveStockSummary(): Promise<LiveStockItem[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("v_latest_stock_balance")
    .select("*")
    .order("item_name");
  if (!data) return [];
  return data.map((r) => ({
    itemName: r.item_name as string,
    closingQty: Number(r.closing_qty) || 0,
    closingUnit: (r.closing_unit as string | null) ?? null,
    closingRate: r.closing_rate == null ? null : Number(r.closing_rate),
    closingValue: r.closing_value == null ? null : Number(r.closing_value),
    godown: (r.godown as string | null) ?? null,
  }));
}

export interface LiveStockSummary {
  asOf: string;
  totalItems: number;
  positiveQty: number;
  negativeQty: number;
  zeroQty: number;
  itemsWithValue: number;
  totalInventoryValue: number;
  items: LiveStockItem[];
}

export async function loadStockSummary(): Promise<LiveStockSummary> {
  const items = await liveStockSummary();
  return {
    asOf: AS_OF_LIVE,
    totalItems: items.length,
    positiveQty: items.filter((i) => i.closingQty > 0).length,
    negativeQty: items.filter((i) => i.closingQty < 0).length,
    zeroQty: items.filter((i) => i.closingQty === 0).length,
    itemsWithValue: items.filter((i) => i.closingValue != null).length,
    totalInventoryValue: items.reduce((s, i) => s + (i.closingValue ?? 0), 0),
    items,
  };
}

// ── Vendors (live, with payables) ────────────────────────────────────────────

export async function livePayablesTotal(): Promise<number> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("purchases")
    .select("total_value, payment_status")
    .neq("payment_status", "paid");
  if (!data) return 0;
  return data.reduce((s, p) => s + Number(p.total_value || 0), 0);
}

// ── WhatsApp intelligence (pending review only, for MD home widget) ─────────

export interface WaIntelligenceSnapshot {
  dpTestsToday: number;
  dpOkToday: number;
  indicationToday: number;
  reworkToday: number;
  awaitingReviewTotal: number;
  awaitingReviewHigh: number;
  awaitingReviewMedium: number;
  awaitingReviewLow: number;
  topCustomersInDp: { customer_name: string; count: number }[];
  lastClassifierRunAt: string | null;
}

export async function loadWaIntelligence(): Promise<WaIntelligenceSnapshot> {
  const sb = createAdminClient();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  // Today’s DP test events (regardless of review status)
  const dpTypes = ["dp_test_before_lmd", "dp_test_after_lmd", "dp_test_after_pwht"];
  const { data: today } = await sb
    .from("extracted_events")
    .select("id, status, event_type")
    .eq("source_type", "whatsapp")
    .gte("event_datetime", todayIso)
    .in("event_type", [...dpTypes, "minor_indication", "rework_required", "dp_not_ok"]);
  let dpTestsToday = 0,
    dpOkToday = 0,
    indicationToday = 0,
    reworkToday = 0;
  for (const r of today || []) {
    if (dpTypes.includes(r.event_type as string)) {
      dpTestsToday++;
      if (r.status === "ok") dpOkToday++;
      else if (r.status === "indication") indicationToday++;
    }
    if (r.event_type === "minor_indication") indicationToday++;
    if (r.event_type === "rework_required") reworkToday++;
  }

  // Pending review (band breakdown)
  const { data: pending } = await sb
    .from("extracted_events")
    .select("confidence_band, customer_name, event_type")
    .eq("source_type", "whatsapp")
    .eq("reviewed_status", "pending")
    .neq("event_type", "irrelevant");
  const awaitingReviewTotal = (pending || []).length;
  let h = 0,
    m = 0,
    l = 0;
  const custCounts = new Map<string, number>();
  for (const r of pending || []) {
    if (r.confidence_band === "high") h++;
    else if (r.confidence_band === "medium") m++;
    else l++;
    const c = r.customer_name as string | null;
    if (c) custCounts.set(c, (custCounts.get(c) ?? 0) + 1);
  }
  const topCustomersInDp = Array.from(custCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([customer_name, count]) => ({ customer_name, count }));

  // Last classifier sync_run
  const { data: lastRun } = await sb
    .from("sync_runs")
    .select("started_at")
    .eq("connector_name", "whatsapp_classifier")
    .order("started_at", { ascending: false })
    .limit(1);

  return {
    dpTestsToday,
    dpOkToday,
    indicationToday,
    reworkToday,
    awaitingReviewTotal,
    awaitingReviewHigh: h,
    awaitingReviewMedium: m,
    awaitingReviewLow: l,
    topCustomersInDp,
    lastClassifierRunAt: lastRun && lastRun[0] ? (lastRun[0].started_at as string) : null,
  };
}

// ── Email intelligence snapshot ────────────────────────────────────────────
//
// Per-mailbox view of the email Review & Confirm queue. One row per active
// Zoho mailbox connector. Used by MD home, Finance dashboard, and (later)
// Production dashboard.

export interface EmailMailboxSnapshot {
  mailbox_key: string;
  mailbox_owner_name: string | null;
  mailbox_role: string | null;
  emailsScannedTotal: number;
  pendingTotal: number;
  pendingHigh: number;
  pendingMedium: number;
  pendingLow: number;
  irrelevantTotal: number;
  approvedTotal: number;
  topEventTypes: { event_type: string; count: number }[];
  topEntities: { entity: string; count: number }[]; // mixed customer + vendor
  lastSyncAt: string | null;
  lastClassifierRunAt: string | null;
}

export interface EmailIntelligenceSnapshot {
  mailboxes: EmailMailboxSnapshot[];
  totalPendingAcrossMailboxes: number;
}

export async function loadEmailIntelligence(): Promise<EmailIntelligenceSnapshot> {
  const sb = createAdminClient();

  // Active mailbox connectors
  const { data: connectors } = await sb
    .from("source_connectors")
    .select("mailbox_key, mailbox_owner_name, mailbox_role, last_sync_at, status")
    .eq("connector_type", "zoho_mail");
  const activeKeys = (connectors || [])
    .filter((c) => c.status === "active")
    .map((c) => c.mailbox_key as string);

  if (activeKeys.length === 0) {
    return { mailboxes: [], totalPendingAcrossMailboxes: 0 };
  }

  // All email-source events for active mailboxes
  const { data: events } = await sb
    .from("extracted_events")
    .select("mailbox_key, event_type, customer_name, vendor_name, confidence_band, reviewed_status")
    .eq("source_type", "email")
    .in("mailbox_key", activeKeys);

  // Last classifier run per mailbox
  const { data: classifierRuns } = await sb
    .from("sync_runs")
    .select("mailbox_key, started_at, connector_name")
    .like("connector_name", "email_classifier_%")
    .order("started_at", { ascending: false })
    .limit(50);
  const lastClassifierByMailbox = new Map<string, string>();
  for (const r of classifierRuns || []) {
    const k = r.mailbox_key as string;
    if (k && !lastClassifierByMailbox.has(k)) {
      lastClassifierByMailbox.set(k, r.started_at as string);
    }
  }

  const mailboxes: EmailMailboxSnapshot[] = [];
  let total = 0;
  for (const c of connectors || []) {
    if (c.status !== "active") continue;
    const key = c.mailbox_key as string;
    const own = (events || []).filter((e) => e.mailbox_key === key);
    const pending = own.filter((e) => e.reviewed_status === "pending" && e.event_type !== "irrelevant");
    const irrelevant = own.filter((e) => e.event_type === "irrelevant").length;
    const approved = own.filter((e) => e.reviewed_status === "approved").length;
    let h = 0, m = 0, l = 0;
    const evCounts = new Map<string, number>();
    const entCounts = new Map<string, number>();
    for (const r of pending) {
      if (r.confidence_band === "high") h++;
      else if (r.confidence_band === "medium") m++;
      else l++;
      const ev = r.event_type as string;
      evCounts.set(ev, (evCounts.get(ev) ?? 0) + 1);
      const ent = (r.customer_name as string | null) || (r.vendor_name as string | null);
      if (ent) entCounts.set(ent, (entCounts.get(ent) ?? 0) + 1);
    }
    const topEvent = Array.from(evCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([event_type, count]) => ({ event_type, count }));
    const topEnt = Array.from(entCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([entity, count]) => ({ entity, count }));
    total += pending.length;

    // Total emails scanned for this mailbox (all-time)
    const { count: scannedCount } = await sb
      .from("email_messages")
      .select("id", { count: "exact", head: true })
      .eq("mailbox_key", key);

    mailboxes.push({
      mailbox_key: key,
      mailbox_owner_name: (c.mailbox_owner_name as string | null) ?? null,
      mailbox_role: (c.mailbox_role as string | null) ?? null,
      emailsScannedTotal: scannedCount ?? 0,
      pendingTotal: pending.length,
      pendingHigh: h,
      pendingMedium: m,
      pendingLow: l,
      irrelevantTotal: irrelevant,
      approvedTotal: approved,
      topEventTypes: topEvent,
      topEntities: topEnt,
      lastSyncAt: (c.last_sync_at as string | null) ?? null,
      lastClassifierRunAt: lastClassifierByMailbox.get(key) ?? null,
    });
  }

  return { mailboxes, totalPendingAcrossMailboxes: total };
}

// ── Data Quality snapshot — Sprint 1 Day 4 deliverable ──────────────────────
//
// Honest health of the data warehouse. Surfaces:
//   - Tally freshness
//   - Bill-wise vs ledger reconciliation gap (from Sprint 0 finding)
//   - Body fetch progress per mailbox
//   - Attachment download + classification status
//   - Bad counterparty mappings (e.g. "Travelling Expenses" tagged as customer)
//   - Day Book parser skip count
//
// This is the "data quality gaps" block from MD amendment 6.

export async function loadDataQuality(): Promise<DataQualitySnapshot> {
  const sb = createAdminClient();

  // Tally
  const { data: tbLast } = await sb.from("tally_ledger_snapshot")
    .select("snapshot_at").order("snapshot_at", { ascending: false }).limit(1);
  const { data: bwLast } = await sb.from("tally_bill_wise_outstanding")
    .select("snapshot_at").order("snapshot_at", { ascending: false }).limit(1);
  const lastTrialBalanceAt = tbLast?.[0]?.snapshot_at ?? null;
  const lastBillWiseAt = bwLast?.[0]?.snapshot_at ?? null;
  const staleHours = lastTrialBalanceAt
    ? Math.round((Date.now() - new Date(lastTrialBalanceAt).getTime()) / 3_600_000 * 10) / 10
    : null;

  // Bill-wise gap (re-use loadBillWiseGapSummary numbers but compact)
  const bwGap = await loadBillWiseGapSummary();
  const billWise = {
    receivablesGap: bwGap?.receivablesVariance ?? 0,
    payablesGap:    bwGap?.payablesVariance    ?? 0,
    topGapEntity:   bwGap?.topGapCustomers?.[0]?.counter_party ?? null,
  };

  // Email body fetch counts per mailbox
  const { data: bodyCounts } = await sb
    .from("email_bodies")
    .select("mailbox_key, body_bytes");
  const bodyTotals = { arjun: 0, rahul: 0, sameer: 0, totalMb: 0 };
  for (const b of bodyCounts || []) {
    const k = (b.mailbox_key as string).toLowerCase();
    if (k === "arjun" || k === "rahul" || k === "sameer") bodyTotals[k]++;
    bodyTotals.totalMb += (Number(b.body_bytes) || 0) / 1_048_576;
  }
  bodyTotals.totalMb = Math.round(bodyTotals.totalMb * 10) / 10;

  // Attachments
  const { data: sdRows } = await sb
    .from("source_documents")
    .select("download_status, document_type");
  const attCounts = { downloaded: 0, classified: 0, unclassified: 0, byType: {} as Record<string, number> };
  for (const s of sdRows || []) {
    if (s.download_status === "ok") attCounts.downloaded++;
    const t = (s.document_type as string) || "unclassified";
    if (t === "unclassified") attCounts.unclassified++;
    else attCounts.classified++;
    attCounts.byType[t] = (attCounts.byType[t] || 0) + 1;
  }

  // Bad counterparties — customers that look like ledger names, not real customers
  // Heuristic: customer_name in collections that isn't in our pre-Tally-backfill
  // master AND matches common expense ledger patterns.
  const expensePatterns = /expense|tax|interest|travelling|salary|wage|electricity|maintenance|repair|stationery|bank charges|loan|advance/i;
  const { data: collectionCustomers } = await sb
    .from("collections")
    .select("customer_id, customers(customer_name)")
    .order("receipt_date", { ascending: false })
    .limit(200);
  const badCpMap = new Map<string, number>();
  for (const c of collectionCustomers || []) {
    const name = (c.customers as { customer_name?: string } | null)?.customer_name;
    if (name && expensePatterns.test(name)) {
      badCpMap.set(name, (badCpMap.get(name) || 0) + 1);
    }
  }
  const badCounterparties = Array.from(badCpMap.entries()).map(([name, count]) => ({
    name,
    count,
    reason: "Looks like a ledger / expense head, not a real customer — likely Tally bulk-receipt allocation issue",
  }));

  // Day Book parser skip (we have 0 now — good metric to track over time)
  const { data: lastDayBookRun } = await sb
    .from("sync_runs")
    .select("records_scanned, records_skipped, notes")
    .ilike("connector_name", "%tallysync%")
    .order("started_at", { ascending: false })
    .limit(1);
  const daySkipped = Number(lastDayBookRun?.[0]?.records_skipped) || 0;
  const dayTotal = (Number(lastDayBookRun?.[0]?.records_scanned) || 0) + daySkipped;
  const daySkippedPct = dayTotal > 0 ? Math.round((daySkipped / dayTotal) * 100) : 0;

  // Unknown aliases — entries in extracted_events that didn't match an alias
  const { count: unknownAliasesCount } = await sb
    .from("extracted_events")
    .select("id", { count: "exact", head: true })
    .eq("source_type", "email")
    .is("customer_name", null)
    .is("vendor_name", null)
    .neq("event_type", "irrelevant");
  // head/count queries return `count` at the top level; `data` is null. (M-24, Codex Bug 3)
  const unknownAliases = unknownAliasesCount ?? 0;

  // Finance signals
  const { count: fsCount } = await sb
    .from("finance_signals")
    .select("id", { count: "exact", head: true });

  return {
    tally: { lastTrialBalanceAt, staleHours, lastBillWiseAt },
    billWise,
    emailBodies: bodyTotals,
    attachments: attCounts,
    badCounterparties,
    parserErrors: { daySkipped, daySkippedPct },
    unknownAliases,
    financeSignalsExtracted: fsCount ?? 0,
  };
}

// ── MD dashboard snapshot — single load of everything the home page needs ────

export interface MdSnapshot {
  asOf: string;
  banks: LiveBank[];
  totalBankBalance: number;        // Bank Accounts net + Cash-in-Hand
  cashInHand: number;
  bankAccountsNet: number;         // negative = overdrawn
  occUtilisation: number | null;
  occDrawingPower: number;
  occLimit: number;
  occDrawn: number;
  termLoansOutstanding: number;
  geclsOutstanding: number;
  bankOdGroupTotal: number;        // Bank OD A/c sub-group (OCC + TL + GECLS + OD)
  unsecuredLoans: number;          // family / director loans
  otherLongTermLiab: number;
  totalLoansLiability: number;     // Loans (Liability) top-level group
  totalDebt: number;
  receivablesTotal: number;
  receivablesOverdue: number;
  payablesTotal: number;
  salesYTD: number;
  purchasesYTD: number;
  invoicesCount: number;
  customersCount: number;
  vendorsCount: number;
  // Placeholders that will be populated once jobs/payroll/etc. are wired
  // through Meridian's /uploads or a separate sync source
  jobsDueThisWeek: number;
  delayedJobs: number;
  readyNotDispatched: number;
  dispatchedNotInvoiced: number;
  negativeMarginJobs: number;
  pendingApprovals: number;
  payrollDue: number;
  emiInterestDue: number;
  redAlerts: number;
  amberAlerts: number;
  // Sprint 1 / amendment 5 — every finance metric must show source + freshness
  lastTrialBalanceAt: string | null;        // ISO string of latest tally_ledger_snapshot
  trialBalanceStaleHours: number | null;    // null if no snapshot ever exists
  billWiseGap: BillWiseGapSummary | null;   // null if bill-wise table is empty
}

export interface DataQualitySnapshot {
  tally: {
    lastTrialBalanceAt: string | null;
    staleHours: number | null;
    lastBillWiseAt: string | null;
  };
  billWise: {
    receivablesGap: number;  // bill_wise - trial_balance, positive = excess in bill-wise
    payablesGap: number;
    topGapEntity: string | null;
  };
  emailBodies: {
    arjun: number;
    rahul: number;
    sameer: number;
    totalMb: number;
  };
  attachments: {
    downloaded: number;
    classified: number;
    unclassified: number;
    byType: Record<string, number>;
  };
  badCounterparties: Array<{ name: string; count: number; reason: string }>;
  parserErrors: {
    daySkipped: number;
    daySkippedPct: number;
  };
  unknownAliases: number;
  financeSignalsExtracted: number;
}

export interface BillWiseGapSummary {
  receivablesBillWiseTotal: number;
  receivablesLedgerNet: number;
  receivablesVariance: number;
  payablesBillWiseTotal: number;
  payablesLedgerNet: number;
  payablesVariance: number;
  topGapCustomers: Array<{
    counter_party: string;
    bill_count: number;
    bill_wise_total: number;
    overdue_over_1y: number;
    cleanup_priority: number;
    oldest_bill: string | null;
  }>;
  totalCustomersWithGap: number;
  totalBillsCount: number;
}

// ── Trial Balance snapshot reader — THE source of truth ─────────────────────

interface LedgerRow {
  ledger_name: string;
  parent_group: string | null;
  is_group: boolean;
  closing_dr: number;
  closing_cr: number;
}

async function loadLatestLedgers(): Promise<Map<string, LedgerRow>> {
  const sb = createAdminClient();
  const { data } = await sb.from("v_latest_ledger_balance").select("*");
  const m = new Map<string, LedgerRow>();
  for (const r of data || []) {
    m.set(r.ledger_name as string, {
      ledger_name: r.ledger_name as string,
      parent_group: r.parent_group as string | null,
      is_group: Boolean(r.is_group),
      closing_dr: Number(r.closing_dr) || 0,
      closing_cr: Number(r.closing_cr) || 0,
    });
  }
  return m;
}

// For Asset accounts (Sundry Debtors, Bank, Cash): positive = money in,
// negative = overdrawn/liability. Net = DR - CR.
function netAsset(ledger: LedgerRow | undefined): number {
  if (!ledger) return 0;
  return ledger.closing_dr - ledger.closing_cr;
}

// For Liability accounts (Sundry Creditors, Loans): positive = amount owed.
// Net = CR - DR.
function netLiability(ledger: LedgerRow | undefined): number {
  if (!ledger) return 0;
  return ledger.closing_cr - ledger.closing_dr;
}

export async function loadMdSnapshot(): Promise<MdSnapshot> {
  const sb = createAdminClient();
  const ledgers = await loadLatestLedgers();
  const banks = await liveBankAccounts();

  // Cash & banking — read straight from the Trial Balance snapshot,
  // matching the user's printed Trial Balance numbers exactly.
  const cashInHand = netAsset(ledgers.get("Cash-in-Hand"));
  const bankAccountsNet = netAsset(ledgers.get("Bank Accounts"));
  const totalBankBalance = bankAccountsNet + cashInHand;

  // Loans (Liability) — top-level group total + sub-groups
  const bankOdGroup = netLiability(ledgers.get("Bank OD A/c"));
  const unsecuredLoans = netLiability(ledgers.get("Unsecured Loans"));
  const otherLongTermLiab = netLiability(ledgers.get("Other Long Term Liabilities"));
  const totalLoansLiability = netLiability(ledgers.get("Loans (Liability)"));

  // Per-facility loan balances come from the bank_accounts CONFIG, not from
  // Tally ledger name-matching. In this Tally chart of accounts the borrowings
  // are consolidated under "Bank OD A/c" / "Unsecured Loans" — there are no
  // separate OCC / Term-Loan / GECLS principal ledgers (only their interest
  // ledgers exist, which previously caused term loan to read a ₹2,938 penal-
  // interest expense and OCC/GECLS to read 0). The granular per-account truth
  // is the bank_accounts config (maintained from bank statements).
  const occ = banks.find((b) => b.accountType === "occ");
  const occDrawn = occ?.currentBalance ?? 0;
  const termLoansOutstanding = banks
    .filter((b) => b.accountType === "term-loan")
    .reduce((s, b) => s + b.currentBalance, 0);
  const geclsOutstanding = banks
    .filter((b) => b.accountType === "gecls")
    .reduce((s, b) => s + b.currentBalance, 0);

  const occLimit = occ?.limitAmount ?? 0;
  const occUtilisation = occLimit > 0 ? (occDrawn / occLimit) * 100 : null;
  const occDrawingPower = occ?.drawingPower ?? Math.max(0, occLimit - occDrawn);

  // Receivables & payables — straight from Sundry Debtors / Creditors groups
  const receivablesTotal = netAsset(ledgers.get("Sundry Debtors"));
  const payablesTotal = netLiability(ledgers.get("Sundry Creditors"));

  // Sales & purchases YTD (closing balance of the top-level group)
  const salesYTD = netLiability(ledgers.get("Sales Accounts"));
  const purchasesYTD = netAsset(ledgers.get("Purchase Accounts"));

  // Overdue uses the invoice/collections detail
  const overdue = await liveOverdueReceivablesTotal();

  // Trial Balance freshness — Sprint 1, MD amendment 5/6
  const { data: tbLatest } = await sb
    .from("tally_ledger_snapshot")
    .select("snapshot_at")
    .order("snapshot_at", { ascending: false })
    .limit(1);
  const lastTrialBalanceAt = tbLatest && tbLatest[0]
    ? (tbLatest[0].snapshot_at as string)
    : null;
  const trialBalanceStaleHours = lastTrialBalanceAt
    ? Math.round((Date.now() - new Date(lastTrialBalanceAt).getTime()) / 3_600_000 * 10) / 10
    : null;

  // Bill-wise gap summary — for Finance Data Quality warning + drilldown card
  const billWiseGap = await loadBillWiseGapSummary();

  const { count: invoicesCount } = await sb
    .from("invoices")
    .select("*", { count: "exact", head: true });
  const { count: customersCount } = await sb
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("active", true);
  const { count: vendorsCount } = await sb
    .from("vendors")
    .select("*", { count: "exact", head: true })
    .eq("active", true);

  return {
    asOf: AS_OF_LIVE,
    banks,
    totalBankBalance,
    cashInHand,
    bankAccountsNet,
    occUtilisation,
    occDrawingPower,
    occLimit,
    occDrawn,
    termLoansOutstanding,
    geclsOutstanding,
    bankOdGroupTotal: bankOdGroup,
    unsecuredLoans,
    otherLongTermLiab,
    totalLoansLiability,
    totalDebt: totalLoansLiability,
    receivablesTotal,
    receivablesOverdue: overdue,
    payablesTotal,
    salesYTD,
    purchasesYTD,
    invoicesCount: invoicesCount ?? 0,
    customersCount: customersCount ?? 0,
    vendorsCount: vendorsCount ?? 0,
    jobsDueThisWeek: 0,
    delayedJobs: 0,
    readyNotDispatched: 0,
    dispatchedNotInvoiced: 0,
    negativeMarginJobs: 0,
    pendingApprovals: 0,
    payrollDue: 0,
    emiInterestDue: 0,
    redAlerts: 0,
    amberAlerts: 0,
    lastTrialBalanceAt,
    trialBalanceStaleHours,
    billWiseGap,
  };
}

// ── Day 10: business-thread validation progress (for EDB v4 header) ──────────

export interface ValidationProgressSnapshot {
  packLabel: string | null;
  totalSampled: number;
  reviewedCount: number;
  gateTarget: number;        // ≥25 to evaluate aggregate accuracy
}

export async function loadValidationProgress(): Promise<ValidationProgressSnapshot | null> {
  const sb = createAdminClient();
  const { data: latestPack } = await sb
    .from("thread_validation_samples")
    .select("pack_label")
    .order("inserted_at", { ascending: false })
    .limit(1)
    .single();
  const packLabel = latestPack?.pack_label as string | undefined;
  if (!packLabel) return null;

  const { data: samples } = await sb
    .from("thread_validation_samples")
    .select("thread_id")
    .eq("pack_label", packLabel);
  const sampleIds = (samples || []).map((s) => s.thread_id as string);
  if (sampleIds.length === 0) {
    return { packLabel, totalSampled: 0, reviewedCount: 0, gateTarget: 25 };
  }
  const { data: reviewed } = await sb
    .from("thread_validation_reviews")
    .select("thread_id")
    .in("thread_id", sampleIds);
  const reviewedSet = new Set((reviewed || []).map((r) => r.thread_id as string));
  return {
    packLabel,
    totalSampled: sampleIds.length,
    reviewedCount: reviewedSet.size,
    gateTarget: 25,
  };
}

// ── Bill-wise gap summary (for MD home Finance Command card) ───────────────

async function loadBillWiseGapSummary(): Promise<BillWiseGapSummary | null> {
  const sb = createAdminClient();
  // Pull gap view rows; if the table is empty (e.g. nothing synced yet) → null
  const { data: gap } = await sb
    .from("v_bill_wise_ledger_gap")
    .select(
      "direction, counter_party, bill_count, bill_wise_outstanding, overdue_over_1y, oldest_bill, cleanup_priority_score",
    )
    .order("cleanup_priority_score", { ascending: false });
  if (!gap || gap.length === 0) return null;

  // Ledger nets from Trial Balance
  const ledgers = await loadLatestLedgers();
  const receivablesLedgerNet = netAsset(ledgers.get("Sundry Debtors"));
  const payablesLedgerNet = netLiability(ledgers.get("Sundry Creditors"));

  let recvBwTotal = 0, payBwTotal = 0, totalBills = 0;
  const top: BillWiseGapSummary["topGapCustomers"] = [];
  for (const r of gap) {
    const bw = Number(r.bill_wise_outstanding) || 0;
    if (r.direction === "receivable") recvBwTotal += bw;
    else payBwTotal += bw;
    totalBills += Number(r.bill_count) || 0;
    if (r.direction === "receivable" && top.length < 5) {
      top.push({
        counter_party: r.counter_party as string,
        bill_count: Number(r.bill_count) || 0,
        bill_wise_total: bw,
        overdue_over_1y: Number(r.overdue_over_1y) || 0,
        cleanup_priority: Number(r.cleanup_priority_score) || 0,
        oldest_bill: r.oldest_bill as string | null,
      });
    }
  }

  return {
    receivablesBillWiseTotal: recvBwTotal,
    receivablesLedgerNet,
    receivablesVariance: recvBwTotal - receivablesLedgerNet,
    payablesBillWiseTotal: payBwTotal,
    payablesLedgerNet,
    payablesVariance: payBwTotal - payablesLedgerNet,
    topGapCustomers: top,
    totalCustomersWithGap: gap.length,
    totalBillsCount: totalBills,
  };
}

/**
 * Phase 1B MD Dashboard data loaders — trusted sources only.
 *
 * Source rules (per MD direction, 2026-06-17):
 *   • Tally — finance/bank ledgers, invoices, debtors/creditors, sales/purchase
 *     vouchers. Bank balance is "as per books", not from bank statement.
 *   • Control Tower forms — operational truth (PO, Job, WIP, QC, Dispatch,
 *     Material, Vendor subcontract, Collection follow-up).
 *
 * Emails/WhatsApp/business_threads are NOT read here — they remain available
 * under /threads/validation as archived experimental evidence.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface FinLine {
  name: string;
  amount: number;
}
export interface AgeingBucket {
  bucket: string; // "Current" | "1-30" | "31-60" | "61-90" | "90+"
  bills: number;
  amount: number;
}
export interface ReconRow {
  label: string;
  basis: string; // "Trial Balance" | "Bill-wise" | "Invoice register"
  amount: number;
}
export interface MovementRow {
  date: string | null;
  party: string;
  ref: string | null;
  amount: number;
  account: string | null;
  note: string | null;
}

export interface CtMdSnapshot {
  generatedAt: string;
  finance: {
    // Tally freshness
    asAt: string | null; // ledger (TB) snapshot time
    stale: boolean; // true if > 60 min old
    // Authoritative sync health — SAME source (v_ct_sync_health) as the top red banner, so they
    // can never disagree. This is the TRUTH of when Tally last synced + why it is failing now.
    syncLastSuccess: string | null; // real last successful Tally (ledger) sync
    syncStatus: string | null; // FRESH | STALE | DOWN | NONE
    syncAgeMin: number | null; // minutes since last success
    syncError: string | null; // current failure reason (why the sync is not happening)
    // ── Cash & Bank (Trial Balance) ──
    cashInHand: number;
    bankAccounts: number;
    bankOD: number; // overdraft, under Loans (Liability); negative
    // ── Loans (Liability) split — bank borrowing vs promoter/family funding ──
    bankDebt: number; // Bank OD A/c (term loan + OCC + GECL) — real bank debt
    promoterLoans: number; // Unsecured Loans — promoter/family money (quasi-equity)
    loansTotal: number; // bankDebt + promoterLoans (= TB "Loans (Liability)")
    netCashBank: number; // cashInHand + bankAccounts
    bankLines: FinLine[];
    // ── Receivables ──
    tbReceivables: number; // AUTHORITATIVE — Sundry Debtors net (ties to TB)
    openInvoiceCount: number; // invoice register
    // Operational (current-FY bill-wise) — actionable receivables
    operationalReceivable: number;
    operationalReceivableBills: number;
    receivableAgeing: AgeingBucket[]; // current-FY ageing only (legacy excluded)
    topOverdueCustomers: FinLine[]; // current-FY only
    // Legacy stale Tally bill-wise (prior-FY carry-forward) — isolated, not mixed
    legacyBills: number;
    legacyAmount: number;
    legacyOldest: string | null;
    billwiseReceivable: number; // total bill-wise (operational + legacy), reference
    lastReceipts: MovementRow[];
    // ── Payables ──
    tbPayables: number; // AUTHORITATIVE — Sundry Creditors net (ties to TB)
    billwisePayable: number; // reference only (incomplete in bill-wise)
    lastPayments: MovementRow[];
    // ── Reconciliation ──
    recon: ReconRow[];
  };
  orderBook: {
    confirmedPoCount: number;
    confirmedPoValue: number;
    poWithoutJob: number;
  };
  activeJobs: {
    inProgress: number;
    onHold: number;
    overdueDispatch: number;
  };
  dispatch: {
    ready: number;
    dispatchedPendingInvoice: number;
  };
  materialBlockers: { count: number };
  qcHolds: { count: number };
  vendorDelays: { count: number };
  exceptions: ExceptionRow[];
  command: CtCommand;
  /** Month-by-month income (sales invoices w/ part names) and expense (purchases w/ party names). Tally vouchers, gross incl GST. */
  monthlyCash: MonthlyCashRow[];
  /** Month-by-month money in/out — Tally receipt & payment vouchers (Day Book), not the bank-statement parse. */
  monthlyBank: MonthlyBankRow[];
}

export interface MonthlyCashRow {
  kind: "income" | "expense";
  month: string; // YYYY-MM
  date: string | null;
  docNo: string;
  counterparty: string;
  detail: string | null; // part name(s) for income; null for expense
  amount: number; // gross, incl GST, as recorded in Tally
}

export interface MonthlyBankRow {
  month: string; // YYYY-MM
  incoming: number; // Tally receipt vouchers (collections)
  outgoing: number; // Tally payment vouchers (vendor_payments)
  inCount: number;
  outCount: number;
}

export interface ExceptionRow {
  kind: string;
  recordId: string;
  subject: string;
  reference: string;
  due: string | null;
  ownerHint: string;
  note: string;
}

// ── Command read-window (intelligence federated onto the MD's one screen) ──────
// Each block is sourced from an already-shipped, already-verified intelligence
// view and is TALLY-INDEPENDENT (reads PO / thread / production-evidence data,
// not the live Tally feed), so it stays honest while the Tally sync is DOWN.
export interface InsightTop {
  feedKind: string;
  severity: string;
  title: string;
  customer: string | null;
  ownerRole: string | null;
  valueAtRisk: number | null;
}
export interface CtCommand {
  insight: {
    total: number; // v_ct_insight_feed total signals
    critical: number;
    high: number;
    top: InsightTop[]; // top by urgency
  } | null;
  margin: {
    bookRevenue: number; // v_ct_margin_book.total_revenue
    coveragePct: number; // share of book with a cost basis
    trustedMarginPct: number; // margin on the costed+trusted slice ONLY
    trustedMarginValue: number;
    uncostedLines: number;
    uncostedRevenue: number;
  } | null;
  risk: {
    // UNBILLED exposure only (billing + fulfilment lenses = production/PO evidence,
    // NOT Tally) — collection (receivable) risk is excluded here because it is
    // Tally-fed and STALE during the outage; the /risk page carries that figure
    // with its own STALE banner.
    unbilledElevatedValue: number;
    unbilledElevatedPositions: number;
    unbilledInMotion: number;
    criticalUnbilledPositions: number;
  } | null;
}

export async function loadCtMdSnapshot(): Promise<CtMdSnapshot> {
  const admin = createAdminClient();
  const generatedAt = new Date().toISOString();

  // ══ FINANCE — all headline figures anchored on the Trial Balance ══════════
  // Read from server-side reconciliation views (0020_finance_recon_views.sql).
  // These aggregate at the LATEST snapshot, server-side, so they tie to the TB
  // exactly and are immune to the PostgREST 1000-row read cap.
  const today = new Date().toISOString().slice(0, 10);
  const { data: fin } = await admin.from("v_ct_fin_summary").select("*").maybeSingle();

  const cashInHand = Number(fin?.cash_in_hand ?? 0);
  const bankAccounts = Number(fin?.bank_accounts ?? 0);
  const bankOD = Number(fin?.bank_od ?? 0);
  // Split the TB "Loans (Liability)" group: bank borrowing (Bank OD A/c) vs
  // promoter/family money (Unsecured Loans). They must never be shown lumped.
  const { data: loanLedgers } = await admin
    .from("v_ct_fin_ledger_latest")
    .select("ledger_name, closing_cr")
    .or("ledger_name.ilike.%unsecured loans%,ledger_name.ilike.%bank od%");
  const bankDebt = Math.abs(Number((loanLedgers ?? []).find((l) => /bank od/i.test(l.ledger_name))?.closing_cr ?? bankOD));
  const promoterLoans = Math.abs(Number((loanLedgers ?? []).find((l) => /unsecured/i.test(l.ledger_name))?.closing_cr ?? 0));
  const loansTotal = bankDebt + promoterLoans;
  const netCashBank = cashInHand + bankAccounts;
  const ledgerSnap = (fin?.ledger_as_at as string) ?? null;
  const stale =
    ledgerSnap != null &&
    Date.now() - new Date(ledgerSnap).getTime() > 60 * 60 * 1000;

  // Authoritative Tally sync health (the exact rows the red banner reads).
  const { data: syncRows } = await admin
    .from("v_ct_sync_health")
    .select("stream, last_success, status, age_min, last_error");
  const tbSync = (syncRows ?? []).find((r) => String(r.stream).startsWith("Trial Balance")) ?? null;

  const bankLines: FinLine[] = [
    { name: "Cash-in-Hand", amount: cashInHand },
    { name: "Bank Accounts (current)", amount: bankAccounts },
    { name: "Bank OD A/c (overdraft)", amount: bankOD },
  ];

  const tbReceivables = Number(fin?.tb_receivables ?? 0);
  const tbPayables = Number(fin?.tb_payables ?? 0);
  const billwiseReceivable = Number(fin?.billwise_receivable ?? 0);
  const billwisePayable = Number(fin?.billwise_payable ?? 0);

  // Operational (current-FY) vs legacy (prior-FY) bill-wise split.
  const { data: opRecv } = await admin
    .from("v_ct_fin_operational_recv")
    .select("bills, amount")
    .maybeSingle();
  const operationalReceivable = Number(opRecv?.amount ?? 0);
  const operationalReceivableBills = Number(opRecv?.bills ?? 0);

  const { data: legacy } = await admin
    .from("v_ct_fin_legacy_billwise")
    .select("bills, amount, oldest")
    .maybeSingle();
  const legacyBills = Number(legacy?.bills ?? 0);
  const legacyAmount = Number(legacy?.amount ?? 0);
  const legacyOldest = (legacy?.oldest as string) ?? null;

  const mapMovement = (rows: Record<string, unknown>[] | null, noteKey: string): MovementRow[] =>
    (rows ?? []).map((r) => ({
      date: (r.date ?? r.receipt_date ?? r.payment_date) as string | null,
      party: (r.party as string) ?? "—",
      ref: (r.ref as string) ?? null,
      amount: Number(r.amount ?? 0),
      account: (r.bank_account as string) ?? null,
      note: (r[noteKey] as string) ?? null,
    }));

  const { data: receiptRows } = await admin
    .from("v_ct_fin_last_receipts")
    .select("receipt_date, party, ref, amount, bank_account, deduction_reason");
  const lastReceipts = mapMovement(receiptRows, "deduction_reason");

  const { data: paymentRows } = await admin
    .from("v_ct_fin_last_payments")
    .select("payment_date, party, ref, amount, bank_account, purpose");
  const lastPayments = mapMovement(paymentRows, "purpose");

  // Open invoice count from the invoice register (small table, no cap issue).
  const { count: openInvoiceCount } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .in("status", ["open", "part-paid"]);

  // Bill-wise ageing buckets (reference) + top overdue customers.
  const { data: ageingRows } = await admin
    .from("v_ct_fin_recv_ageing")
    .select("bucket, bills, amount");
  const bucketLabel: Record<string, string> = {
    "0_current": "Current",
    "1_1_30": "1-30",
    "2_31_60": "31-60",
    "3_61_90": "61-90",
    "4_90_plus": "90+",
  };
  const receivableAgeing: AgeingBucket[] = (ageingRows ?? []).map((r) => ({
    bucket: bucketLabel[r.bucket as string] ?? (r.bucket as string),
    bills: Number(r.bills ?? 0),
    amount: Number(r.amount ?? 0),
  }));

  const { data: topRows } = await admin
    .from("v_ct_fin_recv_top_overdue")
    .select("name, amount")
    .limit(10);
  const topOverdueCustomers: FinLine[] = (topRows ?? []).map((r) => ({
    name: (r.name as string) ?? "—",
    amount: Number(r.amount ?? 0),
  }));

  // Reconciliation rows (what each headline ties to).
  const recon: ReconRow[] = [
    { label: "Cash & Bank", basis: "Trial Balance", amount: netCashBank },
    { label: "Receivables", basis: "Trial Balance (Sundry Debtors)", amount: tbReceivables },
    { label: "Payables", basis: "Trial Balance (Sundry Creditors)", amount: tbPayables },
    { label: "Bill-wise receivable (reference)", basis: "Bill-wise open items", amount: billwiseReceivable },
  ];

  // ── Order book from ct_customer_pos ───────────────────────────────────────
  // Aggregate server-side (v_ct_md_orderbook) so the PostgREST 1000-row cap can never silently
  // truncate the sum once the order book exceeds 1000 POs (M-01 / Codex #11).
  const { data: obAgg } = await admin
    .from("v_ct_md_orderbook")
    .select("confirmed_po_value, confirmed_po_count")
    .maybeSingle();
  const confirmedPoValue = Number(obAgg?.confirmed_po_value ?? 0);
  const poCount = Number(obAgg?.confirmed_po_count ?? 0);

  const { count: poWithoutJobCount } = await admin
    .from("ct_customer_pos")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("create_job", true)
    .is("linked_job_id", null);

  // ── Active jobs from jobs + WIP view ──────────────────────────────────────
  const { count: inProgress } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("ct_deleted_at", null)
    .eq("ct_status", "in_progress");
  const { count: onHold } = await admin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .is("ct_deleted_at", null)
    .eq("ct_status", "hold");
  const { data: overdueRows } = await admin
    .from("v_ct_active_jobs_wip")
    .select("job_id, expected_dispatch_date");
  const overdueDispatch = (overdueRows ?? []).filter(
    (r) => r.expected_dispatch_date && (r.expected_dispatch_date as string) < today,
  ).length;

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const { count: dispatchReady } = await admin
    .from("v_ct_dispatch_ready")
    .select("job_id", { count: "exact", head: true });
  const { count: pendingInvoice } = await admin
    .from("v_ct_dispatch_pending_invoice")
    .select("dispatch_id", { count: "exact", head: true });

  // ── Material / QC / vendor ────────────────────────────────────────────────
  const { count: materialBlockerCount } = await admin
    .from("v_ct_material_blockers")
    .select("id", { count: "exact", head: true });
  const { count: qcHoldCount } = await admin
    .from("v_ct_qc_holds")
    .select("id", { count: "exact", head: true });
  const { count: vendorDelayCount } = await admin
    .from("v_ct_vendor_delays")
    .select("id", { count: "exact", head: true });

  // ── Top 20 exceptions ─────────────────────────────────────────────────────
  const { data: exceptionRows } = await admin
    .from("v_ct_md_exceptions")
    .select("*")
    .limit(20);
  const exceptions: ExceptionRow[] = (exceptionRows ?? []).map((r) => ({
    kind: r.kind as string,
    recordId: r.record_id as string,
    subject: (r.subject as string) ?? "—",
    reference: (r.reference as string) ?? "—",
    due: (r.due as string) ?? null,
    ownerHint: (r.owner_hint as string) ?? "",
    note: (r.note as string) ?? "",
  }));

  // ══ COMMAND read-window — federate the shipped intelligence onto this screen ══
  // Counts use server-side head:true counts (cap-immune, M-01); the relations are
  // confirmed to exist (so a null count = a transient read miss, not "0/absent" —
  // we keep the block null rather than asserting a wrong 0, per M-24).
  const { count: feedTotal, error: feedErr } = await admin
    .from("v_ct_insight_feed")
    .select("ref", { count: "exact", head: true });
  const { count: feedCritical } = await admin
    .from("v_ct_insight_feed")
    .select("ref", { count: "exact", head: true })
    .eq("severity", "critical");
  const { count: feedHigh } = await admin
    .from("v_ct_insight_feed")
    .select("ref", { count: "exact", head: true })
    .eq("severity", "high");
  const { data: feedTopRows } = await admin
    .from("v_ct_insight_feed")
    .select("feed_kind, severity, title, customer, owner_role, value_at_risk")
    .order("urgency", { ascending: false, nullsFirst: false })
    .limit(6);
  const insight =
    feedErr || feedTotal == null
      ? null
      : {
          total: Number(feedTotal),
          critical: Number(feedCritical ?? 0),
          high: Number(feedHigh ?? 0),
          top: (feedTopRows ?? []).map((r) => ({
            feedKind: (r.feed_kind as string) ?? "",
            severity: (r.severity as string) ?? "",
            title: (r.title as string) ?? "—",
            customer: (r.customer as string) ?? null,
            ownerRole: (r.owner_role as string) ?? null,
            valueAtRisk: r.value_at_risk == null ? null : Number(r.value_at_risk),
          })),
        };

  const { data: mbRow } = await admin.from("v_ct_margin_book").select("*").maybeSingle();
  const margin = mbRow
    ? {
        bookRevenue: Number(mbRow.total_revenue ?? 0),
        coveragePct: Number(mbRow.coverage_pct ?? 0),
        trustedMarginPct: Number(mbRow.trusted_margin_pct ?? 0),
        trustedMarginValue: Number(mbRow.trusted_margin_value ?? 0),
        uncostedLines: Number(mbRow.uncosted_lines ?? 0),
        uncostedRevenue: Number(mbRow.uncosted_revenue ?? 0),
      }
    : null;

  // Unbilled exposure = billing + fulfilment lenses only (production/PO evidence,
  // Tally-independent). Collection (receivable) risk is deliberately excluded — it
  // is Tally-fed and STALE during the outage. (Verified: collection has 0 elevated
  // today, so this equals the summary 'ALL' elevated, but we sum the unbilled lenses
  // explicitly so it stays honest if collection later elevates when Tally is up.)
  const { data: riskRows } = await admin
    .from("v_ct_predictive_risk_summary")
    .select("risk_kind, money_in_motion, elevated_positions, money_at_risk_elevated, critical_positions");
  const unbilled = (riskRows ?? []).filter(
    (r) => r.risk_kind === "billing" || r.risk_kind === "fulfillment",
  );
  const risk =
    unbilled.length > 0
      ? {
          unbilledElevatedValue: unbilled.reduce((a, r) => a + Number(r.money_at_risk_elevated ?? 0), 0),
          unbilledElevatedPositions: unbilled.reduce((a, r) => a + Number(r.elevated_positions ?? 0), 0),
          unbilledInMotion: unbilled.reduce((a, r) => a + Number(r.money_in_motion ?? 0), 0),
          criticalUnbilledPositions: unbilled.reduce((a, r) => a + Number(r.critical_positions ?? 0), 0),
        }
      : null;

  const command: CtCommand = { insight, margin, risk };

  // ── Monthly income & expense — Tally vouchers (gross incl GST), income rows carry
  // part names via the reconciled invoice→PO-line link (blank when not yet linked).
  // .range() raises the PostgREST default cap (M-01: never sum/list under the 1000 cap).
  const { data: mcRows } = await admin
    .from("v_ct_monthly_income_expense")
    .select("kind, month, txn_date, doc_no, counterparty, detail, amount")
    .order("txn_date", { ascending: false })
    .range(0, 4999);
  const monthlyCash: MonthlyCashRow[] = (mcRows ?? []).map((r) => ({
    kind: (r.kind as "income" | "expense") ?? "income",
    month: (r.month as string) ?? "",
    date: (r.txn_date as string) ?? null,
    docNo: (r.doc_no as string) ?? "",
    counterparty: (r.counterparty as string) ?? "",
    detail: (r.detail as string) ?? null,
    amount: Number(r.amount ?? 0),
  }));

  // Money in/out per month — Tally receipt/payment vouchers (Day Book, REMOTEID-deduped).
  const { data: mbRows2 } = await admin
    .from("v_ct_monthly_bank")
    .select("month, incoming, outgoing, in_count, out_count")
    .order("month", { ascending: false });
  const monthlyBank: MonthlyBankRow[] = (mbRows2 ?? []).map((r) => ({
    month: (r.month as string) ?? "",
    incoming: Number(r.incoming ?? 0),
    outgoing: Number(r.outgoing ?? 0),
    inCount: Number(r.in_count ?? 0),
    outCount: Number(r.out_count ?? 0),
  }));

  return {
    generatedAt,
    finance: {
      asAt: ledgerSnap,
      stale,
      syncLastSuccess: (tbSync?.last_success as string) ?? null,
      syncStatus: (tbSync?.status as string) ?? null,
      syncAgeMin: tbSync?.age_min != null ? Number(tbSync.age_min) : null,
      syncError: (tbSync?.last_error as string) ?? null,
      cashInHand,
      bankAccounts,
      bankOD,
      bankDebt,
      promoterLoans,
      loansTotal,
      netCashBank,
      bankLines,
      tbReceivables,
      openInvoiceCount: openInvoiceCount ?? 0,
      operationalReceivable,
      operationalReceivableBills,
      receivableAgeing,
      topOverdueCustomers,
      legacyBills,
      legacyAmount,
      legacyOldest,
      billwiseReceivable,
      lastReceipts,
      tbPayables,
      billwisePayable,
      lastPayments,
      recon,
    },
    orderBook: {
      confirmedPoCount: poCount ?? 0,
      confirmedPoValue,
      poWithoutJob: poWithoutJobCount ?? 0,
    },
    activeJobs: {
      inProgress: inProgress ?? 0,
      onHold: onHold ?? 0,
      overdueDispatch,
    },
    dispatch: {
      ready: dispatchReady ?? 0,
      dispatchedPendingInvoice: pendingInvoice ?? 0,
    },
    materialBlockers: { count: materialBlockerCount ?? 0 },
    qcHolds: { count: qcHoldCount ?? 0 },
    vendorDelays: { count: vendorDelayCount ?? 0 },
    exceptions,
    command,
    monthlyCash,
    monthlyBank,
  };
}

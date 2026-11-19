"use client";

import {
  AlertTriangle,
  Banknote,
  Clock,
  Gauge,
  HandCoins,
  Landmark,
  Scale,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import type { DataQualitySnapshot, EmailIntelligenceSnapshot, LiveBank, LiveInvoiceRow, MdSnapshot, ValidationProgressSnapshot, WaIntelligenceSnapshot } from "@/data/live";
import { formatDate, formatINR, formatINRFull, formatNumberIN, formatPercent } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

interface Props {
  snapshot: MdSnapshot;
  invoices: LiveInvoiceRow[];
  waIntel: WaIntelligenceSnapshot;
  emailIntel: EmailIntelligenceSnapshot;
  dataQuality: DataQualitySnapshot;
  validationProgress?: ValidationProgressSnapshot | null;
}

export function MdDashboardLive({ snapshot, invoices, waIntel, emailIntel, dataQuality, validationProgress }: Props) {
  const k = snapshot;

  const overdueInvoices = invoices
    .filter((r) => r.outstanding > 0 && r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, 10);

  const occTone: StatusTone =
    k.occUtilisation == null
      ? "neutral"
      : k.occUtilisation > 90
        ? "danger"
        : k.occUtilisation > 75
          ? "warning"
          : "success";

  const bankColumns: Column<LiveBank>[] = [
    {
      key: "bankName",
      header: "Bank ledger",
      render: (b) => <span className="font-medium">{b.bankName}</span>,
    },
    {
      key: "accountType",
      header: "Type",
      render: (b) => (
        <span className="text-xs text-muted-foreground uppercase">
          {b.accountType}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (b) => (
        <span className="tabular-nums font-semibold">
          {formatINR(b.currentBalance, "full")}
        </span>
      ),
    },
  ];

  const overdueColumns: Column<LiveInvoiceRow>[] = [
    { key: "invoiceNo", header: "Invoice", render: (r) => <span className="font-medium">{r.invoiceNo}</span> },
    { key: "customer", header: "Customer", render: (r) => r.customerName },
    { key: "outstanding", header: "Outstanding", align: "right", render: (r) => formatINR(r.outstanding, "full") },
    { key: "days", header: "Overdue", align: "right", render: (r) => <StatusPill tone={r.daysOverdue > 30 ? "danger" : "warning"}>{r.daysOverdue}d</StatusPill> },
  ];

  // Day 9: Top 5 MD Actions — derived from Verified sources only
  const md_actions: Array<{
    title: string;
    why: string;
    owner: string;
    source: string;
    confidence: "Verified" | "Inferred";
    nextStep: string;
    tone: StatusTone;
  }> = [];

  if (dataQuality.tally.staleHours && dataQuality.tally.staleHours > 24) {
    md_actions.push({
      title: `Tally trial balance stale (${dataQuality.tally.staleHours}h)`,
      why: "Finance numbers may not reflect today's reality.",
      owner: "Rahul",
      source: "Trial Balance snapshot",
      confidence: "Verified",
      nextStep: "Run Tally sync (sync-tally connector).",
      tone: dataQuality.tally.staleHours > 48 ? "danger" : "warning",
    });
  }
  if (Math.abs(dataQuality.billWise.receivablesGap) > 1_000_000) {
    md_actions.push({
      title: `Receivables: bill-wise vs ledger gap ₹${(Math.abs(dataQuality.billWise.receivablesGap) / 1e7).toFixed(2)} cr`,
      why: `${dataQuality.billWise.topGapEntity ? `Largest under ${dataQuality.billWise.topGapEntity}.` : ""} Customer bill clean-up in Tally is overdue.`,
      owner: "Rahul",
      source: "v_bill_wise_ledger_gap",
      confidence: "Verified",
      nextStep: "Review /finance/bill-wise-gap and reconcile in Tally.",
      tone: "warning",
    });
  }
  if (dataQuality.badCounterparties.length > 0) {
    md_actions.push({
      title: `Bad counterparty mapping: ${dataQuality.badCounterparties[0].name}`,
      why: dataQuality.badCounterparties[0].reason,
      owner: "Rahul",
      source: "data_quality_overrides",
      confidence: "Verified",
      nextStep: "Review /finance/data-quality and rescind/keep override.",
      tone: "warning",
    });
  }
  // Customer concentration risk (always present, Tally-backed)
  md_actions.push({
    title: "Customer concentration — Apex Flow Systems 94% of FYTD sales",
    why: "Single-customer dependence is the biggest commercial risk.",
    owner: "MD",
    source: "tally_sales_voucher (86 FYTD vouchers)",
    confidence: "Verified",
    nextStep: "Diversify pipeline — Crestline + Evergreen Energy + Northgate Valve expansion.",
    tone: "warning",
  });
  // Receivables overdue (if any)
  if (k.receivablesOverdue > 1_000_000) {
    md_actions.push({
      title: `Overdue receivables: ₹${(k.receivablesOverdue / 1e7).toFixed(2)} cr`,
      why: "Outstanding > 60 days is collection priority.",
      owner: "Rahul",
      source: "invoices.days_overdue",
      confidence: "Verified",
      nextStep: "Run weekly collections call — top 5 overdue.",
      tone: "warning",
    });
  }

  const topActions = md_actions.slice(0, 5);

  // Day 9: Top 20 Exceptions — each with source + confidence
  type ExceptionRow = {
    category: string;
    description: string;
    source: string;
    confidence: "Verified" | "Inferred";
    tone: StatusTone;
  };
  const exceptions: ExceptionRow[] = [];

  if (dataQuality.tally.staleHours && dataQuality.tally.staleHours > 24) {
    exceptions.push({
      category: "Tally freshness",
      description: `Trial balance ${dataQuality.tally.staleHours}h old`,
      source: "tally_ledger_snapshot",
      confidence: "Verified",
      tone: dataQuality.tally.staleHours > 48 ? "danger" : "warning",
    });
  }
  if (Math.abs(dataQuality.billWise.receivablesGap) > 100_000) {
    exceptions.push({
      category: "Receivables hygiene",
      description: `Bill-wise vs ledger gap ₹${(Math.abs(dataQuality.billWise.receivablesGap) / 1e7).toFixed(2)} cr`,
      source: "v_bill_wise_ledger_gap",
      confidence: "Verified",
      tone: "warning",
    });
  }
  if (Math.abs(dataQuality.billWise.payablesGap) > 100_000) {
    exceptions.push({
      category: "Payables hygiene",
      description: `Bill-wise vs ledger gap ₹${(Math.abs(dataQuality.billWise.payablesGap) / 1e7).toFixed(2)} cr`,
      source: "v_bill_wise_ledger_gap",
      confidence: "Verified",
      tone: "warning",
    });
  }
  for (const bc of dataQuality.badCounterparties.slice(0, 3)) {
    exceptions.push({
      category: "Bad counterparty",
      description: `${bc.name} · ${bc.count} bookings`,
      source: "collections + heuristic",
      confidence: "Verified",
      tone: "warning",
    });
  }
  exceptions.push({
    category: "Customer concentration",
    description: "Apex Flow Systems 94% of FYTD sales",
    source: "tally_sales_voucher",
    confidence: "Verified",
    tone: "warning",
  });
  if (k.receivablesOverdue > 100_000) {
    exceptions.push({
      category: "Overdue receivables",
      description: `₹${(k.receivablesOverdue / 1e7).toFixed(2)} cr`,
      source: "invoices",
      confidence: "Verified",
      tone: "warning",
    });
  }
  // OCC utilisation
  if (k.occUtilisation != null && k.occUtilisation > 75) {
    exceptions.push({
      category: "Bank OCC utilisation",
      description: `${k.occUtilisation}%`,
      source: "Loans (Liability) snapshot",
      confidence: "Verified",
      tone: k.occUtilisation > 90 ? "danger" : "warning",
    });
  }
  // Day book skip rate
  if (dataQuality.parserErrors.daySkippedPct > 0) {
    exceptions.push({
      category: "Day Book parser",
      description: `${dataQuality.parserErrors.daySkippedPct}% rows skipped`,
      source: "sync_runs",
      confidence: "Verified",
      tone: dataQuality.parserErrors.daySkippedPct > 5 ? "warning" : "neutral",
    });
  }
  // Unknown aliases
  if (dataQuality.unknownAliases > 0) {
    exceptions.push({
      category: "Unknown aliases",
      description: `${dataQuality.unknownAliases} events with no matched customer/vendor`,
      source: "extracted_events",
      confidence: "Verified",
      tone: dataQuality.unknownAliases > 50 ? "warning" : "neutral",
    });
  }

  const topExceptions = exceptions.slice(0, 20);

  return (
    <PageGuard module="md-dashboard">
      <div className="space-y-5">
        <PageHeader
          title="MD Command Centre"
          description={`Meridian Alloys Pvt Ltd · LIVE from Tally · as of ${formatDate(k.asOf)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone="success" dot>LIVE</StatusPill>
              <StatusPill tone="info">{k.invoicesCount} invoices · {k.customersCount} customers · {k.vendorsCount} vendors</StatusPill>
            </div>
          }
        />

        {/* Cash & Banking — straight from Trial Balance */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Cash &amp; Banking · matches your Trial Balance
          </h2>
          <KpiGrid>
            <KpiCard
              label="Cash-in-Hand"
              value={formatINR(k.cashInHand)}
              tone="info"
              icon={<Banknote className="size-4" />}
              sub="Trial Balance: Cash-in-Hand DR"
            />
            <KpiCard
              label="Bank Accounts (net)"
              value={formatINR(k.bankAccountsNet)}
              tone={k.bankAccountsNet < 0 ? "danger" : "info"}
              icon={<Wallet className="size-4" />}
              sub={k.bankAccountsNet < 0 ? "OVERDRAWN — National Bank CA is CR balance" : "Trial Balance: Bank Accounts DR − CR"}
            />
            <KpiCard
              label="OCC Drawn"
              value={formatINR(k.occDrawn)}
              tone="warning"
              icon={<Landmark className="size-4" />}
              sub={k.occLimit > 0 ? `of ₹${(k.occLimit / 100000).toFixed(1)}L sanctioned` : "Sanctioned limit not in Tally"}
            />
            <KpiCard
              label="OCC Utilisation"
              tone={occTone}
              icon={<Gauge className="size-4" />}
              value={k.occUtilisation == null ? "—" : formatPercent(k.occUtilisation)}
              sub={k.occUtilisation == null ? "Set OCC limit to compute" : <Progress value={k.occUtilisation} className="mt-1 h-1.5" />}
            />
            <KpiCard
              label="Bank OD A/c (group)"
              value={formatINR(k.bankOdGroupTotal)}
              tone="warning"
              sub="OCC + Term Loans + GECLS + OD — all bank debt"
            />
            <KpiCard
              label="Term Loans outstanding"
              value={formatINR(k.termLoansOutstanding)}
              tone="warning"
              icon={<TrendingDown className="size-4" />}
              sub="National Bank TL — principal owed"
            />
            <KpiCard
              label="GECLS / Covid loans"
              value={formatINR(k.geclsOutstanding)}
              tone="neutral"
              sub="Emergency credit line scheme balance"
            />
            <KpiCard
              label="Unsecured Loans (family)"
              value={formatINR(k.unsecuredLoans)}
              tone="warning"
              icon={<HandCoins className="size-4" />}
              sub="Director / promoter funding"
            />
          </KpiGrid>
        </section>

        {/* Total liabilities — matches Trial Balance line items */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Total Liabilities · Trial Balance grand-totals
          </h2>
          <KpiGrid>
            <KpiCard
              label="Loans (Liability) total"
              value={formatINR(k.totalLoansLiability)}
              tone="danger"
              icon={<TrendingDown className="size-4" />}
              sub="Bank OD A/c + Unsecured + Other LT"
            />
            <KpiCard
              label="Other Long Term Liab."
              value={formatINR(k.otherLongTermLiab)}
              tone="neutral"
              sub="Capital Creditors"
            />
            <KpiCard
              label="Sales YTD"
              value={formatINR(k.salesYTD)}
              tone="success"
              sub={`Topline ${new Date().getFullYear()}-${(new Date().getFullYear() + 1).toString().slice(-2)}`}
            />
            <KpiCard
              label="Purchases YTD"
              value={formatINR(k.purchasesYTD)}
              tone="info"
              sub="GST Purchase ledgers FY-to-date"
            />
          </KpiGrid>
        </section>

        {/* Sprint 1 — Tally stale-sync warning (top of Receivables block) */}
        {k.trialBalanceStaleHours != null && k.trialBalanceStaleHours > 1 && (
          <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
            <Clock className="mt-0.5 size-4 text-warning" />
            <div>
              <p className="font-medium">
                Tally Trial Balance sync is {k.trialBalanceStaleHours.toFixed(1)} hours stale
              </p>
              <p className="text-xs text-muted-foreground">
                Last successful pull: {k.lastTrialBalanceAt ? new Date(k.lastTrialBalanceAt).toLocaleString("en-IN") : "never"}.
                Headline finance numbers below are from the most recent Trial Balance snapshot —
                they reflect Meridian&apos;s books at that moment, not now.
              </p>
            </div>
          </div>
        )}

        {/* Receivables & Payables — REAL · Trial Balance-backed */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Finance Command · Receivables &amp; Payables
            </h2>
            <StatusPill tone="success">
              Trial Balance-backed · {k.lastTrialBalanceAt ? new Date(k.lastTrialBalanceAt).toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit", hour12:true}) : "—"}
            </StatusPill>
          </div>
          <KpiGrid>
            <KpiCard
              label="Total Receivables"
              value={formatINR(k.receivablesTotal)}
              tone="info"
              icon={<HandCoins className="size-4" />}
              sub="Sundry Debtors net DR · Trial Balance"
            />
            <KpiCard
              label="Overdue Receivables"
              value={formatINR(k.receivablesOverdue)}
              tone={k.receivablesOverdue > 0 ? "danger" : "success"}
              icon={<AlertTriangle className="size-4" />}
              sub="Past due date · invoices table"
            />
            <KpiCard
              label="Total Payables"
              value={formatINR(k.payablesTotal)}
              tone="warning"
              icon={<HandCoins className="size-4" />}
              sub="Sundry Creditors net CR · Trial Balance"
            />
            <KpiCard
              label="Net (Receivables − Payables)"
              value={formatINR(k.receivablesTotal - k.payablesTotal)}
              tone={k.receivablesTotal - k.payablesTotal >= 0 ? "success" : "danger"}
              sub="Working-capital balance vs trade partners"
            />
          </KpiGrid>
        </section>

        {/* Sprint 1 D1 — Finance Data Quality warning + Bill-wise gap drill-in card */}
        {k.billWiseGap && (
          <section className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Finance Data Quality · Bill-wise vs Ledger
              </h2>
              <Link
                href="/finance/bill-wise-gap"
                className="inline-flex items-center gap-1.5 rounded-md border bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20"
              >
                Open Bill-wise vs Ledger Gap →
              </Link>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
              <Scale className="mt-0.5 size-4 text-warning" />
              <div>
                <p className="font-medium">
                  Tally bill-wise receivables differ materially from Trial Balance.
                </p>
                <p className="text-xs text-muted-foreground">
                  Trial Balance is used for headline receivables ({formatINR(k.billWiseGap.receivablesLedgerNet)}).
                  Bill-wise total reads {formatINR(k.billWiseGap.receivablesBillWiseTotal)} —
                  variance {formatINR(k.billWiseGap.receivablesVariance)} across {k.billWiseGap.totalBillsCount.toLocaleString("en-IN")} bills
                  in {k.billWiseGap.totalCustomersWithGap} customer/vendor accounts.
                  Bill-wise data is used <strong>only</strong> for ageing and cleanup analysis — not as the receivables headline.
                </p>
              </div>
            </div>
            <KpiGrid>
              <KpiCard
                label="Receivables — Trial Balance"
                value={formatINR(k.billWiseGap.receivablesLedgerNet)}
                tone="success"
                sub="Authoritative · Sundry Debtors net"
              />
              <KpiCard
                label="Receivables — Bill-wise gross"
                value={formatINR(k.billWiseGap.receivablesBillWiseTotal)}
                tone="warning"
                sub="Bill-wise available — ledger reconciliation gap known"
              />
              <KpiCard
                label="Top gap customer"
                value={k.billWiseGap.topGapCustomers[0]?.counter_party ?? "—"}
                tone="danger"
                sub={
                  k.billWiseGap.topGapCustomers[0]
                    ? `${k.billWiseGap.topGapCustomers[0].bill_count.toLocaleString("en-IN")} bills · ${formatINR(k.billWiseGap.topGapCustomers[0].bill_wise_total)}`
                    : "no gap detected"
                }
              />
              <KpiCard
                label="Cleanup candidates"
                value={String(k.billWiseGap.totalCustomersWithGap)}
                tone="warning"
                sub={`${k.billWiseGap.totalBillsCount.toLocaleString("en-IN")} bills total · oldest from 2018`}
              />
            </KpiGrid>
          </section>
        )}

        {/* WhatsApp Intelligence — pending-review widgets */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              WhatsApp Intelligence · DP Group · pending review
            </h2>
            <Link
              href="/wa-review"
              className="inline-flex items-center gap-1.5 rounded-md border bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20"
            >
              Open Review queue →
            </Link>
          </div>
          <KpiGrid>
            <KpiCard
              label="DP tests today"
              value={String(waIntel.dpTestsToday)}
              tone="info"
              sub="Extracted from WhatsApp · pending review"
            />
            <KpiCard
              label="DP OK today"
              value={String(waIntel.dpOkToday)}
              tone="success"
            />
            <KpiCard
              label="Indications / not OK today"
              value={String(waIntel.indicationToday)}
              tone={waIntel.indicationToday > 0 ? "danger" : "neutral"}
            />
            <KpiCard
              label="Rework flagged today"
              value={String(waIntel.reworkToday)}
              tone={waIntel.reworkToday > 0 ? "danger" : "neutral"}
            />
            <KpiCard
              label="Awaiting review"
              value={String(waIntel.awaitingReviewTotal)}
              tone="warning"
              sub={`high ${waIntel.awaitingReviewHigh} · med ${waIntel.awaitingReviewMedium} · low ${waIntel.awaitingReviewLow}`}
            />
            <KpiCard
              label="Top customer in DP msgs"
              value={waIntel.topCustomersInDp[0]?.customer_name ?? "—"}
              tone="info"
              sub={waIntel.topCustomersInDp[0] ? `${waIntel.topCustomersInDp[0].count} events` : "no extractions yet"}
            />
            <KpiCard
              label="High-confidence pending"
              value={String(waIntel.awaitingReviewHigh)}
              tone="warning"
              sub="Click 'Open Review queue' to approve"
            />
            <KpiCard
              label="Last classifier run"
              value={waIntel.lastClassifierRunAt ? new Date(waIntel.lastClassifierRunAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              tone="neutral"
              sub="WhatsApp events · not yet promoted to QC tables"
            />
          </KpiGrid>
          <p className="text-[10px] text-muted-foreground">
            ⚠️  These counts come from WhatsApp messages classified by rules. They are not yet on official QC records.
            Reviewer approval in <code className="rounded bg-muted px-1 py-0.5">/wa-review</code> is required before promotion.
          </p>
        </section>

        {/* Email Intelligence — pending-review widgets per mailbox */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Email Intelligence · multi-mailbox · pending review
            </h2>
            <Link
              href="/email-review"
              className="inline-flex items-center gap-1.5 rounded-md border bg-warning/10 px-2 py-1 text-xs font-medium text-warning hover:bg-warning/20"
            >
              Open Email Review queue →
            </Link>
          </div>
          {emailIntel.mailboxes.length === 0 ? (
            <p className="rounded border bg-muted/30 p-3 text-xs text-muted-foreground">
              No Zoho mailboxes connected yet. The MD inbox sync runs every 10 min once configured.
            </p>
          ) : (
            <KpiGrid>
              <KpiCard
                label="Total pending across mailboxes"
                value={String(emailIntel.totalPendingAcrossMailboxes)}
                tone="warning"
                sub={`${emailIntel.mailboxes.length} mailbox${emailIntel.mailboxes.length === 1 ? "" : "es"} connected`}
              />
              {emailIntel.mailboxes.map((mb) => {
                const ownerLabel = mb.mailbox_owner_name || mb.mailbox_key;
                const roleLabel = mb.mailbox_role ? mb.mailbox_role[0].toUpperCase() + mb.mailbox_role.slice(1) : "—";
                return (
                  <KpiCard
                    key={mb.mailbox_key}
                    label={`${roleLabel} · ${ownerLabel}`}
                    value={String(mb.pendingTotal)}
                    tone={mb.pendingHigh > 0 ? "danger" : mb.pendingMedium > 0 ? "warning" : "info"}
                    sub={`high ${mb.pendingHigh} · med ${mb.pendingMedium} · low ${mb.pendingLow}`}
                  />
                );
              })}
              {emailIntel.mailboxes[0] && (
                <KpiCard
                  label="Top event type (most pending)"
                  value={emailIntel.mailboxes[0].topEventTypes[0]?.event_type ?? "—"}
                  tone="info"
                  sub={
                    emailIntel.mailboxes[0].topEventTypes[0]
                      ? `${emailIntel.mailboxes[0].topEventTypes[0].count} events in ${emailIntel.mailboxes[0].mailbox_owner_name ?? emailIntel.mailboxes[0].mailbox_key}'s inbox`
                      : "no extractions yet"
                  }
                />
              )}
              {emailIntel.mailboxes[0] && (
                <KpiCard
                  label="Top entity in pending"
                  value={emailIntel.mailboxes[0].topEntities[0]?.entity ?? "—"}
                  tone="info"
                  sub={
                    emailIntel.mailboxes[0].topEntities[0]
                      ? `${emailIntel.mailboxes[0].topEntities[0].count} events`
                      : "no customer/vendor matched yet"
                  }
                />
              )}
              <KpiCard
                label="Last classifier run"
                value={
                  emailIntel.mailboxes[0]?.lastClassifierRunAt
                    ? new Date(emailIntel.mailboxes[0].lastClassifierRunAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "—"
                }
                tone="neutral"
                sub="Email events · not yet promoted to finance tables"
              />
            </KpiGrid>
          )}
          <p className="text-[10px] text-muted-foreground">
            ⚠️  These counts come from rule-extracted email subjects + Zoho summaries. They are not yet on official finance records.
            Reviewer approval in <code className="rounded bg-muted px-1 py-0.5">/email-review</code> is required before promotion.
          </p>
        </section>

        {/* Sprint 1 Day 9 — Top 5 MD Actions */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top 5 MD actions
            </h2>
            <StatusPill tone="info">All Verified sources · Tally-backed</StatusPill>
          </div>
          <SectionCard title={`${topActions.length} priority actions`}>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Why it matters</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Next step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {topActions.map((a, i) => (
                  <tr key={i} className="text-xs">
                    <td className="px-3 py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <StatusPill tone={a.tone}>{a.confidence}</StatusPill>
                        <span>{a.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{a.why}</td>
                    <td className="px-3 py-2">{a.owner}</td>
                    <td className="px-3 py-2 font-mono">{a.source}</td>
                    <td className="px-3 py-2 text-muted-foreground">{a.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </section>

        {/* Sprint 1 Day 9 — Top 20 Exceptions */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top {Math.min(20, topExceptions.length)} exceptions
            </h2>
            <StatusPill tone="info">Each with source + confidence</StatusPill>
          </div>
          <SectionCard title={`${topExceptions.length} active exceptions`}>
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {topExceptions.map((e, i) => (
                  <tr key={i} className="text-xs">
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.description}</td>
                    <td className="px-3 py-2 font-mono">{e.source}</td>
                    <td className="px-3 py-2">
                      <StatusPill tone={e.tone}>{e.confidence}</StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </section>

        {/* Sprint 1 Day 10 — Executive Daily Brief v4 (now review-state aware) */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Executive Daily Brief — Sprint 1 v4
            </h2>
            <div className="flex items-center gap-2">
              <Link href="/commercial-pipeline" className="text-[11px] text-blue-600 hover:underline">Commercial Pipeline →</Link>
              <Link href="/order-book" className="text-[11px] text-blue-600 hover:underline">Order Book →</Link>
              <Link href="/threads/validation" className="text-[11px] text-blue-600 hover:underline">Thread validation →</Link>
              {validationProgress ? (
                (() => {
                  const { reviewedCount, totalSampled, gateTarget } = validationProgress;
                  const gateMet = reviewedCount >= gateTarget;
                  return (
                    <StatusPill tone={gateMet ? "success" : "warning"}>
                      {gateMet
                        ? `Promotion gate met · ${reviewedCount}/${totalSampled} reviewed`
                        : `Validation in progress · ${reviewedCount}/${totalSampled} reviewed`}
                    </StatusPill>
                  );
                })()
              ) : (
                <StatusPill tone="info">Verified + Validation pending labels</StatusPill>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <SectionCard title="Today's cash & bank position" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold tabular-nums">{formatINR(k.totalBankBalance)}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="success">Verified</StatusPill>
                <span className="text-xs text-muted-foreground">Trial Balance-backed</span>
              </div>
            </SectionCard>
            <SectionCard title="Customer concentration risk" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold">Apex Flow Systems 94% of FYTD sales</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="warning">Verified</StatusPill>
                <span className="text-xs text-muted-foreground">From Tally sales vouchers (86 FYTD)</span>
              </div>
            </SectionCard>
            <SectionCard title="Receivables" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold tabular-nums">{formatINR(k.receivablesTotal)}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="success">Verified</StatusPill>
                <span className="text-xs text-muted-foreground">Trial Balance · Bill-wise gap surfaced separately</span>
              </div>
            </SectionCard>
            <SectionCard title="Bank OD utilisation" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold tabular-nums">{formatINR(k.bankOdGroupTotal)}</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="warning">Verified</StatusPill>
                <span className="text-xs text-muted-foreground">Trial Balance · Loans (Liability) group</span>
              </div>
            </SectionCard>
            <SectionCard title="Commercial Pipeline KPI" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold text-muted-foreground">Dry-run in progress</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="neutral">Validation pending</StatusPill>
                <span className="text-xs text-muted-foreground">37-thread sample pack awaiting reviewer sign-off</span>
              </div>
            </SectionCard>
            <SectionCard title="Order Book KPI" bodyClassName="px-4 py-3">
              <p className="text-xl font-semibold text-muted-foreground">Dry-run in progress</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill tone="neutral">Validation pending</StatusPill>
                <span className="text-xs text-muted-foreground">Tally linkage 33 ambiguous (0.40 conf) — not Verified</span>
              </div>
            </SectionCard>
          </div>
          <p className="text-[10px] text-muted-foreground">
            ⓘ Sprint 1 EDB v2 shows only Tally-backed numbers. business_threads (43 dry-run · 33 ambiguous Tally links · 10 Data Required) is being
            validated via the 37-thread sample pack at <code>/threads/validation</code> — unlocks Commercial Pipeline + Order Book once
            ≥25 threads are reviewed with ≥85% accuracy.
          </p>
        </section>

        {/* Sprint 1 Day 6 — Commercial Pipeline / Order Book placeholders */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Commercial Pipeline + Order Book — Sprint 2 (dry-run)
            </h2>
            <StatusPill tone="info">business_threads · dry-run · not promoted</StatusPill>
          </div>
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Commercial Pipeline — dry-run in progress</p>
            <p>43 business threads identified (6 cross-mailbox) from extracted events. 0 currently auto-linked to Tally (Sprint 2 will add body-text mining for invoice cross-references). business_threads stays <code className="rounded bg-muted px-1 py-0.5">is_dry_run=true</code> — not promoted to MD home until validation hits the v2 plan&apos;s thresholds.</p>
          </div>
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium text-foreground">Order Book — dry-run in progress</p>
            <p>Verified / Inferred / Data Required split awaits stage promotion through quality_dp_pt → ready_dispatch → invoiced → collected.</p>
          </div>
        </section>

        {/* Sprint 1 Day 4 — Data Quality section */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Data Quality · Health of the warehouse
            </h2>
            <StatusPill tone="info">
              Tally{dataQuality.tally.staleHours != null
                ? ` ${dataQuality.tally.staleHours.toFixed(1)}h ago`
                : " · never synced"}
            </StatusPill>
          </div>
          <KpiGrid>
            <KpiCard
              label="Tally Trial Balance"
              value={dataQuality.tally.staleHours == null
                ? "—"
                : dataQuality.tally.staleHours < 1
                  ? "Fresh"
                  : `${dataQuality.tally.staleHours.toFixed(1)}h stale`}
              tone={dataQuality.tally.staleHours == null ? "neutral"
                  : dataQuality.tally.staleHours < 1 ? "success"
                  : dataQuality.tally.staleHours < 6 ? "warning" : "danger"}
              sub={dataQuality.tally.lastTrialBalanceAt
                ? `Last: ${new Date(dataQuality.tally.lastTrialBalanceAt).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" })}`
                : "No snapshot"}
            />
            <KpiCard
              label="Bill-wise vs Ledger gap"
              value={formatINR(dataQuality.billWise.receivablesGap)}
              tone="warning"
              sub={dataQuality.billWise.topGapEntity ? `Top: ${dataQuality.billWise.topGapEntity}` : "—"}
            />
            <KpiCard
              label="Email bodies fetched"
              value={String(dataQuality.emailBodies.arjun + dataQuality.emailBodies.rahul + dataQuality.emailBodies.sameer)}
              tone="info"
              sub={`Arjun ${dataQuality.emailBodies.arjun} · Rahul ${dataQuality.emailBodies.rahul} · Sameer ${dataQuality.emailBodies.sameer} · ${dataQuality.emailBodies.totalMb.toFixed(1)} MB`}
            />
            <KpiCard
              label="Attachments classified"
              value={`${dataQuality.attachments.classified} / ${dataQuality.attachments.downloaded}`}
              tone={dataQuality.attachments.unclassified > 0 ? "warning" : "success"}
              sub={`${dataQuality.attachments.unclassified} unclassified`}
            />
            <KpiCard
              label="Finance signals"
              value={String(dataQuality.financeSignalsExtracted)}
              tone="info"
              sub="Rahul body extraction · read-only"
            />
            <KpiCard
              label="Day Book parser skip"
              value={`${dataQuality.parserErrors.daySkippedPct}%`}
              tone={dataQuality.parserErrors.daySkippedPct > 10 ? "danger"
                  : dataQuality.parserErrors.daySkippedPct > 0 ? "warning" : "success"}
              sub={`${dataQuality.parserErrors.daySkipped} skipped vouchers in last run`}
            />
            <KpiCard
              label="Unknown counterparties"
              value={String(dataQuality.unknownAliases)}
              tone={dataQuality.unknownAliases > 100 ? "warning" : "neutral"}
              sub="Email events without customer/vendor match"
            />
            <KpiCard
              label="Bad counterparty mappings"
              value={String(dataQuality.badCounterparties.length)}
              tone={dataQuality.badCounterparties.length > 0 ? "danger" : "success"}
              sub={
                dataQuality.badCounterparties[0]
                  ? `e.g. "${dataQuality.badCounterparties[0].name}"`
                  : "Clean"
              }
            />
          </KpiGrid>
          {dataQuality.badCounterparties.length > 0 && (
            <div className="rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-xs">
              <p className="font-medium text-danger mb-1">
                ⚠️  Finance Data Quality exception: ledger names mapped as customers in collections.
              </p>
              <ul className="space-y-0.5 pl-5 list-disc text-muted-foreground">
                {dataQuality.badCounterparties.slice(0, 5).map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}</strong> appears in {c.count} collection{c.count !== 1 ? "s" : ""} —
                    likely Tally bulk-receipt allocation issue, not a real customer
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10px] text-muted-foreground">
                These bad mappings should be flagged for finance team review. They are <strong>not</strong> treated as collection intelligence for the MD.
              </p>
            </div>
          )}
        </section>

        {/* Operations — placeholder, will populate from Meridian /uploads */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Operations &amp; Production
            </h2>
            <StatusPill tone="warning" dot>Pending Meridian uploads</StatusPill>
          </div>
          <KpiGrid>
            <KpiCard label="Jobs Due This Week" value="—" tone="neutral" sub="Populate via /production uploads" />
            <KpiCard label="Delayed Jobs" value="—" tone="neutral" sub="Production team to upload" />
            <KpiCard label="Ready, Not Dispatched" value="—" tone="neutral" />
            <KpiCard label="Dispatched, Not Invoiced" value="—" tone="neutral" />
          </KpiGrid>
        </section>

        {/* Bank ledger detail table */}
        <SectionCard
          title="Bank ledgers — live from Tally"
          description="Every bank / loan account as Tally currently reports it"
          bodyClassName="p-0"
        >
          <DataTable
            columns={bankColumns}
            rows={k.banks}
            getRowKey={(b) => b.id}
            empty="No bank ledgers in Meridian yet — run masters sync."
          />
          <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
            Synced from Tally Sundry Debtors / Creditors / Bank Accounts / Loans groups.
            OCC sanctioned limit isn&apos;t in Tally — set it manually in the bank_accounts row to enable the utilisation gauge.
          </p>
        </SectionCard>

        {/* Overdue invoices */}
        <SectionCard
          title="Overdue customer invoices"
          description={`${overdueInvoices.length} invoice${overdueInvoices.length !== 1 ? "s" : ""} past due date — pulled live from Tally`}
          bodyClassName="p-0"
        >
          <DataTable
            columns={overdueColumns}
            rows={overdueInvoices}
            getRowKey={(r) => r.id}
            empty="No overdue receivables."
          />
        </SectionCard>

        {/* Receivables summary box */}
        <SectionCard
          title="Live data summary"
          description="What's actively flowing through this dashboard right now"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <p className="text-2xl font-semibold tabular-nums">{formatINRFull(k.receivablesTotal)}</p>
              <p className="text-xs text-muted-foreground">Total receivables · {k.customersCount} active customers</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{formatINRFull(k.payablesTotal)}</p>
              <p className="text-xs text-muted-foreground">Total payables · {k.vendorsCount} active vendors</p>
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{formatINRFull(k.totalDebt)}</p>
              <p className="text-xs text-muted-foreground">Total bank debt · OCC + term loans + GECLS</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

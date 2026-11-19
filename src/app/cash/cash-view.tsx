"use client";

import { Banknote, Clock, Gauge, Landmark, Wallet } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { TallyFreshness } from "@/components/kit/tally-freshness";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Progress } from "@/components/ui/progress";
import type { LiveBank, MdSnapshot } from "@/data/live";
import { formatINR, formatINRFull, formatPercent } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

interface Props {
  snapshot: MdSnapshot;
}

export function CashView({ snapshot: k }: Props) {
  const occTone: StatusTone =
    k.occUtilisation == null
      ? "neutral"
      : k.occUtilisation > 90
        ? "danger"
        : k.occUtilisation > 75
          ? "warning"
          : "success";

  const liquidPosition = k.cashInHand + k.bankAccountsNet;
  const liquidTone: StatusTone = liquidPosition < 0 ? "danger" : liquidPosition < 1_000_000 ? "warning" : "success";

  const bankColumns: Column<LiveBank>[] = [
    {
      key: "bankName",
      header: "Bank / Loan ledger",
      render: (b) => <span className="font-medium">{b.bankName}</span>,
    },
    {
      key: "type",
      header: "Type",
      render: (b) => <span className="text-xs uppercase text-muted-foreground">{b.accountType}</span>,
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      render: (b) => (
        <span className="tabular-nums font-semibold">{formatINR(b.currentBalance, "full")}</span>
      ),
    },
    {
      key: "limit",
      header: "Sanctioned Limit",
      align: "right",
      render: (b) => (
        <span className="tabular-nums text-muted-foreground">
          {b.limitAmount > 0 ? formatINR(b.limitAmount, "full") : "—"}
        </span>
      ),
    },
    {
      key: "util",
      header: "Utilisation",
      align: "right",
      render: (b) => {
        if (b.accountType !== "occ" || b.limitAmount === 0) return <span className="text-muted-foreground">—</span>;
        const pct = (b.currentBalance / b.limitAmount) * 100;
        const tone: StatusTone = pct > 90 ? "danger" : pct > 75 ? "warning" : "success";
        return <StatusPill tone={tone}>{formatPercent(pct)}</StatusPill>;
      },
    },
  ];

  return (
    <PageGuard module="cash">
      <div className="space-y-5">
        <PageHeader
          title="Cash Control"
          description="Cash, debt & receivables from Tally Trial Balance"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TallyFreshness streams="Trial Balance / Ledger" />
              {k.occUtilisation != null && k.occUtilisation > 85 && (
                <StatusPill tone="danger">OCC at {formatPercent(k.occUtilisation)}</StatusPill>
              )}
            </div>
          }
        />

        {/* ── Today's cash position ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Today&apos;s Cash Position · from Tally Trial Balance
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Cash-in-Hand"
              value={formatINR(k.cashInHand)}
              tone="info"
              icon={<Wallet className="size-4" />}
              sub="Physical cash held"
            />
            <KpiCard
              label="Bank Accounts (net)"
              value={formatINR(k.bankAccountsNet)}
              tone={k.bankAccountsNet < 0 ? "danger" : "info"}
              icon={<Banknote className="size-4" />}
              sub={k.bankAccountsNet < 0 ? "OVERDRAWN" : "Current accounts DR − CR"}
            />
            <KpiCard
              label="Total Liquid Position"
              value={formatINR(liquidPosition)}
              tone={liquidTone}
              icon={<Wallet className="size-4" />}
              sub="Cash + bank current (overdraft pulls this negative)"
            />
            <KpiCard
              label="OCC Drawing Power"
              value={k.occDrawingPower > 0 ? formatINR(k.occDrawingPower) : "—"}
              tone={k.occDrawingPower === 0 ? "danger" : k.occDrawingPower < 500_000 ? "warning" : "success"}
              icon={<Landmark className="size-4" />}
              sub="Headroom on the OCC line"
            />
          </div>
        </section>

        {/* ── Debt position ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Debt &amp; Borrowing
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="OCC Drawn"
              value={formatINR(k.occDrawn)}
              tone="warning"
              icon={<Landmark className="size-4" />}
              sub={k.occLimit > 0 ? `of ₹${(k.occLimit / 100000).toFixed(1)}L sanctioned` : "Set limit in /settings/bank-config"}
            />
            <KpiCard
              label="OCC Utilisation"
              tone={occTone}
              icon={<Gauge className="size-4" />}
              value={k.occUtilisation == null ? "—" : formatPercent(k.occUtilisation)}
              sub={k.occUtilisation == null ? "Set OCC limit to compute" : <Progress value={k.occUtilisation} className="mt-1 h-1.5" />}
            />
            <KpiCard
              label="Term Loans"
              value={formatINR(k.termLoansOutstanding)}
              tone="warning"
              sub="Principal outstanding"
            />
            <KpiCard
              label="GECLS Loans"
              value={formatINR(k.geclsOutstanding)}
              tone="neutral"
              sub="Emergency credit balance"
            />
          </div>
        </section>

        {/* ── Receivables & Payables ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Receivables &amp; Payables · Tally Sundry Debtors / Creditors
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Total Receivables"
              value={formatINR(k.receivablesTotal)}
              tone="info"
              sub={`from ${k.customersCount} active customers`}
            />
            <KpiCard
              label="Total Payables"
              value={formatINR(k.payablesTotal)}
              tone="warning"
              sub={`owed to ${k.vendorsCount} active vendors`}
            />
            <KpiCard
              label="Net Position"
              value={formatINR(k.receivablesTotal - k.payablesTotal)}
              tone={k.receivablesTotal - k.payablesTotal >= 0 ? "success" : "danger"}
              sub="Receivables − Payables"
            />
            <KpiCard
              label="Sales YTD"
              value={formatINR(k.salesYTD)}
              tone="success"
              sub="Current FY topline"
            />
          </div>
        </section>

        {/* ── Bank ledger detail table ── */}
        <SectionCard
          title="Bank ledgers — every account / loan from Tally"
          description="Closing balance on each, with sanctioned limit (set via /settings/bank-config)"
          bodyClassName="p-0"
        >
          <DataTable
            columns={bankColumns}
            rows={k.banks}
            getRowKey={(b) => b.id}
            empty="No bank ledgers yet — run masters sync."
          />
        </SectionCard>

        {/* ── Coming Soon: cash forecast ── */}
        <SectionCard
          title="Cash Forecast (7-day)"
          description="Pending — needs Bills Receivable + EMI schedule + Must-Pay vendor queue"
          action={<StatusPill tone="warning" dot>Pending</StatusPill>}
        >
          <div className="space-y-2 px-1 py-2 text-sm text-muted-foreground">
            <p>To enable the 7-day cash forecast we need:</p>
            <ul className="ml-4 list-disc space-y-1 text-xs">
              <li><span className="font-medium">Inflows:</span> aged receivables from Tally <code className="rounded bg-muted px-1 py-0.5">Bills Receivable</code> report (promised dates per invoice). Wiring this next.</li>
              <li><span className="font-medium">Outflows:</span> EMI amounts + due days (you enter at <code className="rounded bg-muted px-1 py-0.5">/settings/bank-config</code>) + payroll cycle + critical vendor payments (P1/P2) from Tally <code className="rounded bg-muted px-1 py-0.5">Bills Payable</code>.</li>
              <li><span className="font-medium">Then:</span> forecast = current cash + expected inflows − must-pay outflows by day. Runway days = first day forecast goes negative.</li>
            </ul>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

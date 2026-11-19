"use client";

import {
  AlertTriangle,
  Banknote,
  CreditCard,
  Info,
  Landmark,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { TallyFreshness } from "@/components/kit/tally-freshness";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Progress } from "@/components/ui/progress";
import type { LiveBank, LoanCharges } from "@/data/live";
import { formatINR, formatINRFull, formatPercent } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

function utilisationPct(b: LiveBank): number | null {
  if (b.limitAmount === 0) return null;
  return (b.currentBalance / b.limitAmount) * 100;
}

function accountTone(b: LiveBank): StatusTone {
  if (b.accountType === "current") return "info";
  const util = utilisationPct(b);
  if (b.accountType === "occ") {
    if (b.drawingPower === 0) return "danger";
    if (util !== null && util > 90) return "danger";
    if (util !== null && util > 75) return "warning";
    return "success";
  }
  return "neutral";
}

function accountTypeLabel(type: LiveBank["accountType"]): string {
  switch (type) {
    case "current": return "Current Account";
    case "occ": return "OCC / Cash Credit";
    case "term-loan": return "Term Loan";
    case "gecls": return "GECLS";
  }
}

interface Props {
  banks: LiveBank[];
  charges: LoanCharges;
}

export function BankDebtView({ banks, charges }: Props) {
  const totalCurrentBalance = banks
    .filter((b) => b.accountType === "current")
    .reduce((s, b) => s + Math.max(0, b.currentBalance), 0);
  const totalDebtOutstanding = banks
    .filter((b) => b.accountType === "occ" || b.accountType === "term-loan" || b.accountType === "gecls")
    .reduce((s, b) => s + b.currentBalance, 0);

  return (
    <PageGuard module="bank-debt">
      <div className="space-y-5">
        <PageHeader
          title="Bank & Debt"
          description="Meridian Alloys Pvt Ltd · bank balances (from statements) · finance charges (Tally ledgers)"
          actions={<TallyFreshness streams="Trial Balance / Ledger" />}
        />

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Summary</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Total Bank Balance" value={formatINR(totalCurrentBalance)} tone="info" icon={<Wallet className="size-4" />} sub="Current account(s) + cash-in-hand" />
            <KpiCard label="Total Debt Outstanding" value={formatINR(totalDebtOutstanding)} tone="warning" icon={<Landmark className="size-4" />} sub="OCC drawn + term loans + GECLS" />
            <KpiCard label="Loan Interest (FYTD)" value={formatINR(charges.interestFytd)} tone="neutral" icon={<Banknote className="size-4" />} sub="charged in Tally · FY-to-date" />
            <KpiCard label="Penal Charges (FYTD)" value={formatINR(charges.penalFytd)} tone={charges.penalFytd > 0 ? "warning" : "neutral"} icon={<TrendingDown className="size-4" />} sub="penal interest · from Tally" />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bank Accounts — live</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {banks.map((b) => {
              const util = utilisationPct(b);
              const tone = accountTone(b);
              return (
                <SectionCard key={b.id} title={b.bankName} description={accountTypeLabel(b.accountType)}>
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-muted-foreground">Balance</dt>
                      <dd className="font-semibold tabular-nums">{formatINR(b.currentBalance, "full")}</dd>
                    </div>
                    {b.limitAmount > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Sanctioned Limit</dt>
                        <dd className="tabular-nums">{formatINR(b.limitAmount, "full")}</dd>
                      </div>
                    )}
                    {b.accountType === "occ" && b.drawingPower > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Drawing Power</dt>
                        <dd className="tabular-nums">{formatINR(b.drawingPower, "full")}</dd>
                      </div>
                    )}
                    {b.interestRate > 0 && (
                      <div className="flex items-center justify-between">
                        <dt className="text-muted-foreground">Interest Rate</dt>
                        <dd className="tabular-nums">{b.interestRate}% p.a.</dd>
                      </div>
                    )}
                    {util !== null && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <dt className="text-muted-foreground">Utilisation</dt>
                          <dd><StatusPill tone={tone}>{formatPercent(util)}</StatusPill></dd>
                        </div>
                        <Progress value={util} className="h-1.5" />
                      </div>
                    )}
                  </dl>
                </SectionCard>
              );
            })}
          </div>
        </section>

        <SectionCard
          title="Finance Charges — FY-to-date (from Tally)"
          description="Interest & penal charges booked on loan accounts. Tally holds no forward EMI schedule; these are charges incurred."
          bodyClassName="p-0"
        >
          {charges.lines.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No interest or penal charges booked in Tally this FY.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Ledger</th>
                  <th className="px-4 py-2 text-left font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Amount (FYTD)</th>
                </tr>
              </thead>
              <tbody>
                {charges.lines.map((l) => (
                  <tr key={l.name} className="border-t">
                    <td className="px-4 py-1.5">{l.name}</td>
                    <td className="px-4 py-1.5">
                      <StatusPill tone={l.kind === "penal" ? "danger" : l.kind === "interest" ? "warning" : "neutral"}>
                        {l.kind}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatINRFull(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard
          title="Related-Party Movements"
          description="Promoter / director funding transactions"
          action={<div className="flex items-center gap-1.5 text-xs text-chart-1"><Info className="size-3.5" /><span>Pending Tally bank transactions sync</span></div>}
          bodyClassName="p-0"
        >
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <p>Bank transactions sync pending.</p>
            <p className="mt-1 text-xs">Need to add Daybook bank-voucher pull (Contra + Payment + Receipt) to populate this section.</p>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

// Unused imports to suppress lint on AlertTriangle/CreditCard kept for future debt-schedule wiring
void AlertTriangle;
void CreditCard;

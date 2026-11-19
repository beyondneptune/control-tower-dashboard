"use client";

import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  PackageCheck,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import type { JobProfitData, JobProfitRow, MarginBand, CostBasis } from "@/data/ct-profitability";
import { formatINR, formatNumberIN, formatPercent, formatDate } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

const BAND_META: Record<MarginBand, { tone: StatusTone; label: string }> = {
  ok: { tone: "success", label: "Healthy ≥15%" },
  thin: { tone: "warning", label: "Thin <15%" },
  loss: { tone: "danger", label: "Below cost" },
  anomaly_verify: { tone: "danger", label: "Verify (implausible)" },
  data_required: { tone: "neutral", label: "Data required" },
};

const BASIS_LABEL: Record<CostBasis, string> = {
  bom_confirmed: "BOM",
  bom_size_matched: "BOM · size-matched",
  bom_ambiguous: "BOM ambiguous",
  no_bom: "No BOM yet",
};

function jobCode(r: JobProfitRow) {
  return `${r.poNo}-${r.lineNo}`;
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

function MarginPctPill({ row }: { row: JobProfitRow }) {
  if (row.marginBand === "data_required") return <StatusPill tone="neutral">Data required</StatusPill>;
  return (
    <StatusPill tone={BAND_META[row.marginBand].tone}>
      {formatPercent(row.stdMarginPct)}
    </StatusPill>
  );
}

export function JobProfitabilityView({ data }: { data: JobProfitData }) {
  const { rows, summary, bands, generatedAt } = data;

  // Actionable subset, worst first: below-cost, anomalies, thin.
  const attention = rows
    .filter((r) => r.marginBand === "loss" || r.marginBand === "anomaly_verify" || r.marginBand === "thin")
    .sort((a, b) => (a.stdMarginPct ?? 0) - (b.stdMarginPct ?? 0));

  const mainColumns: Column<JobProfitRow>[] = [
    { key: "job", header: "Job", render: (r) => <span className="font-medium tabular-nums">{jobCode(r)}</span> },
    { key: "customer", header: "Customer", render: (r) => <span className="truncate">{r.customer ?? "—"}</span> },
    { key: "drawing", header: "Drawing", render: (r) => <span className="tabular-nums">{r.drawingNo ?? "—"}</span> },
    { key: "qty", header: "Qty", align: "right", render: (r) => formatNumberIN(r.qty) },
    { key: "revenue", header: "Revenue (excl GST)", align: "right", render: (r) => formatINR(r.revenue, "full") },
    {
      key: "cost",
      header: "Std cost (BOM)",
      align: "right",
      render: (r) =>
        r.stdCostTotal === null ? (
          <span className="italic text-muted-foreground">Data required</span>
        ) : (
          formatINR(r.stdCostTotal, "full")
        ),
    },
    {
      key: "marginVal",
      header: "Std margin ₹",
      align: "right",
      render: (r) => {
        if (r.stdMarginValue === null) return <span className="text-muted-foreground">—</span>;
        const neg = r.stdMarginValue < 0;
        return <span className={neg ? "font-medium text-danger" : "font-medium"}>{formatINR(r.stdMarginValue, "full")}</span>;
      },
    },
    { key: "marginPct", header: "Std margin %", align: "right", render: (r) => <MarginPctPill row={r} /> },
    {
      key: "status",
      header: "Status",
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{BAND_META[r.marginBand].label}</span>
          {r.dispatched && <StatusPill tone="info">shipped</StatusPill>}
        </span>
      ),
    },
    { key: "basis", header: "Cost basis", render: (r) => <span className="text-xs text-muted-foreground">{BASIS_LABEL[r.costBasis]}</span> },
  ];

  return (
    <PageGuard module="job-profitability">
      <div className="space-y-5">
        <PageHeader
          title="Job Profitability"
          description={`Standard margin · quoted PO price vs BOM standard cost · Meridian Alloys Pvt Ltd · live as of ${formatDate(generatedAt)}`}
          actions={
            <div className="flex items-center gap-2">
              {summary.realisedLossCount > 0 && (
                <StatusPill tone="danger">{summary.realisedLossCount} shipped at a loss</StatusPill>
              )}
              {summary.anomalyCount > 0 && (
                <StatusPill tone="danger">{summary.anomalyCount} to verify</StatusPill>
              )}
              {summary.dataRequiredCount > 0 && (
                <StatusPill tone="neutral">{summary.dataRequiredCount} awaiting BOM</StatusPill>
              )}
            </div>
          }
        />

        {/* KPI strip — truthful headline */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Portfolio summary</h2>
          <KpiGrid>
            <KpiCard
              label="Order-book value (excl GST)"
              value={formatINR(summary.totalOrderRevenue, "full")}
              tone="info"
              icon={<PackageCheck className="size-4" />}
              sub={`${formatNumberIN(summary.totalLines)} PO-line work packages · taxable base`}
            />
            <KpiCard
              label="Std margin (costed)"
              // Revenue-weighted portfolio margin = total margin ÷ total revenue
              // (the true ₹ economics, not a naive average of per-line percentages).
              value={formatPercent(
                summary.reliableRevenue > 0 ? (summary.reliableMargin / summary.reliableRevenue) * 100 : null,
              )}
              tone={
                summary.reliableRevenue <= 0
                  ? "neutral"
                  : summary.reliableMargin / summary.reliableRevenue < 0.1
                  ? "danger"
                  : summary.reliableMargin / summary.reliableRevenue < 0.2
                  ? "warning"
                  : "success"
              }
              icon={<TrendingUp className="size-4" />}
              sub={`${summary.reliableCount} jobs · ${formatINR(summary.reliableMargin, "full")} on ${formatINR(summary.reliableRevenue, "full")}`}
            />
            <KpiCard
              label="Margin alerts"
              value={formatNumberIN(summary.lossCount + summary.anomalyCount)}
              tone={summary.lossCount + summary.anomalyCount > 0 ? "danger" : "success"}
              icon={<TrendingDown className="size-4" />}
              sub={`${summary.lossCount} below cost · ${summary.anomalyCount} to verify`}
            />
            <KpiCard
              label="Awaiting BOM cost"
              value={formatNumberIN(summary.dataRequiredCount)}
              tone={summary.dataRequiredCount > 0 ? "warning" : "success"}
              icon={<HelpCircle className="size-4" />}
              sub={`${formatINR(summary.dataRequiredRevenue, "full")} order value · no costing yet`}
            />
          </KpiGrid>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Band distribution */}
          <SectionCard title="Margin band distribution" description="Every PO-line work package, by standard-margin band">
            <ul className="space-y-2">
              {bands.map((b) => (
                <li key={b.band} className="flex items-center justify-between gap-2.5">
                  <span className="flex items-center gap-2.5">
                    <StatusPill tone={BAND_META[b.band].tone}>{formatNumberIN(b.count)}</StatusPill>
                    <span className="text-xs text-muted-foreground">{BAND_META[b.band].label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Truthfulness / method note */}
          <SectionCard title="How this is computed" description="For Finance and Auditor reference">
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                <p>
                  Margin = <strong className="text-foreground">quoted PO price − BOM standard cost</strong> (powder + gas +
                  process + machine). This is a <strong className="text-foreground">standard</strong> margin, not actual —
                  there is no shop-floor cost capture yet, so labour/rework actuals are not claimed.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  {summary.dataRequiredCount} jobs have <strong className="text-foreground">no BOM</strong> for the drawing —
                  shown as <strong className="text-foreground">Data required</strong>, never assumed zero-cost. A wrong
                  number is worse than a blank.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-danger" />
                <p>
                  {summary.anomalyCount} jobs show an <strong className="text-foreground">implausible margin</strong> (worse
                  than −40%) and are flagged <strong className="text-foreground">Verify</strong> — the figure is real but
                  almost certainly a rate or scope error, so it is not asserted as a loss until checked.
                </p>
              </div>
            </div>
          </SectionCard>
        </section>

        {/* Needs attention — actionable, worst first */}
        {attention.length > 0 && (
          <SectionCard
            title="Needs attention — below-cost, verify, and thin jobs"
            description="Worst standard margin first · these are the only jobs a human needs to look at"
            bodyClassName="p-0"
          >
            <DataTable
              columns={[
                { key: "job", header: "Job", render: (r) => <span className="font-medium tabular-nums">{jobCode(r)}</span> },
                { key: "customer", header: "Customer", render: (r) => r.customer ?? "—" },
                { key: "drawing", header: "Drawing", render: (r) => <span className="tabular-nums">{r.drawingNo ?? "—"}</span> },
                { key: "revenue", header: "Revenue", align: "right", render: (r) => formatINR(r.revenue, "full") },
                {
                  key: "cost",
                  header: "Std cost",
                  align: "right",
                  render: (r) => (r.stdCostTotal === null ? "—" : formatINR(r.stdCostTotal, "full")),
                },
                {
                  key: "marginVal",
                  header: "Std margin ₹",
                  align: "right",
                  render: (r) => (
                    <span className={r.stdMarginValue !== null && r.stdMarginValue < 0 ? "font-semibold text-danger" : "font-medium"}>
                      {formatINR(r.stdMarginValue, "full")}
                    </span>
                  ),
                },
                { key: "marginPct", header: "Std margin %", align: "right", render: (r) => <MarginPctPill row={r} /> },
                {
                  key: "flag",
                  header: "Flag",
                  render: (r) => (
                    <span className="flex items-center gap-1.5">
                      <StatusPill tone={BAND_META[r.marginBand].tone}>{BAND_META[r.marginBand].label}</StatusPill>
                      {r.dispatched && <StatusPill tone="info">shipped</StatusPill>}
                    </span>
                  ),
                },
              ] satisfies Column<JobProfitRow>[]}
              rows={attention}
              getRowKey={(r) => jobCode(r)}
              empty="No below-cost, verify, or thin jobs."
            />
          </SectionCard>
        )}

        {/* Full table */}
        <SectionCard
          title="Job-level profitability"
          description={`All ${formatNumberIN(rows.length)} PO-line work packages · revenue excl GST · standard (BOM) cost basis`}
          bodyClassName="p-0"
        >
          <DataTable columns={mainColumns} rows={rows} getRowKey={(r) => jobCode(r)} empty="No jobs found." />
        </SectionCard>
      </div>
    </PageGuard>
  );
}

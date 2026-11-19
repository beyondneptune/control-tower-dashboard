"use client";

import {
  AlertCircle,
  CalendarClock,
  HandCoins,
  IndianRupee,
  ReceiptText,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { TallyFreshness } from "@/components/kit/tally-freshness";
import { DataTable, type Column } from "@/components/kit/data-table";
import { AgeingBarChart } from "@/components/charts";
import type { LiveInvoiceRow } from "@/data/live";
import type { AgeingRow, AgeingSummary } from "@/domain/calc";
import { formatDate, formatINR, formatINRFull, formatNumberIN } from "@/lib/format";
import { severityTone, type StatusTone } from "@/lib/status";

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

function bucketTone(bucket: string): StatusTone {
  if (bucket === ">90") return "danger";
  if (bucket === "61-90") return "danger";
  if (bucket === "31-60") return "warning";
  if (bucket === "0-30") return "warning";
  return "neutral";
}

interface CustomerRollup {
  customerId: string;
  customerName: string;
  outstanding: number;
  oldestOverdueDays: number;
  invoiceCount: number;
}

function buildCustomerRollup(rows: LiveInvoiceRow[]): CustomerRollup[] {
  const map = new Map<string, CustomerRollup>();
  for (const r of rows) {
    if (r.outstanding <= 0) continue;
    const existing = map.get(r.customerId);
    if (!existing) {
      map.set(r.customerId, {
        customerId: r.customerId,
        customerName: r.customerName,
        outstanding: r.outstanding,
        oldestOverdueDays: r.daysOverdue > 0 ? r.daysOverdue : 0,
        invoiceCount: 1,
      });
    } else {
      existing.outstanding += r.outstanding;
      if (r.daysOverdue > existing.oldestOverdueDays) {
        existing.oldestOverdueDays = r.daysOverdue;
      }
      existing.invoiceCount += 1;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
}

interface Props {
  invoices: LiveInvoiceRow[];
  ageing: AgeingSummary;
  ageingChart: { bucket: string; amount: number }[];
}

export function CollectionsView({ invoices, ageing, ageingChart }: Props) {
  const overdueInvoices = invoices
    .filter((r) => r.outstanding > 0 && r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  const overdueCount = overdueInvoices.length;
  const customerRollup = buildCustomerRollup(invoices);
  const ageingRows = ageing.rows.slice().sort((a, b) => b.daysOverdue - a.daysOverdue);

  const totalOutstandingTone: StatusTone = ageing.totalOutstanding > 1_000_000 ? "warning" : "neutral";
  const overdueTotalTone: StatusTone = ageing.overdueTotal > 500_000 ? "danger" : ageing.overdueTotal > 0 ? "warning" : "success";
  const gt90Tone: StatusTone = ageing.buckets[">90"] > 0 ? "danger" : "success";
  const overdueCountTone: StatusTone = overdueCount > 2 ? "danger" : overdueCount > 0 ? "warning" : "success";

  const ageingColumns: Column<AgeingRow>[] = [
    { key: "label", header: "Invoice · Customer", render: (r) => <span className="font-medium">{r.label}</span> },
    { key: "dueDate", header: "Due Date", render: (r) => <span className="text-muted-foreground">{formatDate(r.dueDate)}</span> },
    {
      key: "daysOverdue",
      header: "Days Overdue",
      align: "right",
      render: (r) =>
        r.daysOverdue > 0 ? <StatusPill tone={severityTone[r.severity]}>{r.daysOverdue}d</StatusPill> : <StatusPill tone="success">Not due</StatusPill>,
    },
    {
      key: "bucket",
      header: "Bucket",
      render: (r) => (
        <StatusPill tone={r.bucket === "not-due" ? "success" : bucketTone(r.bucket)}>{r.bucket}</StatusPill>
      ),
    },
    { key: "outstanding", header: "Outstanding", align: "right", render: (r) => <span className="font-semibold tabular-nums">{formatINR(r.outstanding, "full")}</span> },
  ];

  const customerColumns: Column<CustomerRollup>[] = [
    { key: "customerName", header: "Customer", render: (r) => <span className="font-medium">{r.customerName}</span> },
    { key: "invoiceCount", header: "Invoices", align: "right", render: (r) => <span className="tabular-nums">{formatNumberIN(r.invoiceCount)}</span> },
    { key: "outstanding", header: "Outstanding", align: "right", render: (r) => <span className="font-semibold tabular-nums">{formatINRFull(r.outstanding)}</span> },
    {
      key: "oldestOverdueDays",
      header: "Oldest Overdue",
      align: "right",
      render: (r) =>
        r.oldestOverdueDays > 0 ? (
          <StatusPill tone={r.oldestOverdueDays > 30 ? "danger" : "warning"}>{r.oldestOverdueDays}d</StatusPill>
        ) : (
          <StatusPill tone="success">None</StatusPill>
        ),
    },
  ];

  const followUpColumns: Column<LiveInvoiceRow>[] = [
    { key: "invoiceNo", header: "Invoice", render: (r) => <span className="font-medium">{r.invoiceNo}</span> },
    { key: "customer", header: "Customer", render: (r) => r.customerName },
    { key: "dueDate", header: "Due Date", render: (r) => <span className="text-muted-foreground">{formatDate(r.dueDate)}</span> },
    { key: "daysOverdue", header: "Overdue", align: "right", render: (r) => <StatusPill tone={r.daysOverdue > 30 ? "danger" : "warning"}>{r.daysOverdue}d</StatusPill> },
    { key: "outstanding", header: "Outstanding", align: "right", render: (r) => <span className="font-semibold tabular-nums">{formatINR(r.outstanding, "full")}</span> },
    {
      key: "action",
      header: "Promise Date",
      align: "right",
      render: () => (
        <button
          disabled
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-muted-foreground/40 px-2 py-1 text-xs text-muted-foreground opacity-60 cursor-not-allowed"
          title="Maker-checker — Sprint 3"
        >
          <CalendarClock className="size-3" />
          Add promise date
        </button>
      ),
    },
  ];

  return (
    <PageGuard module="collections">
      <div className="space-y-5">
        <PageHeader
          title="Collections"
          description="Receivables ageing from Tally sales invoices & receipts"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TallyFreshness streams="Sales vouchers" />
              <StatusPill tone={overdueTotalTone}>
                {overdueCount} overdue invoice{overdueCount !== 1 ? "s" : ""}
              </StatusPill>
              {ageing.buckets[">90"] > 0 && (
                <StatusPill tone="danger">&gt;90d: {formatINR(ageing.buckets[">90"])}</StatusPill>
              )}
            </div>
          }
        />

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Receivables snapshot
          </h2>
          <KpiGrid>
            <KpiCard label="Total Outstanding" value={formatINR(ageing.totalOutstanding)} tone={totalOutstandingTone} icon={<IndianRupee className="size-4" />} sub="All invoices with balance pending" />
            <KpiCard label="Overdue Total" value={formatINR(ageing.overdueTotal)} tone={overdueTotalTone} icon={<AlertCircle className="size-4" />} sub="Past due date across all buckets" />
            <KpiCard label="&gt;90 Days" value={formatINR(ageing.buckets[">90"])} tone={gt90Tone} icon={<HandCoins className="size-4" />} sub="Highest-risk overdue bucket" />
            <KpiCard label="Invoices Overdue" value={formatNumberIN(overdueCount)} tone={overdueCountTone} icon={<ReceiptText className="size-4" />} sub="Count of invoices past due date" />
          </KpiGrid>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard title="Receivables ageing" description="Outstanding by overdue bucket (0-30 / 31-60 / 61-90 / >90 days)">
            <AgeingBarChart data={ageingChart} />
          </SectionCard>

          <SectionCard title="Outstanding by customer" description="Grouped — sorted by balance descending" bodyClassName="p-0">
            <DataTable columns={customerColumns} rows={customerRollup} getRowKey={(r) => r.customerId} empty="No outstanding balances." />
          </SectionCard>
        </section>

        <SectionCard title="Ageing detail" description="All invoices with outstanding balance — sorted by days overdue (oldest first)" bodyClassName="p-0">
          <DataTable columns={ageingColumns} rows={ageingRows} getRowKey={(r) => r.id} empty="No outstanding receivables." />
        </SectionCard>

        <SectionCard title="Collection follow-up" description={`${overdueCount} overdue invoice${overdueCount !== 1 ? "s" : ""} requiring follow-up`} bodyClassName="p-0">
          <DataTable columns={followUpColumns} rows={overdueInvoices} getRowKey={(r) => r.id} empty="No overdue invoices. All balances within payment terms." />
        </SectionCard>
      </div>
    </PageGuard>
  );
}

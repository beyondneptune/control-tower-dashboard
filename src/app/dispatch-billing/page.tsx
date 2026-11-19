"use client";

import {
  CalendarCheck,
  FileText,
  Package,
  Truck,
  UploadCloud,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import {
  AS_OF,
  customerName,
  invoiceForJob,
  invoicesWithOutstanding,
  jobsByStage,
  type InvoiceRow,
} from "@/data";
import type { Job, Invoice } from "@/domain/types";
import {
  formatDate,
  formatINR,
  formatNumberIN,
  daysBetween,
} from "@/lib/format";
import type { StatusTone } from "@/lib/status";

// ── Inline derivations ───────────────────────────────────────────────────────

/** Jobs in "Ready Dispatch" or "Dispatched" stage for the dispatch table. */
function dispatchableJobs(): Job[] {
  return [...jobsByStage("Ready Dispatch"), ...jobsByStage("Dispatched")];
}

/**
 * Total outstanding across all invoices that have been issued.
 * Derived inline from invoicesWithOutstanding() — no exported function required.
 */
function totalOutstandingBilled(): number {
  return invoicesWithOutstanding().reduce(
    (sum, r) => sum + Math.max(0, r.outstanding),
    0,
  );
}

/** Tone for a Ready Dispatch job based on days overdue vs required date. */
function readyDispatchTone(job: Job): StatusTone {
  const overdue = daysBetween(job.requiredDispatchDate, AS_OF);
  return overdue > 0 ? "danger" : "warning";
}

// ── Page ─────────────────────────────────────────────────────────────────────

/** Row type for the dispatch & ready table. */
interface DispatchRow extends Job {
  customerNameResolved: string;
  hasInvoice: boolean;
  daysLate: number;
}

function buildDispatchRows(): DispatchRow[] {
  return dispatchableJobs().map((j) => ({
    ...j,
    customerNameResolved: customerName(j.customerId),
    hasInvoice: invoiceForJob(j.id) !== undefined,
    daysLate: daysBetween(j.requiredDispatchDate, AS_OF),
  }));
}

const dispatchColumns: Column<DispatchRow>[] = [
  {
    key: "jobCode",
    header: "Job",
    render: (r) => <span className="font-medium">{r.jobCode}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (r) => (
      <span className="max-w-[160px] truncate block">{r.customerNameResolved}</span>
    ),
  },
  {
    key: "partName",
    header: "Part",
    render: (r) => (
      <span className="max-w-[180px] truncate block text-muted-foreground text-xs">
        {r.partName}
      </span>
    ),
  },
  {
    key: "quotedValue",
    header: "Quoted",
    align: "right",
    render: (r) => formatINR(r.quotedValue),
  },
  {
    key: "requiredDispatchDate",
    header: "Req. Date",
    align: "right",
    render: (r) => (
      <span className={r.daysLate > 0 ? "text-danger font-medium" : ""}>
        {formatDate(r.requiredDispatchDate)}
      </span>
    ),
  },
  {
    key: "stage",
    header: "Stage / Status",
    render: (r) => {
      if (r.stage === "Ready Dispatch") {
        return (
          <StatusPill tone={readyDispatchTone(r)}>
            {r.daysLate > 0 ? `Waiting ${r.daysLate}d overdue` : "Ready — pending dispatch"}
          </StatusPill>
        );
      }
      // Dispatched
      if (!r.hasInvoice) {
        return (
          <StatusPill tone="danger">Not invoiced — dispatched</StatusPill>
        );
      }
      return <StatusPill tone="success">Dispatched &amp; invoiced</StatusPill>;
    },
  },
];

const invoiceColumns: Column<InvoiceRow>[] = [
  {
    key: "invoiceNo",
    header: "Invoice No",
    render: (r) => <span className="font-medium">{r.invoiceNo}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    render: (r) => r.customerNameResolved,
  },
  {
    key: "invoiceDate",
    header: "Invoice Date",
    render: (r) => formatDate(r.invoiceDate),
  },
  {
    key: "taxableValue",
    header: "Taxable",
    align: "right",
    render: (r) => formatINR(r.taxableValue, "full"),
  },
  {
    key: "gstValue",
    header: "GST",
    align: "right",
    render: (r) => formatINR(r.gstValue, "full"),
  },
  {
    key: "invoiceTotal",
    header: "Total",
    align: "right",
    render: (r) => (
      <span className="font-semibold">{formatINR(r.invoiceTotal, "full")}</span>
    ),
  },
  {
    key: "dueDate",
    header: "Due Date",
    render: (r) => (
      <span className={r.daysOverdue > 0 ? "text-danger font-medium" : ""}>
        {formatDate(r.dueDate)}
      </span>
    ),
  },
  {
    key: "submittedToCustomer",
    header: "Submitted",
    render: (r) =>
      r.submittedToCustomer ? (
        <StatusPill tone="success">Yes</StatusPill>
      ) : (
        <StatusPill tone="warning">No</StatusPill>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => {
      const toneMap: Record<Invoice["status"], StatusTone> = {
        paid: "success",
        "part-paid": "warning",
        open: "info",
        cancelled: "neutral",
      };
      const labelMap: Record<Invoice["status"], string> = {
        paid: "Paid",
        "part-paid": "Part-paid",
        open: "Open",
        cancelled: "Cancelled",
      };
      return (
        <StatusPill tone={toneMap[r.status]}>{labelMap[r.status]}</StatusPill>
      );
    },
  },
];

export default function DispatchBillingPage() {
  const readyCount = jobsByStage("Ready Dispatch").length;
  const dispatchedCount = jobsByStage("Dispatched").length;
  const invoicesTotal = invoicesWithOutstanding().length;
  const outstandingBilled = totalOutstandingBilled();
  const dispatchRows = buildDispatchRows();
  const invoiceRows = invoicesWithOutstanding();

  return (
    <PageGuard module="dispatch-billing">
      <div className="space-y-5">
        <PageHeader
          title="Dispatch &amp; Billing"
          description={`Sales · dispatch control and invoice tracker as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              {readyCount > 0 && (
                <StatusPill tone="warning">{readyCount} ready to ship</StatusPill>
              )}
              {dispatchedCount > 0 && (
                <StatusPill tone="danger">{dispatchedCount} dispatched, not invoiced</StatusPill>
              )}
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Ready for Dispatch"
            value={formatNumberIN(readyCount)}
            tone={readyCount > 0 ? "warning" : "success"}
            icon={<Package className="size-4" />}
            sub="Jobs cleared by QC, awaiting shipment"
          />
          <KpiCard
            label="Dispatched, Not Invoiced"
            value={formatNumberIN(dispatchedCount)}
            tone={dispatchedCount > 0 ? "danger" : "success"}
            icon={<Truck className="size-4" />}
            sub="Revenue leakage risk — invoice urgently"
          />
          <KpiCard
            label="Total Invoices Issued"
            value={formatNumberIN(invoicesTotal)}
            tone="info"
            icon={<FileText className="size-4" />}
            sub="All invoices in the system"
          />
          <KpiCard
            label="Outstanding Billed"
            value={formatINR(outstandingBilled)}
            tone={outstandingBilled > 0 ? "warning" : "success"}
            icon={<CalendarCheck className="size-4" />}
            sub={`Total receivable across ${invoicesTotal} invoice(s)`}
          />
        </div>

        {/* Ready / Dispatched table */}
        <SectionCard
          title="Ready for Dispatch &amp; Dispatched Jobs"
          description={`${dispatchRows.length} job(s) in transit pipeline — amber = waiting, red = not invoiced after dispatch`}
          bodyClassName="p-0"
        >
          <DataTable<DispatchRow>
            columns={dispatchColumns}
            rows={dispatchRows}
            getRowKey={(r) => r.id}
            empty="No jobs currently in Ready Dispatch or Dispatched stage."
          />
        </SectionCard>

        {/* Invoices table */}
        <SectionCard
          title="Invoice Register"
          description="All issued invoices with outstanding balance and submission status"
          bodyClassName="p-0"
        >
          <DataTable<InvoiceRow>
            columns={invoiceColumns}
            rows={invoiceRows}
            getRowKey={(r) => r.id}
            empty="No invoices found."
          />
        </SectionCard>

        {/* Dispatch daily upload form — visual / non-functional */}
        <SectionCard
          title="Daily Dispatch Upload"
          description="Record a new dispatch event — Maker-checker enforced in Sprint 2/3"
          action={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <UploadCloud className="size-3.5" />
              <span>Visual-only demo</span>
            </div>
          }
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Customer PO */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Customer PO No.
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                e.g. AFS-PO-9988
              </div>
            </div>

            {/* Job selection */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Job Code
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                Select job…
              </div>
            </div>

            {/* Dispatch date */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dispatch Date
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                {formatDate(AS_OF)}
              </div>
            </div>

            {/* LR / DC No */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                LR / DC No.
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                e.g. LR-2026-0451
              </div>
            </div>

            {/* Transporter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Transporter
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                e.g. GATI Logistics
              </div>
            </div>

            {/* Invoice requested */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Invoice Requested?
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                Yes / No
              </div>
            </div>

            {/* Collection promise date */}
            <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Collection Promise Date
              </label>
              <div className="h-9 rounded-md border bg-muted/40 px-3 flex items-center text-sm text-muted-foreground select-none">
                e.g. 30-Jun-2026
              </div>
            </div>

            {/* Submit button row */}
            <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-3 pt-1">
              <button
                disabled
                className="rounded-md bg-primary/30 px-4 py-2 text-sm font-medium text-primary-foreground/60 cursor-not-allowed select-none"
                aria-disabled="true"
              >
                Record Dispatch
              </button>
              <p className="text-xs text-muted-foreground">
                Maker-checker approval enforced in Sprint 2/3 — form is display-only.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

"use client";

import {
  AlertTriangle,
  Ban,
  Building2,
  ClipboardList,
  PackageSearch,
  ShoppingCart,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { PriorityBarChart } from "@/components/charts";
import {
  AS_OF,
  purchases,
  purchaseRequests,
  vendorPayments,
  vendors,
  vendorName,
  vendorPayables,
  vendorPayablesByPriority,
  getJob,
} from "@/data";
import {
  formatDate,
  formatINR,
  formatNumberIN,
  daysBetween,
} from "@/lib/format";
import type { Criticality, Purchase, PurchaseRequest, Vendor, VendorPayment } from "@/domain/types";
import type { StatusTone } from "@/lib/status";

// ── Helpers ──────────────────────────────────────────────────────────────────

function criticalityTone(c: Criticality): StatusTone {
  return c === "high" ? "danger" : c === "medium" ? "warning" : "neutral";
}

function approvalStatusTone(s: string): StatusTone {
  return s === "approved" ? "success" : s === "rejected" ? "danger" : "warning";
}

function paymentStatusTone(s: string): StatusTone {
  return s === "paid" ? "success" : s === "partial" ? "warning" : "danger";
}

function priorityTone(p: string): StatusTone {
  return p === "P1" || p === "P2" ? "danger" : p === "P3" ? "warning" : "neutral";
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

// ── Derived inline ────────────────────────────────────────────────────────────

const openRequests = purchaseRequests.filter((pr) => pr.approvalStatus === "pending");
const unpaidInvoices = purchases.filter((p) => p.paymentStatus !== "paid");
const criticalPending = purchaseRequests.filter(
  (pr) => pr.criticality === "high" && pr.approvalStatus === "pending",
);
const overdueVendorCount = vendorPayables().filter((v) => v.daysOverdue > 0).length;

// ── Column definitions ────────────────────────────────────────────────────────

const prColumns: Column<PurchaseRequest>[] = [
  {
    key: "itemName",
    header: "Item",
    render: (r) => <span className="font-medium">{r.itemName}</span>,
  },
  {
    key: "vendor",
    header: "Vendor",
    render: (r) => <span className="text-sm">{vendorName(r.vendorId)}</span>,
  },
  {
    key: "linkedJobId",
    header: "Job",
    render: (r) => {
      const job = r.linkedJobId ? getJob(r.linkedJobId) : undefined;
      return job ? (
        <span className="text-xs font-medium text-muted-foreground">{job.jobCode}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  {
    key: "quantity",
    header: "Qty",
    align: "right",
    render: (r) => <span>{formatNumberIN(r.quantity)}</span>,
  },
  {
    key: "estimatedRate",
    header: "Est. Rate",
    align: "right",
    render: (r) => <span>{formatINR(r.estimatedRate, "full")}</span>,
  },
  {
    key: "estimatedTotal",
    header: "Est. Total",
    align: "right",
    render: (r) => (
      <span className="font-medium">{formatINR(r.estimatedTotal, "full")}</span>
    ),
  },
  {
    key: "criticality",
    header: "Criticality",
    render: (r) => (
      <StatusPill tone={criticalityTone(r.criticality)}>{r.criticality}</StatusPill>
    ),
  },
  {
    key: "requestedBy",
    header: "Requested by",
    render: (r) => <span className="text-sm">{r.requestedBy ?? "—"}</span>,
  },
  {
    key: "requestDate",
    header: "Date",
    render: (r) => <span className="text-sm">{formatDate(r.requestDate)}</span>,
  },
  {
    key: "approvalStatus",
    header: "Status",
    render: (r) => (
      <StatusPill tone={approvalStatusTone(r.approvalStatus)}>{r.approvalStatus}</StatusPill>
    ),
  },
];

const purchaseColumns: Column<Purchase>[] = [
  {
    key: "vendor",
    header: "Vendor",
    render: (r) => <span className="font-medium">{vendorName(r.vendorId)}</span>,
  },
  {
    key: "invoiceNo",
    header: "Invoice No.",
    render: (r) => <span className="font-mono text-sm">{r.invoiceNo}</span>,
  },
  {
    key: "invoiceDate",
    header: "Date",
    render: (r) => <span className="text-sm">{formatDate(r.invoiceDate)}</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (r) => <span className="text-sm text-muted-foreground">{r.category ?? "—"}</span>,
  },
  {
    key: "totalValue",
    header: "Total (incl. GST)",
    align: "right",
    render: (r) => <span className="font-medium">{formatINR(r.totalValue, "full")}</span>,
  },
  {
    key: "linkedJobId",
    header: "Job",
    render: (r) => {
      const job = r.linkedJobId ? getJob(r.linkedJobId) : undefined;
      return job ? (
        <span className="text-xs font-medium">{job.jobCode}</span>
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      );
    },
  },
  {
    key: "dueDate",
    header: "Due Date",
    render: (r) => {
      const overdue = r.paymentStatus !== "paid" && daysBetween(r.dueDate, AS_OF) > 0;
      return (
        <span className={overdue ? "font-medium text-danger" : "text-sm"}>
          {formatDate(r.dueDate)}
          {overdue && (
            <span className="ml-1 text-xs text-danger">
              (+{daysBetween(r.dueDate, AS_OF)}d)
            </span>
          )}
        </span>
      );
    },
  },
  {
    key: "paymentStatus",
    header: "Payment",
    render: (r) => (
      <StatusPill tone={paymentStatusTone(r.paymentStatus)}>{r.paymentStatus}</StatusPill>
    ),
  },
];

const vpColumns: Column<VendorPayment>[] = [
  {
    key: "vendor",
    header: "Vendor",
    render: (r) => <span className="font-medium">{vendorName(r.vendorId)}</span>,
  },
  {
    key: "amount",
    header: "Amount",
    align: "right",
    render: (r) => <span className="font-medium">{formatINR(r.amount, "full")}</span>,
  },
  {
    key: "priority",
    header: "Priority",
    render: (r) => (
      <StatusPill tone={priorityTone(r.priority)}>{r.priority}</StatusPill>
    ),
  },
  {
    key: "purpose",
    header: "Purpose",
    render: (r) => (
      <span className="max-w-[240px] truncate text-sm text-muted-foreground">
        {r.purpose ?? "—"}
      </span>
    ),
  },
  {
    key: "dueDate",
    header: "Due",
    render: (r) => <span className="text-sm">{r.dueDate ? formatDate(r.dueDate) : "—"}</span>,
  },
  {
    key: "approvalStatus",
    header: "Status",
    render: (r) => (
      <StatusPill tone={approvalStatusTone(r.approvalStatus)}>{r.approvalStatus}</StatusPill>
    ),
  },
  {
    key: "action",
    header: "Approve",
    render: () => (
      <button
        disabled
        title="Purchase cannot approve its own vendor payment — maker-checker"
        className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground opacity-60"
      >
        <Ban className="size-3" />
        Approve
      </button>
    ),
  },
];

const vendorColumns: Column<Vendor>[] = [
  {
    key: "vendorName",
    header: "Vendor Name",
    render: (r) => <span className="font-medium">{r.vendorName}</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (r) => (
      <span className="text-sm text-muted-foreground">{r.category ?? "—"}</span>
    ),
  },
  {
    key: "criticality",
    header: "Criticality",
    render: (r) => (
      <StatusPill tone={criticalityTone(r.criticality)}>{r.criticality}</StatusPill>
    ),
  },
  {
    key: "paymentTermsDays",
    header: "Payment Terms",
    align: "right",
    render: (r) => (
      <span className="text-sm">{formatNumberIN(r.paymentTermsDays)} days</span>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PurchasePage() {
  const pendingVpRequests = vendorPayments.filter((vp) => vp.approvalStatus === "pending");

  return (
    <PageGuard module="purchase">
      <div className="space-y-5">
        <PageHeader
          title="Purchase &amp; Vendors"
          description={`Meridian Alloys Pvt Ltd · procurement snapshot as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              {criticalPending.length > 0 && (
                <StatusPill tone="danger">
                  {criticalPending.length} critical pending
                </StatusPill>
              )}
              {overdueVendorCount > 0 && (
                <StatusPill tone="warning">
                  {overdueVendorCount} vendor{overdueVendorCount > 1 ? "s" : ""} overdue
                </StatusPill>
              )}
            </div>
          }
        />

        {/* KPI strip */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Procurement Overview
          </h2>
          <KpiGrid>
            <KpiCard
              label="Open Purchase Requests"
              value={formatNumberIN(openRequests.length)}
              tone={openRequests.length > 0 ? "warning" : "success"}
              icon={<ClipboardList className="size-4" />}
              sub="Awaiting approval"
            />
            <KpiCard
              label="Vendor Invoices Unpaid"
              value={formatNumberIN(unpaidInvoices.length)}
              tone={unpaidInvoices.length > 0 ? "danger" : "success"}
              icon={<ShoppingCart className="size-4" />}
              sub={`Total: ${formatINR(
                unpaidInvoices.reduce((s, p) => s + p.totalValue, 0),
              )}`}
            />
            <KpiCard
              label="Critical Materials Pending"
              value={formatNumberIN(criticalPending.length)}
              tone={criticalPending.length > 0 ? "danger" : "success"}
              icon={<AlertTriangle className="size-4" />}
              sub="High-criticality PRs pending approval"
            />
            <KpiCard
              label="Overdue Vendor Payments"
              value={formatNumberIN(overdueVendorCount)}
              tone={overdueVendorCount > 0 ? "danger" : "success"}
              icon={<PackageSearch className="size-4" />}
              sub="Vendor invoices past due date"
            />
          </KpiGrid>
        </section>

        {/* Purchase requests + payables chart */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard
              title="Purchase Requests"
              description={`${openRequests.length} open · ${criticalPending.length} critical`}
              bodyClassName="p-0"
            >
              <DataTable
                columns={prColumns}
                rows={purchaseRequests}
                getRowKey={(r) => r.id}
                empty="No purchase requests found."
              />
            </SectionCard>
          </div>
          <SectionCard
            title="Vendor payables by priority"
            description="P1 stops production if unpaid"
          >
            <PriorityBarChart data={vendorPayablesByPriority()} />
          </SectionCard>
        </section>

        {/* Vendor invoices */}
        <SectionCard
          title="Vendor Invoices — Unpaid"
          description="Purchases with paymentStatus unpaid or partial; overdue dates highlighted in red"
          bodyClassName="p-0"
        >
          <DataTable
            columns={purchaseColumns}
            rows={unpaidInvoices}
            getRowKey={(r) => r.id}
            empty="No unpaid vendor invoices."
          />
        </SectionCard>

        {/* Vendor payment requests */}
        <SectionCard
          title="Vendor Payment Requests"
          description={
            <span>
              Pending payment requests — Purchase cannot approve its own payments
              (maker-checker enforced in Sprint 2/3)
            </span>
          }
          bodyClassName="p-0"
        >
          <DataTable
            columns={vpColumns}
            rows={pendingVpRequests}
            getRowKey={(r) => r.id}
            empty="No pending vendor payment requests."
          />
        </SectionCard>

        {/* Vendors master */}
        <SectionCard
          title="Vendors Master"
          description={`${vendors.filter((v) => v.active).length} active vendors`}
          action={<Building2 className="size-4 text-muted-foreground" />}
          bodyClassName="p-0"
        >
          <DataTable
            columns={vendorColumns}
            rows={vendors.filter((v) => v.active)}
            getRowKey={(r) => r.id}
            empty="No vendors on record."
          />
        </SectionCard>
      </div>
    </PageGuard>
  );
}

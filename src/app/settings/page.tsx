"use client";

import {
  Building2,
  Factory,
  Info,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { customers, vendors, AS_OF } from "@/data";
import { DEFAULT_THRESHOLDS } from "@/domain/calc";
import { PRIORITY_MEANING, PAYMENT_PRIORITIES, type PaymentPriority } from "@/domain/types";
import type { Customer, Vendor } from "@/domain/types";
import { formatDate, formatINR, formatPercent, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

// ── Customer master columns ──────────────────────────────────────────────────

const customerColumns: Column<Customer>[] = [
  {
    key: "customerName",
    header: "Customer",
    render: (r) => <span className="font-medium">{r.customerName}</span>,
  },
  {
    key: "gstin",
    header: "GSTIN",
    className: "font-mono text-xs",
    render: (r) => r.gstin ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: "paymentTermsDays",
    header: "Terms",
    align: "right",
    render: (r) => `${r.paymentTermsDays}d`,
  },
  {
    key: "creditLimit",
    header: "Credit Limit",
    align: "right",
    render: (r) => formatINR(r.creditLimit),
  },
  {
    key: "keyContact",
    header: "Key Contact",
    render: (r) =>
      r.keyContact ? (
        <span className="text-sm">{r.keyContact}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "active",
    header: "Status",
    render: (r) => (
      <StatusPill tone={r.active ? "success" : "neutral"}>
        {r.active ? "Active" : "Inactive"}
      </StatusPill>
    ),
  },
];

// ── Vendor master columns ────────────────────────────────────────────────────

function criticalityTone(c: Vendor["criticality"]): StatusTone {
  return c === "high" ? "danger" : c === "medium" ? "warning" : "neutral";
}

const vendorColumns: Column<Vendor>[] = [
  {
    key: "vendorName",
    header: "Vendor",
    render: (r) => <span className="font-medium">{r.vendorName}</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (r) =>
      r.category ? (
        <span className="text-sm">{r.category}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "criticality",
    header: "Criticality",
    render: (r) => (
      <StatusPill tone={criticalityTone(r.criticality)}>
        {r.criticality.charAt(0).toUpperCase() + r.criticality.slice(1)}
      </StatusPill>
    ),
  },
  {
    key: "paymentTermsDays",
    header: "Terms",
    align: "right",
    render: (r) => `${r.paymentTermsDays}d`,
  },
  {
    key: "gstin",
    header: "GSTIN",
    className: "font-mono text-xs",
    render: (r) =>
      r.gstin ? r.gstin : <span className="text-muted-foreground">—</span>,
  },
  {
    key: "active",
    header: "Status",
    render: (r) => (
      <StatusPill tone={r.active ? "success" : "neutral"}>
        {r.active ? "Active" : "Inactive"}
      </StatusPill>
    ),
  },
];

// ── Threshold display rows ───────────────────────────────────────────────────

interface ThresholdRow {
  id: string;
  label: string;
  value: string;
  description: string;
}

const thresholdRows: ThresholdRow[] = [
  {
    id: "cashFloor",
    label: "Cash Floor",
    value: formatINR(DEFAULT_THRESHOLDS.cashFloor, "full"),
    description: "Regional current balance below this triggers a red alert",
  },
  {
    id: "occUtilisationPct",
    label: "OCC Utilisation",
    value: formatPercent(DEFAULT_THRESHOLDS.occUtilisationPct, 0),
    description: "OCC drawdown above this triggers an amber/red alert",
  },
  {
    id: "invoiceOverdueDays",
    label: "Invoice Overdue Window",
    value: `${formatNumberIN(DEFAULT_THRESHOLDS.invoiceOverdueDays)} days`,
    description: "Invoice unpaid beyond this many days from due date = overdue alert",
  },
  {
    id: "readyNotDispatchedDays",
    label: "Ready — Not Dispatched",
    value: `${formatNumberIN(DEFAULT_THRESHOLDS.readyNotDispatchedDays)} days`,
    description: "Job in 'Ready Dispatch' stage without movement beyond this window",
  },
  {
    id: "dispatchedNotInvoicedDays",
    label: "Dispatched — Not Invoiced",
    value: `${formatNumberIN(DEFAULT_THRESHOLDS.dispatchedNotInvoicedDays)} day`,
    description: "Goods dispatched but invoice not raised within this many days",
  },
  {
    id: "costOverQuotePct",
    label: "Cost Over Quote",
    value: formatPercent(DEFAULT_THRESHOLDS.costOverQuotePct, 0),
    description: "Actual job cost exceeding quoted cost by this % triggers an alert",
  },
  {
    id: "estimateOverrunPct",
    label: "Estimate Overrun (Powder / Material)",
    value: formatPercent(DEFAULT_THRESHOLDS.estimateOverrunPct, 0),
    description: "Powder or material issue exceeding job estimate by this % triggers an alert",
  },
  {
    id: "payrollWindowDays",
    label: "Payroll Cash-Risk Window",
    value: `${formatNumberIN(DEFAULT_THRESHOLDS.payrollWindowDays)} days`,
    description: "If cash-on-hand cannot cover pending payroll within this many days, alert fires",
  },
];

const thresholdColumns: Column<ThresholdRow>[] = [
  {
    key: "label",
    header: "Threshold",
    render: (r) => <span className="font-medium text-sm">{r.label}</span>,
  },
  {
    key: "value",
    header: "Current Value",
    align: "right",
    render: (r) => (
      <span className="font-semibold tabular-nums">{r.value}</span>
    ),
  },
  {
    key: "description",
    header: "Trigger Condition",
    render: (r) => (
      <span className="text-xs text-muted-foreground">{r.description}</span>
    ),
  },
];

// ── Priority legend rows ─────────────────────────────────────────────────────

const priorityTone: Record<PaymentPriority, StatusTone> = {
  P1: "danger",
  P2: "danger",
  P3: "warning",
  P4: "info",
  P5: "neutral",
};

interface PriorityRow {
  priority: PaymentPriority;
  meaning: string;
}

const priorityRows: PriorityRow[] = PAYMENT_PRIORITIES.map((p) => ({
  priority: p,
  meaning: PRIORITY_MEANING[p],
}));

const priorityColumns: Column<PriorityRow>[] = [
  {
    key: "priority",
    header: "Priority",
    render: (r) => (
      <StatusPill tone={priorityTone[r.priority]}>{r.priority}</StatusPill>
    ),
  },
  {
    key: "meaning",
    header: "Meaning",
    render: (r) => <span className="text-sm">{r.meaning}</span>,
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <PageGuard module="settings">
      <div className="space-y-5">
        <PageHeader
          title="Settings / Masters"
          description={`Master data and system configuration · as of ${formatDate(AS_OF)}`}
          actions={
            <StatusPill tone="info">
              <Info className="size-3" />
              MD only
            </StatusPill>
          }
        />

        {/* Customers master */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Building2 className="size-3.5" />
            Customers
          </h2>
          <SectionCard
            title="Customer Master"
            description={`${customers.length} customers registered`}
            bodyClassName="p-0"
          >
            <DataTable
              columns={customerColumns}
              rows={customers}
              getRowKey={(r) => r.id}
              empty="No customers found."
            />
          </SectionCard>
        </section>

        {/* Vendors master */}
        <section className="space-y-2">
          <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Factory className="size-3.5" />
            Vendors
          </h2>
          <SectionCard
            title="Vendor Master"
            description={`${vendors.length} vendors registered · criticality drives payment-priority logic`}
            bodyClassName="p-0"
          >
            <DataTable
              columns={vendorColumns}
              rows={vendors}
              getRowKey={(r) => r.id}
              empty="No vendors found."
            />
          </SectionCard>
        </section>

        {/* Alert thresholds + Priority legend side-by-side on xl */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* Alert thresholds */}
          <SectionCard
            title={
              <span className="flex items-center gap-1.5">
                <ShieldAlert className="size-4" />
                Alert Thresholds
              </span>
            }
            description="Read-only — editable by MD in Sprint 2"
            bodyClassName="p-0"
          >
            <DataTable
              columns={thresholdColumns}
              rows={thresholdRows}
              getRowKey={(r) => r.id}
              empty="No thresholds configured."
            />
          </SectionCard>

          {/* Payment priority legend */}
          <SectionCard
            title={
              <span className="flex items-center gap-1.5">
                <Users className="size-4" />
                Payment Priority Legend
              </span>
            }
            description="P1 → P5 classification used across vendor payments and cash planning"
            bodyClassName="p-0"
          >
            <DataTable
              columns={priorityColumns}
              rows={priorityRows}
              getRowKey={(r) => r.priority}
              empty="No priorities defined."
            />
          </SectionCard>
        </section>
      </div>
    </PageGuard>
  );
}

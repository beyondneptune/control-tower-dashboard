"use client";

import { ClipboardCheck, ClipboardX, FilePen, Info, ScrollText, ShieldAlert, Trash2 } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { AS_OF } from "@/data";
import { formatDate, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";
import type { Role } from "@/domain/types";

// ── Inline audit log sample ──────────────────────────────────────────────────
// The audit_log table is not yet seeded (Sprint 1). This inline array uses the
// AuditLogEntry shape from domain/types.ts and represents plausible events
// across every active module. Sprint 2/3 will replace this with a Supabase
// query; the column definitions below are forward-compatible with that shape.

type AuditAction = "insert" | "update" | "delete" | "approve" | "reject" | "override";

interface AuditEntry {
  id: string;
  timestamp: string; // ISO datetime
  userRole: Role;
  userName: string;
  action: AuditAction;
  tableName: string;
  recordId: string;
  summary: string;
}

const AUDIT_SAMPLE: AuditEntry[] = [
  {
    id: "al-001",
    timestamp: "2026-05-31T09:14:22Z",
    userRole: "md",
    userName: "Arjun Varma (MD)",
    action: "override",
    tableName: "vendor_payments",
    recordId: "VP-0087",
    summary:
      "MD override — released ₹2,40,000 payment to Hardface Stellite Powders (P1) bypassing pending checker approval. Reason: urgent powder shortage, production stops tomorrow.",
  },
  {
    id: "al-002",
    timestamp: "2026-05-31T08:47:05Z",
    userRole: "finance",
    userName: "P. Kavitha (Finance)",
    action: "approve",
    tableName: "vendor_payments",
    recordId: "VP-0086",
    summary:
      "Approved vendor payment of ₹85,000 to Precision Machining Co (P3) — checker sign-off complete, due date 2026-06-02.",
  },
  {
    id: "al-003",
    timestamp: "2026-05-30T16:31:48Z",
    userRole: "quality",
    userName: "Quality Desk",
    action: "update",
    tableName: "quality_reports",
    recordId: "QR-j5",
    summary:
      "QC status updated from 'pending' to 'accepted' for job MER-0424 (Check Valve Seat). DP after PWHT: passed. FIR: approved. QC released.",
  },
  {
    id: "al-004",
    timestamp: "2026-05-30T14:10:09Z",
    userRole: "finance",
    userName: "P. Kavitha (Finance)",
    action: "insert",
    tableName: "invoices",
    recordId: "INV-0042",
    summary:
      "New invoice INV-0042 created for job MER-0422 (Wedge Gate Hardfacing, Crestline Valves). Taxable value ₹5,90,000. Due date 2026-06-29.",
  },
  {
    id: "al-005",
    timestamp: "2026-05-29T11:55:33Z",
    userRole: "purchase",
    userName: "G. Srinivas (Purchase)",
    action: "insert",
    tableName: "purchase_requests",
    recordId: "PR-0034",
    summary:
      "Purchase request raised for Hardface Alloys Stellite 6 powder (5 kg, est. ₹1,20,000) linked to job MER-0425. Criticality: high. Awaiting MD approval.",
  },
  {
    id: "al-006",
    timestamp: "2026-05-29T09:02:14Z",
    userRole: "finance",
    userName: "P. Kavitha (Finance)",
    action: "reject",
    tableName: "expense_requests",
    recordId: "EXP-0019",
    summary:
      "Expense request EXP-0019 (₹18,500 — miscellaneous tools, Production) rejected. Reason: no linked job code; resubmit with job allocation.",
  },
  {
    id: "al-007",
    timestamp: "2026-05-28T17:44:00Z",
    userRole: "stores",
    userName: "D. Ramaiah (Stores)",
    action: "update",
    tableName: "inventory_items",
    recordId: "INV-ITEM-003",
    summary:
      "Closing qty for Stellite 6 Powder updated from 4.2 kg to 2.8 kg after material issue to job MER-0425. Reorder level: 3 kg — now below threshold.",
  },
  {
    id: "al-008",
    timestamp: "2026-05-27T13:20:55Z",
    userRole: "md",
    userName: "Arjun Varma (MD)",
    action: "delete",
    tableName: "quotations",
    recordId: "QT-DRAFT-08",
    summary:
      "Draft quotation QT-DRAFT-08 (₹4,20,000, Pipeworks Engineers) deleted. Reason: customer withdrew RFQ before approval.",
  },
];

// ── Derived KPIs ─────────────────────────────────────────────────────────────

const todayPrefix = AS_OF; // "2026-05-31"

const entriesToday = AUDIT_SAMPLE.filter((e) => e.timestamp.startsWith(todayPrefix)).length;
const approvals = AUDIT_SAMPLE.filter((e) => e.action === "approve").length;
const overrides = AUDIT_SAMPLE.filter((e) => e.action === "override").length;
const deletions = AUDIT_SAMPLE.filter((e) => e.action === "delete").length;

// ── Action pill config ────────────────────────────────────────────────────────

const ACTION_TONE: Record<AuditAction, StatusTone> = {
  insert: "info",
  update: "neutral",
  delete: "danger",
  approve: "success",
  reject: "warning",
  override: "danger",
};

const ACTION_LABEL: Record<AuditAction, string> = {
  insert: "Insert",
  update: "Update",
  delete: "Delete",
  approve: "Approve",
  reject: "Reject",
  override: "Override",
};

// ── Column definitions ────────────────────────────────────────────────────────

const auditColumns: Column<AuditEntry>[] = [
  {
    key: "timestamp",
    header: "Timestamp",
    className: "whitespace-nowrap",
    render: (r) => (
      <span className="text-xs tabular-nums text-muted-foreground">
        {formatDate(r.timestamp.slice(0, 10))}
        <br />
        <span className="font-mono">{r.timestamp.slice(11, 19)} UTC</span>
      </span>
    ),
  },
  {
    key: "userRole",
    header: "Role",
    render: (r) => {
      const roleTone: Record<Role, StatusTone> = {
        md: "danger",
        finance: "info",
        production: "neutral",
        quality: "success",
        stores: "neutral",
        purchase: "warning",
        sales: "info",
        hr: "neutral",
        auditor: "neutral",
      };
      return <StatusPill tone={roleTone[r.userRole]}>{r.userRole}</StatusPill>;
    },
  },
  {
    key: "userName",
    header: "User",
    render: (r) => <span className="text-sm font-medium">{r.userName}</span>,
  },
  {
    key: "action",
    header: "Action",
    render: (r) => (
      <StatusPill tone={ACTION_TONE[r.action]}>{ACTION_LABEL[r.action]}</StatusPill>
    ),
  },
  {
    key: "tableName",
    header: "Table",
    render: (r) => (
      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        {r.tableName}
      </span>
    ),
  },
  {
    key: "recordId",
    header: "Record",
    render: (r) => <span className="font-mono text-xs">{r.recordId}</span>,
  },
  {
    key: "summary",
    header: "Summary",
    className: "max-w-md",
    render: (r) => (
      <p className="line-clamp-2 text-xs text-muted-foreground">{r.summary}</p>
    ),
  },
];

// Sort newest first (already in order, but guard for safety)
const sortedRows = [...AUDIT_SAMPLE].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

// ── Page component ────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  return (
    <PageGuard module="audit-log">
      <div className="space-y-5">
        <PageHeader
          title="Audit Log"
          description={`Meridian Alloys Pvt Ltd · tamper-evident record of all inserts, updates, approvals, and overrides · as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone="danger" dot={false}>
                <ShieldAlert className="mr-1 size-3" />
                {overrides} override{overrides !== 1 ? "s" : ""}
              </StatusPill>
              <StatusPill tone="neutral" dot={false}>
                <Info className="mr-1 size-3" />
                Sprint 2/3 backend wires live writes
              </StatusPill>
            </div>
          }
        />

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label="Entries today"
            value={formatNumberIN(entriesToday)}
            tone="info"
            icon={<ScrollText className="size-4" />}
            sub={`As of ${formatDate(AS_OF)}`}
          />
          <KpiCard
            label="Approvals"
            value={formatNumberIN(approvals)}
            tone="success"
            icon={<ClipboardCheck className="size-4" />}
            sub="Maker-checker sign-offs"
          />
          <KpiCard
            label="Overrides"
            value={formatNumberIN(overrides)}
            tone={overrides > 0 ? "danger" : "success"}
            icon={<ShieldAlert className="size-4" />}
            sub="MD overrides with reason"
          />
          <KpiCard
            label="Deletions"
            value={formatNumberIN(deletions)}
            tone={deletions > 0 ? "warning" : "success"}
            icon={<Trash2 className="size-4" />}
            sub="Hard deletes — audit flags these"
          />
        </div>

        {/* Full audit table */}
        <SectionCard
          title="All audit entries"
          description="Newest first · every insert / update / delete / approval / override across all modules"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FilePen className="size-3" />
              <span>Read-only · Sprint 2/3 wires live writes here automatically</span>
            </div>
          }
        >
          <DataTable
            columns={auditColumns}
            rows={sortedRows}
            getRowKey={(r) => r.id}
            empty="No audit entries found. Every insert, edit, delete, approval, and override will appear here once the Sprint 2 backend is connected."
          />
        </SectionCard>

        {/* Governance note */}
        <SectionCard
          title="How this log works"
          description="Governance contract for Sprint 2/3 implementation"
        >
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <ClipboardCheck className="size-4 text-success" />
                Automatic capture
              </div>
              <p className="text-xs text-muted-foreground">
                Every mutation through the Sprint 2 server actions writes a row here — no manual
                logging required. The table is append-only; no row can be updated or deleted by
                application code.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="size-4 text-danger" />
                Override policy
              </div>
              <p className="text-xs text-muted-foreground">
                An <span className="font-semibold text-danger">override</span> entry is written any
                time the MD bypasses a pending maker-checker stage. The override reason is mandatory
                and stored verbatim — flagged in amber to the auditor role.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <ClipboardX className="size-4 text-warning" />
                Deletion policy
              </div>
              <p className="text-xs text-muted-foreground">
                Hard deletes require MD approval and write a <span className="font-semibold">delete</span>{" "}
                entry with the full old-value snapshot in{" "}
                <span className="font-mono text-xs">old_value</span> (JSONB). Soft-delete (
                <span className="font-mono text-xs">active = false</span>) is preferred for all
                master data.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

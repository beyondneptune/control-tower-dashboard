"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  RefreshCw,
  ShieldCheck,
  ShieldX,
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
  qualityReports,
  getJob,
} from "@/data";
import type { QualityReport } from "@/domain/types";
import { formatDate, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

// ── Derived KPIs (inline — no dedicated data export) ─────────────────────────

const allReports = qualityReports;

/** qcStatus "pending" */
const pendingQC = allReports.filter((r) => r.qcStatus === "pending");

/** qcStatus "hold" */
const onHold = allReports.filter((r) => r.qcStatus === "hold");

/** reworkRequired === true */
const reworkRequired = allReports.filter((r) => r.reworkRequired);

/** firStatus not "Cleared" (and not empty) — treated as FIR pending */
const firPending = allReports.filter(
  (r) => r.firStatus !== undefined && r.firStatus !== "" && r.firStatus !== "Cleared",
);

// ── QC status tone map ────────────────────────────────────────────────────────

function qcStatusTone(status: QualityReport["qcStatus"]): StatusTone {
  switch (status) {
    case "accepted": return "success";
    case "hold":     return "warning";
    case "rework":   return "danger";
    case "pending":  return "neutral";
  }
}

function qcStatusLabel(status: QualityReport["qcStatus"]): string {
  switch (status) {
    case "accepted": return "Accepted";
    case "hold":     return "On Hold";
    case "rework":   return "Rework";
    case "pending":  return "Pending";
  }
}

// ── Enriched row type ─────────────────────────────────────────────────────────

interface QCRow extends QualityReport {
  jobCode: string;
}

const qcRows: QCRow[] = allReports.map((r) => ({
  ...r,
  jobCode: getJob(r.jobId)?.jobCode ?? r.jobId,
}));

const reworkRows: QCRow[] = reworkRequired.map((r) => ({
  ...r,
  jobCode: getJob(r.jobId)?.jobCode ?? r.jobId,
}));

const pendingRows: QCRow[] = pendingQC.map((r) => ({
  ...r,
  jobCode: getJob(r.jobId)?.jobCode ?? r.jobId,
}));

// ── Column definitions ────────────────────────────────────────────────────────

const qcRegisterCols: Column<QCRow>[] = [
  {
    key: "jobCode",
    header: "Job",
    render: (r) => <span className="font-medium">{r.jobCode}</span>,
  },
  {
    key: "inspectionStage",
    header: "Stage",
    render: (r) => <span className="text-sm">{r.inspectionStage ?? "—"}</span>,
  },
  {
    key: "dpAfterLmd",
    header: "DP / PT",
    align: "center",
    render: (r) => {
      const val = r.dpAfterLmd ?? r.dpBeforeLmd;
      if (!val) return <span className="text-muted-foreground">—</span>;
      const tone: StatusTone = val === "Accepted" ? "success" : val === "Rework" ? "danger" : "warning";
      return <StatusPill tone={tone}>{val}</StatusPill>;
    },
  },
  {
    key: "vtResult",
    header: "VT",
    align: "center",
    render: (r) => {
      if (!r.vtResult) return <span className="text-muted-foreground">—</span>;
      const tone: StatusTone = r.vtResult === "Accepted" ? "success" : "danger";
      return <StatusPill tone={tone}>{r.vtResult}</StatusPill>;
    },
  },
  {
    key: "firStatus",
    header: "FIR",
    align: "center",
    render: (r) => {
      if (!r.firStatus) return <span className="text-muted-foreground">—</span>;
      const tone: StatusTone = r.firStatus === "Cleared" ? "success" : "warning";
      return <StatusPill tone={tone}>{r.firStatus}</StatusPill>;
    },
  },
  {
    key: "qcStatus",
    header: "QC Status",
    align: "center",
    render: (r) => (
      <StatusPill tone={qcStatusTone(r.qcStatus)}>{qcStatusLabel(r.qcStatus)}</StatusPill>
    ),
  },
  {
    key: "ncrNo",
    header: "NCR No.",
    render: (r) =>
      r.ncrNo ? <span className="font-mono text-xs">{r.ncrNo}</span> : <span className="text-muted-foreground">—</span>,
  },
];

const reworkCols: Column<QCRow>[] = [
  {
    key: "jobCode",
    header: "Job",
    render: (r) => <span className="font-medium">{r.jobCode}</span>,
  },
  {
    key: "ncrNo",
    header: "NCR No.",
    render: (r) =>
      r.ncrNo ? (
        <span className="font-mono text-xs text-danger">{r.ncrNo}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "reworkReason",
    header: "Rework Reason",
    render: (r) => (
      <span className="text-sm text-muted-foreground">{r.reworkReason ?? "Not documented"}</span>
    ),
  },
  {
    key: "remarks",
    header: "Remarks",
    render: (r) => (
      <span className="text-xs text-muted-foreground">{r.remarks ?? "—"}</span>
    ),
  },
];

const releaseCols: Column<QCRow>[] = [
  {
    key: "jobCode",
    header: "Job",
    render: (r) => <span className="font-medium">{r.jobCode}</span>,
  },
  {
    key: "inspectionStage",
    header: "Stage",
    render: (r) => <span className="text-sm">{r.inspectionStage ?? "—"}</span>,
  },
  {
    key: "firStatus",
    header: "FIR",
    align: "center",
    render: (r) => {
      if (!r.firStatus) return <span className="text-muted-foreground">—</span>;
      const tone: StatusTone = r.firStatus === "Cleared" ? "success" : "warning";
      return <StatusPill tone={tone}>{r.firStatus}</StatusPill>;
    },
  },
  {
    key: "remarks",
    header: "Remarks",
    render: (r) => (
      <span className="text-xs text-muted-foreground">{r.remarks ?? "—"}</span>
    ),
  },
  {
    key: "action",
    header: "QC Release",
    align: "center",
    render: () => (
      <div className="flex flex-col items-center gap-0.5">
        <button
          disabled
          className="rounded-md border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground cursor-not-allowed"
          title="QC release is enforced server-side — Sprint 3"
        >
          Release QC
        </button>
        <span className="text-[10px] text-muted-foreground leading-tight text-center max-w-[120px]">
          Maker-checker — Sprint 3
        </span>
      </div>
    ),
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function QualityPage() {
  const pendingCount = pendingQC.length;
  const holdCount = onHold.length;
  const reworkCount = reworkRequired.length;
  const firPendingCount = firPending.length;

  return (
    <PageGuard module="quality">
      <div className="space-y-5">
        <PageHeader
          title="Quality Control"
          description={`Meridian Alloys — QC register & NCR tracker · as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              {reworkCount > 0 && (
                <StatusPill tone="danger">
                  {reworkCount} rework
                </StatusPill>
              )}
              {firPendingCount > 0 && (
                <StatusPill tone="warning">
                  {firPendingCount} FIR pending
                </StatusPill>
              )}
            </div>
          }
        />

        {/* KPI grid */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            QC Snapshot
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Awaiting QC"
              value={formatNumberIN(pendingCount)}
              tone={pendingCount > 0 ? "warning" : "success"}
              icon={<ClipboardCheck className="size-4" />}
              sub="qcStatus = pending"
            />
            <KpiCard
              label="On Hold"
              value={formatNumberIN(holdCount)}
              tone={holdCount > 0 ? "warning" : "success"}
              icon={<ShieldX className="size-4" />}
              sub="qcStatus = hold"
            />
            <KpiCard
              label="Rework Required"
              value={formatNumberIN(reworkCount)}
              tone={reworkCount > 0 ? "danger" : "success"}
              icon={<RefreshCw className="size-4" />}
              sub="NCR raised, re-coat needed"
            />
            <KpiCard
              label="FIR Pending"
              value={formatNumberIN(firPendingCount)}
              tone={firPendingCount > 0 ? "warning" : "success"}
              icon={<FileSearch className="size-4" />}
              sub="Final Inspection Report outstanding"
            />
          </div>
        </section>

        {/* QC Register table */}
        <SectionCard
          title="QC Register"
          description={`All quality reports — ${qcRows.length} record${qcRows.length !== 1 ? "s" : ""}`}
          bodyClassName="p-0"
        >
          <DataTable
            columns={qcRegisterCols}
            rows={qcRows}
            getRowKey={(r) => r.id}
            empty="No quality reports on record."
          />
        </SectionCard>

        {/* NCR / Rework list + Release panel — side by side on xl */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {/* NCR / Rework */}
          <SectionCard
            title="NCR / Rework List"
            description={
              reworkRows.length > 0
                ? `${reworkRows.length} active NCR${reworkRows.length !== 1 ? "s" : ""} — re-coat required`
                : "No open NCRs"
            }
            bodyClassName="p-0"
          >
            <DataTable
              columns={reworkCols}
              rows={reworkRows}
              getRowKey={(r) => r.id}
              empty="No rework jobs outstanding."
            />
          </SectionCard>

          {/* QC Release panel */}
          <SectionCard
            title="QC Release — Pending Jobs"
            description="QC release is mandatory before dispatch — enforced server-side in Sprint 3"
            action={
              <StatusPill tone="neutral">
                <AlertTriangle className="size-3" />
                Maker-checker
              </StatusPill>
            }
            bodyClassName="p-0"
          >
            <DataTable
              columns={releaseCols}
              rows={pendingRows}
              getRowKey={(r) => r.id}
              empty="No jobs awaiting QC release."
            />
          </SectionCard>
        </section>

        {/* Quality daily upload form — visual / non-functional */}
        <SectionCard
          title="Quality Daily Upload"
          description="Record inspection results — data entry is visual-only in Sprint 1; server persistence in Sprint 2"
          action={
            <StatusPill tone="info">
              <UploadCloud className="size-3" />
              Sprint 2
            </StatusPill>
          }
        >
          <form
            onSubmit={(e) => e.preventDefault()}
            className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {/* Job / inspection stage */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Job Code
              </label>
              <input
                disabled
                placeholder="e.g. MER-0424"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/60 cursor-not-allowed"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Inspection Stage
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Pre-DP</option>
                <option>Post-DP</option>
                <option>Final QC</option>
              </select>
            </div>

            {/* DP results */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                DP Before LMD
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Accepted</option>
                <option>Rework</option>
                <option>Hold</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                DP After LMD
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Accepted</option>
                <option>Rework</option>
                <option>Hold</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                DP After PWHT
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>N/A</option>
                <option>Accepted</option>
                <option>Rework</option>
                <option>Hold</option>
              </select>
            </div>

            {/* VT */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                VT Result
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Accepted</option>
                <option>Rejected</option>
                <option>Pending</option>
              </select>
            </div>

            {/* FIR */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                FIR Status
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Pending</option>
                <option>Cleared</option>
              </select>
            </div>

            {/* Accept / hold / rework */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                QC Disposition
              </label>
              <select
                disabled
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              >
                <option>Accepted</option>
                <option>Hold</option>
                <option>Rework</option>
                <option>Pending</option>
              </select>
            </div>

            {/* NCR no */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                NCR No. (if applicable)
              </label>
              <input
                disabled
                placeholder="e.g. NCR-20"
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/60 cursor-not-allowed"
              />
            </div>

            {/* Report file */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Report File (PDF / Image)
              </label>
              <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted px-3 py-2 cursor-not-allowed">
                <UploadCloud className="size-4 shrink-0 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Drag &amp; drop or browse — Sprint 2
                </span>
              </div>
            </div>

            {/* Remarks — full width */}
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Remarks
              </label>
              <textarea
                disabled
                rows={2}
                placeholder="Inspector remarks..."
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground placeholder:text-muted-foreground/60 cursor-not-allowed resize-none"
              />
            </div>

            {/* Submit row */}
            <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <button
                disabled
                type="submit"
                className="inline-flex items-center gap-2 rounded-md bg-primary/20 px-4 py-2 text-sm font-medium text-primary/60 cursor-not-allowed"
              >
                <CheckCircle2 className="size-4" />
                Save Inspection Record
              </button>
              <span className="text-xs text-muted-foreground">
                Maker-checker enforced — save &amp; QC release require server-side approval (Sprint 2 / 3).
              </span>
            </div>
          </form>
        </SectionCard>

        {/* Released / closed QC for reference */}
        <SectionCard
          title="Released QC Records"
          description="Jobs whose QC has been cleared and released"
        >
          <div className="space-y-2">
            {allReports
              .filter((r) => r.qcStatus === "accepted" && r.qcReleasedBy)
              .map((r) => {
                const job = getJob(r.jobId);
                return (
                  <div
                    key={r.id}
                    className="flex flex-col gap-1 rounded-lg border border-success/20 bg-success-soft px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-success shrink-0" />
                      <div>
                        <span className="text-sm font-medium">{job?.jobCode ?? r.jobId}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.inspectionStage}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Released by: <span className="font-medium text-foreground">{r.qcReleasedBy}</span></span>
                      {r.qcReleaseDate && (
                        <span>{formatDate(r.qcReleaseDate)}</span>
                      )}
                      <StatusPill tone="success">Accepted</StatusPill>
                    </div>
                  </div>
                );
              })}
            {allReports.filter((r) => r.qcStatus === "accepted" && r.qcReleasedBy).length === 0 && (
              <p className="text-sm text-muted-foreground">No released QC records yet.</p>
            )}
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

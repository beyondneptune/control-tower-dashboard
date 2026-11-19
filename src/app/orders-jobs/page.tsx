"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ClipboardList,
  Factory,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { StatusPill } from "@/components/kit/status-pill";
import {
  AS_OF,
  customerName,
  jobMargin,
  jobsByStage,
  jobs,
} from "@/data";
import { JOB_STAGES, type Job, type JobStage } from "@/domain/types";
import { marginBandTone } from "@/lib/status";
import {
  formatDate,
  formatINRCompact,
  formatNumberIN,
  formatPercent,
  daysBetween,
} from "@/lib/format";

// ── Inline derived data ──────────────────────────────────────────────────────

/** Stages considered "in production" (Material Received → Final QC inclusive). */
const IN_PRODUCTION_STAGES: JobStage[] = [
  "Material Received",
  "Pre-DP",
  "LMD",
  "PWHT / Proof Machining",
  "Post-DP",
  "Final QC",
];

function inProductionCount(): number {
  return jobs.filter((j) => IN_PRODUCTION_STAGES.includes(j.stage)).length;
}

function orderBookValue(): number {
  return jobs.reduce((s, j) => s + j.quotedValue, 0);
}

/** A job is delayed if its dispatch date is past AS_OF and it is not yet Dispatched/Invoiced/Collected. */
const DISPATCHED_INDEX = JOB_STAGES.indexOf("Dispatched");

function isDelayed(job: Job): boolean {
  const stageIdx = JOB_STAGES.indexOf(job.stage);
  return stageIdx < DISPATCHED_INDEX && daysBetween(job.requiredDispatchDate, AS_OF) > 0;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

interface JobCardProps {
  job: Job;
}

function JobCard({ job }: JobCardProps) {
  const margin = jobMargin(job.id);
  const delayed = isDelayed(job);
  const customer = customerName(job.customerId);

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm transition-colors hover:bg-accent/30 cursor-default">
      {/* Header row */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-semibold text-sm tracking-tight text-foreground truncate">
          {job.jobCode}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {delayed && (
            <StatusPill tone="danger">
              <AlertTriangle className="size-2.5" />
              Delayed
            </StatusPill>
          )}
        </div>
      </div>

      {/* Customer & Part */}
      <p className="text-xs text-muted-foreground truncate mb-0.5" title={customer}>
        {customer}
      </p>
      <p className="text-xs font-medium text-foreground truncate mb-2" title={job.partName}>
        {job.partName}
      </p>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mb-2">
        <div>
          <span className="text-muted-foreground">Qty</span>
          <span className="ml-1 font-medium tabular-nums">{formatNumberIN(job.quantity)}</span>
        </div>
        <div className="text-right">
          <span className="font-semibold tabular-nums">{formatINRCompact(job.quotedValue)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Due</span>
          <span className={`ml-1 font-medium tabular-nums ${delayed ? "text-danger" : ""}`}>
            {formatDate(job.requiredDispatchDate)}
          </span>
        </div>
        <div className="text-right">
          <StatusPill tone={marginBandTone[margin.band]}>
            {margin.marginPercent !== null ? formatPercent(margin.marginPercent) : "—"}
          </StatusPill>
        </div>
      </div>

      {/* Footer row */}
      <div className="flex items-center justify-between border-t pt-1.5 mt-1.5">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {job.owner ?? "—"}
        </span>
        <span
          className={`text-[10px] font-medium uppercase tracking-wide ${
            job.priority === "high"
              ? "text-danger"
              : job.priority === "medium"
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
        >
          {job.priority}
        </span>
      </div>
    </div>
  );
}

interface KanbanColumnProps {
  stage: JobStage;
  stageJobs: Job[];
}

function KanbanColumn({ stage, stageJobs }: KanbanColumnProps) {
  const count = stageJobs.length;
  const hasDelayed = stageJobs.some(isDelayed);

  return (
    <div className="flex flex-col min-w-[260px] max-w-[280px] rounded-xl bg-muted/40 border border-border/60">
      {/* Sticky column header */}
      <div className="sticky top-0 z-10 rounded-t-xl bg-muted/80 backdrop-blur-sm border-b border-border/60 px-3 py-2.5 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-tight text-foreground truncate">{stage}</h3>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasDelayed && <StatusPill tone="danger" dot={false}>{count}</StatusPill>}
          {!hasDelayed && count > 0 && (
            <StatusPill tone="neutral" dot={false}>{count}</StatusPill>
          )}
          {count === 0 && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground border border-border">
              0
            </span>
          )}
        </div>
      </div>

      {/* Job cards */}
      <div className="flex flex-col gap-2 p-2 min-h-[80px]">
        {stageJobs.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Empty</p>
        ) : (
          stageJobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function OrdersJobsPage() {
  const totalJobs = jobs.length;
  const orderBook = orderBookValue();
  const inProduction = inProductionCount();
  const collectedCount = jobsByStage("Collected").length;
  const totalDelayed = jobs.filter(isDelayed).length;

  return (
    <PageGuard module="orders-jobs">
      <div className="space-y-5">
        <PageHeader
          title="Orders & Jobs"
          description={`Kanban view of all ${totalJobs} active jobs · Meridian Alloys · as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              {totalDelayed > 0 && (
                <StatusPill tone="danger">
                  <AlertTriangle className="size-3" />
                  {totalDelayed} delayed
                </StatusPill>
              )}
              <StatusPill tone="neutral" dot={false}>
                Sprint 2 — drag-to-move coming
              </StatusPill>
            </div>
          }
        />

        {/* KPI strip */}
        <KpiGrid>
          <KpiCard
            label="Total Jobs"
            value={formatNumberIN(totalJobs)}
            tone="neutral"
            icon={<ClipboardList className="size-4" />}
            sub="Active order book"
          />
          <KpiCard
            label="Order-Book Value"
            value={formatINRCompact(orderBook)}
            tone="info"
            icon={<Banknote className="size-4" />}
            sub="Sum of quoted values"
          />
          <KpiCard
            label="In Production"
            value={formatNumberIN(inProduction)}
            tone={inProduction > 0 ? "warning" : "success"}
            icon={<Factory className="size-4" />}
            sub="Material Received → Final QC"
          />
          <KpiCard
            label="Collected"
            value={formatNumberIN(collectedCount)}
            tone="success"
            icon={<CheckCircle2 className="size-4" />}
            sub="Payment received in full"
          />
        </KpiGrid>

        {/* Kanban board */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Job Pipeline — {JOB_STAGES.length} stages
          </h2>
          {/* Note: cards are display-only; drag-to-move enforced in Sprint 2 */}
          <div className="overflow-x-auto pb-3">
            <div className="flex gap-3" style={{ minWidth: "max-content" }}>
              {JOB_STAGES.map((stage) => (
                <KanbanColumn
                  key={stage}
                  stage={stage}
                  stageJobs={jobsByStage(stage)}
                />
              ))}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Maker-checker — drag-to-move enforced in Sprint 2. Cards are read-only in this release.
          </p>
        </section>
      </div>
    </PageGuard>
  );
}

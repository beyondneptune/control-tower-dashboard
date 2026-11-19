"use client";

import {
  AlertTriangle,
  CalendarClock,
  ClipboardList,
  Factory,
  Layers,
  Timer,
  Upload,
  WrapText,
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
  delayedJobs,
  jobStageCounts,
  jobs,
} from "@/data";
import { JOB_STAGES, type Job, type JobStage } from "@/domain/types";
import { daysBetween, formatDate, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

// ── Inline derivations ──────────────────────────────────────────────────────

/** Stages that are considered "complete" for the purposes of "open jobs". */
const CLOSED_STAGES: JobStage[] = ["Collected"];

/** All jobs not yet collected. */
function openJobs(): Job[] {
  return jobs.filter((j) => !CLOSED_STAGES.includes(j.stage));
}

/** Jobs in active production — not in the earliest two intake stages and not closed. */
const INTAKE_STAGES: JobStage[] = ["PO Received", "Collected"];
function inProgressJobs(): Job[] {
  return jobs.filter((j) => !INTAKE_STAGES.includes(j.stage));
}

/** Jobs whose required dispatch date equals AS_OF (today). */
function jobsDueToday(): Job[] {
  return jobs.filter(
    (j) =>
      j.requiredDispatchDate === AS_OF &&
      JOB_STAGES.indexOf(j.stage) < JOB_STAGES.indexOf("Dispatched"),
  );
}

/** Priority tone mapping. */
function priorityTone(p: Job["priority"]): StatusTone {
  if (p === "high") return "danger";
  if (p === "medium") return "warning";
  return "neutral";
}

/** Stage tone: anything before Dispatched that is past due = danger, else neutral. */
function stageTone(stage: JobStage): StatusTone {
  const idx = JOB_STAGES.indexOf(stage);
  if (idx >= JOB_STAGES.indexOf("Dispatched")) return "success";
  if (idx >= JOB_STAGES.indexOf("Final QC")) return "info";
  return "neutral";
}

// ── Sub-types ────────────────────────────────────────────────────────────────

interface ActiveJobRow extends Job {
  customerName: string;
  isDelayed: boolean;
  daysLate: number;
}

interface DelayedJobRow extends Job {
  customerName: string;
  daysLate: number;
}

// ── Derived rows ─────────────────────────────────────────────────────────────

function activeJobRows(): ActiveJobRow[] {
  return openJobs().map((j) => {
    const daysLate = daysBetween(j.requiredDispatchDate, AS_OF);
    return {
      ...j,
      customerName: customerName(j.customerId),
      isDelayed: daysLate > 0 && JOB_STAGES.indexOf(j.stage) < JOB_STAGES.indexOf("Dispatched"),
      daysLate: Math.max(0, daysLate),
    };
  });
}

function delayedJobRows(): DelayedJobRow[] {
  return delayedJobs().map((j) => ({
    ...j,
    customerName: customerName(j.customerId),
    daysLate: daysBetween(j.requiredDispatchDate, AS_OF),
  }));
}

// ── KPI grid wrapper ─────────────────────────────────────────────────────────

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProductionPage() {
  const stageCounts = jobStageCounts();
  const delayed = delayedJobRows();
  const activeRows = activeJobRows();
  const dueToday = jobsDueToday();
  const inProgress = inProgressJobs();
  const allOpen = openJobs();

  // ── Table columns ──────────────────────────────────────────────────────────

  const activeColumns: Column<ActiveJobRow>[] = [
    {
      key: "jobCode",
      header: "Job",
      render: (r) => <span className="font-medium tabular-nums">{r.jobCode}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => <span className="text-sm">{r.customerName}</span>,
    },
    {
      key: "partName",
      header: "Part",
      render: (r) => (
        <span className="max-w-[200px] truncate text-sm text-muted-foreground" title={r.partName}>
          {r.partName}
        </span>
      ),
    },
    {
      key: "stage",
      header: "Stage",
      render: (r) =>
        r.isDelayed ? (
          <StatusPill tone="danger">Delayed</StatusPill>
        ) : (
          <StatusPill tone={stageTone(r.stage)}>{r.stage}</StatusPill>
        ),
    },
    {
      key: "requiredDispatchDate",
      header: "Req. Dispatch",
      align: "right",
      render: (r) => (
        <span className={r.isDelayed ? "font-medium text-danger" : ""}>
          {formatDate(r.requiredDispatchDate)}
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      render: (r) => <span className="text-sm text-muted-foreground">{r.owner ?? "—"}</span>,
    },
    {
      key: "priority",
      header: "Priority",
      align: "right",
      render: (r) => (
        <StatusPill tone={priorityTone(r.priority)}>
          {r.priority.charAt(0).toUpperCase() + r.priority.slice(1)}
        </StatusPill>
      ),
    },
  ];

  const delayedColumns: Column<DelayedJobRow>[] = [
    {
      key: "jobCode",
      header: "Job",
      render: (r) => <span className="font-medium tabular-nums">{r.jobCode}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      render: (r) => <span className="text-sm">{r.customerName}</span>,
    },
    {
      key: "stage",
      header: "Current Stage",
      render: (r) => <StatusPill tone="neutral">{r.stage}</StatusPill>,
    },
    {
      key: "requiredDispatchDate",
      header: "Required Date",
      align: "right",
      render: (r) => formatDate(r.requiredDispatchDate),
    },
    {
      key: "daysLate",
      header: "Days Late",
      align: "right",
      render: (r) => (
        <StatusPill tone={r.daysLate > 14 ? "danger" : "warning"}>
          {formatNumberIN(r.daysLate)}d
        </StatusPill>
      ),
    },
    {
      key: "remarks",
      header: "Reason / Remarks",
      render: (r) =>
        r.remarks ? (
          <span className="text-xs text-muted-foreground">{r.remarks}</span>
        ) : (
          <span className="text-xs italic text-danger">Delay reason mandatory</span>
        ),
    },
  ];

  return (
    <PageGuard module="production">
      <div className="space-y-5">
        <PageHeader
          title="Production Control"
          description={`Meridian Alloys Pvt Ltd · shop-floor snapshot as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone={delayed.length > 0 ? "danger" : "success"}>
                {delayed.length} delayed
              </StatusPill>
              <StatusPill tone={dueToday.length > 0 ? "warning" : "neutral"}>
                {dueToday.length} due today
              </StatusPill>
            </div>
          }
        />

        {/* KPIs */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Production KPIs
          </h2>
          <KpiGrid>
            <KpiCard
              label="Jobs Due Today"
              value={formatNumberIN(dueToday.length)}
              tone={dueToday.length > 0 ? "warning" : "success"}
              icon={<CalendarClock className="size-4" />}
              sub={`Dispatch date = ${formatDate(AS_OF)}`}
            />
            <KpiCard
              label="Delayed Jobs"
              value={formatNumberIN(delayed.length)}
              tone={delayed.length > 0 ? "danger" : "success"}
              icon={<AlertTriangle className="size-4" />}
              sub="Past required dispatch date"
            />
            <KpiCard
              label="Jobs In Progress"
              value={formatNumberIN(inProgress.length)}
              tone={inProgress.length > 0 ? "info" : "neutral"}
              icon={<Factory className="size-4" />}
              sub="Active on shop floor"
            />
            <KpiCard
              label="Total Open Jobs"
              value={formatNumberIN(allOpen.length)}
              tone="neutral"
              icon={<ClipboardList className="size-4" />}
              sub="Excluding collected"
            />
          </KpiGrid>
        </section>

        {/* Stage distribution strip */}
        <SectionCard
          title="Jobs by stage"
          description="Live count across the production kanban"
          action={<Layers className="size-4 text-muted-foreground" />}
        >
          <div className="flex flex-wrap gap-2">
            {stageCounts.map(({ stage, count }) => (
              <div
                key={stage}
                className="flex flex-col items-center gap-1 rounded-lg border bg-muted/40 px-3 py-2 text-center"
              >
                <span
                  className={`text-lg font-bold tabular-nums leading-none ${count === 0 ? "text-muted-foreground" : "text-foreground"}`}
                >
                  {count}
                </span>
                <span className="max-w-[110px] text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                  {stage}
                </span>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Active jobs table */}
        <SectionCard
          title="Active jobs"
          description={`${allOpen.length} open jobs — delayed rows show danger status`}
          bodyClassName="p-0"
        >
          <DataTable<ActiveJobRow>
            columns={activeColumns}
            rows={activeRows}
            getRowKey={(r) => r.id}
            empty="No open jobs."
          />
        </SectionCard>

        {/* Delayed jobs */}
        <SectionCard
          title="Delayed jobs"
          description={`${delayed.length} job(s) past required dispatch date — delay reason is mandatory`}
          bodyClassName="p-0"
          action={
            delayed.length > 0 ? (
              <StatusPill tone="danger">
                <Timer className="size-3" />
                Action required
              </StatusPill>
            ) : undefined
          }
        >
          <DataTable<DelayedJobRow>
            columns={delayedColumns}
            rows={delayed}
            getRowKey={(r) => r.id}
            empty="No delayed jobs."
          />
        </SectionCard>

        {/* Production daily upload form */}
        <SectionCard
          title="Production daily update"
          description="Submit today's stage progress, machine usage, and operator log"
          action={
            <StatusPill tone="neutral">
              <WrapText className="size-3" />
              Sprint 2
            </StatusPill>
          }
        >
          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onSubmit={(e) => e.preventDefault()}
          >
            {/* Job selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Job
              </label>
              <select
                disabled
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                defaultValue=""
              >
                <option value="" disabled>
                  Select job…
                </option>
                {openJobs().map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobCode} — {j.partName}
                  </option>
                ))}
              </select>
            </div>

            {/* Stage */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Stage reached today
              </label>
              <select
                disabled
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
                defaultValue=""
              >
                <option value="" disabled>
                  Select stage…
                </option>
                {JOB_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Machine */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Machine / Equipment
              </label>
              <input
                disabled
                type="text"
                placeholder="e.g. LMD-01, HT Furnace"
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Operator */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Operator
              </label>
              <input
                disabled
                type="text"
                placeholder="Operator name"
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Planned completion */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Planned completion
              </label>
              <input
                disabled
                type="date"
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Actual completion */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Actual completion
              </label>
              <input
                disabled
                type="date"
                className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Delay reason — full width */}
            <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Delay reason{" "}
                <span className="text-danger">(mandatory if job is delayed)</span>
              </label>
              <textarea
                disabled
                rows={2}
                placeholder="Describe reason for delay, if any…"
                className="resize-none rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            {/* Submit row */}
            <div className="col-span-1 flex items-center gap-3 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                disabled
                className="inline-flex items-center gap-2 rounded-md bg-primary/40 px-4 py-2 text-sm font-medium text-primary-foreground cursor-not-allowed opacity-60"
              >
                <Upload className="size-4" />
                Submit update
              </button>
              <p className="text-xs text-muted-foreground">
                Maker-checker enforced — posts to the production log in Sprint 2.
              </p>
            </div>
          </form>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

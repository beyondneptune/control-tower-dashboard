"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Check,
  CheckCircle2,
  Copy,
  Filter,
  MessageSquare,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { approveEvent, markDuplicate, rejectEvent } from "./actions";
import type { StatusTone } from "@/lib/status";

export interface ReviewEventRow {
  id: string;
  inspection_bundle_id: string | null;
  event_type: string;
  event_datetime: string;
  customer_name: string | null;
  part_name: string | null;
  material_grade: string | null;
  coating_material: string | null;
  powder_supplier: string | null;
  serial_no: string | null;
  process_stage: string | null;
  status: string | null;
  remarks: string | null;
  responsible_person: string | null;
  confidence_score: number;
  confidence_band: "high" | "medium" | "low";
  confidence_reason: string | null;
  reviewed_status: string;
  rawTextSamples: string[]; // joined samples from source_messages
  bundleSize: number;
}

interface Props {
  initialRows: ReviewEventRow[];
  totalCount: { high: number; medium: number; low: number; irrelevant: number; approved: number; rejected: number };
  asOf: string;
}

function bandTone(band: string): StatusTone {
  return band === "high" ? "success" : band === "medium" ? "warning" : "danger";
}

function statusTone(status: string | null): StatusTone {
  if (!status) return "neutral";
  if (status === "ok") return "success";
  if (status === "indication") return "warning";
  if (status === "not_ok" || status === "rework") return "danger";
  return "neutral";
}

function fmtDt(s: string): string {
  const d = new Date(s);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function WaReviewView({ initialRows, totalCount, asOf }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterBand, setFilterBand] = useState<string>("all");
  const [filterCustomer, setFilterCustomer] = useState<string>("all");
  const [statusMsg, setStatusMsg] = useState<{ tone: StatusTone; text: string } | null>(null);

  const eventTypeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.event_type));
    return Array.from(set).sort();
  }, [rows]);

  const customerOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.customer_name).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterEventType !== "all" && r.event_type !== filterEventType) return false;
      if (filterBand !== "all" && r.confidence_band !== filterBand) return false;
      if (filterCustomer !== "all" && r.customer_name !== filterCustomer) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay =
          (r.remarks || "") +
          " " +
          (r.part_name || "") +
          " " +
          (r.material_grade || "") +
          " " +
          (r.serial_no || "") +
          " " +
          (r.customer_name || "");
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterEventType, filterBand, filterCustomer, search]);

  function doAction(
    eventId: string,
    action: "approve" | "reject" | "duplicate",
    notes?: string,
  ) {
    setStatusMsg(null);
    startTransition(async () => {
      const fn = action === "approve" ? approveEvent : action === "reject" ? rejectEvent : markDuplicate;
      const res = await fn(eventId, notes);
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== eventId));
        setStatusMsg({ tone: "success", text: `Event ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "marked duplicate"}.` });
      } else {
        setStatusMsg({ tone: "danger", text: res.error ?? "Action failed." });
      }
    });
  }

  return (
    <PageGuard module="quality">
      <div className="space-y-5">
        <PageHeader
          title="WhatsApp Review & Confirm"
          description={`Extracted DP-group events awaiting human approval · ${asOf}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone="warning" dot>Pending review only</StatusPill>
              <StatusPill tone="info">{filtered.length} shown / {rows.length} pending</StatusPill>
            </div>
          }
        />

        {statusMsg && (
          <div className={`rounded-md border px-3 py-2 text-sm ${
            statusMsg.tone === "success" ? "border-success/40 bg-success-soft" : "border-danger/40 bg-danger-soft"
          }`}>
            {statusMsg.text}
          </div>
        )}

        {/* Summary KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SectionCard title="High confidence" description="Auto-extracted with all key fields" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{totalCount.high}</p>
          </SectionCard>
          <SectionCard title="Medium confidence" description="Some fields missing" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-warning">{totalCount.medium}</p>
          </SectionCard>
          <SectionCard title="Low confidence" description="Needs more careful review" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-danger">{totalCount.low}</p>
          </SectionCard>
          <SectionCard title="Irrelevant" description="Greetings/media/system" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{totalCount.irrelevant}</p>
          </SectionCard>
          <SectionCard title="Approved" description="MD/Quality signed off" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-success">{totalCount.approved}</p>
          </SectionCard>
          <SectionCard title="Rejected" description="Discarded by reviewer" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{totalCount.rejected}</p>
          </SectionCard>
        </section>

        {/* Filters */}
        <SectionCard title="Filters" bodyClassName="px-4 py-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <label className="text-xs">
              <span className="text-muted-foreground">Event type</span>
              <select
                value={filterEventType}
                onChange={(e) => setFilterEventType(e.target.value)}
                className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {eventTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Confidence</span>
              <select
                value={filterBand}
                onChange={(e) => setFilterBand(e.target.value)}
                className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Customer</span>
              <select
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
                className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {customerOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs">
              <span className="text-muted-foreground">Search remarks / part / grade / serial</span>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. CW6MC, crestline, 4 inch…"
                  className="w-full rounded border bg-background px-7 py-1 text-sm"
                />
              </div>
            </label>
          </div>
        </SectionCard>

        {/* Event cards */}
        <section className="space-y-3">
          {filtered.length === 0 && (
            <SectionCard title="Nothing to review here" bodyClassName="px-4 py-6">
              <p className="text-sm text-muted-foreground">
                Either you&apos;ve filtered everything out, or all pending events have been handled.
              </p>
            </SectionCard>
          )}
          {filtered.slice(0, 100).map((r) => (
            <SectionCard
              key={r.id}
              title={r.event_type}
              description={`${fmtDt(r.event_datetime)} · ${r.responsible_person ?? "(unknown sender)"} · bundle of ${r.bundleSize} message${r.bundleSize !== 1 ? "s" : ""}`}
              action={
                <div className="flex items-center gap-1.5">
                  <StatusPill tone={bandTone(r.confidence_band)}>
                    {r.confidence_band} · {(r.confidence_score * 100).toFixed(0)}%
                  </StatusPill>
                  {r.status && <StatusPill tone={statusTone(r.status)}>{r.status}</StatusPill>}
                </div>
              }
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Extracted fields */}
                <div className="space-y-2 text-sm">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Extracted fields
                  </h4>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <Field label="Customer" value={r.customer_name} />
                    <Field label="Part" value={r.part_name} />
                    <Field label="Stage" value={r.process_stage} />
                    <Field label="Material" value={r.material_grade} />
                    <Field label="Coating" value={r.coating_material} />
                    <Field label="Powder" value={r.powder_supplier} />
                    <Field label="Serial" value={r.serial_no} />
                    <Field label="Status" value={r.status} />
                  </dl>
                  {r.confidence_reason && (
                    <p className="rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                      {r.confidence_reason}
                    </p>
                  )}
                </div>

                {/* Raw source messages */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Raw WhatsApp text
                  </h4>
                  <div className="space-y-1 rounded border bg-muted/30 p-2 text-xs">
                    {r.rawTextSamples.length === 0 && (
                      <p className="italic text-muted-foreground">(no text — media-only)</p>
                    )}
                    {r.rawTextSamples.map((t, i) => (
                      <p key={i} className="whitespace-pre-wrap">
                        <MessageSquare className="mr-1 inline size-3 text-muted-foreground" />
                        {t}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action row */}
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => doAction(r.id, "approve")}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-60"
                >
                  <CheckCircle2 className="size-3.5" />
                  Approve
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => doAction(r.id, "duplicate")}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60 disabled:opacity-60"
                >
                  <Copy className="size-3.5" />
                  Mark duplicate
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => doAction(r.id, "reject")}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-danger/10 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/20 disabled:opacity-60"
                >
                  <XCircle className="size-3.5" />
                  Reject
                </button>
              </div>
            </SectionCard>
          ))}
          {filtered.length > 100 && (
            <p className="text-center text-xs text-muted-foreground">
              Showing first 100 of {filtered.length} — refine filters to see more.
            </p>
          )}
        </section>
      </div>
    </PageGuard>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "font-medium" : "italic text-muted-foreground/60"}>
        {value || "—"}
      </dd>
    </>
  );
}

void Filter;
void Check;
void X;

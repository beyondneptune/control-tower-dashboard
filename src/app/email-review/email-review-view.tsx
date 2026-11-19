"use client";

import { useMemo, useState, useTransition } from "react";
import {
  CheckCircle2,
  Copy,
  Mail,
  Paperclip,
  Search,
  XCircle,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { approveEmailEvent, markEmailDuplicate, rejectEmailEvent } from "./actions";
import type { StatusTone } from "@/lib/status";

export interface EmailEventRow {
  id: string;
  inspection_bundle_id: string | null;
  mailbox_key: string;
  mailbox_owner_name: string | null;
  event_type: string;
  event_datetime: string;
  customer_name: string | null;
  vendor_name: string | null;
  invoice_no: string | null;
  po_no: string | null;
  amount: number | null;
  due_date: string | null;
  status: string | null;
  responsible_person: string | null;
  confidence_score: number;
  confidence_band: "high" | "medium" | "low";
  confidence_reason: string | null;
  reviewed_status: string;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  summary_excerpt: string | null;
  has_attachment: boolean;
  gst_reference: string | null;
  action_required: string | null;
  urgency: string | null;
  payment_status: string | null;
}

interface Props {
  initialRows: EmailEventRow[];
  totalCount: {
    high: number;
    medium: number;
    low: number;
    irrelevant: number;
    approved: number;
    rejected: number;
  };
  asOf: string;
}

function bandTone(band: string): StatusTone {
  return band === "high" ? "success" : band === "medium" ? "warning" : "danger";
}

function urgencyTone(u: string | null): StatusTone {
  if (u === "high" || u === "urgent") return "danger";
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

function fmtAmt(a: number | null): string {
  if (a == null || isNaN(a)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(a);
}

export function EmailReviewView({ initialRows, totalCount, asOf }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterMailbox, setFilterMailbox] = useState<string>("all");
  const [filterEventType, setFilterEventType] = useState<string>("all");
  const [filterBand, setFilterBand] = useState<string>("all");
  const [filterEntity, setFilterEntity] = useState<string>("all");
  const [statusMsg, setStatusMsg] = useState<{ tone: StatusTone; text: string } | null>(null);

  const mailboxOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.mailbox_key));
    return Array.from(set).sort();
  }, [rows]);
  const eventTypeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.event_type));
    return Array.from(set).sort();
  }, [rows]);
  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.customer_name) set.add(r.customer_name);
      if (r.vendor_name) set.add(r.vendor_name);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterMailbox !== "all" && r.mailbox_key !== filterMailbox) return false;
      if (filterEventType !== "all" && r.event_type !== filterEventType) return false;
      if (filterBand !== "all" && r.confidence_band !== filterBand) return false;
      if (filterEntity !== "all") {
        if (r.customer_name !== filterEntity && r.vendor_name !== filterEntity) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = [
          r.subject,
          r.from_email,
          r.from_name,
          r.summary_excerpt,
          r.invoice_no,
          r.po_no,
          r.customer_name,
          r.vendor_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filterMailbox, filterEventType, filterBand, filterEntity, search]);

  function doAction(
    eventId: string,
    action: "approve" | "reject" | "duplicate",
    notes?: string,
  ) {
    setStatusMsg(null);
    startTransition(async () => {
      const fn =
        action === "approve" ? approveEmailEvent :
        action === "reject"  ? rejectEmailEvent  : markEmailDuplicate;
      const res = await fn(eventId, notes);
      if (res.ok) {
        setRows((rs) => rs.filter((r) => r.id !== eventId));
        setStatusMsg({
          tone: "success",
          text: `Event ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "marked duplicate"}.`,
        });
      } else {
        setStatusMsg({ tone: "danger", text: res.error ?? "Action failed." });
      }
    });
  }

  return (
    <PageGuard module="email-review">
      <div className="space-y-5">
        <PageHeader
          title="Email Review & Confirm"
          description={`Rule-extracted email events awaiting human approval · ${asOf}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone="warning" dot>Not on official records</StatusPill>
              <StatusPill tone="info">{filtered.length} shown / {rows.length} pending</StatusPill>
            </div>
          }
        />

        {statusMsg && (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              statusMsg.tone === "success"
                ? "border-success/40 bg-success-soft"
                : "border-danger/40 bg-danger-soft"
            }`}
          >
            {statusMsg.text}
          </div>
        )}

        {/* Summary KPIs */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SectionCard title="High confidence" description="Top-tier auto extraction" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{totalCount.high}</p>
          </SectionCard>
          <SectionCard title="Medium confidence" description="Some fields missing" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-warning">{totalCount.medium}</p>
          </SectionCard>
          <SectionCard title="Low confidence" description="Subject-only signal" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-danger">{totalCount.low}</p>
          </SectionCard>
          <SectionCard title="Irrelevant" description="System / noreply / login alerts" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{totalCount.irrelevant}</p>
          </SectionCard>
          <SectionCard title="Approved" description="Signed off by reviewer" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-success">{totalCount.approved}</p>
          </SectionCard>
          <SectionCard title="Rejected" description="Discarded by reviewer" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-muted-foreground">{totalCount.rejected}</p>
          </SectionCard>
        </section>

        {/* Filters */}
        <SectionCard title="Filters" bodyClassName="px-4 py-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-6">
            <label className="text-xs">
              <span className="text-muted-foreground">Mailbox</span>
              <select
                value={filterMailbox}
                onChange={(e) => setFilterMailbox(e.target.value)}
                className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {mailboxOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
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
              <span className="text-muted-foreground">Customer / vendor</span>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="mt-1 w-full rounded border bg-background px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                {entityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="col-span-2 text-xs">
              <span className="text-muted-foreground">Search subject / sender / invoice / PO</span>
              <div className="relative mt-1">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. 1137, crestline, overdue…"
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
              description={`${fmtDt(r.event_datetime)} · ${r.mailbox_owner_name ?? r.mailbox_key} · from ${r.from_email ?? "(unknown)"}`}
              action={
                <div className="flex items-center gap-1.5">
                  <StatusPill tone={bandTone(r.confidence_band)}>
                    {r.confidence_band} · {(r.confidence_score * 100).toFixed(0)}%
                  </StatusPill>
                  {r.urgency && r.urgency !== "normal" && (
                    <StatusPill tone={urgencyTone(r.urgency)}>{r.urgency}</StatusPill>
                  )}
                  {r.has_attachment && (
                    <StatusPill tone="info">
                      <Paperclip className="inline size-3" /> attachment
                    </StatusPill>
                  )}
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
                    <Field label="Vendor" value={r.vendor_name} />
                    <Field label="Invoice no." value={r.invoice_no} />
                    <Field label="PO / OC no." value={r.po_no} />
                    <Field label="Amount" value={r.amount != null ? `₹ ${fmtAmt(r.amount)}` : null} />
                    <Field label="Due date" value={r.due_date} />
                    <Field label="GST ref" value={r.gst_reference} />
                    <Field label="Action" value={r.action_required} />
                    <Field label="Payment status" value={r.payment_status} />
                  </dl>
                  {r.confidence_reason && (
                    <p className="rounded bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground">
                      {r.confidence_reason}
                    </p>
                  )}
                </div>

                {/* Raw subject + summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Raw email
                  </h4>
                  <div className="rounded border bg-muted/30 p-2 text-xs">
                    <p className="mb-1 font-medium">
                      <Mail className="mr-1 inline size-3 text-muted-foreground" />
                      {r.subject || "(no subject)"}
                    </p>
                    <p className="text-muted-foreground">
                      From: {r.from_name ? `${r.from_name} <${r.from_email}>` : r.from_email}
                    </p>
                    {r.summary_excerpt && (
                      <p className="mt-2 whitespace-pre-wrap italic text-muted-foreground">
                        “{r.summary_excerpt}”
                      </p>
                    )}
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

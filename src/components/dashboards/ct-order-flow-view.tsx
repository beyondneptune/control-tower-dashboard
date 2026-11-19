"use client";

import { Fragment, useMemo, useState } from "react";
import type { OrderFlowRow, OrderFlowSummary, LinkState } from "@/data/ct-order-flow";
import { KpiCard } from "@/components/kit/kpi-card";
import { formatINRCompact } from "@/lib/format";

// ── Stage model — the 8 lifecycle stages, left→right, with per-stage deep-links ──
// Each node links to the register that OWNS that stage, pre-filtered to the doc no
// (registers honour ?q=). Absent stages that have a same-drawing candidate offer a
// one-click "bridge" link so the gap can be closed without hunting for the record.
const enc = (v: unknown) => encodeURIComponent(String(v ?? "").trim());

interface StageDef {
  key: string;
  label: string;
  present: (r: OrderFlowRow) => boolean;
  doc: (r: OrderFlowRow) => string | null;
  date: (r: OrderFlowRow) => string | null;
  href: (r: OrderFlowRow) => string | null;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Compact date "27 Jun" from a YYYY-MM-DD string (no timezone drift).
function fmtShort(d: string | null): string {
  if (!d) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]} ${MON[+m[2] - 1]}` : "";
}

const STAGES: StageDef[] = [
  {
    key: "rfq", label: "RFQ",
    present: (r) => r.present_rfq,
    doc: (r) => r.rfq_no,
    date: (r) => r.rfq_date,
    href: (r) => (r.rfq_no ? `/registers/rfq?q=${enc(r.rfq_no)}` : "/registers/rfq"),
  },
  {
    key: "bom", label: "BOM",
    present: (r) => r.present_bom,
    doc: (r) => r.bom_ref,
    date: (r) => r.bom_date,
    href: () => "/engineering/costing",
  },
  {
    key: "quote", label: "Quote",
    present: (r) => r.present_quote,
    doc: (r) => r.quote_no,
    date: (r) => r.quote_date,
    href: (r) => (r.quote_no ? `/registers/quotation?q=${enc(r.quote_no)}` : "/registers/quotation"),
  },
  {
    key: "po", label: "PO",
    present: (r) => r.present_po,
    doc: (r) => r.po_no,
    date: (r) => r.po_date,
    href: (r) => (r.po_no ? `/registers/customer-po?q=${enc(r.po_no)}` : "/registers/customer-po"),
  },
  {
    key: "job", label: "Job",
    present: (r) => r.present_job,
    doc: (r) => r.job_code,
    date: (r) => r.job_date,
    href: (r) => `/registers/job?q=${enc(r.job_code || r.po_no)}`,
  },
  {
    key: "qc", label: "QC",
    present: (r) => r.present_qc,
    doc: (r) => r.qc_ref, // weld reports / FIR / route card / job card
    date: (r) => r.qc_date,
    href: (r) => `/registers/qc?q=${enc(r.job_code || r.po_no)}`,
  },
  {
    key: "dispatch", label: "Dispatch",
    present: (r) => r.present_dispatch,
    doc: (r) => r.dispatch_no,
    date: (r) => r.dispatch_date,
    href: (r) => `/registers/dispatch?q=${enc(r.dispatch_no || r.job_code || r.po_no)}`,
  },
  {
    key: "invoice", label: "Invoice",
    present: (r) => r.present_invoice,
    doc: (r) => r.invoice_no,
    date: (r) => r.invoice_date,
    href: (r) => (r.invoice_no ? `/collections?q=${enc(r.invoice_no)}` : "/collections"),
  },
];

const TONE: Record<LinkState, { rail: string; node: string; chip: string; label: string; dot: string }> = {
  complete: { rail: "bg-emerald-500", node: "bg-emerald-500 text-white border-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Complete", dot: "bg-emerald-500" },
  partial: { rail: "bg-amber-500", node: "bg-amber-500 text-white border-amber-500", chip: "bg-amber-50 text-amber-700 border-amber-200", label: "Partial ≥50%", dot: "bg-amber-500" },
  weak: { rail: "bg-red-500", node: "bg-red-500 text-white border-red-500", chip: "bg-red-50 text-red-700 border-red-200", label: "Weak <50%", dot: "bg-red-500" },
  wip: { rail: "bg-indigo-500", node: "bg-indigo-500 text-white border-indigo-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "WIP", dot: "bg-indigo-500" },
};

const NODE_W = "w-[68px]";

function shortDoc(s: string | null): string {
  if (!s) return "";
  const t = String(s).trim();
  return t.length > 9 ? "…" + t.slice(-8) : t;
}

// ── One stage node + (optional) inbound connector ─────────────────────────────
function StageNode({ row, stage }: { row: OrderFlowRow; stage: StageDef }) {
  const tone = TONE[row.link_state];
  const present = stage.present(row);
  const doc = stage.doc(row);

  const base = "flex h-7 min-w-[2.1rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold transition";
  let pill: React.ReactNode;
  if (present) {
    // Click a stage → open its actual source document (PDF/xls) in a new tab.
    const href = `/api/order-flow-doc?key=${enc(row.flow_key)}&stage=${stage.key}`;
    const cls = `${base} ${tone.node} hover:opacity-80`;
    pill = (
      <a href={href} target="_blank" rel="noopener noreferrer"
        title={`Open ${stage.label} document${doc ? ": " + doc : ""}`} className={cls}>
        {doc ? shortDoc(doc) : "✓"}
      </a>
    );
  } else {
    pill = (
      <span
        title={`${stage.label}: not connected`}
        className={`${base} border-2 border-dashed border-muted-foreground/25 bg-muted/30 text-muted-foreground/40`}
      >
        –
      </span>
    );
  }

  const dateStr = stage.date(row);
  return (
    <div className={`flex shrink-0 flex-col items-center gap-0.5 ${NODE_W}`}>
      {pill}
      <span className="w-full truncate text-center text-[9px] leading-tight text-muted-foreground" title={doc ?? ""}>
        {doc ? shortDoc(doc) : ""}
      </span>
      <span className="w-full truncate text-center text-[9px] font-medium leading-tight text-foreground/70" title={dateStr ?? ""}>
        {fmtShort(dateStr)}
      </span>
    </div>
  );
}

function Connector({ solid, tone }: { solid: boolean; tone: string }) {
  return (
    <div className="flex min-w-[8px] flex-1 items-center pb-4">
      {solid
        ? <div className={`h-[3px] w-full rounded ${tone}`} />
        : <div className="h-0 w-full border-t-2 border-dashed border-muted-foreground/25" />}
    </div>
  );
}

function OrderRow({ row }: { row: OrderFlowRow }) {
  const tone = TONE[row.link_state];
  return (
    <div className="flex items-stretch gap-3 border-t px-3 py-2 hover:bg-accent/20">
      {/* Left: order identity + connectivity chip */}
      <div className="w-[210px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 shrink-0 rounded-full ${tone.dot}`} />
          <span className="truncate text-sm font-medium" title={row.customer ?? ""}>{row.customer ?? "—"}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground" title={`${row.drawing_no ?? ""} ${row.part ?? ""}`}>
          {row.drawing_no ?? "—"}{row.part ? ` · ${row.part}` : ""}
        </div>
        {row.po_no && (
          <div className="truncate text-[10px] text-muted-foreground/80" title={`PO ${row.po_no}`}>
            PO {row.po_no}{row.po_line != null ? ` · line ${row.po_line}` : ""}{row.qty != null ? ` · ${row.qty} pc` : ""}
          </div>
        )}
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
            {tone.label} · {row.connected_count}/8
          </span>
          {row.broken_links > 0 && (
            <span className="rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600" title="Stages missing BEHIND the furthest stage reached — real broken links needing a bridge.">
              {row.broken_links} broken
            </span>
          )}
          {row.value ? <span className="text-[10px] text-muted-foreground">{formatINRCompact(row.value)}</span> : null}
        </div>
      </div>

      {/* Right: the 8-stage rail */}
      <div className="flex min-w-[620px] flex-1 items-start">
        {STAGES.map((st, i) => {
          const prev = i > 0 ? STAGES[i - 1] : null;
          const solid = !!prev && prev.present(row) && st.present(row);
          return (
            <Fragment key={st.key}>
              {i > 0 && <Connector solid={solid} tone={tone.rail} />}
              <StageNode row={row} stage={st} />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function StageHeader() {
  return (
    <div className="sticky top-0 z-20 flex items-stretch gap-3 border-b bg-muted px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shadow-sm">
      <div className="w-[210px] shrink-0">Order</div>
      <div className="flex min-w-[620px] flex-1 items-center">
        {STAGES.map((st, i) => (
          <Fragment key={st.key}>
            {i > 0 && <div className="min-w-[8px] flex-1" />}
            <div className={`shrink-0 text-center ${NODE_W}`}>{st.label}</div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

type View = "orders" | "wip" | "bridging" | "rfq_open" | "invoice_orphan" | "all";

const VIEWS: { key: View; label: string }[] = [
  { key: "orders", label: "Orders (PO+Invoice)" },
  { key: "wip", label: "WIP only" },
  { key: "bridging", label: "Needs bridging" },
  { key: "rfq_open", label: "Open RFQs" },
  { key: "invoice_orphan", label: "Orphan invoices" },
  { key: "all", label: "All" },
];

export function CtOrderFlowView({ rows, summary }: { rows: OrderFlowRow[]; summary: OrderFlowSummary }) {
  const [view, setView] = useState<View>("orders");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const inView =
        view === "all" ? true :
        view === "orders" ? (r.kind === "po_line" || r.kind === "invoice_orphan") :
        view === "wip" ? r.link_state === "wip" :
        view === "bridging" ? r.broken_links > 0 :
        view === "rfq_open" ? r.kind === "rfq_open" :
        view === "invoice_orphan" ? r.kind === "invoice_orphan" : true;
      if (!inView) return false;
      if (!needle) return true;
      const blob = [r.customer, r.drawing_no, r.part, r.po_no, r.rfq_no, r.quote_no, r.job_code, r.invoice_no, r.dispatch_no]
        .join(" ").toLowerCase();
      return blob.includes(needle);
    })
      // newest jobs on top — by inception (first activity). A just-arrived RFQ sits
      // above an old order, so the oldest (to be cleared to green) sink to the bottom.
      .sort((a, b) => (b.first_date ?? "").localeCompare(a.first_date ?? ""));
  }, [rows, view, q]);

  const maxCov = Math.max(1, summary.poLines);

  return (
    <div className="space-y-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Captured orders" value={summary.poLines.toString()} sub={`PO lines · book ${formatINRCompact(summary.bookValue)}`} tone="neutral" />
        <KpiCard label="Fully connected" value={summary.complete.toString()} sub="all 8 stages linked" tone={summary.complete > 0 ? "success" : "danger"} />
        <KpiCard label="In production (WIP)" value={summary.wip.toString()} sub="job open, not yet billed" tone="info" />
        <KpiCard label="Needs bridging" value={summary.needsBridging.toString()} sub="gap behind the frontier" tone={summary.needsBridging > 0 ? "warning" : "success"} />
        <KpiCard label="Orphan invoices" value={summary.orphanInvoices.toString()} sub="billed, no captured PO" tone={summary.orphanInvoices > 0 ? "warning" : "success"} />
        <KpiCard label="Open RFQs" value={summary.openRfqs.toString()} sub="enquiry, not yet ordered" tone="neutral" />
      </div>

      {/* Stage coverage — how many captured orders have each stage linked */}
      <div className="rounded-lg border bg-card p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Stage connectivity across {summary.poLines} captured orders — the shortest bars are the weakest links
        </div>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-8">
          {summary.stageCoverage.map((s) => {
            const pct = Math.round((s.present / maxCov) * 100);
            const tone = pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
            return (
              <div key={s.key} className="rounded border p-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium">{s.label}</span>
                  <span className="text-[10px] text-muted-foreground">{s.present}/{summary.poLines}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-muted">
                  <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${view === v.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search customer / drawing / PO / invoice…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-md border bg-background px-2 py-1 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-medium">Line colour:</span>
        {(["complete", "partial", "weak", "wip"] as LinkState[]).map((s) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={`inline-block h-[3px] w-5 rounded ${TONE[s].rail}`} /> {TONE[s].label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="inline-block size-3 rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/40" /> not connected
        </span>
      </div>

      {/* The flow chart — vertical scroll with a frozen stage-header row */}
      <div className="rounded-lg border bg-card">
        <div className="max-h-[72vh] overflow-auto">
          <div className="min-w-[860px]">
            <StageHeader />
            <div className="text-xs text-muted-foreground">
              {filtered.length === 0 ? (
                <div className="p-6 text-center">No orders match this filter.</div>
              ) : (
                filtered.map((r) => <OrderRow key={r.flow_key} row={r} />)
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        Showing {filtered.length} of {rows.length} order-anchors · newest first · every node links to its register.
      </div>

      {/* Gap-closure playbook */}
      <GapPlaybook summary={summary} />
    </div>
  );
}

function GapPlaybook({ summary }: { summary: OrderFlowSummary }) {
  const steps = [
    {
      title: `Make the RFQ links durable + capture the ${summary.poWithoutRfqLink} with no RFQ`,
      effort: "Low · mostly automatic",
      body: `RFQs are now auto-linked to their PO by drawing number (the sanctioned join spine), so most orders already show their RFQ. ${summary.poWithoutRfqLink} orders have no RFQ even by drawing — the enquiry was never captured or the drawing differs. To make the link permanent, populate ct_customer_pos.rfq_id from the drawing match (one migration) so it survives as a hard FK; capture the residual RFQs.`,
    },
    {
      title: `Cost the ${summary.poWithoutBom} orders missing a BOM`,
      effort: "Medium · Arjun, exceptions only",
      body: `${summary.poWithoutBom} orders have no latest-revision BOM on their drawing. Route these to Arjun's costing queue; each priced BOM back-fills the Quote and margin stages too. Prioritise by order value.`,
    },
    {
      title: `Close the Dispatch gap (biggest hole)`,
      effort: "Process · one form per shipment",
      body: `Only a handful of dispatches are captured, yet ${summary.invoicedWithoutDispatch} orders are already invoiced with no dispatch/challan record behind them. Fastest fix: auto-create a dispatch row from each Tally sales invoice (DC no + date), leaving only physical-handover confirmation to the shop floor.`,
    },
    {
      title: `Push ${summary.producedNotInvoiced} produced-not-invoiced orders to billing`,
      effort: "Low · finance follow-up",
      body: `${summary.producedNotInvoiced} orders show production done but no invoice — the cash-conversion bottleneck. Surfaced here as WIP; each links straight to its job and dispatch record so finance can raise the invoice.`,
    },
    {
      title: `Reconcile ${summary.orphanInvoices} orphan invoices to a PO`,
      effort: "Low · drawing match",
      body: `These invoices are billed but their PO line was never captured (legacy Tally billing before PO capture began). Each carries a drawing number; matching it to a captured PO line — or capturing the missing PO — connects them upstream.`,
    },
  ];
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">How to connect every stage — with minimal human effort</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Ordered by leverage. Automatable steps first; humans reserved for genuine exceptions (per the Control Tower operating rule).
      </p>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="rounded-md border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{i + 1}. {s.title}</span>
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{s.effort}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

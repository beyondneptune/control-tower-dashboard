"use client";

import { Fragment, useMemo, useState } from "react";
import type { OpsOrderRow, OpsSummary, StageState } from "@/data/ops";
import { KpiCard } from "@/components/kit/kpi-card";
import { formatINRCompact } from "@/lib/format";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (d: string | null) => { if (!d) return ""; const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d); return m ? `${m[3]} ${MON[+m[2] - 1]}` : ""; };
const short = (s: string | null) => (!s ? "" : s.length > 10 ? "…" + s.slice(-9) : s);

type NodeState = StageState | "wip";
interface StageDef { key: string; label: string; state: (r: OpsOrderRow) => NodeState; doc: (r: OpsOrderRow) => string | null; date: (r: OpsOrderRow) => string | null; }

const STAGES: StageDef[] = [
  { key: "rfq", label: "RFQ", state: (r) => r.rfq_state, doc: (r) => r.rfq_no, date: (r) => r.rfq_date },
  { key: "bom", label: "BOM", state: (r) => r.bom_state, doc: (r) => r.bom_ref, date: (r) => r.bom_date },
  { key: "quote", label: "Quote", state: (r) => r.quote_state, doc: (r) => r.quote_no, date: (r) => r.quote_date },
  { key: "po", label: "PO", state: (r) => r.po_state, doc: (r) => r.po_no, date: (r) => r.po_date },
  { key: "prod", label: "Production", state: (r) => (r.invoice_state === "done" ? "done" : r.wip_stage ? "wip" : "pending"), doc: (r) => r.wip_stage, date: () => null },
  { key: "qc", label: "QC", state: (r) => r.qc_state, doc: (r) => (r.weld_count ? `${r.weld_count}×WR` : null), date: (r) => r.qc_date },
  { key: "dispatch", label: "Dispatch", state: (r) => r.dispatch_state, doc: (r) => r.dc_no, date: (r) => r.dispatch_date },
  { key: "invoice", label: "Invoice", state: (r) => r.invoice_state, doc: (r) => r.invoice_no, date: (r) => r.invoice_date },
];

const ROW = {
  complete: { rail: "bg-emerald-500", dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Complete" },
  wip: { rail: "bg-indigo-500", dot: "bg-indigo-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-200", label: "WIP" },
  invoiced: { rail: "bg-red-500", dot: "bg-red-500", chip: "bg-red-50 text-red-700 border-red-200", label: "Exception" },
} as const;

function nodeCls(s: NodeState): string {
  if (s === "done") return "bg-emerald-500 text-white border-emerald-500";
  if (s === "wip") return "bg-indigo-500 text-white border-indigo-500";
  if (s === "pre_system") return "border-2 border-dashed border-muted-foreground/40 bg-muted/50 text-muted-foreground/70";
  return "border-2 border-dashed border-muted-foreground/25 bg-muted/30 text-muted-foreground/40"; // pending
}

const NODE_W = "w-[74px]";

function StageNode({ row, stage }: { row: OpsOrderRow; stage: StageDef }) {
  const s = stage.state(row);
  const doc = stage.doc(row);
  const dt = stage.date(row);
  const face = s === "done" ? (doc ? short(doc) : "✓") : s === "wip" ? (doc ? short(doc) : "▶") : s === "pre_system" ? "n/a" : "–";
  return (
    <div className={`flex shrink-0 flex-col items-center gap-0.5 ${NODE_W}`}>
      <span title={`${stage.label}: ${s}${doc ? " · " + doc : ""}`} className={`flex h-7 min-w-[2.2rem] items-center justify-center rounded-full px-2 text-[11px] font-semibold ${nodeCls(s)}`}>{face}</span>
      <span className="w-full truncate text-center text-[9px] text-muted-foreground" title={doc ?? ""}>{s === "pre_system" ? "pre-system" : doc ? short(doc) : ""}</span>
      <span className="w-full truncate text-center text-[9px] font-medium text-foreground/70">{fmt(dt)}</span>
    </div>
  );
}

function missingFor(r: OpsOrderRow): string {
  if (r.link_state !== "invoiced") return "";
  const gaps: string[] = [];
  if (r.bom_state !== "done") gaps.push("BOM");
  if (r.quote_state !== "done") gaps.push("Quote");
  if (r.qc_state !== "done") gaps.push("QC");
  return gaps.length ? `invoiced · missing ${gaps.join(", ")}` : "invoiced";
}

function OrderRow({ row }: { row: OpsOrderRow }) {
  const tone = ROW[row.link_state];
  const miss = missingFor(row);
  return (
    <div className="flex items-stretch gap-3 border-t px-3 py-2 hover:bg-accent/20">
      <div className="w-[210px] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className={`inline-block size-2 shrink-0 rounded-full ${tone.dot}`} />
          <span className="truncate text-sm font-medium" title={row.customer ?? ""}>{row.customer ?? "—"}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{row.drawing_no ?? "—"}{row.part_desc ? ` · ${row.part_desc}` : ""}</div>
        <div className="truncate text-[10px] text-muted-foreground/80">PO {row.po_no} · line {row.po_line}{row.qty != null ? ` · ${row.qty} pc` : ""}</div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${tone.chip}`}>{tone.label}</span>
          {miss && <span className="text-[10px] text-red-600">{miss}</span>}
          {row.line_value ? <span className="text-[10px] text-muted-foreground">{formatINRCompact(row.line_value)}</span> : null}
        </div>
      </div>
      <div className="flex min-w-[680px] flex-1 items-start">
        {STAGES.map((st, i) => {
          const prev = i > 0 ? STAGES[i - 1] : null;
          const solid = !!prev && ["done", "pre_system"].includes(prev.state(row)) && ["done", "pre_system", "wip"].includes(st.state(row));
          return (
            <Fragment key={st.key}>
              {i > 0 && <div className="flex min-w-[8px] flex-1 items-center pb-6">{solid ? <div className={`h-[3px] w-full rounded ${tone.rail}`} /> : <div className="h-0 w-full border-t-2 border-dashed border-muted-foreground/25" />}</div>}
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
      <div className="flex min-w-[680px] flex-1 items-center">
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

type View = "all" | "complete" | "wip" | "exception";
const VIEWS: { key: View; label: string }[] = [
  { key: "all", label: "All" },
  { key: "complete", label: "Complete" },
  { key: "wip", label: "WIP" },
  { key: "exception", label: "Exceptions" },
];

export function OpsOrderFlowView({ rows, summary }: { rows: OpsOrderRow[]; summary: OpsSummary }) {
  const [view, setView] = useState<View>("all");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    return rows.filter((r) => {
      const inView = view === "all" ? true : view === "complete" ? r.link_state === "complete" : view === "wip" ? r.link_state === "wip" : r.link_state === "invoiced";
      if (!inView) return false;
      if (!n) return true;
      return `${r.customer} ${r.drawing_no} ${r.po_no} ${r.part_desc} ${r.invoice_no}`.toLowerCase().includes(n);
    });
  }, [rows, view, q]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <KpiCard label="Orders (SSOT)" value={summary.total.toString()} sub={`book ${formatINRCompact(summary.bookValue)}`} tone="neutral" />
        <KpiCard label="Complete" value={summary.complete.toString()} sub="fully green, source-verified" tone={summary.complete > 0 ? "success" : "neutral"} />
        <KpiCard label="WIP" value={summary.wip.toString()} sub="in production" tone="info" />
        <KpiCard label="Exceptions" value={summary.exceptions.toString()} sub="invoiced · upstream doc missing" tone={summary.exceptions > 0 ? "danger" : "success"} />
        <KpiCard label="Entities" value={summary.entities.length.toString()} sub={summary.entities.slice(0, 3).map((e) => `${e.entity.replace("apexflow_", "").replace("_", " ")} ${e.n}`).join(" · ")} tone="neutral" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${view === v.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}>{v.label}</button>
          ))}
        </div>
        <input type="search" placeholder="Search customer / drawing / PO / invoice…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 rounded-md border bg-background px-2 py-1 text-sm" />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-medium">Line:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-[3px] w-5 rounded bg-emerald-500" /> Complete</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-[3px] w-5 rounded bg-indigo-500" /> WIP</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block h-[3px] w-5 rounded bg-red-500" /> Exception</span>
        <span className="ml-2 font-medium">Stage:</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full bg-emerald-500" /> done</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full bg-indigo-500" /> in production</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full border-2 border-dashed border-muted-foreground/40 bg-muted/50" /> pre-system</span>
        <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/30" /> pending</span>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="max-h-[72vh] overflow-auto">
          <div className="min-w-[900px]">
            <StageHeader />
            <div className="text-xs text-muted-foreground">
              {filtered.length === 0 ? <div className="p-6 text-center">No orders match.</div> : filtered.map((r) => <OrderRow key={r.flow_key} row={r} />)}
            </div>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">Showing {filtered.length} of {rows.length} orders · newest PO first · SSOT only (folders + Tally + forms), zero email/inference.</div>
    </div>
  );
}

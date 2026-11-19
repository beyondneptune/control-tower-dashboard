"use client";

import { useState, useTransition } from "react";
import { updateWip } from "@/lib/ops-actions";
import { OPS_WIP_STAGES } from "@/lib/ops-constants";
import type { ActiveJob } from "@/data/ops";

const FIR_RESULTS = ["Pass", "Hold", "Rework", "Reject"];

// Production-floor capture. For every active job the team records its current stage
// AND the production documents (Job Card / Route Card / Weld Report / FIR) — this is
// the SSOT for the production & QC stages and drives the Operations Board live.
export function DailyWipClient({ jobs, updatedToday }: { jobs: ActiveJob[]; updatedToday: number }) {
  const [q, setQ] = useState("");
  const filtered = jobs.filter((j) => !q || `${j.customer} ${j.drawing_no} ${j.po_no} ${j.part}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <b className="text-foreground">{jobs.length}</b> active jobs · <b className="text-foreground">{updatedToday}</b> updated today
          {jobs.length - updatedToday > 0 && <span className="ml-1 text-amber-600">· {jobs.length - updatedToday} still need today’s update</span>}
        </div>
        <input type="search" placeholder="Search customer / drawing / PO…" value={q} onChange={(e) => setQ(e.target.value)} className="w-72 rounded-md border bg-background px-2 py-1 text-sm" />
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">No active jobs.</div>}
        {filtered.map((j) => <WipRow key={j.flow_key} j={j} />)}
      </div>
    </div>
  );
}

function WipRow({ j }: { j: ActiveJob }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    stage: j.stage ?? "", qty_done: "", job_card_no: j.job_card_no ?? "", route_card_no: j.route_card_no ?? "",
    weld_report_no: j.weld_report_no ?? "", weld_grade: "", fir_no: j.fir_no ?? "", fir_result: j.fir_result ?? "", note: "",
  });
  const [state, setState] = useState<{ by: string | null; at: string | null; stage: string | null }>({ by: j.updated_by, at: j.updated_at, stage: j.stage });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const today = new Date().toISOString().slice(0, 10);
  const fresh = state.at ? String(state.at).slice(0, 10) === today : false;

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await updateWip({
        po_no: j.po_no, line_no: j.line_no, job_id: j.job_id, stage: f.stage,
        job_card_no: f.job_card_no, route_card_no: f.route_card_no, weld_report_no: f.weld_report_no,
        weld_grade: f.weld_grade, fir_no: f.fir_no, fir_result: f.fir_result,
        qty_done: f.qty_done ? Number(f.qty_done) : null, note: f.note,
      });
      if (res.ok) { setState({ by: "you", at: new Date().toISOString(), stage: f.stage || state.stage }); setOpen(false); }
      else setMsg(res.error ?? "failed");
    });

  const inp = "w-full rounded border bg-background px-2 py-1 text-xs";
  const badge = (label: string, v: string | null) => v ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{label} {v}</span> : null;

  return (
    <div className="rounded-lg border bg-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent/20">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{j.customer} · {j.drawing_no}{j.kind === "floor" && <span className="ml-1 rounded bg-amber-50 px-1 py-0.5 text-[9px] font-semibold text-amber-700">FLOOR</span>}</div>
          <div className="truncate text-[11px] text-muted-foreground">{j.kind === "floor" ? `Floor job${j.job_card_no ? ` · JC ${j.job_card_no}` : ""}` : `PO ${j.po_no} · line ${j.line_no}`}{j.qty != null ? ` · ${j.qty} pc` : ""}{j.part ? ` · ${j.part}` : ""}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {state.stage ? <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{state.stage}</span> : <span className="rounded-full border bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600">not started</span>}
          {badge("JC", j.job_card_no)}{badge("RC", j.route_card_no)}{badge("WR", j.weld_report_no)}{badge("FIR", j.fir_no)}
          <span className="text-[10px] text-muted-foreground">{state.at ? <span className={fresh ? "text-emerald-600" : "text-amber-600"}>{String(state.at).slice(0, 10)}</span> : "never"}</span>
          <span className="text-muted-foreground">{open ? "▾" : "▸"}</span>
        </div>
      </button>
      {open && (
        <div className="border-t p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Field label="Current stage">
              <select value={f.stage} onChange={(e) => set("stage", e.target.value)} className={inp}>
                <option value="">— set —</option>{OPS_WIP_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Qty done"><input type="number" value={f.qty_done} onChange={(e) => set("qty_done", e.target.value)} className={inp} /></Field>
            <Field label="Job Card No"><input value={f.job_card_no} onChange={(e) => set("job_card_no", e.target.value)} className={inp} /></Field>
            <Field label="Route Card No"><input value={f.route_card_no} onChange={(e) => set("route_card_no", e.target.value)} className={inp} /></Field>
            <Field label="Weld Report No"><input value={f.weld_report_no} onChange={(e) => set("weld_report_no", e.target.value)} className={inp} /></Field>
            <Field label="Weld Grade"><input value={f.weld_grade} onChange={(e) => set("weld_grade", e.target.value)} className={inp} placeholder="e.g. Stellite 6" /></Field>
            <Field label="FIR No"><input value={f.fir_no} onChange={(e) => set("fir_no", e.target.value)} className={inp} /></Field>
            <Field label="FIR Result">
              <select value={f.fir_result} onChange={(e) => set("fir_result", e.target.value)} className={inp}>
                <option value="">—</option>{FIR_RESULTS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
            <div className="col-span-2 md:col-span-4"><Field label="Note"><input value={f.note} onChange={(e) => set("note", e.target.value)} className={inp} placeholder="optional remarks" /></Field></div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button onClick={save} disabled={pending} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">{pending ? "Saving…" : "Save production update"}</button>
            {msg && <span className="text-xs text-red-600">{msg}</span>}
            <span className="text-[10px] text-muted-foreground">Weld Report or FIR entered here turns the QC stage green on the board.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

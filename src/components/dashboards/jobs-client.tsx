"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createJob } from "@/lib/ops-actions";
import { OPS_WIP_STAGES } from "@/lib/ops-constants";
import type { JobRow, QuoteOpt } from "@/data/ops";

const STATUS_CLS: Record<string, string> = {
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  wip: "bg-indigo-50 text-indigo-700 border-indigo-200",
  invoiced: "bg-red-50 text-red-700 border-red-200",
  active: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

export function JobsClient({ jobs, poCount, floorCount, quotes }: { jobs: JobRow[]; poCount: number; floorCount: number; quotes: QuoteOpt[] }) {
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const filtered = jobs.filter((j) => !q || `${j.customer} ${j.drawing_no} ${j.po_no} ${j.job_no} ${j.part}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground"><b className="text-foreground">{poCount}</b> PO-line jobs · <b className="text-foreground">{floorCount}</b> shop-floor jobs</div>
        <div className="flex items-center gap-2">
          <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 rounded-md border bg-background px-2 py-1 text-sm" />
          <button onClick={() => setShowForm((s) => !s)} className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">+ New Job</button>
        </div>
      </div>

      {showForm && <NewJobForm quotes={quotes} onDone={() => setShowForm(false)} />}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Source</th><th className="px-3 py-2 text-left">Customer</th><th className="px-3 py-2 text-left">Drawing / Part</th>
              <th className="px-3 py-2 text-left">Qty</th><th className="px-3 py-2 text-left">Stage</th><th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Quote</th><th className="px-3 py-2 text-left">PO / Job Card</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((j) => (
              <tr key={`${j.source}-${j.ref}`} className="border-t hover:bg-accent/30">
                <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${j.source === "floor" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-border bg-muted text-muted-foreground"}`}>{j.source === "floor" ? "Floor" : "PO line"}</span></td>
                <td className="px-3 py-2 text-xs">{j.customer ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{j.drawing_no ?? "—"}<div className="text-[10px] text-muted-foreground">{j.part ?? ""}</div></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{j.qty ?? "—"}</td>
                <td className="px-3 py-2 text-xs">{j.stage ? <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">{j.stage}</span> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2"><span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_CLS[j.status] ?? "bg-muted text-muted-foreground border-border"}`}>{j.status === "invoiced" ? "exception" : j.status}</span></td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{j.quote_no ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{j.po_no ?? j.job_no ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewJobForm({ quotes, onDone }: { quotes: QuoteOpt[]; onDone: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({ job_no: "", customer: "", drawing_no: "", part_desc: "", qty: "", quote_no: "", stage: "", note: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const inp = "w-full rounded border bg-background px-2 py-1 text-xs";
  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await createJob({ ...f, qty: f.qty ? Number(f.qty) : null });
      if (res.ok) { onDone(); router.refresh(); } else setMsg(res.error ?? "failed");
    });
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 text-sm font-semibold">New shop-floor job</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Field label="Job Card No"><input value={f.job_no} onChange={(e) => set("job_no", e.target.value)} className={inp} /></Field>
        <Field label="Customer *"><input value={f.customer} onChange={(e) => set("customer", e.target.value)} className={inp} /></Field>
        <Field label="Drawing *"><input value={f.drawing_no} onChange={(e) => set("drawing_no", e.target.value)} className={inp} /></Field>
        <Field label="Part"><input value={f.part_desc} onChange={(e) => set("part_desc", e.target.value)} className={inp} /></Field>
        <Field label="Qty"><input type="number" value={f.qty} onChange={(e) => set("qty", e.target.value)} className={inp} /></Field>
        <Field label="Quote No (internal key)">
          <select value={f.quote_no} onChange={(e) => set("quote_no", e.target.value)} className={inp}>
            <option value="">—</option>{quotes.map((qq) => <option key={qq.quote_no} value={qq.quote_no}>{qq.quote_no} · {qq.customer ?? ""}</option>)}
          </select>
        </Field>
        <Field label="Current stage">
          <select value={f.stage} onChange={(e) => set("stage", e.target.value)} className={inp}>
            <option value="">—</option>{OPS_WIP_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Note"><input value={f.note} onChange={(e) => set("note", e.target.value)} className={inp} /></Field>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={save} disabled={pending || !f.customer.trim() || !f.drawing_no.trim()} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">{pending ? "Creating…" : "Create job"}</button>
        <button onClick={onDone} className="text-xs text-muted-foreground hover:underline">cancel</button>
        {msg && <span className="text-xs text-red-600">{msg}</span>}
        <span className="text-[10px] text-muted-foreground">* required. The Quote No links this job to its order when the PO is captured.</span>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

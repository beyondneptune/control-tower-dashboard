"use client";

import { useState, useTransition } from "react";
import { confirmRfq } from "@/lib/ops-actions";
import type { RfqCandidate } from "@/data/ops";

// RFQ candidate-confirm: email PROPOSES an enquiry; a human vouches for it here →
// it becomes SSOT (ops_rfq) and the RFQ stage turns green. Each row is editable so
// any gap (missing customer / drawing / date) is filled before confirming — no gaps.
export function RfqConfirmClient({ candidates, confirmedCount }: { candidates: RfqCandidate[]; confirmedCount: number }) {
  const [rows, setRows] = useState(candidates);
  const [q, setQ] = useState("");
  const filtered = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {rows.length ? `${rows.length} RFQ ${rows.length === 1 ? "enquiry" : "enquiries"} from Arjun — confirm into the order book` : "No enquiry pending"} · <b className="text-foreground">{confirmedCount}</b> confirmed (SSOT) · newest first
        </div>
        <input type="search" placeholder="Search customer / drawing…" value={q} onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded-md border bg-background px-2 py-1 text-sm" />
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Customer *</th>
              <th className="px-3 py-2 text-left">Drawing * </th>
              <th className="px-3 py-2 text-left">Received *</th>
              <th className="px-3 py-2 text-left">Part</th>
              <th className="px-3 py-2 text-left">Qty</th>
              <th className="px-3 py-2 text-left">Evidence</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No new enquiries to confirm right now. New RFQs appear here as they arrive — historical ones stay pre-system, we don’t backfill the past.</td></tr>
            )}
            {filtered.map((c) => (
              <RfqRow key={c.id} c={c} onConfirmed={(id) => setRows((rs) => rs.filter((r) => r.id !== id))} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">* required — a row can’t be confirmed until Customer, Drawing and Received date are all present.</p>
    </div>
  );
}

function RfqRow({ c, onConfirmed }: { c: RfqCandidate; onConfirmed: (id: string) => void }) {
  const [customer, setCustomer] = useState(c.customer ?? "");
  const [drawing, setDrawing] = useState(c.drawing_no ?? "");
  const [date, setDate] = useState(c.received_date ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ready = customer.trim() && drawing.trim() && date.trim();
  const inp = "w-full rounded border bg-background px-1.5 py-1 text-xs";

  const confirm = () =>
    start(async () => {
      setMsg(null);
      const res = await confirmRfq({ rfq_no: c.rfq_no, customer, drawing_no: drawing, received_date: date, part: c.part, qty: c.qty, candidate_ref: c.email_message_id ?? c.rfq_no });
      if (res.ok) onConfirmed(c.id);
      else setMsg(res.error ?? "failed");
    });

  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2"><input className={inp} value={customer} onChange={(e) => setCustomer(e.target.value)} /></td>
      <td className="px-3 py-2"><input className={inp} value={drawing} onChange={(e) => setDrawing(e.target.value)} /></td>
      <td className="px-3 py-2"><input type="date" className={inp} value={date ?? ""} onChange={(e) => setDate(e.target.value)} /></td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{c.part ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{c.qty ?? "—"}</td>
      <td className="px-3 py-2 text-xs">
        <div className="flex flex-col gap-0.5">
          {c.drawing_has_file
            ? <a href={`/api/ops-evidence?drawing=${encodeURIComponent(drawing)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">📄 View drawing</a>
            : <span className="text-muted-foreground">no drawing on file</span>}
          {c.email_message_id
            ? <a href={`/api/ops-evidence?email=${encodeURIComponent(c.email_message_id)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline" title={`${c.email_from ?? ""}${c.email_subject ? " · " + c.email_subject : ""}`}>✉ View email</a>
            : <span className="text-[10px] text-muted-foreground" title={c.chain_evidence ?? ""}>✉ {c.received_through ?? "enquiry"}</span>}
          {c.email_subject && <span className="max-w-[170px] truncate text-[9px] text-muted-foreground" title={c.email_subject}>{c.email_subject}</span>}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={confirm} disabled={pending || !ready}
          className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40">
          {pending ? "…" : "Confirm"}
        </button>
        {msg && <div className="mt-1 text-[10px] text-red-600">{msg}</div>}
      </td>
    </tr>
  );
}

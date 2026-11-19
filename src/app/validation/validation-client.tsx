"use client";
import { useState, useTransition } from "react";
import { confirmLink } from "./actions";

export interface Candidate {
  po_no: string;
  line_no: number;
  customer: string | null;
  part: string | null;
  drawing_no: string | null;
  line_value: number | null;
  po_date: string | null;
  thread_stage: string | null;
  suggested_quotes: string | null;
  match_basis: string | null; // 'drawing' | 'rate' | 'ambiguous' | 'none'
  note: string | null; // finding for no-quote lines (e.g. produced & billed → repeat order)
}

// Extract the quote number from a suggestion string regardless of trailing
// annotations like " — ₹417595 ✓cost" or "(date)" — preserves a "Rev01" suffix (M-18).
const firstQuote = (s: string | null) => {
  if (!s) return null;
  const m = s.split("·")[0].match(/[A-Z]{2,}\/\d{4}-\d{2}\/\d+(?:\s*Rev\d+)?/i);
  return m ? m[0].replace(/\s+/g, " ").trim() : null;
};
const fmt = (n: number | null) => (n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN"));

// Inline document evidence — renders PDF pages as images by document number.
function EvidencePages({ docno, label }: { docno: string; label: string }) {
  const [maxPage, setMaxPage] = useState(1);
  return (
    <div className="flex-1">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{label}: <span className="font-mono">{docno}</span></div>
      <div className="max-h-[520px] space-y-2 overflow-y-auto rounded border bg-white p-2">
        {Array.from({ length: maxPage }, (_, i) => i + 1).map((n) => (
          <img
            key={n}
            src={`/api/evidence/doc?docno=${encodeURIComponent(docno)}&page=${n}`}
            alt={`${docno} p${n}`}
            className="mx-auto w-full max-w-[640px] rounded border"
            onLoad={() => { if (n === maxPage && maxPage < 20) setMaxPage(maxPage + 1); }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ))}
      </div>
    </div>
  );
}

export function ValidationQueue({ rows }: { rows: Candidate[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Order line</th>
            <th className="px-3 py-2 text-left font-medium">Part / drawing</th>
            <th className="px-3 py-2 text-right font-medium">Value</th>
            <th className="px-3 py-2 text-left font-medium">CT suggests</th>
            <th className="px-3 py-2 text-left font-medium">Confirm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => <Row key={r.po_no + ":" + r.line_no} r={r} />)}
        </tbody>
      </table>
    </div>
  );
}

function Row({ r }: { r: Candidate }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [show, setShow] = useState(false);
  const suggested = firstQuote(r.suggested_quotes);

  function act(resolution: "linked" | "no_quote_direct_order" | "order_complete", quote?: string | null) {
    start(async () => {
      await confirmLink({ po_no: r.po_no, po_line: r.line_no, quote_no: quote ?? null, resolution });
      setDone(resolution === "linked" ? "linked ✓" : resolution === "order_complete" ? "closed ✓" : "direct order ✓");
    });
  }

  return (
    <>
    <tr className={`border-t ${done ? "opacity-50" : ""}`}>
      <td className="whitespace-nowrap px-3 py-2">
        <div className="font-medium">PO {r.po_no} · L{r.line_no}</div>
        <div className="text-xs text-muted-foreground">{r.customer} · {r.po_date}</div>
        <button onClick={() => setShow((v) => !v)} className="mt-1 rounded border px-2 py-0.5 text-[11px] hover:bg-muted">{show ? "Hide evidence ▴" : "View evidence ▾"}</button>
      </td>
      <td className="px-3 py-2">{r.part} <span className="font-mono text-xs text-muted-foreground">{r.drawing_no}</span></td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(r.line_value)}</td>
      <td className="px-3 py-2">
        {r.suggested_quotes ? (
          <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-400">
            {r.suggested_quotes}
          </span>
        ) : (
          <span className="block max-w-[420px] text-xs text-muted-foreground">
            {r.note ?? "no quote found in any record"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        {done ? (
          <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">{done}</span>
        ) : (
          <div className="flex items-center gap-1">
            {suggested && (
              <button onClick={() => act("linked", suggested)} disabled={pending}
                className="rounded bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700">Confirm {suggested.split("/").pop()}</button>
            )}
            <input value={pick} onChange={(e) => setPick(e.target.value)} placeholder="other quote no"
              className="w-28 rounded-md border bg-background px-2 py-1 text-xs" />
            {pick && (
              <button onClick={() => act("linked", pick)} disabled={pending}
                className="rounded border px-2 py-1 text-xs hover:bg-muted">Link</button>
            )}
            <button onClick={() => act("no_quote_direct_order")} disabled={pending}
              className="rounded border px-2 py-1 text-xs hover:bg-muted" title="No quotation — direct order">Direct</button>
            <button onClick={() => act("order_complete")} disabled={pending}
              className="rounded border px-2 py-1 text-xs hover:bg-muted" title="Old order already completed — close it">Close old</button>
          </div>
        )}
      </td>
    </tr>
    {show && (
      <tr className="border-t bg-muted/20">
        <td colSpan={5} className="p-3">
          <div className="flex flex-col gap-3 md:flex-row">
            <EvidencePages docno={r.po_no} label="Customer PO" />
            {suggested && <EvidencePages docno={suggested} label="Suggested quote (confirm this is the right part)" />}
          </div>
        </td>
      </tr>
    )}
    </>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { linkQuoteToPo } from "@/lib/ops-actions";
import type { PoQuoteGroup, PoQuoteLine, QuoteOpt } from "@/data/ops";
import { formatINRCompact, formatDate } from "@/lib/format";

// Per-LINE quote↔PO bridge. A quote is per-part, so each PO line is matched to its
// quotation by the DRAWING printed on both the PO and the quote (a hard content match,
// not a guess). Rahul opens both documents, reverifies the drawing, and confirms.
// The confirmed link lives in ops_line_quote_link and survives every re-ingestion.
export function LinkQuotesClient({ groups, quotes, stats }: { groups: PoQuoteGroup[]; quotes: QuoteOpt[]; stats: { pos: number; lines: number; linked: number; auto: number; unmatched: number } }) {
  const [q, setQ] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const filtered = useMemo(() =>
    groups.filter((g) => {
      if (onlyPending && g.linked === g.total) return false;
      if (!q) return true;
      const hay = `${g.customer} ${g.po_no} ${g.lines.map((l) => `${l.drawing_no} ${l.auto_quote}`).join(" ")}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    }), [groups, q, onlyPending]);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          <b className="text-foreground">{stats.linked}</b> of {stats.lines} PO lines confirmed ·{" "}
          <span className="text-amber-600">{stats.auto} drawing-matched, awaiting reverify</span> ·{" "}
          <span className="text-muted-foreground">{stats.unmatched} no quote found</span> · across {stats.pos} POs
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> only unconfirmed</label>
          <input type="search" placeholder="Search PO / customer / drawing / quote…" value={q} onChange={(e) => setQ(e.target.value)} className="w-60 rounded-md border bg-background px-2 py-1 text-sm" />
        </div>
      </div>
      <div className="space-y-3">
        {filtered.map((g) => <PoCard key={g.po_no} g={g} quotes={quotes} />)}
        {filtered.length === 0 && <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground">Nothing to show.</div>}
      </div>
    </div>
  );
}

function PoCard({ g, quotes }: { g: PoQuoteGroup; quotes: QuoteOpt[] }) {
  const done = g.linked === g.total;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">PO {g.po_no}</span>
          <span className="text-muted-foreground">· {g.customer ?? "—"}{g.entity ? ` (${g.entity})` : ""}</span>
          <span className="text-xs text-muted-foreground">· {g.po_date ? formatDate(g.po_date) : "—"}</span>
          <a href={`/api/ops-evidence?po=${encodeURIComponent(g.po_no)}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">📄 View PO</a>
        </div>
        <div className="text-xs">
          {done ? <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-600">✓ all {g.total} lines confirmed</span>
                : <span className="rounded bg-amber-500/15 px-2 py-0.5 font-medium text-amber-600">{g.linked}/{g.total} confirmed</span>}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/20 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-1.5 text-left">Line</th><th className="px-3 py-1.5 text-left">Drawing</th>
            <th className="px-3 py-1.5 text-left">Part</th><th className="px-3 py-1.5 text-left">Quote (drawing-matched)</th>
            <th className="px-3 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {g.lines.map((l) => <LineRow key={l.line_no} l={l} quotes={quotes} />)}
        </tbody>
      </table>
    </div>
  );
}

function LineRow({ l, quotes }: { l: PoQuoteLine; quotes: QuoteOpt[] }) {
  const initial = l.linked_quote ?? l.auto_quote ?? "";
  const [sel, setSel] = useState(initial);
  const [confirmed, setConfirmed] = useState(!!l.linked_quote);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await linkQuoteToPo({ po_no: l.po_no, line_no: l.line_no, quote_no: sel });
      if (res.ok) setConfirmed(!!sel); else setMsg(res.error ?? "failed");
    });
  const multi = l.candidates.length > 1;
  const isAuto = !l.linked_quote && !!l.auto_quote;
  return (
    <tr className="border-t align-top">
      <td className="px-3 py-2 text-xs text-muted-foreground">{l.line_no}</td>
      <td className="px-3 py-2 font-medium">{l.drawing_no ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{l.part_desc ?? "—"}</td>
      <td className="px-3 py-2">
        <select value={sel} onChange={(e) => { setSel(e.target.value); setConfirmed(false); }} className="w-72 rounded border bg-background px-1.5 py-1 text-xs">
          <option value="">— no quote (leave unmatched) —</option>
          {/* drawing-matched candidates first (what actually covers this drawing) */}
          {l.candidates.length > 0 && (
            <optgroup label="matches this drawing">
              {l.candidates.map((c) => <option key={c.quote_no} value={c.quote_no}>{c.quote_no}{c.quote_date ? ` · ${formatDate(c.quote_date)}` : ""}{c.total_value ? ` · ${formatINRCompact(c.total_value)}` : ""}{c.before_po ? "" : " · (after PO)"}</option>)}
            </optgroup>
          )}
          <optgroup label="all quotes (override)">
            {quotes.map((qq) => <option key={qq.quote_no} value={qq.quote_no}>{qq.quote_no} · {qq.customer ?? ""}{qq.quote_date ? ` · ${formatDate(qq.quote_date)}` : ""}{qq.total_value ? ` · ${formatINRCompact(qq.total_value)}` : ""}</option>)}
          </optgroup>
        </select>
        <div className="mt-0.5 text-[10px]">
          {l.linked_quote ? <span className="text-emerald-600">confirmed{l.linked_by ? ` by ${l.linked_by}` : ""}</span>
            : isAuto ? <span className="text-amber-600">drawing-matched: {l.auto_quote}{multi ? ` · ${l.candidates.length} candidates — pick the right revision` : ""} — open both to reverify</span>
            : <span className="text-muted-foreground">no quote covers this drawing (may be unquoted / pending — leave as-is)</span>}
        </div>
        {sel && <div className="mt-1 flex flex-wrap gap-2 text-[10px]">
          <a href={`/api/ops-evidence?quote=${encodeURIComponent(sel)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">📄 View quote {sel}</a>
          {l.drawing_no && <a href={`/api/ops-evidence?drawing=${encodeURIComponent(l.drawing_no)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">📐 View drawing</a>}
        </div>}
        {msg && <div className="mt-1 text-[10px] text-red-600">{msg}</div>}
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={save} disabled={pending || sel === (l.linked_quote ?? "")} className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
          {pending ? "…" : confirmed ? "✓ Confirmed" : sel ? "Confirm" : "Clear"}
        </button>
      </td>
    </tr>
  );
}

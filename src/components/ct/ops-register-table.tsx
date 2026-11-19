"use client";

import { useState } from "react";
import { basename } from "@/lib/basename";
import { formatINR, formatDate } from "@/lib/format";
import type { OpsRegister, OpsCol } from "@/lib/ops-registers";

const STATE_CLS: Record<string, string> = {
  complete: "bg-emerald-50 text-emerald-700 border-emerald-200",
  wip: "bg-indigo-50 text-indigo-700 border-indigo-200",
  invoiced: "bg-red-50 text-red-700 border-red-200",
};

function cell(v: unknown, col: OpsCol) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  switch (col.type) {
    case "date": return formatDate(String(v));
    case "money": return formatINR(Number(v), "full");
    case "num": return <span className="tabular-nums">{String(v)}</span>;
    case "bool": return v ? <span className="text-emerald-600">✓</span> : <span className="text-muted-foreground">—</span>;
    case "file": return <span className="truncate text-xs text-muted-foreground" title={String(v)}>{basename(String(v))}</span>;
    case "state": {
      const s = String(v);
      return <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${STATE_CLS[s] ?? "bg-muted text-muted-foreground border-border"}`}>{s === "invoiced" ? "exception" : s}</span>;
    }
    default: return String(v);
  }
}

export function OpsRegisterTable({ register, rows }: { register: OpsRegister; rows: Record<string, unknown>[] }) {
  const [q, setQ] = useState("");
  const cols = register.columns;
  const filtered = rows.filter((r) => !q || JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64 rounded-md border bg-background px-2 py-1 text-sm" />
        <div className="text-xs text-muted-foreground">{filtered.length} of {rows.length} rows · SSOT only</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>{cols.map((c) => <th key={c.field} className="px-3 py-2 text-left font-medium">{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={cols.length} className="p-6 text-center text-muted-foreground">No records yet — this register fills as its source documents land.</td></tr>}
            {filtered.map((r, i) => (
              <tr key={i} className="border-t hover:bg-accent/30">
                {cols.map((c) => <td key={c.field} className="max-w-[220px] truncate px-3 py-2">{cell(r[c.field], c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

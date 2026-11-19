"use client";

import Link from "next/link";
import { useState } from "react";
import type { CtRegister } from "@/lib/ct-registers";

interface Props {
  register: CtRegister;
  rows: Record<string, unknown>[];
  customerNameById?: Record<string, string>;
  vendorNameById?: Record<string, string>;
  /** Pre-fill the search box (e.g. deep-linked from the Order Flow tab with ?q=<doc-no>). */
  initialSearch?: string;
}

// Friendly labels + colours for the `source_label` provenance column. Records reconstructed
// by a backfill (e.g. RFQ rows inferred from customer POs) are visually distinct from rows a
// human captured through the Control Tower form, so derived scaffolding is never mistaken for
// a real captured document.
const SOURCE_META: Record<string, { label: string; cls: string }> = {
  inferred_from_email_chain: { label: "Enquiry chain", cls: "bg-blue-100 text-blue-800 ring-1 ring-blue-200" },
  inferred_from_po: { label: "Inferred from PO", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200" },
  control_tower_form: { label: "Form entry", cls: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200" },
  wave1_backfill: { label: "Backfill", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200" },
};
function sourceMeta(raw: string) {
  return SOURCE_META[raw] ?? { label: raw, cls: "bg-muted text-muted-foreground ring-1 ring-border" };
}

export function RegisterTable({ register, rows, customerNameById, vendorNameById, initialSearch }: Props) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [sourceFilter, setSourceFilter] = useState("");
  const cols = register.tableColumns;

  // Source filter — only for registers that surface the provenance column (e.g. RFQ).
  const hasSource = cols.includes("source_label");
  const sourceOptions = hasSource
    ? Array.from(new Set(rows.map((r) => String(r.source_label ?? "")).filter(Boolean))).sort()
    : [];

  const filtered = rows.filter((r) => {
    if (sourceFilter && String(r.source_label ?? "") !== sourceFilter) return false;
    if (!search) return true;
    const blob = JSON.stringify(r).toLowerCase();
    return blob.includes(search.toLowerCase());
  });
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 rounded-md border bg-background px-2 py-1 text-sm"
          />
          {hasSource && sourceOptions.length > 1 && (
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-md border bg-background px-2 py-1 text-sm"
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {sourceOptions.map((s) => (
                <option key={s} value={s}>
                  {sourceMeta(s).label}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {filtered.length} of {rows.length} rows
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {cols.map((c) => (
                <th key={c} className="px-3 py-2 text-left font-medium">
                  {register.fields.find((f) => f.name === c)?.label ?? c}
                </th>
              ))}
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={cols.length + 1} className="p-6 text-center text-sm text-muted-foreground">
                  No records yet. Use “New” above to add the first one.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={String(r.id)} className="border-t hover:bg-accent/30">
                {cols.map((c) => (
                  <td key={c} className="px-3 py-2">
                    {renderCell(r, c, customerNameById, vendorNameById)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <Link
                    href={`/registers/${register.key}/${r.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function renderCell(
  row: Record<string, unknown>,
  col: string,
  customerNameById?: Record<string, string>,
  vendorNameById?: Record<string, string>,
) {
  const v = row[col];
  // Customer columns: registers list either "customer_id" or the denormalised
  // "customer_name". Resolve both via the customer_id → name lookup so a saved
  // customer never shows as "—".
  if (col === "customer_id" || col === "customer_name") {
    const id = String(row.customer_id ?? "");
    return (row.customer_name as string) || customerNameById?.[id] || "—";
  }
  if (col === "vendor_id" || col === "vendor_name") {
    const id = String(row.vendor_id ?? "");
    return (row.vendor_name as string) || vendorNameById?.[id] || "—";
  }
  // Provenance badge: distinguish backfill-derived rows from human-captured ones.
  if (col === "source_label") {
    const raw = String(v ?? "");
    if (!raw) return "—";
    const meta = sourceMeta(raw);
    return (
      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${meta.cls}`}>
        {meta.label}
      </span>
    );
  }
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
    return new Date(v).toLocaleString();
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

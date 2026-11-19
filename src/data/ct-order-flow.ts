/**
 * Order Flow (digital-thread pipeline) data loader.
 *
 * Reads the presentation view `v_ct_order_flow` (see migration 0052) — one row per
 * order-anchor scored across the 8 lifecycle stages RFQ→Quote→BOM→PO→Job→QC→Dispatch→Invoice —
 * and derives the gap summary that drives the Operations "Order Flow" tab.
 *
 * Presentation-only. Every field is hard-evidence from the view; nothing is inferred here.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type OrderKind = "po_line" | "rfq_open" | "invoice_orphan";
export type LinkState = "complete" | "partial" | "weak" | "wip";

export interface OrderFlowRow {
  flow_key: string;
  kind: OrderKind;
  customer: string | null;
  drawing_no: string | null;
  part: string | null;
  qty: number | null;
  value: number | null;
  rfq_no: string | null;
  rfq_date: string | null;
  quote_no: string | null;
  quote_date: string | null;
  bom_ref: string | null;
  bom_margin_pct: number | null;
  bom_date: string | null;
  po_no: string | null;
  po_line: number | null;
  po_date: string | null;
  job_code: string | null;
  job_date: string | null;
  qc_ref: string | null;
  qc_result: string | null;
  qc_date: string | null;
  dispatch_no: string | null;
  dispatch_date: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  billed: number | null;
  outstanding: number | null;
  max_overdue: number | null;
  collection: string | null;
  thread_stage: string | null;
  present_rfq: boolean;
  present_quote: boolean;
  present_bom: boolean;
  present_po: boolean;
  present_job: boolean;
  present_qc: boolean;
  present_dispatch: boolean;
  present_invoice: boolean;
  is_wip: boolean;
  sort_date: string | null;
  first_date: string | null;
  connected_count: number;
  reached_idx: number;
  expected_count: number;
  broken_links: number;
  link_state: LinkState;
}

export interface StageCoverage {
  key: string;
  label: string;
  present: number; // among captured PO-line orders
}

export interface OrderFlowSummary {
  total: number;
  poLines: number;
  openRfqs: number;
  orphanInvoices: number;
  complete: number;
  partial: number;
  weak: number;
  wip: number;
  needsBridging: number; // rows with a gap BEHIND the furthest stage reached
  // gap headlines (over captured PO-line orders)
  poWithoutRfqLink: number; // no RFQ even by drawing match
  poWithoutQuote: number;
  poWithoutBom: number;
  poWithoutJob: number;
  producedNotInvoiced: number;
  invoicedWithoutDispatch: number;
  stageCoverage: StageCoverage[];
  bookValue: number; // sum of captured PO-line value
}

const STAGE_LABELS: { key: string; label: string; flag: keyof OrderFlowRow }[] = [
  { key: "rfq", label: "RFQ", flag: "present_rfq" },
  { key: "bom", label: "BOM", flag: "present_bom" },
  { key: "quote", label: "Quote", flag: "present_quote" },
  { key: "po", label: "PO", flag: "present_po" },
  { key: "job", label: "Job", flag: "present_job" },
  { key: "qc", label: "QC", flag: "present_qc" },
  { key: "dispatch", label: "Dispatch", flag: "present_dispatch" },
  { key: "invoice", label: "Invoice", flag: "present_invoice" },
];

export interface OrderFlowData {
  rows: OrderFlowRow[];
  summary: OrderFlowSummary;
  since: string;
  asAt: string;
}

/**
 * Load the pipeline. `since` filters on the earliest activity date on each order
 * (default 1-Apr-2026, the FY start the MD asked for). Open enquiries with no dates
 * are kept — they are the live front of the funnel.
 */
export async function getOrderFlow(since = "2026-04-01"): Promise<OrderFlowData> {
  const sb = createAdminClient();
  const { data, error } = await sb
    .from("v_ct_order_flow")
    .select("*")
    .order("first_date", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) throw new Error(`v_ct_order_flow read failed: ${error.message}`);

  const all = (data ?? []) as OrderFlowRow[];
  const rows = all.filter((r) => !r.first_date || r.first_date >= since);

  const po = rows.filter((r) => r.kind === "po_line");
  const summary: OrderFlowSummary = {
    total: rows.length,
    poLines: po.length,
    openRfqs: rows.filter((r) => r.kind === "rfq_open").length,
    orphanInvoices: rows.filter((r) => r.kind === "invoice_orphan").length,
    complete: rows.filter((r) => r.link_state === "complete").length,
    partial: rows.filter((r) => r.link_state === "partial").length,
    weak: rows.filter((r) => r.link_state === "weak").length,
    wip: rows.filter((r) => r.link_state === "wip").length,
    needsBridging: rows.filter((r) => r.broken_links > 0).length,
    poWithoutRfqLink: po.filter((r) => !r.present_rfq).length,
    poWithoutQuote: po.filter((r) => !r.present_quote).length,
    poWithoutBom: po.filter((r) => !r.present_bom).length,
    poWithoutJob: po.filter((r) => !r.present_job).length,
    producedNotInvoiced: po.filter((r) => r.present_job && !r.present_invoice).length,
    invoicedWithoutDispatch: po.filter((r) => r.present_invoice && !r.present_dispatch).length,
    stageCoverage: STAGE_LABELS.map((s) => ({
      key: s.key,
      label: s.label,
      present: po.filter((r) => r[s.flag] === true).length,
    })),
    bookValue: po.reduce((a, r) => a + (Number(r.value) || 0), 0),
  };

  return { rows, summary, since, asAt: new Date().toISOString() };
}

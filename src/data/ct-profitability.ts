/**
 * Job-profitability loader — STANDARD margin (quoted PO price vs BOM standard cost).
 *
 * Truth rules (CLAUDE.md §7, §2):
 *   • Revenue = PO line value excl GST (qty × rate), corroborated by line_value.
 *   • Cost   = BOM STANDARD cost (powder + gas + process + machine). NOT actual —
 *     there is no shop-floor capture, so this is the *standard* margin, never a
 *     claimed realised margin.
 *   • Cost is confident-or-blank: assigned only when the drawing resolves to a
 *     single BOM cost, or a multi-variant drawing is disambiguated by part_size.
 *     Otherwise the job is "data required" — never a guessed number.
 *   • Implausible margins (< −40%) are flagged "verify", not asserted as losses.
 *
 * Reads v_ct_job_profitability (161 PO-line work packages, one row each, no fan-out).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type CostBasis = "bom_confirmed" | "bom_size_matched" | "bom_ambiguous" | "no_bom";
export type MarginBand = "ok" | "thin" | "loss" | "anomaly_verify" | "data_required";

export interface JobProfitRow {
  poNo: string;
  lineNo: number;
  customer: string | null;
  drawingNo: string | null;
  partType: string | null;
  partSize: string | null;
  partDesc: string | null;
  qty: number;
  poRate: number;
  costBasis: CostBasis;
  bomFile: string | null;
  revenue: number;
  stdCostPp: number | null;
  stdCostTotal: number | null;
  stdMarginValue: number | null;
  stdMarginPct: number | null;
  powderPp: number | null;
  gasCost: number | null;
  machineMin: number | null;
  processPp: number | null;
  dispatched: boolean;
  dispatchDate: string | null;
  invoiced: boolean;
  marginBand: MarginBand;
}

export interface JobProfitData {
  generatedAt: string;
  rows: JobProfitRow[];
  summary: {
    totalLines: number;
    totalOrderRevenue: number;
    costedLines: number;
    // reliable = ok | thin | loss (a trustworthy standard margin)
    reliableCount: number;
    reliableRevenue: number;
    reliableMargin: number;
    avgPctReliable: number | null;
    anomalyCount: number;
    anomalyRevenue: number;
    dataRequiredCount: number;
    dataRequiredRevenue: number;
    lossCount: number;
    thinCount: number;
    // realised = already dispatched (the loss/anomaly is real money, not a projection)
    realisedLossCount: number;
    realisedLossValue: number;
  };
  bands: { band: MarginBand; count: number }[];
}

const RELIABLE: MarginBand[] = ["ok", "thin", "loss"];

export async function loadJobProfitability(): Promise<JobProfitData> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("v_ct_job_profitability")
    .select("*")
    .order("revenue", { ascending: false });

  if (error) throw new Error(`v_ct_job_profitability read failed: ${error.message}`);

  const rows: JobProfitRow[] = (data ?? []).map((r) => ({
    poNo: r.po_no,
    lineNo: r.line_no,
    customer: r.customer,
    drawingNo: r.drawing_no,
    partType: r.part_type,
    partSize: r.part_size,
    partDesc: r.part_desc,
    qty: Number(r.qty),
    poRate: Number(r.po_rate),
    costBasis: r.cost_basis as CostBasis,
    bomFile: r.bom_file,
    revenue: Number(r.revenue),
    stdCostPp: r.std_cost_pp == null ? null : Number(r.std_cost_pp),
    stdCostTotal: r.std_cost_total == null ? null : Number(r.std_cost_total),
    stdMarginValue: r.std_margin_value == null ? null : Number(r.std_margin_value),
    stdMarginPct: r.std_margin_pct == null ? null : Number(r.std_margin_pct),
    powderPp: r.powder_pp == null ? null : Number(r.powder_pp),
    gasCost: r.gas_cost == null ? null : Number(r.gas_cost),
    machineMin: r.machine_min == null ? null : Number(r.machine_min),
    processPp: r.process_pp == null ? null : Number(r.process_pp),
    dispatched: Boolean(r.dispatched),
    dispatchDate: r.dispatch_date,
    invoiced: Boolean(r.invoiced),
    marginBand: r.margin_band as MarginBand,
  }));

  const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  const reliable = rows.filter((r) => RELIABLE.includes(r.marginBand));
  const anomaly = rows.filter((r) => r.marginBand === "anomaly_verify");
  const dataReq = rows.filter((r) => r.marginBand === "data_required");
  const reliablePcts = reliable.map((r) => r.stdMarginPct).filter((p): p is number => p !== null);
  // realised loss = work already dispatched whose price is below standard cost
  const realisedLoss = rows.filter(
    (r) => r.dispatched && r.stdMarginValue !== null && r.stdMarginValue < 0,
  );

  const bandOrder: MarginBand[] = ["ok", "thin", "loss", "anomaly_verify", "data_required"];
  const bands = bandOrder.map((band) => ({
    band,
    count: rows.filter((r) => r.marginBand === band).length,
  }));

  return {
    generatedAt: new Date().toISOString(),
    rows,
    summary: {
      totalLines: rows.length,
      totalOrderRevenue: sum(rows.map((r) => r.revenue)),
      costedLines: rows.filter((r) => r.stdCostPp !== null).length,
      reliableCount: reliable.length,
      reliableRevenue: sum(reliable.map((r) => r.revenue)),
      reliableMargin: sum(reliable.map((r) => r.stdMarginValue ?? 0)),
      avgPctReliable: reliablePcts.length ? sum(reliablePcts) / reliablePcts.length : null,
      anomalyCount: anomaly.length,
      anomalyRevenue: sum(anomaly.map((r) => r.revenue)),
      dataRequiredCount: dataReq.length,
      dataRequiredRevenue: sum(dataReq.map((r) => r.revenue)),
      lossCount: rows.filter((r) => r.marginBand === "loss").length,
      thinCount: rows.filter((r) => r.marginBand === "thin").length,
      realisedLossCount: realisedLoss.length,
      realisedLossValue: sum(realisedLoss.map((r) => r.stdMarginValue ?? 0)),
    },
    bands,
  };
}

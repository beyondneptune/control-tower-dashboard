/**
 * Job profitability.
 *
 * Margin ₹ = revenue − actual cost.  Margin % = margin / revenue.
 *
 * CRITICAL RULE: actual cost is built from components typed `number | null`.
 * A `null` component means "data required" — NOT zero. If ANY component is
 * unknown, the actual cost is unknown and the result is `data-required`. We
 * never silently treat unknown as 0, because that would invent a 100%-margin
 * job out of an un-costed one.
 */

import type { MarginBand } from "../types";

/** Cost components for one job. `null` = unknown (data required); `0` = a known zero. */
export interface JobCostBreakdown {
  material: number | null;
  purchases: number | null;
  labour: number | null;
  machine: number | null;
  power: number | null;
  jobwork: number | null;
  rework: number | null;
  logistics: number | null;
}

export interface MarginResult {
  revenue: number | null;
  actualCost: number | null;
  marginValue: number | null;
  marginPercent: number | null;
  band: MarginBand;
  /** True when revenue or any cost component is unknown. */
  incomplete: boolean;
  /** Names of the unknown cost components, for the "data required" UI. */
  missingComponents: (keyof JobCostBreakdown)[];
}

const COST_KEYS: (keyof JobCostBreakdown)[] = [
  "material",
  "purchases",
  "labour",
  "machine",
  "power",
  "jobwork",
  "rework",
  "logistics",
];

/** Map a margin percentage to a traffic-light band. */
export function marginBand(percent: number): Exclude<MarginBand, "data-required"> {
  if (percent < 0) return "dark-red";
  if (percent < 10) return "red";
  if (percent < 20) return "amber";
  if (percent <= 30) return "light-green";
  return "green";
}

/**
 * Compute a job's margin. `revenue` is the invoice taxable value (or null if
 * not yet invoiced). Returns `data-required` whenever revenue or any cost
 * component is unknown.
 */
export function computeMargin(revenue: number | null, costs: JobCostBreakdown): MarginResult {
  const missingComponents = COST_KEYS.filter((k) => costs[k] === null);
  const costIncomplete = missingComponents.length > 0;
  const revenueUnknown = revenue === null;
  const incomplete = costIncomplete || revenueUnknown;

  const actualCost = costIncomplete
    ? null
    : COST_KEYS.reduce((sum, k) => sum + (costs[k] as number), 0);

  const marginValue = revenue !== null && actualCost !== null ? revenue - actualCost : null;

  // Percent is undefined when revenue is unknown or zero (can't divide by zero).
  const marginPercent =
    marginValue !== null && revenue !== null && revenue !== 0 ? (marginValue / revenue) * 100 : null;

  let band: MarginBand;
  if (marginPercent !== null) {
    band = marginBand(marginPercent);
  } else if (marginValue !== null && marginValue < 0) {
    // Zero-revenue job carrying real cost is a confirmed loss.
    band = "dark-red";
  } else {
    band = "data-required";
  }

  return { revenue, actualCost, marginValue, marginPercent, band, incomplete, missingComponents };
}

export const MARGIN_BAND_LABEL: Record<MarginBand, string> = {
  green: "Healthy (>30%)",
  "light-green": "Acceptable (20–30%)",
  amber: "Thin (10–20%)",
  red: "Critical (<10%)",
  "dark-red": "Negative margin",
  "data-required": "Data required",
};

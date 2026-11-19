import { format as formatDateFns, parseISO, isValid } from "date-fns";

/**
 * Indian currency, number, and date formatting.
 *
 * Currency uses the Indian numbering system (lakh = 1,00,000, crore =
 * 1,00,00,000) and the en-IN locale for digit grouping. Dates render as
 * DD-MMM-YYYY per the company standard (e.g. 31-May-2026).
 *
 * A `null` / `undefined` / `NaN` input renders as the em-dash "—" rather than
 * "₹0" — because in this system "unknown" must never be displayed as zero.
 */

export type INRStyle = "compact" | "full";

const enIN0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** True when a value should render as "—" (unknown / data required). */
function isBlank(v: number | null | undefined): v is null | undefined {
  return v === null || v === undefined || Number.isNaN(v as number);
}

/** Format rupees. `compact` → ₹2.67 Cr / ₹45.30 L / ₹12,500; `full` → ₹26,70,000. */
export function formatINR(amount: number | null | undefined, style: INRStyle = "compact"): string {
  if (isBlank(amount)) return "—";
  return style === "full" ? formatINRFull(amount) : formatINRCompact(amount);
}

/** Full Indian-grouped rupee value: ₹26,70,000 (negatives → -₹…). */
export function formatINRFull(amount: number): string {
  if (isBlank(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  return `${sign}₹${enIN0.format(Math.abs(Math.round(amount)))}`;
}

/** Compact crore/lakh abbreviation: ₹2.67 Cr, ₹45.30 L, else grouped rupees. */
export function formatINRCompact(amount: number): string {
  if (isBlank(amount)) return "—";
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return `${sign}₹${enIN0.format(Math.round(abs))}`;
}

/** Plain Indian-grouped number, no symbol. */
export function formatNumberIN(n: number | null | undefined, decimals = 0): string {
  if (isBlank(n)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

/** Percentage with one decimal. Pass the percent value (23.4), not the ratio (0.234). */
export function formatPercent(pct: number | null | undefined, decimals = 1): string {
  if (isBlank(pct)) return "—";
  return `${pct.toFixed(decimals)}%`;
}

/** DD-MMM-YYYY, e.g. 31-May-2026. Accepts a Date or ISO string. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(d)) return "—";
  return formatDateFns(d, "dd-MMM-yyyy");
}

/** Whole days between two dates (b - a), floored. Negative if b is before a. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? parseISO(a) : a;
  const db = typeof b === "string" ? parseISO(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86_400_000);
}

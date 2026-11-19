/**
 * Visual status mapping — the one place RAG severity and margin bands translate
 * into Tailwind classes (driven by the design tokens) and Recharts colors.
 *
 * Recharts gets hex values (SVG fill attributes don't resolve CSS `var()`),
 * while component classes use the semantic token utilities (bg-success, etc.).
 */

import type { MarginBand, Severity } from "@/domain/types";

export type StatusTone = "success" | "warning" | "danger" | "neutral" | "info";

export const toneClasses: Record<StatusTone, { dot: string; pill: string; text: string; bar: string }> = {
  success: { dot: "bg-success", pill: "bg-success-soft text-success border border-success/25", text: "text-success", bar: "bg-success" },
  warning: { dot: "bg-warning", pill: "bg-warning-soft text-amber-700 dark:text-amber-300 border border-warning/35", text: "text-amber-700 dark:text-amber-300", bar: "bg-warning" },
  danger: { dot: "bg-danger", pill: "bg-danger-soft text-danger border border-danger/25", text: "text-danger", bar: "bg-danger" },
  neutral: { dot: "bg-muted-foreground/60", pill: "bg-muted text-muted-foreground border border-border", text: "text-muted-foreground", bar: "bg-muted-foreground/50" },
  info: { dot: "bg-chart-1", pill: "bg-chart-1/10 text-chart-1 border border-chart-1/25", text: "text-chart-1", bar: "bg-chart-1" },
};

export const severityTone: Record<Severity, StatusTone> = {
  red: "danger",
  amber: "warning",
  green: "success",
};

export const marginBandTone: Record<MarginBand, StatusTone> = {
  green: "success",
  "light-green": "success",
  amber: "warning",
  red: "danger",
  "dark-red": "danger",
  "data-required": "neutral",
};

/** Hex palette for Recharts, aligned to the CSS token hues. */
export const chartColors = {
  c1: "#3b82f6", // blue
  c2: "#14b8a6", // teal
  c3: "#f59e0b", // amber
  c4: "#dc2626", // red
  c5: "#16a34a", // green
  indigo: "#6366f1",
  slate: "#64748b",
  success: "#16a34a",
  warning: "#f59e0b",
  danger: "#dc2626",
} as const;

/** Colors keyed by payment priority for the payables chart. */
export const priorityColors: Record<string, string> = {
  P1: "#dc2626",
  P2: "#ea580c",
  P3: "#f59e0b",
  P4: "#3b82f6",
  P5: "#64748b",
};

/** Colors keyed by margin band for the margin distribution chart. */
export const marginBandColors: Record<MarginBand, string> = {
  green: "#16a34a",
  "light-green": "#65a30d",
  amber: "#f59e0b",
  red: "#dc2626",
  "dark-red": "#991b1b",
  "data-required": "#94a3b8",
};

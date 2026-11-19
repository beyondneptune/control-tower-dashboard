/**
 * Receivables (and payables) ageing.
 *
 * Buckets by days overdue relative to `asOf`: 0-30 / 31-60 / 61-90 / >90, with
 * a separate "not-due" class for invoices not yet past due date. Severity
 * follows the alert rule: overdue >30 days is red.
 */

import type { Severity } from "../types";
import { daysBetween } from "@/lib/format";

export type AgeBucket = "not-due" | "0-30" | "31-60" | "61-90" | ">90";

export const OVERDUE_BUCKETS: AgeBucket[] = ["0-30", "31-60", "61-90", ">90"];

export interface AgeingInput {
  id: string;
  dueDate: string; // ISO
  outstanding: number;
  label?: string;
}

export interface AgeingRow extends AgeingInput {
  daysOverdue: number;
  bucket: AgeBucket;
  severity: Severity;
}

export interface AgeingSummary {
  rows: AgeingRow[];
  buckets: Record<AgeBucket, number>;
  totalOutstanding: number;
  /** Sum across all overdue buckets (excludes not-due). */
  overdueTotal: number;
}

/** Positive when `asOf` is past the due date. */
export function daysOverdue(dueDate: string, asOf: string): number {
  return daysBetween(dueDate, asOf);
}

export function ageBucket(overdueDays: number): AgeBucket {
  if (overdueDays <= 0) return "not-due";
  if (overdueDays <= 30) return "0-30";
  if (overdueDays <= 60) return "31-60";
  if (overdueDays <= 90) return "61-90";
  return ">90";
}

function bucketSeverity(overdueDays: number): Severity {
  if (overdueDays > 30) return "red";
  if (overdueDays > 0) return "amber";
  return "green";
}

export function buildAgeing(inputs: AgeingInput[], asOf: string): AgeingSummary {
  const buckets: Record<AgeBucket, number> = {
    "not-due": 0,
    "0-30": 0,
    "31-60": 0,
    "61-90": 0,
    ">90": 0,
  };

  const rows: AgeingRow[] = inputs
    .filter((i) => i.outstanding > 0)
    .map((i) => {
      const d = daysOverdue(i.dueDate, asOf);
      const bucket = ageBucket(d);
      buckets[bucket] += i.outstanding;
      return { ...i, daysOverdue: d, bucket, severity: bucketSeverity(d) };
    });

  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const overdueTotal = OVERDUE_BUCKETS.reduce((s, b) => s + buckets[b], 0);

  return { rows, buckets, totalOutstanding, overdueTotal };
}

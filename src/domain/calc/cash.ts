/**
 * Cash control.
 *
 * Core identity (from the brief):
 *   opening + confirmed receipts + expected receipts − approved payments
 *     = projected closing cash.
 *
 * "Cash runway" is the genuinely underspecified figure, so it is modelled as a
 * forward day-by-day simulation rather than a crude ratio: we walk the dated
 * cashflows from `asOf` and report the first day the running balance turns
 * negative. A ratio (cash ÷ avg daily burn) hides lumpy obligations — an EMI on
 * day 3 — that a simulation surfaces. Capped at `horizonDays`.
 */

import { daysBetween } from "@/lib/format";

export interface CashForecastInput {
  openingCash: number;
  confirmedReceipts: number;
  expectedReceipts: number;
  approvedPayments: number;
}

export interface CashForecast {
  projectedClosing: number;
  /** Positive = surplus, negative = gap. */
  netPosition: number;
  status: "surplus" | "gap";
}

export function cashForecast(input: CashForecastInput): CashForecast {
  const projectedClosing =
    input.openingCash + input.confirmedReceipts + input.expectedReceipts - input.approvedPayments;
  return {
    projectedClosing,
    netPosition: projectedClosing,
    status: projectedClosing >= 0 ? "surplus" : "gap",
  };
}

/** A dated cashflow. Positive `amount` = inflow, negative = outflow. */
export interface DatedCashflow {
  date: string; // ISO
  amount: number;
}

/**
 * Days of runway: the first day (from `asOf`) on which the running balance goes
 * negative, given starting cash and dated flows. Returns `horizonDays` if cash
 * never runs out within the horizon. Returns 0 if already negative at `asOf`.
 */
export function cashRunwayDays(
  startingCash: number,
  flows: DatedCashflow[],
  asOf: string,
  horizonDays = 90,
): number {
  if (startingCash < 0) return 0;

  // Aggregate flows by day-offset from asOf, within the horizon and not in the past.
  const byDay = new Map<number, number>();
  for (const f of flows) {
    const d = daysBetween(asOf, f.date);
    if (d < 0 || d > horizonDays) continue;
    byDay.set(d, (byDay.get(d) ?? 0) + f.amount);
  }

  let balance = startingCash;
  for (let day = 0; day <= horizonDays; day++) {
    balance += byDay.get(day) ?? 0;
    if (balance < 0) return day;
  }
  return horizonDays;
}

/**
 * Sum of must-pay obligations falling within `windowDays` of `asOf`. Used for
 * the "cash below 7-day must-pay obligations" red alert.
 */
export function mustPayWithin(
  obligations: DatedCashflow[],
  asOf: string,
  windowDays = 7,
): number {
  return obligations
    .filter((o) => {
      const d = daysBetween(asOf, o.date);
      return d >= 0 && d <= windowDays;
    })
    .reduce((sum, o) => sum + Math.abs(o.amount), 0);
}

/** Utilisation % of an OCC/loan limit, clamped to [0, ∞). */
export function utilisationPercent(used: number, limit: number): number | null {
  if (limit <= 0) return null;
  return (used / limit) * 100;
}

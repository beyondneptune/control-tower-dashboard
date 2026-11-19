import Link from "next/link";
import type { CtMdSnapshot, MonthlyBankRow, MonthlyCashRow } from "@/data/ct-md";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { formatINRCompact, formatINRFull } from "@/lib/format";

export function CtMdDashboard({ snapshot }: { snapshot: CtMdSnapshot }) {
  const s = snapshot;
  const f = snapshot.finance;
  const c = snapshot.command;
  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="MD Dashboard"
        description={`Tally + Control Tower forms · ${
          f.syncLastSuccess
            ? `Tally last synced ${new Date(f.syncLastSuccess).toLocaleString()}`
            : "Tally has never synced"
        }${f.syncStatus && f.syncStatus !== "FRESH" ? ` · sync ${f.syncStatus}` : ""}`}
      />

      {/* Tally freshness — authoritative: same source (v_ct_sync_health) as the top red banner. */}
      {(() => {
        const st = f.syncStatus ?? (f.stale ? "STALE" : "FRESH");
        const down = st !== "FRESH";
        const last = f.syncLastSuccess ?? f.asAt;
        const age = f.syncAgeMin;
        const ageTxt = age == null ? "" : age < 90 ? `${age} min ago` : `${Math.round(age / 60)} h ago`;
        const tone =
          st === "DOWN" || st === "NONE"
            ? "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400"
            : down
              ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
        return (
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs ${tone}`}>
            <span>
              {down ? `⚠ Tally sync ${st}` : "✓ Tally current"} · last successful sync{" "}
              <b>{last ? new Date(last).toLocaleString() : "never"}</b>
              {ageTxt ? ` (${ageTxt})` : ""} · finance figures are <b>as per Trial Balance</b>
            </span>
            {down && f.syncError ? <span className="font-medium">Reason: {f.syncError}</span> : null}
          </div>
        );
      })()}

      {/* Command read-window — the shipped intelligence federated onto the MD's one
          screen, so company health is visible without searching (go-live Phase D#3).
          Sourced from already-verified, TALLY-INDEPENDENT views, so honest while Tally is down. */}
      {(c.insight || c.margin || c.risk) && (
        <Section title="Command — what needs attention">
          <Grid>
            {c.insight && (
              <Link href="/insights" className="block">
                <KpiCard
                  label="Open signals"
                  value={c.insight.total.toString()}
                  sub={`${c.insight.critical} critical · ${c.insight.high} high · exceptions + margin + leaks`}
                  tone={c.insight.critical > 0 ? "danger" : c.insight.high > 0 ? "warning" : "success"}
                />
              </Link>
            )}
            {c.margin && (
              <Link href="/engineering/margin" className="block">
                <KpiCard
                  label="Order-book margin"
                  value={`${c.margin.trustedMarginPct.toFixed(1)}%`}
                  sub={`trusted slice · ${c.margin.coveragePct.toFixed(1)}% costed · book ${formatINRCompact(c.margin.bookRevenue)}`}
                  tone={c.margin.trustedMarginPct < 22 ? "warning" : "success"}
                />
              </Link>
            )}
            {c.risk && (
              <Link href="/risk" className="block">
                <KpiCard
                  label="Unbilled at risk"
                  value={formatINRCompact(c.risk.unbilledElevatedValue)}
                  sub={`${c.risk.unbilledElevatedPositions} elevated of ${formatINRCompact(c.risk.unbilledInMotion)} unbilled in motion`}
                  tone={c.risk.unbilledElevatedValue > 0 ? "warning" : "neutral"}
                />
              </Link>
            )}
          </Grid>
          {c.insight && c.insight.top.length > 0 && (
            <div className="mt-3 rounded-md border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs uppercase text-muted-foreground">
                <span>Top signals by urgency</span>
                <Link href="/insights" className="underline">all {c.insight.total} →</Link>
              </div>
              <ul className="divide-y">
                {c.insight.top.map((t, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <SevDot severity={t.severity} />
                      <span className="shrink-0 text-[11px] uppercase text-muted-foreground">{t.feedKind}</span>
                      <span className="truncate">
                        {t.title}
                        {t.customer ? <span className="text-muted-foreground"> · {t.customer}</span> : null}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      {t.ownerRole && <span className="text-[11px] uppercase text-muted-foreground">{t.ownerRole}</span>}
                      {t.valueAtRisk != null && (
                        <span className="tabular-nums">{formatINRCompact(t.valueAtRisk)}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Basis>
            Read-window over the live intelligence — Insight Feed (<code>v_ct_insight_feed</code>),
            order-book Margin (<code>v_ct_margin_book</code>), unbilled Risk (<code>v_ct_predictive_risk</code>).
            Margin and unbilled-risk are Tally-independent (PO + production evidence), so true while Tally is down;
            the feed is mostly PO/cost/production signals but ~24 of its items are overdue-invoice exceptions from
            the last Tally bill-wise pull (STALE during the outage). Margin % is the costed-and-trusted slice only
            (coverage shown), never the whole book; unbilled risk excludes Tally-fed receivable (collection) risk —
            see <Link className="underline" href="/risk">Risk Radar</Link>.
          </Basis>
        </Section>
      )}

      <Section title="1. Cash & Bank — Trial Balance">
        <Grid>
          <KpiCard label="Net Cash & Bank" value={formatINRCompact(f.netCashBank)} sub="Cash-in-Hand + Bank A/c" tone="neutral" />
          <KpiCard label="Cash-in-Hand" value={formatINRCompact(f.cashInHand)} tone="neutral" />
          <KpiCard label="Bank Accounts" value={formatINRCompact(f.bankAccounts)} tone="neutral" />
        </Grid>
        <Basis>TB based · ledger snapshot · net of Dr/Cr per ledger</Basis>
      </Section>

      <Section title="1b. Loans (Liability) — bank debt vs promoter funding">
        <Grid>
          <KpiCard label="Bank debt" value={formatINRCompact(f.bankDebt)} sub="Term loan + OCC + GECL" tone="danger" />
          <KpiCard label="Promoter / family loans" value={formatINRCompact(f.promoterLoans)} sub="Unsecured — quasi-equity, not bank borrowing" tone="neutral" />
          <KpiCard label="Total loans (TB)" value={formatINRCompact(f.loansTotal)} sub="bank debt + promoter funding" tone="neutral" />
        </Grid>
        <Basis>Tally &quot;Loans (Liability)&quot; group, split: Bank OD A/c vs Unsecured Loans — never lumped.</Basis>
      </Section>

      <Section title="2. Receivables">
        <Grid>
          <KpiCard label="Receivables (TB)" value={formatINRCompact(f.tbReceivables)} sub="Sundry Debtors, net — authoritative" tone="neutral" />
          <KpiCard label="Open invoices" value={f.openInvoiceCount.toString()} sub="invoice register" tone="neutral" />
          <KpiCard
            label="Operational open"
            value={formatINRCompact(f.operationalReceivable)}
            sub={`${f.operationalReceivableBills} bills · current FY`}
            tone="neutral"
          />
          <KpiCard
            label="Legacy stale (Tally)"
            value={formatINRCompact(f.legacyAmount)}
            sub={`${f.legacyBills} prior-FY bills · excluded`}
            tone="warning"
          />
        </Grid>
        <Basis>Headline = TB (Sundry Debtors). Operational = current-FY bill-wise. Legacy = prior-FY clutter, isolated.</Basis>

        {/* Operational ageing (current FY only) */}
        <div className="mt-3 rounded-md border bg-card p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase text-muted-foreground">Operational ageing — current FY open items</span>
            <span className="text-[11px] text-muted-foreground">days overdue</span>
          </div>
          <AgeingBars buckets={f.receivableAgeing} />
        </div>

        {/* Legacy isolation note */}
        <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
          <b>Legacy stale Tally bill-wise — isolated, not counted as current receivable.</b>{" "}
          {f.legacyBills} bills worth <b>{formatINRCompact(f.legacyAmount)}</b>
          {f.legacyOldest ? ` (oldest ${f.legacyOldest})` : ""} are prior-financial-year items left open in
          Tally&apos;s bill-wise report — old bills paid but not knocked off bill-by-bill. They are{" "}
          <b>excluded from the operational ageing above</b>. The authoritative receivable remains the{" "}
          <b>TB figure {formatINRCompact(f.tbReceivables)}</b>. No Tally data was changed; this is a dashboard
          presentation filter only.
        </div>

        {f.topOverdueCustomers.length > 0 && (
          <div className="mt-3 rounded-md border bg-card p-3 text-sm">
            <div className="mb-1 text-xs uppercase text-muted-foreground">Top overdue customers · current FY</div>
            <ul className="grid gap-1 sm:grid-cols-2">
              {f.topOverdueCustomers.map((c) => (
                <li key={c.name} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <span className="tabular-nums">{formatINRCompact(c.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <MovementTable
          title="Last 10 receipts (Tally)"
          rows={f.lastReceipts}
          partyHead="Customer / ledger"
          noteHead="Deduction"
        />
        <Basis>Last 10 receipts — Tally receipt vouchers (collections), latest synced</Basis>
      </Section>

      <Section title="3. Payables — Trial Balance">
        <Grid>
          <KpiCard label="Trade payables (TB)" value={formatINRCompact(f.tbPayables)} sub="Sundry Creditors, net" tone="neutral" />
          <KpiCard label="Bill-wise payable (ref)" value={formatINRCompact(f.billwisePayable)} sub="incomplete in bill-wise" tone="neutral" />
        </Grid>
        <Basis>TB based · Sundry Creditors net (Cr − Dr)</Basis>

        <MovementTable
          title="Last 10 payments (Tally)"
          rows={f.lastPayments}
          partyHead="Vendor / ledger"
          noteHead="Purpose"
        />
        <Basis>Last 10 payments — Tally payment vouchers (vendor_payments), latest synced</Basis>
      </Section>

      <Section title="3b. Monthly Income & Expense (Tally)">
        <MonthlyCashPanel rows={s.monthlyCash} bank={s.monthlyBank} />
        <Basis>
          Tally sales &amp; purchase vouchers · amounts gross (incl GST) as recorded in Tally · income part
          names via the reconciled invoice↔PO-line link — blank part = invoice not yet linked, never guessed ·
          bank row = Tally receipt &amp; payment vouchers (Day Book), not the bank statement
        </Basis>
      </Section>

      <Section title="4. Confirmed order book (Customer PO Register)">
        <Grid>
          <KpiCard label="POs" value={s.orderBook.confirmedPoCount.toString()} tone="neutral" />
          <KpiCard label="PO value" value={formatINRCompact(s.orderBook.confirmedPoValue)} tone="neutral" />
          <KpiCard label="PO without job" value={s.orderBook.poWithoutJob.toString()} tone={s.orderBook.poWithoutJob > 0 ? "warning" : "neutral"} />
        </Grid>
        <p className="mt-2 text-xs text-muted-foreground">
          Source: <Link className="underline" href="/registers/customer-po">Customer PO Register</Link>
        </p>
      </Section>

      <Section title="5. Active WIP (Job Master + Daily WIP)">
        <Grid>
          <KpiCard label="In progress" value={s.activeJobs.inProgress.toString()} tone="neutral" />
          <KpiCard label="On hold" value={s.activeJobs.onHold.toString()} tone={s.activeJobs.onHold > 0 ? "warning" : "neutral"} />
          <KpiCard label="Overdue dispatch" value={s.activeJobs.overdueDispatch.toString()} tone={s.activeJobs.overdueDispatch > 0 ? "danger" : "neutral"} />
        </Grid>
      </Section>

      <Section title="6. Dispatch readiness (QC + Dispatch Register)">
        <Grid>
          <KpiCard label="Dispatch ready" value={s.dispatch.ready.toString()} tone="neutral" />
          <KpiCard label="Dispatched / invoice pending" value={s.dispatch.dispatchedPendingInvoice.toString()} tone={s.dispatch.dispatchedPendingInvoice > 0 ? "warning" : "neutral"} />
        </Grid>
      </Section>

      <Section title="7. Operational blockers">
        <Grid>
          <KpiCard label="Material blockers" value={s.materialBlockers.count.toString()} tone={s.materialBlockers.count > 0 ? "warning" : "neutral"} />
          <KpiCard label="QC holds / NCR" value={s.qcHolds.count.toString()} tone={s.qcHolds.count > 0 ? "warning" : "neutral"} />
          <KpiCard label="Vendor delays" value={s.vendorDelays.count.toString()} tone={s.vendorDelays.count > 0 ? "warning" : "neutral"} />
        </Grid>
      </Section>

      <Section title="8. Top exceptions">
        <div className="rounded-lg border bg-card">
          {s.exceptions.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground">No exceptions right now.</div>
          )}
          {s.exceptions.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Kind</th>
                  <th className="px-3 py-2 text-left font-medium">Subject</th>
                  <th className="px-3 py-2 text-left font-medium">Reference</th>
                  <th className="px-3 py-2 text-left font-medium">Due</th>
                  <th className="px-3 py-2 text-left font-medium">Owner</th>
                  <th className="px-3 py-2 text-left font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {s.exceptions.map((x) => (
                  <tr key={`${x.kind}-${x.recordId}`} className="border-t">
                    <td className="px-3 py-1.5">{x.kind}</td>
                    <td className="px-3 py-1.5">{x.subject}</td>
                    <td className="px-3 py-1.5">{x.reference}</td>
                    <td className="px-3 py-1.5">{x.due ?? "—"}</td>
                    <td className="px-3 py-1.5">{x.ownerHint}</td>
                    <td className="px-3 py-1.5">{x.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

function SevDot({ severity }: { severity: string }) {
  const cls =
    severity === "critical"
      ? "bg-red-500"
      : severity === "high"
        ? "bg-amber-500"
        : severity === "medium"
          ? "bg-sky-500"
          : "bg-muted-foreground/40";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function MovementTable({
  title,
  rows,
  partyHead,
  noteHead,
}: {
  title: string;
  rows: { date: string | null; party: string; ref: string | null; amount: number; account: string | null; note: string | null }[];
  partyHead: string;
  noteHead: string;
}) {
  return (
    <div className="mt-3 rounded-md border bg-card">
      <div className="border-b px-3 py-2 text-xs uppercase text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <div className="p-3 text-sm text-muted-foreground">No recent entries.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Date</th>
              <th className="px-3 py-1.5 text-left font-medium">{partyHead}</th>
              <th className="px-3 py-1.5 text-left font-medium">Ref</th>
              <th className="px-3 py-1.5 text-right font-medium">Amount</th>
              <th className="px-3 py-1.5 text-left font-medium">Account</th>
              <th className="px-3 py-1.5 text-left font-medium">{noteHead}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{r.date ?? "—"}</td>
                <td className="px-3 py-1.5">{r.party}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.ref ?? "—"}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatINRCompact(r.amount)}</td>
                <td className="max-w-[160px] truncate px-3 py-1.5 text-muted-foreground">{r.account ?? "—"}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{r.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Basis({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-[11px] uppercase tracking-wide text-muted-foreground">
      Basis: {children}
    </p>
  );
}

function AgeingBars({
  buckets,
}: {
  buckets: { bucket: string; bills: number; amount: number }[];
}) {
  const order = ["Current", "1-30", "31-60", "61-90", "90+"];
  const sorted = [...buckets].sort(
    (a, b) => order.indexOf(a.bucket) - order.indexOf(b.bucket),
  );
  const max = Math.max(1, ...sorted.map((b) => Math.abs(b.amount)));
  const tone: Record<string, string> = {
    Current: "bg-emerald-500",
    "1-30": "bg-lime-500",
    "31-60": "bg-amber-500",
    "61-90": "bg-orange-500",
    "90+": "bg-red-500",
  };
  return (
    <div className="space-y-1.5">
      {sorted.map((b) => (
        <div key={b.bucket} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 text-muted-foreground">{b.bucket}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
            <div
              className={`h-full ${tone[b.bucket] ?? "bg-primary"}`}
              style={{ width: `${Math.max(2, (Math.abs(b.amount) / max) * 100)}%` }}
            />
          </div>
          <span className="w-24 shrink-0 text-right tabular-nums">
            {formatINRCompact(b.amount)}
          </span>
          <span className="w-14 shrink-0 text-right text-muted-foreground">
            {b.bills} {b.bills === 1 ? "bill" : "bills"}
          </span>
        </div>
      ))}
    </div>
  );
}

// Month-by-month listing: income (sales invoices with part names) beside expenses
// (purchase vouchers with party names), a totals strip per month. Data comes from
// v_ct_monthly_income_expense — Tally vouchers, gross incl GST, abs() of Tally's sign.
function MonthlyCashPanel({ rows, bank }: { rows: MonthlyCashRow[]; bank: MonthlyBankRow[] }) {
  const months = Array.from(new Set([...rows.map((r) => r.month), ...bank.map((b) => b.month)])).sort().reverse();
  if (months.length === 0) {
    return <div className="rounded-md border bg-card p-3 text-sm text-muted-foreground">No Tally vouchers synced yet.</div>;
  }
  const monthLabel = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, (mo ?? 1) - 1, 1).toLocaleString("en-GB", { month: "long", year: "numeric" });
  };
  return (
    <div className="space-y-4">
      {months.map((m) => {
        const inc = rows.filter((r) => r.month === m && r.kind === "income");
        const exp = rows.filter((r) => r.month === m && r.kind === "expense");
        const incTotal = inc.reduce((a, r) => a + r.amount, 0);
        const expTotal = exp.reduce((a, r) => a + r.amount, 0);
        return (
          <div key={m} className="rounded-md border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <span className="text-sm font-semibold">{monthLabel(m)}</span>
              <span className="text-xs tabular-nums">
                <span className="text-emerald-600">Income {formatINRCompact(incTotal)} ({inc.length} inv)</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-red-600">Expense {formatINRCompact(expTotal)} ({exp.length} vch)</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className={incTotal - expTotal >= 0 ? "text-emerald-700" : "text-red-700"}>
                  Net {formatINRCompact(incTotal - expTotal)}
                </span>
              </span>
            </div>
            <div className="grid gap-0 lg:grid-cols-2">
              <CashList title="Income — sales invoices (by part)" kind="income" rows={inc} />
              <CashList title="Expense — purchases (by party)" kind="expense" rows={exp} />
            </div>
            <BankStrip row={bank.find((b) => b.month === m)} />
          </div>
        );
      })}
    </div>
  );
}

function CashList({ title, kind, rows }: { title: string; kind: "income" | "expense"; rows: MonthlyCashRow[] }) {
  return (
    <div className={kind === "income" ? "border-b lg:border-b-0 lg:border-r" : ""}>
      <div className="border-b bg-muted/30 px-3 py-1.5 text-[11px] uppercase text-muted-foreground">{title}</div>
      {rows.length === 0 ? (
        <div className="p-3 text-xs text-muted-foreground">None this month.</div>
      ) : (
        <div className="max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Date</th>
                <th className="px-2 py-1 text-left font-medium">{kind === "income" ? "Invoice" : "Voucher"}</th>
                <th className="px-2 py-1 text-left font-medium">{kind === "income" ? "Customer" : "Party"}</th>
                {kind === "income" && <th className="px-2 py-1 text-left font-medium">Part</th>}
                <th className="px-2 py-1 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.docNo}-${r.date}`} className="border-t">
                  <td className="whitespace-nowrap px-2 py-1 text-muted-foreground">{r.date ? r.date.slice(8) + "/" + r.date.slice(5, 7) : "—"}</td>
                  <td className="whitespace-nowrap px-2 py-1">{r.docNo}</td>
                  <td className="max-w-[140px] truncate px-2 py-1" title={r.counterparty}>{r.counterparty}</td>
                  {kind === "income" && (
                    <td className="max-w-[160px] truncate px-2 py-1" title={r.detail ?? ""}>{r.detail ?? "—"}</td>
                  )}
                  <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums">{formatINRFull(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Money in/out strip under each month — Tally receipt & payment vouchers (Day Book,
// REMOTEID-deduped). Deliberately NOT ct_bank_txn: that statement parse carries no
// dr/cr amounts (and duplicated rows), so it cannot honestly source these totals.
function BankStrip({ row }: { row: MonthlyBankRow | undefined }) {
  return (
    <div className="border-t bg-muted/20">
      <table className="w-full text-xs">
        <tbody>
          <tr>
            <td className="px-3 py-1.5 text-[11px] uppercase text-muted-foreground">Bank — money in / out (Tally)</td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              <span className="text-emerald-700">In {row ? formatINRFull(row.incoming) : "—"}</span>
              <span className="ml-1 text-muted-foreground">({row?.inCount ?? 0} receipts)</span>
            </td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              <span className="text-red-700">Out {row ? formatINRFull(row.outgoing) : "—"}</span>
              <span className="ml-1 text-muted-foreground">({row?.outCount ?? 0} payments)</span>
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums">
              {row ? (
                <span className={row.incoming - row.outgoing >= 0 ? "font-medium text-emerald-700" : "font-medium text-red-700"}>
                  Net {formatINRFull(row.incoming - row.outgoing)}
                </span>
              ) : (
                <span className="text-muted-foreground">no vouchers</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

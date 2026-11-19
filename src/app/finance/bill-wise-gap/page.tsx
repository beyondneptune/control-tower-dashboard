// Server component — bill-wise vs ledger gap drilldown.
//
// Surfaces the Tally hygiene finding from Sprint 0: bill-wise outstanding
// totals diverge materially from ledger Trial Balance net for some customers.
// This page is for the Finance team (Rahul) to reconcile, NOT for the MD
// to use as a receivables number.

import Link from "next/link";
import { ArrowLeft, Download, Scale, TriangleAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

interface GapRow {
  direction: string;
  counter_party: string;
  bill_count: number;
  bill_wise_outstanding: number;
  not_yet_due: number;
  overdue_1_90: number;
  overdue_91_365: number;
  overdue_over_1y: number;
  oldest_bill: string | null;
  newest_bill: string | null;
  cleanup_priority_score: number;
}

export default async function BillWiseGapPage() {
  const sb = createAdminClient();
  const { data: rows } = await sb
    .from("v_bill_wise_ledger_gap")
    .select("*")
    .order("cleanup_priority_score", { ascending: false });

  // Ledger nets for reconciliation header
  const { data: ledgers } = await sb
    .from("v_latest_ledger_balance")
    .select("ledger_name, closing_dr, closing_cr")
    .in("ledger_name", ["Sundry Debtors", "Sundry Creditors"]);
  const debtorsRow = ledgers?.find((l) => l.ledger_name === "Sundry Debtors");
  const creditorsRow = ledgers?.find((l) => l.ledger_name === "Sundry Creditors");
  const debtorsNet = debtorsRow ? Number(debtorsRow.closing_dr) - Number(debtorsRow.closing_cr) : 0;
  const creditorsNet = creditorsRow ? Number(creditorsRow.closing_cr) - Number(creditorsRow.closing_dr) : 0;

  const receivables = (rows || []).filter((r) => r.direction === "receivable") as GapRow[];
  const payables = (rows || []).filter((r) => r.direction === "payable") as GapRow[];

  const recvBwTotal = receivables.reduce((s, r) => s + (Number(r.bill_wise_outstanding) || 0), 0);
  const payBwTotal = payables.reduce((s, r) => s + (Number(r.bill_wise_outstanding) || 0), 0);
  const recvBillCount = receivables.reduce((s, r) => s + (Number(r.bill_count) || 0), 0);
  const payBillCount = payables.reduce((s, r) => s + (Number(r.bill_count) || 0), 0);

  return (
    <PageGuard module="cash">
      <div className="space-y-5">
        <PageHeader
          title="Bill-wise vs Ledger Gap"
          description="Cleanup view for the finance team · NOT for headline receivables"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/cash"
                className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <ArrowLeft className="size-3.5" /> Back to Cash
              </Link>
              <Link
                href="/finance/bill-wise-gap/export"
                className="inline-flex items-center gap-1.5 rounded-md border bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/20"
              >
                <Download className="size-3.5" /> Bill-wise Cleanup List (Rahul)
              </Link>
            </div>
          }
        />

        {/* Headline warning — repeat the MD home warning here so context is obvious */}
        <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 text-warning" />
          <div>
            <p className="font-medium">
              Bill-wise data shows {receivables.length} customers and {payables.length} vendors with open bills.
              The bill-wise totals do NOT match the ledger Trial Balance net.
            </p>
            <p className="text-xs text-muted-foreground">
              This page is for finance hygiene — identifying customers whose receipts have not been allocated to specific bills.
              The MD home shows ledger headline receivables ({formatINR(debtorsNet)}) and payables ({formatINR(creditorsNet)}),
              which are authoritative for management decisions.
            </p>
          </div>
        </div>

        {/* Reconciliation summary card */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SectionCard title="Receivables reconciliation" bodyClassName="px-4 py-3">
            <ReconcileLine
              label="Trial Balance (Sundry Debtors net)"
              value={debtorsNet}
              tone="authoritative"
            />
            <ReconcileLine
              label="Bill-wise gross total"
              value={recvBwTotal}
              tone="hygiene"
            />
            <ReconcileLine
              label="Variance"
              value={recvBwTotal - debtorsNet}
              tone="variance"
            />
            <p className="mt-2 text-[10px] text-muted-foreground">
              {recvBillCount.toLocaleString("en-IN")} bills across {receivables.length} customers.
              Variance suggests {Math.round(((recvBwTotal - debtorsNet) / recvBwTotal) * 100)}% of bill-wise gross is unreconciled.
            </p>
          </SectionCard>

          <SectionCard title="Payables reconciliation" bodyClassName="px-4 py-3">
            <ReconcileLine
              label="Trial Balance (Sundry Creditors net)"
              value={creditorsNet}
              tone="authoritative"
            />
            <ReconcileLine
              label="Bill-wise gross total"
              value={payBwTotal}
              tone="hygiene"
            />
            <ReconcileLine
              label="Variance"
              value={payBwTotal - creditorsNet}
              tone="variance"
            />
            <p className="mt-2 text-[10px] text-muted-foreground">
              {payBillCount.toLocaleString("en-IN")} bills across {payables.length} vendors.
              {payBwTotal < creditorsNet && " Bill-wise is UNDER ledger — likely some bills exist outside bill-wise tracking."}
            </p>
          </SectionCard>
        </section>

        {/* Receivables drilldown table */}
        <SectionCard
          title="Customer-side cleanup priority"
          description={`Sorted by cleanup priority score · highest first · ${receivables.length} customers`}
          bodyClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Customer</Th>
                  <Th align="right">Bills</Th>
                  <Th align="right">Bill-wise ₹</Th>
                  <Th align="right">Not yet due</Th>
                  <Th align="right">1–90 days</Th>
                  <Th align="right">91–365</Th>
                  <Th align="right">&gt; 1 year</Th>
                  <Th>Oldest bill</Th>
                  <Th align="right">Priority</Th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.counter_party} className="border-t hover:bg-muted/20">
                    <Td>
                      <div className="font-medium">{r.counter_party}</div>
                    </Td>
                    <Td align="right">{r.bill_count.toLocaleString("en-IN")}</Td>
                    <Td align="right" className="font-semibold tabular-nums">
                      {formatINR(Number(r.bill_wise_outstanding))}
                    </Td>
                    <Td align="right" className="tabular-nums">{formatINR(Number(r.not_yet_due))}</Td>
                    <Td align="right" className="tabular-nums">{formatINR(Number(r.overdue_1_90))}</Td>
                    <Td align="right" className="tabular-nums">{formatINR(Number(r.overdue_91_365))}</Td>
                    <Td align="right" className="tabular-nums">
                      <span className={Number(r.overdue_over_1y) > 0 ? "font-semibold text-danger" : ""}>
                        {formatINR(Number(r.overdue_over_1y))}
                      </span>
                    </Td>
                    <Td>{r.oldest_bill ?? "—"}</Td>
                    <Td align="right">
                      <PriorityPill score={Number(r.cleanup_priority_score)} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Payables drilldown */}
        <SectionCard
          title="Vendor-side cleanup priority"
          description={`Sorted by cleanup priority · ${payables.length} vendors`}
          bodyClassName="px-0 py-0"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Vendor</Th>
                  <Th align="right">Bills</Th>
                  <Th align="right">Bill-wise ₹</Th>
                  <Th align="right">&gt; 1 year</Th>
                  <Th>Oldest bill</Th>
                  <Th align="right">Priority</Th>
                </tr>
              </thead>
              <tbody>
                {payables.map((r) => (
                  <tr key={r.counter_party} className="border-t hover:bg-muted/20">
                    <Td><div className="font-medium">{r.counter_party}</div></Td>
                    <Td align="right">{r.bill_count.toLocaleString("en-IN")}</Td>
                    <Td align="right" className="font-semibold tabular-nums">
                      {formatINR(Number(r.bill_wise_outstanding))}
                    </Td>
                    <Td align="right" className="tabular-nums">
                      <span className={Number(r.overdue_over_1y) > 0 ? "font-semibold text-danger" : ""}>
                        {formatINR(Number(r.overdue_over_1y))}
                      </span>
                    </Td>
                    <Td>{r.oldest_bill ?? "—"}</Td>
                    <Td align="right"><PriorityPill score={Number(r.cleanup_priority_score)} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">For the finance team (Rahul):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Start with the highest-priority row. Pull each bill in Tally → check if a receipt has come in but wasn&apos;t allocated against this specific bill.</li>
            <li>Most cleanup target: <strong>Apex Flow Systems Pvt Ltd</strong> with 1,522 historical bills. Many likely have already-received payments posted only at ledger level.</li>
            <li>Second priority: <strong>Crestline Valves (India) Pvt Ltd</strong> with 140 bills.</li>
            <li>Use the &quot;Bill-wise Cleanup List&quot; export above to share with the team for systematic reconciliation.</li>
          </ul>
        </div>
      </div>
    </PageGuard>
  );
}

function ReconcileLine({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "authoritative" | "hygiene" | "variance";
}) {
  const cls =
    tone === "authoritative" ? "text-success font-semibold" :
    tone === "hygiene"       ? "text-warning" :
                                "text-danger font-bold";
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-muted-foreground/20 py-1.5 text-sm last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${cls}`}>{formatINR(value)}</span>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}
function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}>
      {children}
    </td>
  );
}
function PriorityPill({ score }: { score: number }) {
  const tone = score > 1000 ? "danger" : score > 100 ? "warning" : score > 10 ? "info" : "neutral";
  return <StatusPill tone={tone}>{score.toFixed(1)}</StatusPill>;
}

// Silence unused-icon import in some builds
void Scale;

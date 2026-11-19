// Day 9: Commercial Pipeline page — read-only.
// Shows business_threads grouped by promotion tier (Verified / Inferred / Dry-run).
// Honours promotion_status — only Tier A/B threads get visible counts.
// Dry-run + rejected stay hidden behind a "Validation pending" placeholder.

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  customer_name: string | null;
  current_stage: string;
  primary_po_no: string | null;
  primary_invoice_no: string | null;
  confidence_score: number | null;
  latest_activity_at: string;
}

interface PromoRow {
  thread_id: string;
  tier: string;
  reason: string | null;
}

export default async function CommercialPipelinePage() {
  const sb = createAdminClient();

  const { data: threads } = await sb
    .from("business_threads")
    .select(
      "id, customer_name, current_stage, primary_po_no, primary_invoice_no, confidence_score, latest_activity_at",
    )
    .eq("is_dry_run", true);

  const { data: promos } = await sb
    .from("thread_promotion_status")
    .select("thread_id, tier, reason");

  const promoMap = new Map<string, PromoRow>();
  for (const p of (promos || []) as PromoRow[]) promoMap.set(p.thread_id, p);

  const tierBuckets = { verified: [], inferred: [], dry_run: [], rejected: [] } as Record<
    string,
    ThreadRow[]
  >;
  for (const t of (threads || []) as ThreadRow[]) {
    const tier = promoMap.get(t.id)?.tier || "dry_run";
    if (tierBuckets[tier]) tierBuckets[tier].push(t);
  }

  const visible = [...tierBuckets.verified, ...tierBuckets.inferred];
  const validationComplete = visible.length > 0;

  // Per-customer for visible threads
  const byCustomer = new Map<string, { verified: number; inferred: number }>();
  for (const t of tierBuckets.verified) {
    const k = t.customer_name || "(unknown)";
    if (!byCustomer.has(k)) byCustomer.set(k, { verified: 0, inferred: 0 });
    byCustomer.get(k)!.verified++;
  }
  for (const t of tierBuckets.inferred) {
    const k = t.customer_name || "(unknown)";
    if (!byCustomer.has(k)) byCustomer.set(k, { verified: 0, inferred: 0 });
    byCustomer.get(k)!.inferred++;
  }

  // Stage distribution of visible threads
  const byStage = new Map<string, { verified: number; inferred: number }>();
  for (const t of tierBuckets.verified) {
    const k = t.current_stage;
    if (!byStage.has(k)) byStage.set(k, { verified: 0, inferred: 0 });
    byStage.get(k)!.verified++;
  }
  for (const t of tierBuckets.inferred) {
    const k = t.current_stage;
    if (!byStage.has(k)) byStage.set(k, { verified: 0, inferred: 0 });
    byStage.get(k)!.inferred++;
  }

  return (
    <PageGuard module="validation">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">← Back to home</Link>
          <Link href="/threads/validation" className="text-xs text-blue-600 hover:underline">Thread validation →</Link>
        </div>
        <PageHeader
          title={<><BarChart3 className="mr-2 inline size-4 -translate-y-0.5" />Commercial Pipeline</>}
          description="Reviewer-validated business threads. Only Verified + Inferred tiers appear here."
        />

        {/* Headline counts */}
        <SectionCard title="Pipeline status">
          <div className="grid grid-cols-2 gap-3 px-4 py-3 sm:grid-cols-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Verified</div>
              <div className="text-2xl font-semibold tabular-nums">{tierBuckets.verified.length}</div>
              <StatusPill tone="success">Reviewer-confirmed</StatusPill>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Inferred</div>
              <div className="text-2xl font-semibold tabular-nums">{tierBuckets.inferred.length}</div>
              <StatusPill tone="warning">Ambiguous Tally link</StatusPill>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Dry-run held</div>
              <div className="text-2xl font-semibold tabular-nums">{tierBuckets.dry_run.length}</div>
              <StatusPill tone="neutral">Not reviewed</StatusPill>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Rejected</div>
              <div className="text-2xl font-semibold tabular-nums">{tierBuckets.rejected.length}</div>
              <StatusPill tone="danger">Reviewer-rejected</StatusPill>
            </div>
          </div>
          {!validationComplete && (
            <div className="mx-4 mb-3 rounded-md border border-amber-200/40 bg-amber-50/30 p-3 text-sm">
              <div className="font-medium">Validation pending</div>
              <div className="text-xs text-muted-foreground">
                No reviewer-confirmed threads yet. The Commercial Pipeline tables below will populate once reviewers complete the
                37-thread sample pack at <Link href="/threads/validation" className="underline">/threads/validation</Link>.
              </div>
            </div>
          )}
        </SectionCard>

        {/* Visible threads */}
        {validationComplete && (
          <>
            <SectionCard title="By customer (Verified + Inferred)">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2 text-right">Verified</th>
                    <th className="px-3 py-2 text-right">Inferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {Array.from(byCustomer.entries())
                    .sort((a, b) => b[1].verified + b[1].inferred - (a[1].verified + a[1].inferred))
                    .map(([cust, c]) => (
                      <tr key={cust} className="text-xs">
                        <td className="px-3 py-2">{cust}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.verified}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.inferred}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </SectionCard>

            <SectionCard title="By lifecycle stage (Verified + Inferred)">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2 text-right">Verified</th>
                    <th className="px-3 py-2 text-right">Inferred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {Array.from(byStage.entries())
                    .sort((a, b) => b[1].verified + b[1].inferred - (a[1].verified + a[1].inferred))
                    .map(([stage, c]) => (
                      <tr key={stage} className="text-xs">
                        <td className="px-3 py-2 font-mono">{stage}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.verified}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.inferred}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </SectionCard>

            <SectionCard title="Threads (Verified + Inferred)">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Stage</th>
                    <th className="px-3 py-2">PO / Invoice</th>
                    <th className="px-3 py-2">Tier</th>
                    <th className="px-3 py-2">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {visible.map((t) => {
                    const tier = promoMap.get(t.id)?.tier || "dry_run";
                    return (
                      <tr key={t.id} className="text-xs">
                        <td className="px-3 py-2">{t.customer_name || "—"}</td>
                        <td className="px-3 py-2 font-mono">{t.current_stage}</td>
                        <td className="px-3 py-2 font-mono">{t.primary_po_no || t.primary_invoice_no || "—"}</td>
                        <td className="px-3 py-2">
                          <StatusPill tone={tier === "verified" ? "success" : "warning"}>
                            {tier === "verified" ? "Verified" : "Inferred"}
                          </StatusPill>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(t.latest_activity_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </SectionCard>
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          ⓘ Hidden: <strong>{tierBuckets.dry_run.length} dry-run</strong> + <strong>{tierBuckets.rejected.length} rejected</strong> threads. They
          stay off this page until reviewer evidence promotes them to Verified or Inferred. No rupee values shown —
          this page is order-tracking, not finance.
        </p>
      </div>
    </PageGuard>
  );
}

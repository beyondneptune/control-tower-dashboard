// Day 9: Order Book page — read-only, Tally-aware.
// Shows business_threads where Tally evidence exists (L1 or L2_date_proximity).
// Verified / Inferred / Data Required split.
// No rupee totals unless directly Tally-backed; ambiguous links never count as Verified.

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { isStrongLinkMethod } from "@/domain/link-methods";

export const dynamic = "force-dynamic";

interface ThreadRow {
  id: string;
  customer_name: string | null;
  current_stage: string;
  primary_po_no: string | null;
  primary_invoice_no: string | null;
  latest_activity_at: string;
}

interface LinkRow {
  thread_id: string;
  link_method: string;
  confidence: number | null;
  tally_natural_key: string | null;
}

interface PromoRow {
  thread_id: string;
  tier: string;
}

export default async function OrderBookPage() {
  const sb = createAdminClient();

  const { data: threads } = await sb
    .from("business_threads")
    .select("id, customer_name, current_stage, primary_po_no, primary_invoice_no, latest_activity_at");

  const { data: links } = await sb
    .from("business_thread_tally_links")
    .select("thread_id, link_method, confidence, tally_natural_key");
  const linkByThread = new Map<string, LinkRow>();
  for (const l of (links || []) as LinkRow[]) {
    const existing = linkByThread.get(l.thread_id);
    if (!existing || (Number(l.confidence) || 0) > (Number(existing.confidence) || 0)) {
      linkByThread.set(l.thread_id, l);
    }
  }

  const { data: promos } = await sb
    .from("thread_promotion_status")
    .select("thread_id, tier");
  const promoMap = new Map<string, string>();
  for (const p of (promos || []) as PromoRow[]) promoMap.set(p.thread_id, p.tier);

  const verified: ThreadRow[] = [];
  const inferred: ThreadRow[] = [];
  const dataRequired: ThreadRow[] = [];

  for (const t of (threads || []) as ThreadRow[]) {
    const link = linkByThread.get(t.id);
    const tier = promoMap.get(t.id) || "dry_run";

    const isStrongLink = !!link && isStrongLinkMethod(link.link_method);

    if (tier === "verified" && isStrongLink) {
      verified.push(t);
    } else if (tier === "inferred" || (tier !== "dry_run" && tier !== "rejected" && link && isStrongLink)) {
      inferred.push(t);
    } else {
      dataRequired.push(t);
    }
  }

  const hasPromoted = verified.length + inferred.length > 0;

  return (
    <PageGuard module="ct-customer-po">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">← Back to home</Link>
          <Link href="/threads/validation" className="text-xs text-blue-600 hover:underline">Thread validation →</Link>
        </div>
        <PageHeader
          title={<><BookOpen className="mr-2 inline size-4 -translate-y-0.5" />Order Book</>}
          description="Reviewer-confirmed orders that map to Tally evidence. No rupee values unless directly Tally-backed."
        />

        <SectionCard title="Order book split">
          <div className="grid grid-cols-1 gap-3 px-4 py-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Verified</div>
              <div className="text-2xl font-semibold tabular-nums">{verified.length}</div>
              <StatusPill tone="success">L1 or clear L2 + reviewer confirmed</StatusPill>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Inferred</div>
              <div className="text-2xl font-semibold tabular-nums">{inferred.length}</div>
              <StatusPill tone="warning">Reviewer-confirmed but link ambiguous</StatusPill>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Data Required</div>
              <div className="text-2xl font-semibold tabular-nums">{dataRequired.length}</div>
              <StatusPill tone="neutral">No reviewer evidence yet</StatusPill>
            </div>
          </div>
          {!hasPromoted && (
            <div className="mx-4 mb-3 rounded-md border border-amber-200/40 bg-amber-50/30 p-3 text-sm">
              <div className="font-medium">Validation pending</div>
              <div className="text-xs text-muted-foreground">
                No reviewer-confirmed Tally-backed orders yet. Order book table below will populate once reviewers complete
                sampling at <Link href="/threads/validation" className="underline">/threads/validation</Link>.
              </div>
            </div>
          )}
        </SectionCard>

        {/* Verified rows */}
        <SectionCard title={`Verified (${verified.length})`}>
          {verified.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">_None yet. Requires Tier A promotion + strong Tally link._</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">PO / Invoice</th>
                  <th className="px-3 py-2">Tally key</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {verified.map((t) => {
                  const link = linkByThread.get(t.id);
                  return (
                    <tr key={t.id} className="text-xs">
                      <td className="px-3 py-2">{t.customer_name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{t.primary_po_no || t.primary_invoice_no || "—"}</td>
                      <td className="px-3 py-2 font-mono">{link?.tally_natural_key || "—"}</td>
                      <td className="px-3 py-2 font-mono">{t.current_stage}</td>
                      <td className="px-3 py-2 text-muted-foreground">{new Date(t.latest_activity_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Inferred rows */}
        <SectionCard title={`Inferred (${inferred.length})`} description="Reviewer-confirmed customer + stage; Tally link ambiguous or N/A.">
          {inferred.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground">_None yet._</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">PO / Invoice</th>
                  <th className="px-3 py-2">Tally link</th>
                  <th className="px-3 py-2">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {inferred.map((t) => {
                  const link = linkByThread.get(t.id);
                  return (
                    <tr key={t.id} className="text-xs">
                      <td className="px-3 py-2">{t.customer_name || "—"}</td>
                      <td className="px-3 py-2 font-mono">{t.primary_po_no || t.primary_invoice_no || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {link ? (
                          <>
                            <span className="font-mono">{link.tally_natural_key}</span>
                            <span className="ml-1 text-muted-foreground">({link.link_method})</span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{t.current_stage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </SectionCard>

        <p className="text-[11px] text-muted-foreground">
          ⓘ Order Book is order-tracking, not finance. Rupee values are not aggregated here — for those, see the
          Trial Balance-backed Finance section on MD home. Ambiguous Tally links never count as Verified, only Inferred.
        </p>
      </div>
    </PageGuard>
  );
}

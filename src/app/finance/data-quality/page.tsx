// Data Quality drilldown — read-only audit of bad counterparty mappings.
//
// Per Day 6 amendment 6:
//   - shows active + rescinded overrides
//   - shows affected collections count
//   - before/after using v_collections_clean
//   - NO Tally write-back
//   - NO mutation of official customers/collections
//   - only local data_quality_overrides can be changed (Sprint 2 builds rescind UI)

import Link from "next/link";
import { ArrowLeft, CheckCircle2, TriangleAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";

export const dynamic = "force-dynamic";

interface OverrideRow {
  id: string;
  entity_type: string;
  entity_name: string;
  override_kind: string;
  reason: string | null;
  marked_by_role: string | null;
  marked_at: string;
  rescinded_at: string | null;
  rescind_reason: string | null;
}

export default async function DataQualityPage() {
  const sb = createAdminClient();

  const { data: overrides } = await sb
    .from("data_quality_overrides")
    .select("*")
    .order("marked_at", { ascending: false });

  const all = (overrides || []) as OverrideRow[];
  const active = all.filter((o) => !o.rescinded_at);
  const rescinded = all.filter((o) => o.rescinded_at);

  // Before / after counts: how many collections are affected by each override
  const { count: totalCollections } = await sb
    .from("collections")
    .select("id", { count: "exact", head: true });
  const { count: cleanCollections } = await sb
    .from("v_collections_clean")
    .select("id", { count: "exact", head: true });
  const filteredOut = (totalCollections || 0) - (cleanCollections || 0);

  // Per-override affected collections count (active overrides only)
  const perOverride: Record<string, number> = {};
  for (const o of active) {
    const { count } = await sb
      .from("collections")
      .select("id, customers!inner(customer_name)", { count: "exact", head: true })
      .ilike("customers.customer_name", o.entity_name);
    perOverride[o.id] = count || 0;
  }

  return (
    <PageGuard module="cash">
      <div className="space-y-5">
        <PageHeader
          title="Finance Data Quality"
          description="Read-only metadata — overrides do NOT alter Tally or official accounting records"
          actions={
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-3.5" /> Back to MD home
            </Link>
          }
        />

        {/* Headline before / after */}
        <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <SectionCard title="Total collections (Tally)" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{(totalCollections || 0).toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">Raw from Day Book parser — includes potentially-misattributed entries</p>
          </SectionCard>
          <SectionCard title="Clean collections (after overrides)" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-success">{(cleanCollections || 0).toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">From v_collections_clean view — used by dashboard</p>
          </SectionCard>
          <SectionCard title="Filtered out by overrides" bodyClassName="px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums text-warning">{filteredOut.toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">{active.length} active override{active.length === 1 ? "" : "s"}</p>
          </SectionCard>
        </section>

        {/* Active overrides */}
        <SectionCard
          title={`Active overrides (${active.length})`}
          description="These entities are excluded from collection intelligence on MD dashboard"
        >
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active overrides.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <Th>Entity</Th>
                    <Th>Type</Th>
                    <Th>Override kind</Th>
                    <Th align="right">Affected collections</Th>
                    <Th>Reason</Th>
                    <Th>Marked at</Th>
                    <Th>Marked by</Th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((o) => (
                    <tr key={o.id} className="border-t hover:bg-muted/20">
                      <Td><div className="font-semibold">{o.entity_name}</div></Td>
                      <Td><StatusPill tone="neutral">{o.entity_type}</StatusPill></Td>
                      <Td><StatusPill tone="warning">{o.override_kind}</StatusPill></Td>
                      <Td align="right" className="tabular-nums font-semibold">{(perOverride[o.id] || 0)}</Td>
                      <Td>{o.reason ?? "—"}</Td>
                      <Td>{new Date(o.marked_at).toLocaleString("en-IN")}</Td>
                      <Td>{o.marked_by_role ?? "system"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Rescinded */}
        <SectionCard
          title={`Rescinded overrides (${rescinded.length})`}
          description="Previously-active overrides that have been rescinded"
        >
          {rescinded.length === 0 ? (
            <p className="text-sm text-muted-foreground">No rescinded overrides yet.</p>
          ) : (
            <table className="min-w-full text-xs">
              <thead className="bg-muted/40">
                <tr className="text-left">
                  <Th>Entity</Th>
                  <Th>Marked at</Th>
                  <Th>Rescinded at</Th>
                  <Th>Rescind reason</Th>
                </tr>
              </thead>
              <tbody>
                {rescinded.map((o) => (
                  <tr key={o.id} className="border-t">
                    <Td><div className="font-medium">{o.entity_name}</div></Td>
                    <Td>{new Date(o.marked_at).toLocaleDateString("en-IN")}</Td>
                    <Td>{o.rescinded_at ? new Date(o.rescinded_at).toLocaleDateString("en-IN") : "—"}</Td>
                    <Td>{o.rescind_reason ?? "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </SectionCard>

        {/* Boundaries footer */}
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <CheckCircle2 className="size-3.5 text-success" />
            Read-only contract
          </p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Overrides are local metadata — they do NOT modify Tally, `customers`, `collections`, or any operational table</li>
            <li>The `collections` table remains untouched; only the dashboard&apos;s `v_collections_clean` view applies the filter</li>
            <li>Overrides are auditable (marked_by, marked_at) and rescindable</li>
            <li>Sprint 2 will add a one-click rescind UI here</li>
          </ul>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-xs">
          <TriangleAlert className="size-4 text-warning mt-0.5" />
          <p className="text-muted-foreground">
            <strong>What this page is NOT:</strong> a Tally cleanup tool. To clean the underlying Tally hygiene gap
            (e.g. the Sundry Debtors bulk-receipt issue documented in `BILL_WISE_LEDGER_GAP_REPORT.md`),
            the finance team must adjust Tally directly. This dashboard simply ensures bad mappings don&apos;t mislead the MD.
          </p>
        </div>
      </div>
    </PageGuard>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <th className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"} ${className ?? ""}`}>{children}</td>;
}

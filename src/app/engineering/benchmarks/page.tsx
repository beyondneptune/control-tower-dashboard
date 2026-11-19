// Engineering · Best Practice — Meridian vs world best-practice (ct_engineering_benchmarks)
// + the verified leak register (ct_chain_leaks). From the global BOM/drawing science deep dive.
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";
type Row = Record<string, string | number | null>;
const inr = (n: number) => "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");

const GAP = {
  behind: "bg-red-100 text-red-800 ring-1 ring-red-200",
  at: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  ahead: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  unknown: "bg-muted text-muted-foreground ring-1 ring-border",
} as Record<string, string>;
const SEV = {
  CRITICAL: "bg-red-100 text-red-800 ring-1 ring-red-200",
  HIGH: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  MEDIUM: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  LOW: "bg-muted text-muted-foreground ring-1 ring-border",
} as Record<string, string>;

export default async function BenchmarksPage() {
  const admin = createAdminClient();
  const [bRes, lRes] = await Promise.all([
    admin.from("ct_engineering_benchmarks").select("*"),
    admin.from("ct_chain_leaks").select("*"),
  ]);
  const benchmarks = (bRes.data ?? []) as Row[];
  const leaks = ((lRes.data ?? []) as Row[]).sort((a, b) => Math.abs(Number(b.rupee_impact)) - Math.abs(Number(a.rupee_impact)));
  const behind = benchmarks.filter((b) => b.gap_status === "behind").length;
  const leakTotal = leaks.reduce((a, l) => a + Math.abs(Number(l.rupee_impact) || 0), 0);
  const critical = leaks.filter((l) => l.severity === "CRITICAL").length;

  const areas = new Map<string, Row[]>();
  for (const b of benchmarks) {
    const grp = String(b.area ?? "Other").split("—")[0].trim();
    if (!areas.has(grp)) areas.set(grp, []);
    areas.get(grp)!.push(b);
  }

  const kpi = [
    { value: benchmarks.length, label: "Benchmarks", sub: "vs world best-practice" },
    { value: behind, label: "Behind the norm", sub: `${Math.round((behind / benchmarks.length) * 100)}% of metrics` },
    { value: inr(leakTotal), label: "Identified leaks", sub: `${leaks.length} items` },
    { value: critical, label: "Critical leaks", sub: "act this quarter" },
  ];

  return (
    <PageGuard module="engineering-benchmarks">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Best Practice — BOM &amp; Drawing Science</h1>
          <p className="text-sm text-muted-foreground">
            Meridian benchmarked against world best-practice + the latest published research. Every Meridian value is a
            DB query; every global norm is cited. Powder is ~67% of cost — this is a powder ledger, not a labour shop.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="text-2xl font-semibold">{k.value}</div>
              <div className="text-xs font-medium">{k.label}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Leak register — ranked by rupee impact ({leaks.length})</div>
          <div className="divide-y">
            {leaks.map((l) => (
              <div key={String(l.leak_id)} className="flex flex-wrap items-start gap-2 px-4 py-2 text-sm">
                <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${SEV[String(l.severity)] ?? SEV.LOW}`}>{String(l.severity)}</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{String(l.drawing_no ?? l.po_no ?? "—")}</span>
                <span className="shrink-0 font-semibold text-red-600">{Number(l.rupee_impact) < 0 ? "−" : ""}{inr(Number(l.rupee_impact))}</span>
                <span className="min-w-0 flex-1 text-muted-foreground">{String(l.detail ?? "")}</span>
              </div>
            ))}
          </div>
        </div>

        {[...areas.entries()].sort((a, b) => b[1].length - a[1].length).map(([area, rows]) => (
          <div key={area} className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">{area} <span className="text-xs text-muted-foreground">({rows.length})</span></div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Metric", "Meridian", "Global norm", "Gap", "Recommendation", "Src"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={String(b.id)} className="border-t align-top hover:bg-accent/30">
                      <td className="px-3 py-1.5">{String(b.metric ?? "—")}</td>
                      <td className="px-3 py-1.5">{String(b.meridian_value ?? "—")}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{String(b.global_norm ?? "—")}</td>
                      <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GAP[String(b.gap_status)] ?? GAP.unknown}`}>{String(b.gap_status ?? "—")}</span></td>
                      <td className="px-3 py-1.5">{String(b.recommendation ?? "—")}{b.profit_impact ? <span className="block text-xs text-emerald-700">{String(b.profit_impact)}</span> : null}</td>
                      <td className="px-3 py-1.5">{b.source_url ? <a href={String(b.source_url)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">↗</a> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </PageGuard>
  );
}

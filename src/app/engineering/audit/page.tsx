// Engineering · Audit — per-item verdicts on Meridian's drawings/BOMs/quotes/process vs best-practice
// (ct_engineering_verdicts). From the deep historical+foundational audit workflow.
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";
type Row = Record<string, string | null>;

const VBADGE: Record<string, string> = {
  wrong: "bg-red-100 text-red-800 ring-1 ring-red-200",
  needs_update: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  improve: "bg-blue-100 text-blue-800 ring-1 ring-blue-200",
  correct: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
};
const ORDER: Record<string, number> = { wrong: 0, needs_update: 1, improve: 2, correct: 3 };

export default async function AuditPage() {
  const admin = createAdminClient();
  // PostgREST caps at 1000; 255 rows fit, but page explicitly to be safe.
  const { data } = await admin.from("ct_engineering_verdicts").select("*").range(0, 999);
  const rows = ((data ?? []) as Row[]).sort(
    (a, b) => (ORDER[a.verdict ?? ""] ?? 9) - (ORDER[b.verdict ?? ""] ?? 9) || String(a.item_type).localeCompare(String(b.item_type)),
  );
  const c = (v: string) => rows.filter((r) => r.verdict === v).length;
  const byType = [...new Set(rows.map((r) => r.item_type ?? "—"))].map((t) => ({
    t, total: rows.filter((r) => r.item_type === t).length, wrong: rows.filter((r) => r.item_type === t && r.verdict === "wrong").length,
  })).sort((a, b) => b.total - a.total);

  const kpi = [
    { value: rows.length, label: "Item verdicts", sub: "drawings · BOMs · quotes · process" },
    { value: c("wrong"), label: "Wrong", sub: "incorrect vs best-practice" },
    { value: c("needs_update"), label: "Needs updating", sub: "incomplete / outdated" },
    { value: c("correct"), label: "Correct", sub: "to standard — credit due" },
  ];

  return (
    <PageGuard module="engineering-audit">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Audit — Drawing &amp; Costing Verdicts</h1>
          <p className="text-sm text-muted-foreground">
            Per-item audit of every drawing, BOM, quote, chain and procedure vs world best-practice &amp; the
            foundational research. The metallurgy is largely right; the <b>records and gates</b> are missing.
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

        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-sm font-medium">By item type</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {byType.map((b) => (
              <span key={b.t} className="rounded-md border px-2 py-1">
                <b>{b.t}</b> {b.total} <span className="text-red-600">({b.wrong} wrong)</span>
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">All verdicts ({rows.length}) — wrong first</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Verdict", "Type", "Item", "Dimension", "Finding", "Best practice", "Fix", "Src"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-t align-top hover:bg-accent/30">
                    <td className="px-3 py-1.5"><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${VBADGE[r.verdict ?? ""] ?? ""}`}>{String(r.verdict ?? "—")}</span></td>
                    <td className="px-3 py-1.5 text-xs">{String(r.item_type ?? "—")}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{String(r.item_ref ?? "—")}</td>
                    <td className="px-3 py-1.5 text-xs">{String(r.dimension ?? "—")}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{String(r.finding ?? "—")}{r.evidence ? <span className="block text-xs">↳ {String(r.evidence)}</span> : null}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{String(r.best_practice ?? "—")}</td>
                    <td className="px-3 py-1.5 text-xs">{String(r.recommendation ?? "—")}</td>
                    <td className="px-3 py-1.5">{r.source_url ? <a href={String(r.source_url)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">↗</a> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}

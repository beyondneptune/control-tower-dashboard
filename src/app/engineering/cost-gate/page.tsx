// Engineering · Cost Gate — should-cost + margin-floor gate (v_ct_should_cost_gate).
// Flags any drawing whose price (PO rate, else quote) is below should-cost or below the margin floor,
// so a below-cost/thin job is caught BEFORE the PO. The control the audit recommended (Tier 1, no capex).
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";
type Row = Record<string, string | number | null>;
const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(Number(n)).toLocaleString("en-IN"));

const GATE: Record<string, string> = {
  BLOCK: "bg-red-100 text-red-800 ring-1 ring-red-200",
  REVIEW: "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
  WATCH: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  OK: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  NO_PRICE: "bg-muted text-muted-foreground ring-1 ring-border",
};
const ORDER: Record<string, number> = { BLOCK: 0, REVIEW: 1, WATCH: 2, NO_PRICE: 3, OK: 4 };

export default async function CostGatePage() {
  const admin = createAdminClient();
  const { data } = await admin.from("v_ct_should_cost_gate").select("*");
  const rows = ((data ?? []) as Row[]).sort(
    (a, b) => (ORDER[String(a.gate_status)] ?? 9) - (ORDER[String(b.gate_status)] ?? 9) || Number(a.margin_pct) - Number(b.margin_pct),
  );
  const c = (s: string) => rows.filter((r) => r.gate_status === s).length;
  const belowCost = rows.filter((r) => r.gate_status === "BLOCK").reduce((a, r) => a + Math.abs(Number(r.margin_amt) || 0), 0);

  const kpi = [
    { value: c("BLOCK"), label: "BLOCK — below cost", sub: "hard-stop before PO", cls: "text-red-600" },
    { value: c("REVIEW"), label: "REVIEW — under 22%", sub: "finance sign-off", cls: "text-orange-600" },
    { value: c("WATCH"), label: "WATCH — under 28%", sub: "thin, watch powder", cls: "text-amber-600" },
    { value: c("OK"), label: "OK — 28%+", sub: "clear", cls: "text-emerald-600" },
  ];

  return (
    <PageGuard module="engineering-cost-gate">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Cost Gate — Should-Cost &amp; Margin Floor</h1>
          <p className="text-sm text-muted-foreground">
            Every drawing&apos;s price (PO rate, else quote) vs its BOM should-cost. The control that catches a
            below-cost or thin job <b>before the PO</b>. Floor: <b>BLOCK</b> below cost · <b>REVIEW</b> &lt;22% ·
            <b> WATCH</b> &lt;28% · <b>OK</b> ≥28%.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className={`text-2xl font-semibold ${k.cls}`}>{k.value}</div>
              <div className="text-xs font-medium">{k.label}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Note — the gate is only as good as the should-cost.</b> F002201524&apos;s &quot;latest&quot; BOM points
          at the wrong cheap cost variant (₹88,312 vs the correct ₹1,61,135 for INC625+Stellite), so the gate
          currently <i>under-flags</i> it. Resolving the cost-sheet revision lock (audit item) makes this gate fully reliable.
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Gate results ({rows.length} drawings) — worst first</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Gate", "Drawing", "Customer", "Alloy", "Should-cost", "Price", "Margin ₹", "Margin %", "Quote"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={String(r.drawing_no) + i} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${GATE[String(r.gate_status)] ?? ""}`}>{String(r.gate_status)}</span></td>
                    <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                    <td className="px-3 py-1.5 text-xs">{String(r.customer ?? "—").replace(/ (India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Associates Limited)/, "")}</td>
                    <td className="px-3 py-1.5 text-xs">{String(r.powder_alloy ?? "—")}</td>
                    <td className="px-3 py-1.5">{inr(r.should_cost as number)}</td>
                    <td className="px-3 py-1.5">{inr(r.effective_price as number)} {r.po_rate != null ? <span className="text-xs text-muted-foreground">(PO)</span> : <span className="text-xs text-muted-foreground">(quote)</span>}</td>
                    <td className={`px-3 py-1.5 ${Number(r.margin_amt) < 0 ? "text-red-600 font-medium" : ""}`}>{inr(r.margin_amt as number)}</td>
                    <td className={`px-3 py-1.5 font-medium ${Number(r.margin_pct) < 0 ? "text-red-600" : Number(r.margin_pct) < 22 ? "text-orange-600" : ""}`}>{r.margin_pct != null ? `${Number(r.margin_pct).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{String(r.pipl_quote_no ?? "—")}</td>
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

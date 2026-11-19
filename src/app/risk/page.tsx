// Risk Radar — Phase E#3 predictive signals. Forward-looking, ₹-weighted "where is
// money exposed and slipping": aging→risk benchmarked to the order book's OWN cycle
// times (NOT a fabricated forecast) + current-FY receivable risk + open-pipeline aging.
// READ-ONLY window over v_ct_predictive_risk / _summary / v_ct_pipeline_risk (migration 0041).
// Collection figures are a Tally bill-wise pull — STALE while Tally is down (banner surfaces it).
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";

type RiskRow = {
  risk_kind: string;
  grain: string | null;
  ref_label: string | null;
  customer: string | null;
  drawing_no: string | null;
  part: string | null;
  money_at_risk: number | string | null;
  age_days: number | null;
  ref_days: number | null;
  owner_role: string | null;
  basis_note: string | null;
  freshness: string | null;
  severity_ratio: number | string | null;
  risk_band: string | null;
  risk_score: number | string | null;
};
type SummaryRow = {
  risk_kind: string;
  positions: number | null;
  money_in_motion: number | string | null;
  elevated_positions: number | null;
  money_at_risk_elevated: number | string | null;
  critical_positions: number | null;
  money_at_risk_critical: number | string | null;
};
type PipelineRow = {
  quote_no: string | null;
  customer: string | null;
  quote_date: string | null;
  quote_value: number | string | null;
  has_bom_cost: boolean | null;
  age_days: number | null;
  conv_window_p90_days: number | null;
  window_flag: string | null;
};
type HealthRow = {
  stream: string;
  last_success: string | null;
  status: string | null;
};

const KIND_LABEL: Record<string, string> = {
  billing: "Billing leak",
  fulfillment: "Fulfilment",
  collection: "Collection",
};
const KIND_CHIP: Record<string, string> = {
  billing: "bg-rose-100 text-rose-800",
  fulfillment: "bg-amber-100 text-amber-900",
  collection: "bg-blue-100 text-blue-800",
};
const BAND_CHIP: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-200 text-amber-900",
  low: "bg-slate-200 text-slate-700",
  watch: "bg-slate-100 text-slate-500",
};

function inr(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function num(v: number | string | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function RiskRadarPage() {
  const admin = createAdminClient();
  const [riskRes, sumRes, pipeRes, healthRes] = await Promise.all([
    admin.from("v_ct_predictive_risk").select("*").order("risk_score", { ascending: false }).range(0, 999),
    admin.from("v_ct_predictive_risk_summary").select("*"),
    admin.from("v_ct_pipeline_risk").select("*").range(0, 999),
    admin.from("v_ct_sync_health").select("stream,last_success,status"),
  ]);
  const rows = (riskRes.data ?? []) as RiskRow[];
  const summary = (sumRes.data ?? []) as SummaryRow[];
  const pipeline = (pipeRes.data ?? []) as PipelineRow[];
  const health = (healthRes.data ?? []) as HealthRow[];

  const total = summary.find((s) => s.risk_kind === "ALL");
  const billwise = health.find((h) => h.stream === "Bill-wise outstanding");
  const billwiseStale = billwise && billwise.status !== "OK";

  const moneyInMotion = num(total?.money_in_motion);
  const elevated = num(total?.money_at_risk_elevated);
  const criticalN = num(total?.critical_positions);
  const pipelineValue = pipeline.reduce((a, p) => a + num(p.quote_value), 0);
  const pipelinePast = pipeline.filter((p) => p.window_flag === "past_typical_window").length;

  const kpi = [
    { value: inr(elevated), label: "At risk (elevated)", sub: "high + critical bands", tone: "text-red-600" },
    { value: criticalN, label: "Critical positions", sub: "≥2× the benchmark window", tone: "text-red-600" },
    { value: inr(moneyInMotion), label: "Money in motion", sub: "unbilled + outstanding", tone: "" },
    { value: inr(pipelineValue), label: "Open pipeline", sub: `${pipelinePast} past typical window`, tone: "" },
  ];

  const TOP = 40;
  // Show the genuinely-at-risk first; within-terms "watch" collection sorts to the bottom by score.
  const shown = rows.filter((r) => r.risk_band !== "watch").slice(0, TOP);
  const watchCount = rows.filter((r) => r.risk_band === "watch").length;
  const watchAmt = rows.filter((r) => r.risk_band === "watch").reduce((a, r) => a + num(r.money_at_risk), 0);

  return (
    <PageGuard module="predictive-risk">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Risk Radar — Where Money Is Exposed &amp; Slipping</h1>
          <p className="text-sm text-muted-foreground">
            Forward-looking, ₹-weighted risk over the digital-thread spine. Each position is scored by
            how far its <b>aging</b> has run past the order book&apos;s <b>own</b> observed cycle
            (order→invoice p90 = <b>53d</b>; overdue ref = 30d) — a deterministic risk index, <b>not a
            forecast</b>. Three lenses: <b>billing</b> (made, not invoiced), <b>fulfilment</b> (ordered,
            not yet invoiced), <b>collection</b> (invoiced, outstanding). Money positions are disjoint, so
            the total never double-counts.
          </p>
        </div>

        {billwiseStale ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            ⚠ <b>Collection figures are STALE.</b> Tally bill-wise sync is{" "}
            <b>{billwise?.status ?? "DOWN"}</b>
            {billwise?.last_success
              ? ` — last good pull ${new Date(billwise.last_success).toLocaleString("en-GB", { timeZone: "Europe/London" })} BST`
              : ""}
            . Outstanding shown is the last known Tally bill-wise position (current FY), not a live read.
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className={`text-2xl font-semibold ${k.tone}`}>{k.value}</div>
              <div className="text-xs font-medium">{k.label}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Summary by kind */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {summary
            .filter((s) => s.risk_kind !== "ALL")
            .map((s) => (
              <div key={s.risk_kind} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${KIND_CHIP[s.risk_kind] ?? "bg-slate-100"}`}>
                    {KIND_LABEL[s.risk_kind] ?? s.risk_kind}
                  </span>
                  <span className="text-xs text-muted-foreground">{num(s.positions)} positions</span>
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums">{inr(s.money_in_motion)}</div>
                <div className="text-xs text-muted-foreground">
                  in motion · <b className="text-red-600">{inr(s.money_at_risk_elevated)}</b> elevated (
                  {num(s.elevated_positions)})
                </div>
              </div>
            ))}
        </div>

        {/* Risk register */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="text-sm font-medium">
              Money-in-motion risk register{" "}
              <span className="text-xs text-muted-foreground">
                (top {Math.min(TOP, shown.length)} at-risk by score; {watchCount} within-terms positions hidden)
              </span>
            </div>
            <div className="text-xs text-muted-foreground">score = ₹ × aging ÷ benchmark</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Band</th>
                  <th className="px-3 py-2 font-medium">Lens</th>
                  <th className="px-3 py-2 font-medium">Ref</th>
                  <th className="px-3 py-2 text-right font-medium">₹ at risk</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 text-right font-medium">×Bench</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                  <th className="px-3 py-2 font-medium">Why</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-b align-top last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${BAND_CHIP[r.risk_band ?? ""] ?? "bg-slate-100"}`}>
                        {(r.risk_band ?? "—").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${KIND_CHIP[r.risk_kind] ?? "bg-slate-100"}`}>
                        {KIND_LABEL[r.risk_kind] ?? r.risk_kind}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {r.ref_label ?? "—"}
                      {r.customer ? <div className="text-[11px] text-muted-foreground">{r.customer}</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">{inr(r.money_at_risk)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                      {r.age_days == null ? "—" : `${r.age_days}d`}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                      {r.severity_ratio == null ? "—" : `${Number(r.severity_ratio).toFixed(2)}×`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs capitalize text-muted-foreground">{r.owner_role ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{r.basis_note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {inr(watchAmt)} across {watchCount} positions is <b>within terms / freshly ordered</b> (watch — not
            yet at risk) and hidden above. Billing/fulfilment ranked by order→invoice aging; a missing
            production date is <b>never</b> read as &quot;not produced&quot; (sample-grade capture). Act on
            billing/collection in <b>Finance</b>; fulfilment with <b>Production</b>.
          </div>
        </div>

        {/* Pipeline risk */}
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="text-sm font-medium">
              Open-pipeline aging{" "}
              <span className="text-xs text-muted-foreground">
                ({pipeline.length} open quotes · {inr(pipelineValue)})
              </span>
            </div>
            <div className="text-xs text-muted-foreground">past 21d window = chase / clean up</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Quote</th>
                  <th className="px-3 py-2 font-medium">Customer</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 font-medium">Window</th>
                  <th className="px-3 py-2 font-medium">Cost basis</th>
                </tr>
              </thead>
              <tbody>
                {pipeline.map((p, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{p.quote_no ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{p.customer ?? "—"}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums font-medium">{inr(p.quote_value)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                      {p.age_days == null ? "—" : `${p.age_days}d`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${p.window_flag === "past_typical_window" ? "bg-amber-200 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                        {p.window_flag === "past_typical_window" ? "past window" : "in window"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{p.has_bom_cost ? "BOM costed" : "no BOM cost"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            &quot;Past window&quot; = older than 90% of historical conversions took (won-cohort p90 = 21d) — a
            factual chase signal, <b>not</b> a per-quote probability. Population base rate (context): ~64% of
            dated quotes convert.
          </div>
        </div>
      </div>
    </PageGuard>
  );
}

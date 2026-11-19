// Engineering · Price Consistency — repeat-part price-drift monitor (Phase E#3 leak-detection +
// E#4 repeat-part standardization). The cost-gate checks price-vs-COST; the margin book rolls margin
// up; NEITHER checks price-vs-ITSELF. This surfaces where the SAME part (exact identity) has been
// quoted at different rates across POs, so pricing drift / a possible leak is visible.
//
// ⛔ HONESTY (Rule #0 / M-07 / M-21): the view groups on the FULL part identity (customer + drawing +
// size + EXACT part_desc) so it never collapses different parts that share a drawing code (the
// PRM-SCM front-vs-bonnet phantom-leak trap). It ASSERTS NOTHING about cause — a price rise over
// months is likely repricing (cobalt/powder inflation), not a leak; only a same-period swing is odd.
// "Variance size" is a sizing of the spread, NOT a loss and NOT a claim the top rate is correct.
// Re-pricing any part stays an MD decision (F002201524 16" is already in the MD review queue).
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";

type Hist = { po_no: string; po_date: string | null; rate: number; qty: number };
type Row = {
  customer: string | null;
  drawing_no: string | null;
  part_size: string | null;
  part_desc: string | null;
  n_lines: number | null;
  n_pos: number | null;
  n_rates: number | null;
  min_rate: number | null;
  max_rate: number | null;
  variance_span: number | null;
  spread_x: number | null;
  variance_value: number | null;
  total_qty: number | null;
  first_date: string | null;
  last_date: string | null;
  span_days: number | null;
  direction: string | null;
  review_flag: string | null;
  rate_history: Hist[] | null;
};

const inr = (n: unknown) => (n == null ? "—" : "₹" + Math.round(Number(n)).toLocaleString("en-IN"));
const shortCust = (s: unknown) =>
  String(s ?? "—").replace(
    / (India Pvt Ltd|India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Private Limited|Associates Limited)/,
    "",
  );

const FLAG: Record<string, { cls: string; label: string }> = {
  same_period: { cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200", label: "REVIEW · same window" },
  time_separated: { cls: "bg-sky-100 text-sky-800 ring-1 ring-sky-200", label: "TREND · over time" },
  minor: { cls: "bg-muted text-muted-foreground", label: "minor" },
  undated: { cls: "bg-muted text-muted-foreground", label: "undated" },
};

// Collapse the per-line history to one chip per (po_no, rate), qty summed, ordered by date.
function poHistory(h: Hist[] | null): { po_no: string; po_date: string | null; rate: number; qty: number }[] {
  if (!Array.isArray(h)) return [];
  const m = new Map<string, { po_no: string; po_date: string | null; rate: number; qty: number }>();
  for (const r of h) {
    const k = `${r.po_no}|${r.rate}`;
    const cur = m.get(k);
    if (cur) cur.qty += Number(r.qty) || 0;
    else m.set(k, { po_no: r.po_no, po_date: r.po_date, rate: Number(r.rate), qty: Number(r.qty) || 0 });
  }
  return [...m.values()].sort((a, b) => (a.po_date ?? "").localeCompare(b.po_date ?? "") || a.rate - b.rate);
}

export default async function PricingPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("v_ct_price_consistency").select("*");
  const rows = (data ?? []) as Row[];

  const reviewCount = rows.filter((r) => r.review_flag === "same_period").length;
  const trendCount = rows.filter((r) => r.review_flag === "time_separated").length;
  const widest = rows.reduce<Row | null>((a, r) => (a == null || Number(r.spread_x) > Number(a.spread_x) ? r : a), null);

  const kpi = [
    { value: String(rows.length), label: "Repeat parts priced inconsistently", sub: "same exact part, >1 rate across >1 PO", cls: "" },
    { value: String(reviewCount), label: "Same-window swings", sub: "rates close in time that differ — review for error/leak", cls: reviewCount > 0 ? "text-amber-600" : "text-emerald-600" },
    { value: String(trendCount), label: "Time-separated drift", sub: "spread built up over time — likely repricing, not a leak", cls: "text-sky-700" },
    {
      value: widest ? `${Number(widest.spread_x).toFixed(2)}×` : "—",
      label: "Widest spread",
      sub: widest ? `${widest.drawing_no} ${widest.part_size ? widest.part_size + '"' : ""} · ${inr(widest.min_rate)} → ${inr(widest.max_rate)}` : "—",
      cls: "text-orange-600",
    },
  ];

  // Most actionable first: same-window swings, then by spread.
  const ORDER: Record<string, number> = { same_period: 0, undated: 1, time_separated: 2, minor: 3 };
  const sorted = [...rows].sort(
    (a, b) =>
      (ORDER[String(a.review_flag)] ?? 9) - (ORDER[String(b.review_flag)] ?? 9) ||
      Number(b.spread_x) - Number(a.spread_x),
  );

  return (
    <PageGuard module="engineering-pricing">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Price Consistency — Repeat-Part Drift</h1>
          <p className="text-sm text-muted-foreground">
            Where the <i>same</i> part (exact drawing + size + description) has been ordered at different
            rates across POs. Meridian re-clads the same Apex Flow Systems valve plugs repeatedly, so a stable price
            is the norm — drift is either legitimate repricing or a margin leak worth a look.
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

        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
          <b>Read this honestly.</b> A price difference is <b>not automatically a leak</b>. A spread that
          builds up <b>over time</b> (<span className="font-medium">TREND</span>) is most likely real
          repricing — e.g. <b>FR0212D 4&quot;</b> rose ₹14,102 → ₹16,136 → ₹23,408 across Jan→Jun, in step
          with rising cobalt/powder cost. What deserves a <span className="font-medium">REVIEW</span> is a
          <b> same-window swing</b> that time can&apos;t explain — e.g. <b>F002201524 16&quot;</b> at
          ₹1,97,641 then ₹72,941 just <b>2 days apart</b> (already in the MD review queue). The
          &quot;variance size&quot; column sizes the spread for triage — it is <b>not</b> a loss and not a
          claim that the highest rate is the correct one. This screen only surfaces; <b>re-pricing is an
          MD decision</b>.
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">
            Repeat parts with price drift ({rows.length}) — review-worthy first
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Signal", "Drawing", "Part", "Size", "POs", "Rate range", "Spread", "Price history (date · rate · qty)", "Variance size"].map((h, i) => (
                    <th key={h} className={`px-3 py-2 font-medium ${i >= 4 && i <= 6 ? "text-right" : i === 8 ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const flag = FLAG[String(r.review_flag)] ?? { cls: "bg-muted text-muted-foreground", label: String(r.review_flag ?? "—") };
                  const hist = poHistory(r.rate_history);
                  const arrow = r.direction === "rising" ? "↑" : r.direction === "falling" ? "↓" : "→";
                  return (
                    <tr key={String(r.drawing_no) + String(r.part_desc) + i} className="border-t align-top hover:bg-accent/30">
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${flag.cls}`}>{flag.label}</span>
                        {r.span_days != null && (
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{arrow} {r.span_days}d span</div>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                      <td className="px-3 py-2 text-xs">
                        <div className="max-w-[16rem] truncate" title={String(r.part_desc ?? "")}>{String(r.part_desc ?? "—")}</div>
                        <div className="text-[11px] text-muted-foreground">{shortCust(r.customer)}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.part_size == null ? "—" : `${r.part_size}"`}</td>
                      <td className="px-3 py-2 text-right text-xs">{String(r.n_pos ?? "—")}</td>
                      <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                        {inr(r.min_rate)} <span className="text-muted-foreground">→</span> {inr(r.max_rate)}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${Number(r.spread_x) >= 1.5 ? "text-orange-600" : Number(r.spread_x) >= 1.15 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {r.spread_x == null ? "—" : `${Number(r.spread_x).toFixed(2)}×`}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-1">
                          {hist.map((h, j) => (
                            <span key={h.po_no + j} className="inline-flex items-center gap-1 rounded border bg-muted/40 px-1.5 py-0.5 text-[11px]">
                              <span className="text-muted-foreground">{h.po_date ?? "—"}</span>
                              <span className="font-medium">{inr(h.rate)}</span>
                              <span className="text-muted-foreground">×{h.qty}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground">{inr(r.variance_value)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            Grain = exact part identity (customer + drawing + size + description) — different parts that
            share a drawing code are never merged (M-07/M-21). &quot;Variance size&quot; = ₹ if every
            below-top order had matched the highest rate seen; a triage size, <b>not</b> a loss. Source:
            <span className="font-mono"> ct_customer_po_lines</span> (line-grain, M-05) + PO header date.
          </div>
        </div>
      </div>
    </PageGuard>
  );
}

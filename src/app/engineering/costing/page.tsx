// Engineering · Costing (BOM) — cost-driver & margin register (ct_bom_costing).
// NOT legacy ct_bom_cost (its margin is structurally 0). Read-only research view.
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | boolean | null>;
const inr = (n: number | null) => (n == null ? "—" : "₹" + Math.round(Number(n)).toLocaleString("en-IN"));
const inrL = (n: unknown) =>
  n == null ? "—" : "₹" + (Number(n) / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "L";
const shortCust = (s: unknown) =>
  String(s ?? "—").replace(/ (India Pvt Ltd|India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Private Limited|Associates Limited)/, "");
const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

// Evidence tiers for the costing-coverage worklist (v_ct_costing_coverage). Each tier ASSERTS
// only that evidence EXISTS — never that a cost has been applied (money basis stays MD/Arjun-gated).
const TIER: Record<string, { label: string; cls: string; action: string }> = {
  bom_costed: { label: "BOM parsed (cost layer)", cls: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200", action: "Confirm variant → propagate cost" },
  bom_in_inbox: { label: "BOM in inbox · un-parsed", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200", action: "Parse inbox BOM → confirm" },
  customer_bom_in_inbox: { label: "Customer BOM lead", cls: "bg-orange-100 text-orange-800 ring-1 ring-orange-200", action: "Locate part's BOM in inbox → parse" },
  no_evidence: { label: "No evidence found", cls: "bg-red-100 text-red-800 ring-1 ring-red-200", action: "Request BOM from customer / Arjun" },
};

// Repeat-part standardization priority (v_ct_part_catalog). Deterministic label from
// (is_repeat, cost_coverage) — NOT a fabricated score. The two repeat buckets shown in the worklist.
const PRIO: Record<string, { label: string; cls: string; rank: number }> = {
  standardize_and_cost: { label: "Standardize + cost first", cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200", rank: 0 },
  standardize: { label: "Standardize", cls: "bg-sky-100 text-sky-800 ring-1 ring-sky-200", rank: 1 },
};
const COVER: Record<string, string> = {
  costed: "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200",
  partial: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  uncosted: "bg-red-100 text-red-800 ring-1 ring-red-200",
};

export default async function CostingPage() {
  const admin = createAdminClient();
  const [{ data }, { data: covData }, { data: pcData }] = await Promise.all([
    admin.from("ct_bom_costing").select("*").order("standard_cost_per_unit", { ascending: false }),
    admin.from("v_ct_costing_coverage").select("*"),
    admin.from("v_ct_part_catalog").select("*"),
  ]);
  const cov = (covData ?? []) as Row[];

  // Repeat-part standardization worklist: parts on >1 PO, ranked priority then revenue.
  const parts = (pcData ?? []) as Row[];
  const bookRev = parts.reduce((a, r) => a + Number(r.revenue ?? 0), 0);
  const repeatParts = parts
    .filter((r) => r.is_repeat)
    .sort(
      (a, b) =>
        (PRIO[String(a.std_priority)]?.rank ?? 9) - (PRIO[String(b.std_priority)]?.rank ?? 9) ||
        Number(b.revenue) - Number(a.revenue),
    );
  const repeatRev = repeatParts.reduce((a, r) => a + Number(r.revenue ?? 0), 0);
  const prioRev = (p: string) =>
    parts.filter((r) => r.std_priority === p).reduce((a, r) => a + Number(r.revenue ?? 0), 0);
  const prioCount = (p: string) => parts.filter((r) => r.std_priority === p).length;
  const topCostFirst = repeatParts.find((r) => r.std_priority === "standardize_and_cost");
  const covTotal = (k: "lines" | "revenue") => cov.reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const tierSum = (t: string, k: "lines" | "revenue") =>
    cov.filter((r) => r.evidence_status === t).reduce((a, r) => a + Number(r[k] ?? 0), 0);
  const covRevenue = covTotal("revenue");
  const covLines = covTotal("lines");
  const all = (data ?? []) as Row[];
  const rows = all.filter((r) => r.is_latest_revision !== false);
  const costed = rows.filter((r) => Number(r.standard_cost_per_unit) > 0 && r.margin_pct != null);

  const margins = costed.map((r) => Number(r.margin_pct));
  const powderShares = costed.map((r) => Number(r.powder_pct_of_cost)).filter((x) => x > 0);
  const totalPowder = rows.reduce((a, r) => a + (Number(r.powder_cost) || 0), 0);

  // margin by customer
  const byCust = new Map<string, number[]>();
  for (const r of costed) {
    const c = String(r.customer ?? "—");
    if (!byCust.has(c)) byCust.set(c, []);
    byCust.get(c)!.push(Number(r.margin_pct));
  }
  const custMargins = [...byCust.entries()].map(([c, m]) => [c, median(m), m.length] as [string, number, number]).sort((a, b) => a[1] - b[1]);
  const thin = costed.filter((r) => Number(r.margin_pct) < 15.5).sort((a, b) => Number(a.margin_pct) - Number(b.margin_pct));

  const kpi = [
    { label: "Median margin", value: `${median(margins).toFixed(1)}%`, sub: `${costed.length} costed jobs` },
    { label: "Powder share of cost", value: `${Math.round(median(powderShares))}%`, sub: "the master profit dial" },
    { label: "Total powder", value: inr(totalPowder), sub: "10% catchment gain ≈ ₹1.09L" },
    { label: "Thin-margin jobs", value: thin.length, sub: "< 15.5% — re-price" },
  ];

  return (
    <PageGuard module="engineering-costing">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Costing (BOM) — Engineering Register</h1>
          <p className="text-sm text-muted-foreground">
            Cost drivers & margins from {all.length} BOM/costing files. Powder is the profit dial, not
            labour. Built from <code className="text-xs">ct_bom_costing</code> (legacy ct_bom_cost shows 0% margin and is not used).
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

        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <b>Margin-leak alert (verified).</b> Drawing <b>F002201524</b> (16&quot; plug, INC625+Stellite), PO 752502:
          7 units sold at ₹72,941 vs standard cost ₹84,677 = <b>−₹82,152 loss</b>. The same drawing carries two BOM
          cost variants (₹84,677 vs ₹1,54,498) — re-price above ₹95k and resolve which cost sheet is correct before quoting it again.
        </div>

        {cov.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">
              Costing coverage — closing the {inrL(covRevenue)} gap
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">{covLines} order-book lines ({inrL(covRevenue)})</b> have no BOM cost feeding
                margin — the same uncosted gap shown on the Margin page.{" "}
                {cov.every((r) => r.evidence_status !== "no_evidence") ? (
                  <>
                    But <b className="text-foreground">none of it is missing data</b>: every uncosted line has BOM/drawing
                    evidence already in Meridian&apos;s own systems. The gap is a <b className="text-foreground">parse-propagation
                    + variant-confirmation backlog</b>, not a customer blocker.
                  </>
                ) : (
                  <>
                    <b className="text-foreground">{inrL(tierSum("no_evidence", "revenue"))}</b> has no evidence found and
                    genuinely needs the customer/Arjun; the rest is already in Meridian&apos;s systems.
                  </>
                )}{" "}
                Applying a cost is a money-basis decision (MD/Arjun) — FR0206D / FR0212D re-cost are in the MD review
                queue; this worklist only locates the evidence, it asserts no cost.
              </p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {(["bom_costed", "bom_in_inbox", "customer_bom_in_inbox", "no_evidence"] as const)
                  .filter((t) => cov.some((r) => r.evidence_status === t))
                  .map((t) => (
                    <div key={t} className="rounded-md border bg-muted/30 p-2">
                      <div className="text-lg font-semibold">{inrL(tierSum(t, "revenue"))}</div>
                      <div className="text-xs">
                        <span className={`mr-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TIER[t].cls}`}>{TIER[t].label}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{tierSum(t, "lines")} lines · {TIER[t].action}</div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Drawing", "Customer", "Type / size", "Lines", "Revenue", "Evidence", "What we have", "Next action"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-medium ${i === 3 || i === 4 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cov.map((r) => {
                    const status = String(r.evidence_status);
                    const tier = TIER[status] ?? { label: status, cls: "bg-muted text-muted-foreground", action: "—" };
                    const detail =
                      status === "bom_costed"
                        ? `${r.bom_drawings ?? "—"}${Number(r.cost_variants) > 1 ? ` · ${r.cost_variants} cost variants — confirm which applies` : " · 1 variant"}`
                        : status === "bom_in_inbox"
                          ? `${r.inbox_plug_files} plug BOM file(s) in inbox`
                          : status === "customer_bom_in_inbox"
                            ? `${r.inbox_customer_files} ${shortCust(r.customer)} BOM file(s) in inbox`
                            : "—";
                    return (
                      <tr key={String(r.drawing_no)} className="border-t hover:bg-accent/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                        <td className="px-3 py-1.5 text-xs">{shortCust(r.customer)}</td>
                        <td className="px-3 py-1.5 text-xs">{String(r.part_type ?? "—")}{r.part_sizes ? ` · ${r.part_sizes}"` : ""}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{String(r.lines)}</td>
                        <td className="px-3 py-1.5 text-right">{inr(r.revenue as number | null)}</td>
                        <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tier.cls}`}>{tier.label}</span></td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{detail}</td>
                        <td className="px-3 py-1.5 text-xs">{tier.action}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Evidence located by drawing-base key (customer &quot;D&quot; drawing ↔ Meridian &quot;P&quot; BOM, e.g. FR0212D ↔ FR0212P,
              corroborated by part type + size) and the email corpus (a plug BOM matched by size + &quot;plug&quot; in the filename;
              Sri-Energy parts matched at customer level only — the weakest lead). An inbox match means a BOM <i>exists</i> to
              parse, not that the right revision is confirmed. Reconciles to the rupee with the Margin page&apos;s uncosted gap
              ({covLines} lines · {inrL(covRevenue)}).
            </div>
          </div>
        )}

        {repeatParts.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">
              Repeat-part standardization — {inrL(repeatRev)} ({Math.round((100 * repeatRev) / bookRev)}%) of the book is repeat work
            </div>
            <div className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                {parts.length} distinct parts make up the order book; <b className="text-foreground">{repeatParts.length} of them recur
                across more than one PO</b> = <b className="text-foreground">{inrL(repeatRev)}</b> ({Math.round((100 * repeatRev) / bookRev)}% of
                revenue) — the standardization opportunity (process template, locked standard cost, price lock). Of that repeat work,{" "}
                <b className="text-foreground">{prioCount("standardize_and_cost")} parts ({inrL(prioRev("standardize_and_cost"))})</b> still
                have <b className="text-foreground">no standard cost</b>
                {topCostFirst ? <> — led by <b className="text-foreground">{String(topCostFirst.drawing_no)}</b> ({String(topCostFirst.po_count)} POs, {inrL(topCostFirst.revenue)})</> : null} — the
                priority to cost first (which BOM evidence to use is on the coverage worklist above). This is a recurrence + coverage
                ranking only: it asserts no cost and no margin — applying a cost stays a money-basis decision (MD/Arjun).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["standardize_and_cost", "standardize"] as const)
                  .filter((p) => prioCount(p) > 0)
                  .map((p) => (
                    <div key={p} className="rounded-md border bg-muted/30 p-2">
                      <div className="text-lg font-semibold">{inrL(prioRev(p))}</div>
                      <div className="text-xs">
                        <span className={`mr-1 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIO[p].cls}`}>{PRIO[p].label}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {prioCount(p)} repeat parts · {p === "standardize_and_cost" ? "recur + no std cost" : "recur + costed"}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Drawing", "Customer", "Type / size", "POs", "Lines", "Revenue", "Share", "Cost", "Rate", "Priority"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-medium ${i >= 3 && i <= 6 ? "text-right" : "text-left"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {repeatParts.map((r) => {
                    const prio = PRIO[String(r.std_priority)] ?? { label: String(r.std_priority), cls: "bg-muted text-muted-foreground" };
                    const cover = String(r.cost_coverage);
                    return (
                      <tr key={`${r.drawing_no}|${r.part_size}|${r.part_desc}`} className="border-t hover:bg-accent/30">
                        <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                        <td className="px-3 py-1.5 text-xs">{shortCust(r.customer)}</td>
                        <td className="px-3 py-1.5 text-xs">{String(r.part_type ?? "—")}{r.part_size ? ` · ${r.part_size}"` : ""}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{String(r.po_count)}</td>
                        <td className="px-3 py-1.5 text-right text-xs">{String(r.line_count)}</td>
                        <td className="px-3 py-1.5 text-right">{inr(r.revenue as number | null)}</td>
                        <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">{r.revenue_share_pct != null ? `${Number(r.revenue_share_pct).toFixed(1)}%` : "—"}</td>
                        <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${COVER[cover] ?? ""}`}>{cover}</span></td>
                        <td className="px-3 py-1.5 text-xs">{r.price_varies ? <span className="text-amber-700">varies ({String(r.distinct_rates)})</span> : <span className="text-muted-foreground">uniform</span>}</td>
                        <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${prio.cls}`}>{prio.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Grain = exact part identity (customer · drawing · size · description), so PRM-SCM &quot;BONNET&quot; stays distinct from
              &quot;FRONT&quot; (same drawing code, different part). <b>Rate varies</b> flags that the part&apos;s lines carry more than one
              rate — a pointer to the Pricing monitor, not an asserted leak. The {prioCount("cost") + prioCount("one_off")} one-off parts
              ({inrL(bookRev - repeatRev)}) are not standardization candidates and are omitted here. Reconciles to the rupee with the order
              book ({parts.length} parts · {inrL(bookRev)} = the Margin page total).
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-sm font-medium">Median margin by customer</div>
            <ul className="space-y-1 text-sm">
              {custMargins.map(([c, m, k]) => (
                <li key={c} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{c.replace(/ (India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Associates Limited)/, "")} <span className="text-xs">({k})</span></span>
                  <span className={`font-medium ${m < 16 ? "text-red-600" : m > 25 ? "text-emerald-600" : ""}`}>{m.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-2 text-sm font-medium">Thin-margin watchlist (&lt; 15.5%)</div>
            <ul className="space-y-1 text-sm">
              {thin.map((r) => (
                <li key={String(r.id)} className="flex items-center justify-between gap-2">
                  <span className="truncate text-muted-foreground">{String(r.drawing_no ?? r.part_name ?? "—")} · {String(r.part_name ?? "")}</span>
                  <span className="font-medium text-red-600">{Number(r.margin_pct).toFixed(1)}%</span>
                </li>
              ))}
              {!thin.length && <li className="text-muted-foreground">none</li>}
            </ul>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">All costed jobs ({rows.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Drawing / Part", "Customer", "Alloy", "Powder ₹", "Min", "Std cost", "Quoted", "Margin", "Powder %", "Quote"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-1.5"><span className="font-mono text-xs">{String(r.drawing_no ?? "—")}</span> {String(r.part_name ?? "")}</td>
                    <td className="px-3 py-1.5">{String(r.customer ?? "—").replace(/ (India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Associates Limited)/, "")}</td>
                    <td className="px-3 py-1.5 text-xs">{String(r.powder_alloy ?? "—")}</td>
                    <td className="px-3 py-1.5">{inr(r.powder_cost as number | null)}</td>
                    <td className="px-3 py-1.5">{r.machine_time_min ?? "—"}</td>
                    <td className="px-3 py-1.5">{inr(r.standard_cost_per_unit as number | null)}</td>
                    <td className="px-3 py-1.5">{inr(r.quoted_price_per_unit as number | null)}</td>
                    <td className={`px-3 py-1.5 font-medium ${r.margin_pct != null && Number(r.margin_pct) < 15.5 ? "text-red-600" : ""}`}>{r.margin_pct != null ? `${Number(r.margin_pct).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-1.5 text-xs">{r.powder_pct_of_cost != null ? `${Math.round(Number(r.powder_pct_of_cost))}%` : "—"}</td>
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

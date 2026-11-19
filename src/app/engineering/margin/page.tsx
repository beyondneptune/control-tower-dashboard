// Engineering · Margin — order-book margin intelligence (Phase E#1).
// Rolls up the per-line job margin (v_ct_job_profitability, the M-21-safe 161-row base) to the
// grain a decision-maker reads: total book, how much of it we can see a cost for (coverage),
// the TRUSTED blended margin on the costed-and-trusted slice, and where the variance lives
// (by customer / part size / part type) — plus the actionable margin exceptions.
//
// ⛔ HONESTY (Rule #0 / M-21): trusted margin SUMS ONLY margin_band ok+thin+loss. The 7
// 'anomaly_verify' lines (F002201524 16", the disputed cost variant already in the MD review
// queue) are NEVER summed into the headline — shown separately as "verify". coverage_pct makes
// clear the trusted % is on the costed slice, not the whole ₹1.85cr book (56% is uncosted).
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";
type Row = Record<string, string | number | null>;
const num = (n: unknown) => (n == null ? null : Number(n));
const inr = (n: unknown) => (n == null ? "—" : "₹" + Math.round(Number(n)).toLocaleString("en-IN"));
const inrL = (n: unknown) =>
  n == null ? "—" : "₹" + (Number(n) / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 }) + "L";
const pct = (n: unknown) => (n == null ? "—" : `${Number(n).toFixed(1)}%`);
const shortCust = (s: unknown) =>
  String(s ?? "—").replace(/ (India Pvt Ltd|India Controls Pvt Ltd|Valves Private Limited|Spares Pvt Limited|Private Limited|Associates Limited)/, "");

const BAND: Record<string, { cls: string; label: string }> = {
  loss: { cls: "bg-red-100 text-red-800 ring-1 ring-red-200", label: "LOSS" },
  thin: { cls: "bg-amber-100 text-amber-800 ring-1 ring-amber-200", label: "THIN" },
  anomaly_verify: { cls: "bg-purple-100 text-purple-800 ring-1 ring-purple-200", label: "VERIFY" },
};

export default async function MarginPage() {
  const admin = createAdminClient();
  const [{ data: bookRows }, { data: dimRows }, { data: jobRows }, { data: powderRows }, { data: fragRows }] =
    await Promise.all([
      admin.from("v_ct_margin_book").select("*"),
      admin.from("v_ct_margin_by_dimension").select("*"),
      admin
        .from("v_ct_job_profitability")
        .select("po_no,line_no,customer,drawing_no,part_type,part_size,qty,po_rate,revenue,std_cost_pp,powder_pp,process_pp,std_margin_value,std_margin_pct,margin_band"),
      admin.from("v_ct_powder_exposure").select("*"),
      admin.from("v_ct_powder_fragility").select("*"),
    ]);

  const b = (bookRows?.[0] ?? {}) as Row;
  const dims = (dimRows ?? []) as Row[];
  const jobs = (jobRows ?? []) as Row[];
  const pe = (powderRows?.[0] ?? {}) as Row;
  const frag = (fragRows ?? []) as Row[];

  // Per-part powder FRAGILITY (v_ct_powder_fragility) — which costed+trusted parts go loss-making
  // FIRST under a cobalt/powder shock (breakeven = the % powder rise that zeroes that part's margin,
  // a deterministic what-if), and where the powder cost CONCENTRATES. The book-average +36.3% cliff
  // masks far more fragile parts. NOTE the most fragile are often SMALL — the page shows powder-share
  // alongside so "most fragile" is never read as "biggest priority".
  const bookBreakeven = num(frag[0]?.book_breakeven);
  const fragByBreakeven = [...frag].sort((a, c) => {
    const ba = num(a.breakeven_powder_rise_pct);
    const bc = num(c.breakeven_powder_rise_pct);
    if (ba == null) return 1; // already_below_cost → last
    if (bc == null) return -1;
    return ba - bc;
  });
  const highFrag = fragByBreakeven.filter((r) => r.fragility === "high"); // more fragile than the book
  const mostFragileBe = num(fragByBreakeven[0]?.breakeven_powder_rise_pct);
  const top5Share = [...frag]
    .sort((a, c) => Number(c.powder_cost) - Number(a.powder_cost))
    .slice(0, 5)
    .reduce((s, r) => s + (num(r.powder_share_pct) ?? 0), 0);

  // Powder (cobalt) exposure — deterministic sensitivity on the costed+trusted slice.
  // margin falls by (powder share of revenue) per 1% powder-cost rise, price held.
  const powderPctRev = num(pe.powder_pct_of_rev);
  const marginNow = num(pe.margin_pct);
  const sensitivity = [10, 25, 50].map((step) => ({
    step,
    margin: marginNow != null && powderPctRev != null ? marginNow - (step * powderPctRev) / 100 : null,
  }));
  // where the powder exposure concentrates — top costed+trusted parts by powder cost.
  const powderParts = jobs
    .filter((r) => ["ok", "thin", "loss"].includes(String(r.margin_band)) && r.std_cost_pp != null && r.powder_pp != null)
    .map((r) => {
      const powderCost = Number(r.powder_pp) * Number(r.qty);
      const rev = Number(r.revenue);
      return {
        drawing: String(r.drawing_no ?? "—"),
        customer: r.customer,
        size: r.part_size,
        powderCost,
        powderOfRev: rev > 0 ? (powderCost / rev) * 100 : null,
      };
    })
    .sort((a, b) => b.powderCost - a.powderCost)
    .slice(0, 6);

  const coverage = num(b.coverage_pct) ?? 0;
  const kpi = [
    { value: inrL(b.total_revenue), label: `Order book (taxable)`, sub: `${b.total_lines ?? "—"} PO lines`, cls: "" },
    { value: pct(b.coverage_pct), label: "Cost coverage", sub: `${inrL(b.costed_revenue)} of ${b.costed_lines ?? "—"}/${b.total_lines ?? "—"} lines have a BOM cost`, cls: coverage < 60 ? "text-orange-600" : "text-emerald-600" },
    { value: pct(b.trusted_margin_pct), label: "Trusted margin", sub: `on the ${inrL(b.trusted_revenue)} costed+trusted slice only`, cls: (num(b.trusted_margin_pct) ?? 0) < 22 ? "text-amber-600" : "text-emerald-600" },
    { value: inrL(b.uncosted_revenue), label: "Uncosted (gap)", sub: `${b.uncosted_lines ?? "—"} lines with no cost basis — BOM backfill priority`, cls: "text-muted-foreground" },
  ];

  const dimsByType = (t: string) =>
    dims.filter((d) => d.dimension === t).sort((a, b) => Number(b.revenue) - Number(a.revenue));

  const ORDER: Record<string, number> = { loss: 0, anomaly_verify: 1, thin: 2 };
  const exceptions = jobs
    .filter((r) => ["loss", "thin", "anomaly_verify"].includes(String(r.margin_band)))
    .sort(
      (a, b) =>
        (ORDER[String(a.margin_band)] ?? 9) - (ORDER[String(b.margin_band)] ?? 9) ||
        Number(a.std_margin_pct ?? 0) - Number(b.std_margin_pct ?? 0),
    );

  const dimTable = (title: string, type: string) => {
    const rows = dimsByType(type);
    return (
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2 text-sm font-medium">{title}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                {["", "Lines", "Revenue", "Coverage", "Trusted margin %", "Verify", "Uncosted"].map((h, i) => (
                  <th key={h + i} className={`px-3 py-2 font-medium ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={String(r.label) + i} className="border-t hover:bg-accent/30">
                  <td className="px-3 py-1.5 text-xs font-medium">{type === "customer" ? shortCust(r.label) : type === "part_size" ? `${r.label}"` : String(r.label)}</td>
                  <td className="px-3 py-1.5 text-right text-xs">{String(r.lines)}</td>
                  <td className="px-3 py-1.5 text-right">{inr(r.revenue)}</td>
                  <td className={`px-3 py-1.5 text-right text-xs ${(num(r.coverage_pct) ?? 0) < 60 ? "text-orange-600" : ""}`}>{r.coverage_pct == null ? "0%" : pct(r.coverage_pct)}</td>
                  <td className={`px-3 py-1.5 text-right font-medium ${r.trusted_margin_pct == null ? "text-muted-foreground" : (num(r.trusted_margin_pct) ?? 0) < 22 ? "text-amber-600" : "text-emerald-700"}`}>{r.trusted_margin_pct == null ? "—" : pct(r.trusted_margin_pct)}</td>
                  <td className={`px-3 py-1.5 text-right text-xs ${Number(r.verify_lines) > 0 ? "text-purple-700 font-medium" : "text-muted-foreground"}`}>{String(r.verify_lines)}</td>
                  <td className={`px-3 py-1.5 text-right text-xs ${Number(r.uncosted_lines) > 0 ? "text-orange-600" : "text-muted-foreground"}`}>{String(r.uncosted_lines)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <PageGuard module="engineering-margin">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Margin — Order-Book Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Realised standard margin across the live order book (161 PO lines), rolled up from per-line job
            profitability. Shows what we can see a cost for, the blended margin on that slice, and where the
            variance lives — so pricing leaks and the costing gap are visible at a glance.
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
          <b>Read this honestly.</b> The <b>{pct(b.trusted_margin_pct)}</b> trusted margin is the margin on the{" "}
          <b>{inrL(b.trusted_revenue)}</b> of revenue that has a BOM cost <i>and</i> a trusted figure — only{" "}
          <b>{pct(b.coverage_pct)}</b> of the ₹{(Number(b.total_revenue) / 100000).toFixed(0)}L book. It is{" "}
          <b>not</b> the whole-book margin: <b>{b.uncosted_lines ?? "—"} lines (₹{((Number(b.uncosted_revenue) || 0) / 100000).toFixed(2)}L)</b> have
          no cost basis yet, and <b>{b.verify_lines ?? "—"} verify-flagged lines</b> (all F002201524 16", the
          disputed ₹1,54,498-vs-₹72,941 cost variant in the MD review queue) are <b>excluded</b> from the
          figure, never asserted. Closing the costing gap is the way to make this a true book margin.
        </div>

        {pe.costed_lines != null && (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">
              Cost structure &amp; powder (cobalt) exposure — costed+trusted slice
            </div>
            <div className="grid gap-4 p-4 lg:grid-cols-2">
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Of the <b className="text-foreground">{inrL(pe.std_cost)}</b> standard cost on the{" "}
                  <b className="text-foreground">{String(pe.costed_lines)}</b> costed+trusted lines,{" "}
                  <b className="text-foreground">{pct(pe.powder_pct_of_cost)}</b> is <b>powder</b> (cobalt-based
                  stellite) and {pct(pe.process_pct_of_cost)} is process/other. Powder alone is{" "}
                  <b className="text-foreground">{pct(pe.powder_pct_of_rev)}</b> of revenue — so the margin is
                  heavily geared to the powder price.
                </p>
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>Powder {pct(pe.powder_pct_of_cost)}</span>
                    <span>Process / other {pct(pe.process_pct_of_cost)}</span>
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded ring-1 ring-border">
                    <div className="bg-orange-500" style={{ width: `${num(pe.powder_pct_of_cost) ?? 0}%` }} />
                    <div className="bg-slate-300" style={{ width: `${num(pe.process_pct_of_cost) ?? 0}%` }} />
                  </div>
                </div>
                <div className="rounded-md bg-orange-50 p-3 text-sm text-orange-900 ring-1 ring-orange-200">
                  A <b>+{pct(pe.breakeven_powder_rise_pct)}</b> rise in powder cost (price unchanged) erases the
                  entire <b>{pct(pe.margin_pct)}</b> margin on this slice. The Strategy tab cites cobalt — powder&apos;s
                  main input — at <b>+68.9% YoY</b>: a real, not hypothetical, threat to this book.
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">
                  Margin if powder cost rises (price held)
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1.5 text-left font-medium">Powder cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Resulting margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-3 py-1.5">today</td>
                      <td className="px-3 py-1.5 text-right font-medium text-emerald-700">{pct(pe.margin_pct)}</td>
                    </tr>
                    {sensitivity.map((s) => (
                      <tr key={s.step} className="border-t">
                        <td className="px-3 py-1.5">+{s.step}%</td>
                        <td
                          className={`px-3 py-1.5 text-right font-medium ${
                            s.margin == null
                              ? ""
                              : s.margin < 0
                                ? "text-red-600"
                                : s.margin < 12
                                  ? "text-amber-600"
                                  : "text-emerald-700"
                          }`}
                        >
                          {s.margin == null ? "—" : `${s.margin.toFixed(1)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">
                  Deterministic sensitivity (a what-if on powder price), not a forecast. Assumes price held and a
                  1:1 powder-cost move; powder is cobalt-dominated stellite but not pure cobalt.
                </p>
              </div>
            </div>
            <div className="border-t px-4 py-2 text-xs font-medium uppercase text-muted-foreground">
              Where the powder exposure concentrates (top costed parts by powder cost)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Drawing</th>
                    <th className="px-3 py-2 text-left font-medium">Customer</th>
                    <th className="px-3 py-2 text-left font-medium">Size</th>
                    <th className="px-3 py-2 text-right font-medium">Powder cost (line)</th>
                    <th className="px-3 py-2 text-right font-medium">Powder % of revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {powderParts.map((p, i) => (
                    <tr key={p.drawing + i} className="border-t hover:bg-accent/30">
                      <td className="px-3 py-1.5 font-mono text-xs">{p.drawing}</td>
                      <td className="px-3 py-1.5 text-xs">{shortCust(p.customer)}</td>
                      <td className="px-3 py-1.5 text-xs">{p.size == null ? "—" : `${p.size}"`}</td>
                      <td className="px-3 py-1.5 text-right">{inr(p.powderCost)}</td>
                      <td className={`px-3 py-1.5 text-right font-medium ${(p.powderOfRev ?? 0) > 60 ? "text-orange-600" : ""}`}>
                        {p.powderOfRev == null ? "—" : `${p.powderOfRev.toFixed(0)}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Powder / cost shares are on the <b>costed+trusted slice only</b> ({pct(b.coverage_pct)} of the book).
              The {String(b.uncosted_lines ?? "—")} uncosted lines (incl FR0206D) have no parsed BOM, so their powder
              mix is unknown and true book-wide exposure is not yet measurable. Powder = per-piece BOM powder cost ×
              qty; machine time and gas (≈{inr(pe.gas_cost)}, 4 lines) are not material here.
            </div>
          </div>
        )}

        {highFrag.length > 0 && (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2 text-sm font-medium">
              Most powder-fragile parts — which go loss-making first under a cobalt shock
            </div>
            <div className="px-4 py-3 text-sm text-muted-foreground">
              The book as a whole breaks even at a <b className="text-foreground">+{pct(bookBreakeven)}</b> powder-cost
              rise — but that powder-weighted average hides parts far more fragile.{" "}
              <b className="text-foreground">{highFrag.length} of {frag.length}</b> costed+trusted parts break even
              <i> sooner</i> than the book; the most fragile,{" "}
              <b className="text-foreground">{String(fragByBreakeven[0]?.drawing_no ?? "—")} {fragByBreakeven[0]?.part_size == null ? "" : `${fragByBreakeven[0]?.part_size}"`}</b>,
              goes to zero margin at just <b className="text-orange-700">+{pct(mostFragileBe)}</b>. Separately, the powder
              cost <b className="text-foreground">concentrates</b>: the top 5 parts carry{" "}
              <b className="text-foreground">{pct(top5Share)}</b> of all powder spend on this slice — so an
              escalation clause / hedge can be targeted at a handful of parts. (A part that is <i>both</i> highly
              fragile <i>and</i> a large share is the real priority — read the two right-hand columns together.)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Drawing</th>
                    <th className="px-3 py-2 text-left font-medium">Size</th>
                    <th className="px-3 py-2 text-left font-medium">Spec</th>
                    <th className="px-3 py-2 text-right font-medium">Margin %</th>
                    <th className="px-3 py-2 text-right font-medium">Powder % of rev</th>
                    <th className="px-3 py-2 text-right font-medium" title="The % powder-cost rise (price held) that zeroes this part's margin — lower = more fragile">
                      Breakeven rise
                    </th>
                    <th className="px-3 py-2 text-right font-medium" title="This part's share of all powder cost on the costed+trusted slice">
                      Powder share
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {highFrag.map((r, i) => {
                    const big = (num(r.powder_share_pct) ?? 0) >= 8; // both fragile AND material
                    return (
                      <tr key={String(r.drawing_no) + String(r.part_desc) + i} className={`border-t hover:bg-accent/30 ${big ? "bg-orange-50/60" : ""}`}>
                        <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                        <td className="px-3 py-1.5 text-xs">{r.part_size == null ? "—" : `${r.part_size}"`}</td>
                        <td className="max-w-[22rem] truncate px-3 py-1.5 text-xs text-muted-foreground" title={String(r.part_desc ?? "")}>
                          {String(r.part_desc ?? "—")}
                        </td>
                        <td className="px-3 py-1.5 text-right text-xs">{pct(r.margin_pct)}</td>
                        <td className={`px-3 py-1.5 text-right text-xs ${(num(r.powder_pct_of_rev) ?? 0) > 60 ? "text-orange-600" : ""}`}>{pct(r.powder_pct_of_rev)}</td>
                        <td className="px-3 py-1.5 text-right font-medium text-orange-700">+{pct(r.breakeven_powder_rise_pct)}</td>
                        <td className={`px-3 py-1.5 text-right ${big ? "font-semibold text-orange-700" : "text-muted-foreground"}`}>{pct(r.powder_share_pct)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Costed+trusted slice only ({pct(b.coverage_pct)} of the book; {frag.length} parts / {String(pe.costed_lines ?? "—")} lines,
              reconciles to the powder exposure above). <b>Breakeven rise</b> is a deterministic what-if (margin ÷ powder
              cost), not a forecast — it assumes price held and a 1:1 powder-cost move. &quot;Fragility&quot; is relative to
              the book&apos;s own +{pct(bookBreakeven)} breakeven (rows shaded = both fragile and ≥8% of powder spend). The
              {" "}{String(b.uncosted_lines ?? "—")} uncosted lines have no parsed BOM, so their fragility is unknown. Re-pricing /
              hedging stays the MD&apos;s decision — this only ranks the exposure.
            </div>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          {dimTable("By customer", "customer")}
          {dimTable("By part type", "part_type")}
        </div>
        {dimTable("By part size (where the variance lives)", "part_size")}

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">
            Margin exceptions ({exceptions.length}) — loss / thin / verify, worst first
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Band", "Drawing", "Customer", "Size", "PO", "Qty", "Rate", "Std cost", "Margin %"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exceptions.map((r, i) => {
                  const isVerify = r.margin_band === "anomaly_verify";
                  const band = BAND[String(r.margin_band)] ?? { cls: "bg-muted text-muted-foreground", label: String(r.margin_band) };
                  return (
                    <tr key={String(r.drawing_no) + String(r.po_no) + i} className="border-t hover:bg-accent/30">
                      <td className="px-3 py-1.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${band.cls}`}>{band.label}</span></td>
                      <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                      <td className="px-3 py-1.5 text-xs">{shortCust(r.customer)}</td>
                      <td className="px-3 py-1.5 text-xs">{r.part_size == null ? "—" : `${r.part_size}"`}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{String(r.po_no ?? "—")}</td>
                      <td className="px-3 py-1.5 text-xs">{String(r.qty ?? "—")}</td>
                      <td className="px-3 py-1.5">{inr(r.po_rate)}</td>
                      <td className="px-3 py-1.5">{inr(r.std_cost_pp)}</td>
                      <td className={`px-3 py-1.5 font-medium ${isVerify ? "text-purple-700" : Number(r.std_margin_pct) < 0 ? "text-red-600" : "text-amber-600"}`}>
                        {isVerify ? "verify" : pct(r.std_margin_pct)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            VERIFY rows are not asserted — their cost variant is disputed (in the MD review queue); their
            margin is shown as &quot;verify&quot;, never as a number, per the confident-or-blank rule.
          </div>
        </div>
      </div>
    </PageGuard>
  );
}

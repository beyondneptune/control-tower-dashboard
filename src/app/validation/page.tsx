import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/kit/page-header";
import { ValidationQueue, type Candidate } from "./validation-client";

export const dynamic = "force-dynamic";

// Thread-derived quote↔PO pairing that feeds v_ct_quote_conversion (cycle 12,
// view v_ct_quote_link_integrity). Distinct from the line-level confirmation queue
// below (which is ct_po_quote_link based).
type LinkRow = {
  customer: string | null;
  quote_no: string | null;
  quote_date: string | null;
  quote_value: number | null;
  po_no: string | null;
  po_date: string | null;
  quote_po_conf: string | null;
  po_quote_count: number | null;
  po_predates_quote: boolean | null;
  days_po_before_quote: number | null;
  link_integrity: string | null;
};

const inrL = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const shortCust = (c: string | null) =>
  (c ?? "—").replace(/ (India Pvt Ltd|India Controls Pvt Ltd|Valves Private Limited|Private Limited|Spares Pvt Limited|Associates Limited|Pvt Ltd)/g, "");

export default async function ValidationPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("v_ct_po_quote_validation")
    .select("*")
    .order("line_value", { ascending: false })
    .range(0, 9999); // defeat the PostgREST 1000-row cap as the backfill grows (M-01)
  const rows = (data ?? []) as Candidate[];
  const { count: autoLinked } = await admin
    .from("ct_po_quote_link")
    .select("*", { count: "exact", head: true })
    .eq("confirmed_by", "auto:rate+drawing");
  const drawing = rows.filter((r) => r.match_basis === "drawing").length;
  const rate = rows.filter((r) => r.match_basis === "rate").length;
  const none = rows.filter((r) => !r.suggested_quotes).length;

  // Conversion-link integrity (thread-level quote↔PO pairings).
  const { data: liData } = await admin
    .from("v_ct_quote_link_integrity")
    .select("*")
    .range(0, 9999);
  const links = (liData ?? []) as LinkRow[];
  const reviewLinks = links
    .filter((r) => r.link_integrity === "review")
    .sort((a, b) => Number(b.days_po_before_quote ?? 0) - Number(a.days_po_before_quote ?? 0));
  const consistentLinks = links.filter((r) => r.link_integrity === "consistent");
  const sumQ = (a: LinkRow[]) => a.reduce((s, r) => s + Number(r.quote_value ?? 0), 0);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="PO ↔ Quote Validation"
        description="Lines where the quote's drawing AND per-unit rate both matched exactly are already auto-linked (no action needed). What's left here is where only one of the two matched — confirm the suggested quote, or for 'no quote found' the quotation is likely missing from the folder."
      />

      {links.length > 0 && (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-sm font-semibold">Quote ↔ PO link integrity — the gate on a conversion win-rate</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The thread engine labels all {links.length} &ldquo;won&rdquo; quote→PO links <span className="font-mono">exact</span> confidence,
              but it never checks date order: <b className="text-amber-700 dark:text-amber-400">{reviewLinks.length} have the PO dated <i>before</i> the quote</b> —
              impossible for a forward quote→PO (often one old PO claimed by several later quotes, the §11 &ldquo;PO doesn&rsquo;t cite quote#&rdquo; gap).
              Each could be a <b>spurious link</b> or a <b>legitimate re-quote of a standing order</b> — for Rahul/MD to confirm; nothing is auto-corrected here.
              Until these are resolved a quote→order <b>win-rate / conversion velocity is not shown</b> (it would be built on unreliable links).
            </p>
          </div>
          <div className="flex flex-wrap gap-3 px-4 py-3 text-sm">
            <span className="rounded-md border bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">
              Consistent (forward-timed) <b>{consistentLinks.length}</b> · {inrL(sumQ(consistentLinks))}
            </span>
            <span className="rounded-md border bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400">
              To review (PO predates quote) <b>{reviewLinks.length}</b> · {inrL(sumQ(reviewLinks))}
            </span>
          </div>
          {reviewLinks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    {["Customer", "Quote no", "Quote date", "PO no", "PO date", "PO before quote", "Other quotes on PO", "Quoted value"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reviewLinks.map((r) => (
                    <tr key={`${r.quote_no}-${r.po_no}`} className="border-t hover:bg-accent/30">
                      <td className="px-3 py-1.5">{shortCust(r.customer)}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.quote_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.quote_date ?? "—"}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.po_no ?? "—"}</td>
                      <td className="px-3 py-1.5">{r.po_date ?? "—"}</td>
                      <td className="px-3 py-1.5 font-medium text-amber-700 dark:text-amber-400">{r.days_po_before_quote ?? 0}d</td>
                      <td className="px-3 py-1.5">{Number(r.po_quote_count ?? 1) > 1 ? `${Number(r.po_quote_count) - 1} other` : "—"}</td>
                      <td className="px-3 py-1.5">{inrL(Number(r.quote_value ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-md border bg-emerald-500/10 px-3 py-1.5 text-emerald-700 dark:text-emerald-400">✓ Auto-linked (drawing+rate) <b>{autoLinked ?? 0}</b></span>
        <span className="rounded-md border bg-card px-3 py-1.5">To validate <b>{rows.length}</b></span>
        <span className="rounded-md border bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400">Drawing match — verify rate <b>{drawing}</b></span>
        <span className="rounded-md border bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400">Rate match — verify part <b>{rate}</b></span>
        <span className="rounded-md border bg-card px-3 py-1.5 text-muted-foreground">No quote found <b>{none}</b></span>
      </div>
      {rows.length === 0 ? (
        <div className="rounded-lg border bg-emerald-500/5 p-8 text-center text-sm text-muted-foreground">
          ✓ Every PO line is confirmed. Nothing left to validate.
        </div>
      ) : (
        <ValidationQueue rows={rows} />
      )}
    </div>
  );
}

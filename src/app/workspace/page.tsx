import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/kit/page-header";
import { TallyFreshness } from "@/components/kit/tally-freshness";
import { WorkspaceQueue, type Exception } from "./workspace-client";

export const dynamic = "force-dynamic";

const ROLE_TO_OWNER: Record<string, string> = {
  finance: "rahul", sales: "rahul",
  production: "arjun", quality: "qc", stores: "stores", purchase: "purchase",
};
const fmt = (n: number | null) => (n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN"));

export default async function WorkspacePage() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const role = ((u?.user?.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  const isMD = role === "md" || role === "auditor";
  const admin = createAdminClient();

  // MD: company-health summary + all high-severity exceptions.
  // Operational role: only that role's open exception queue.
  const owner = ROLE_TO_OWNER[role];
  // Priority order: severity, then oldest, then highest value at risk.
  const exQuery = admin
    .from("v_ct_exceptions_open")
    .select("*")
    .order("severity")
    .order("age_days", { ascending: false })
    .order("value_at_risk", { ascending: false });
  const { data: exData } = isMD ? await exQuery : await exQuery.eq("owner_role", owner ?? "_none_");
  const exceptions = (exData ?? []) as Exception[];

  // Commercial Command read-window (finance/sales = Rahul): federate the
  // already-verified, owned signals into one screen — the same go-live pattern
  // the MD home (/) got in cycle 5. Read-only; each card a DISTINCT lens, never
  // summed (M-21). To-invoice + prices are Tally-independent; collections is
  // bill-wise/Tally-fed and labelled STALE via <TallyFreshness> during outages
  // (M-27/M-28). All figures reconcile to source — scripts/verify-rahul-command.mjs.
  const isRahul = !isMD && owner === "rahul";
  const { data: billing } = isRahul
    ? await admin.from("v_ct_predictive_risk_summary").select("*").eq("risk_kind", "billing").maybeSingle()
    : { data: null };
  const { data: overdueRows } = isRahul
    ? await admin.from("v_ct_receivables_priority").select("outstanding").eq("bucket", "1-30")
    : { data: null };
  const { data: priceRows } = isRahul
    ? await admin.from("v_ct_price_consistency").select("drawing_no")
    : { data: null };
  const overdueCount = overdueRows?.length ?? 0;
  const overdueValue = Math.round((overdueRows ?? []).reduce((s, r) => s + Number(r.outstanding ?? 0), 0));
  const priceCount = priceRows?.length ?? 0;
  const unbilledCount = exceptions.filter((e) => e.ex_type === "UNBILLED").length;
  const overdueExCount = exceptions.filter((e) => e.ex_type === "OVERDUE").length;

  const { data: mdRow } = isMD ? await admin.from("v_ct_ws_md").select("*").maybeSingle() : { data: null };
  const { data: bottleneck } = isMD ? await admin.from("v_ct_bottleneck").select("*") : { data: null };
  const { data: mdEscalations } = isMD ? await admin.from("v_ct_md_exceptions").select("*") : { data: null };
  const { data: health } = await admin.from("v_ct_data_health").select("*").maybeSingle();
  const stageLabel: Record<string, string> = {
    "4_ordered": "Ordered, awaiting production", "5_produced": "Produced, awaiting invoice",
    "6_invoiced": "Invoiced, awaiting payment", "6_overdue": "Overdue",
  };

  const high = exceptions.filter((e) => e.severity === "high").length;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={isMD ? "MD Workspace" : "My Workspace"}
        description="The system tells you what needs attention. You only Approve, Reject, Comment, or Correct — everything else is automated."
      />

      {isRahul && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Commercial Command — what needs your attention</div>
          <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-4">
            <Link href="/risk" className="block rounded-lg border bg-card px-3 py-2 hover:bg-muted/40">
              <div className="text-xs text-muted-foreground">To invoice now (produced, unbilled — aged)</div>
              <div className="text-lg font-semibold tabular-nums">{fmt(billing?.money_at_risk_elevated ?? null)}</div>
              <div className="text-xs text-muted-foreground">
                {billing?.elevated_positions ?? "—"} aged lines (of {billing?.positions ?? "—"} produced-but-unbilled) · you raise these · Tally-independent
              </div>
            </Link>
            <Link href="/collections" className="block rounded-lg border bg-card px-3 py-2 hover:bg-muted/40">
              <div className="flex items-center justify-between gap-1">
                <div className="text-xs text-muted-foreground">Collections overdue (current-FY)</div>
                <TallyFreshness streams="Bill-wise outstanding" />
              </div>
              <div className="text-lg font-semibold tabular-nums">{fmt(overdueValue)}</div>
              <div className="text-xs text-muted-foreground">{overdueCount} bills 1–30d · bill-wise (Tally)</div>
            </Link>
            <Link href="/engineering/pricing" className="block rounded-lg border bg-card px-3 py-2 hover:bg-muted/40">
              <div className="text-xs text-muted-foreground">Prices to review</div>
              <div className="text-lg font-semibold tabular-nums">{priceCount}</div>
              <div className="text-xs text-muted-foreground">repeat parts priced inconsistently · Tally-independent</div>
            </Link>
            <div className="rounded-lg border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">Your open queue</div>
              <div className="text-lg font-semibold tabular-nums">{exceptions.length}</div>
              <div className="text-xs text-muted-foreground">{unbilledCount} unbilled · {overdueExCount} overdue · act below</div>
            </div>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            Read-window over your owned signals — to-invoice from <code>v_ct_predictive_risk</code> (billing arm,
            produced-not-invoiced, finance-owned), collections from <code>v_ct_receivables_priority</code> (current-FY,
            bill-wise/Tally — stale while Tally is down), prices from <code>v_ct_price_consistency</code>. Each card is a
            distinct lens — never summed into one figure. Invoicing and re-pricing stay your decision; this only surfaces them.
          </div>
        </div>
      )}

      {isMD && mdRow && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ["Order book (incl GST)", fmt(mdRow.order_book)],
            ["Invoiced (incl GST)", fmt(mdRow.invoiced)],
            ["Receivables (incl GST)", fmt(mdRow.receivables)],
            ["Overdue cash (incl GST)", fmt(mdRow.overdue_cash)],
            ["Unbilled backlog", fmt(mdRow.unbilled_backlog)],
            ["Avg order→invoice", (mdRow.avg_order_to_invoice_days ?? "—") + " days"],
            ["Conversion", (mdRow.conversion_pct ?? "—") + "%"],
            ["Open exceptions", `${mdRow.open_exceptions} (${mdRow.high_exceptions} high)`],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{val}</div>
            </div>
          ))}
        </div>
      )}

      {isMD && bottleneck && bottleneck.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Where work is piling up (bottlenecks)</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-1.5 text-left">Stage</th><th className="px-3 py-1.5 text-right">Items</th><th className="px-3 py-1.5 text-right">Avg age</th><th className="px-3 py-1.5 text-right">Oldest</th><th className="px-3 py-1.5 text-right">Value</th></tr>
            </thead>
            <tbody>
              {bottleneck.map((b) => (
                <tr key={b.thread_stage} className={`border-t ${Number(b.avg_age_days) > 30 ? "bg-red-500/5" : ""}`}>
                  <td className="px-3 py-1.5">{stageLabel[b.thread_stage] ?? b.thread_stage}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.work_packages}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.avg_age_days ?? "—"}d</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{b.oldest_days ?? "—"}d</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{fmt(b.value_at_stage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isMD && mdEscalations && mdEscalations.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Operational escalations ({mdEscalations.length})</div>
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="px-3 py-1.5 text-left">Type</th><th className="px-3 py-1.5 text-left">Subject</th><th className="px-3 py-1.5 text-left">Ref</th><th className="px-3 py-1.5 text-left">Due</th><th className="px-3 py-1.5 text-left">Owner</th><th className="px-3 py-1.5 text-left">Note</th></tr>
            </thead>
            <tbody>
              {mdEscalations.map((e, i) => (
                <tr key={(e.record_id as string) ?? i} className="border-t">
                  <td className="px-3 py-1.5">{(e.kind as string)?.replace(/_/g, " ")}</td>
                  <td className="px-3 py-1.5">{e.subject as string}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.reference as string}</td>
                  <td className="px-3 py-1.5 tabular-nums">{e.due as string}</td>
                  <td className="px-3 py-1.5">{e.owner_hint as string}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{e.note as string}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-md border bg-card px-3 py-1.5">Your queue <b>{exceptions.length}</b></span>
        <span className="rounded-md border bg-red-500/10 px-3 py-1.5 text-red-700 dark:text-red-400">High <b>{high}</b></span>
        {health && health.unclassified_docs != null && (
          <span className="rounded-md border bg-amber-500/10 px-3 py-1.5 text-amber-700 dark:text-amber-400" title="Documents the pipeline could not classify — need a human or a new template">
            Data health: {health.unclassified_docs} unclassified doc{health.unclassified_docs === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {exceptions.length === 0 ? (
        <div className="rounded-lg border bg-emerald-500/5 p-8 text-center text-sm text-muted-foreground">
          ✓ Nothing needs your attention. The Control Tower has handled everything automatically.
        </div>
      ) : (
        <WorkspaceQueue exceptions={exceptions} />
      )}
    </div>
  );
}

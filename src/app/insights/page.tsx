// Insight Feed — the single "what needs attention" stream.
// Federates operational exceptions + margin-floor breaches + recorded leaks
// (v_ct_insight_feed), typed/role-routed/urgency-ranked. READ-ONLY window.
// ₹ figures are per-signal exposure, NOT additive across types (a part can appear
// under more than one lens — see migration 0039 / MISTAKE_LEDGER M-21).
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";

type Row = {
  feed_kind: string;
  signal_type: string | null;
  severity: string | null;
  sev_rank: number | null;
  owner_role: string | null;
  ref: string | null;
  customer: string | null;
  title: string | null;
  detail: string | null;
  value_at_risk: number | string | null;
  age_days: number | null;
  suggested_action: string | null;
  source_view: string | null;
  urgency: number | string | null;
};

const KIND_LABEL: Record<string, string> = {
  EXCEPTION: "Operational",
  MARGIN_FLOOR: "Margin floor",
  LEAK: "Leak",
};
const KIND_CHIP: Record<string, string> = {
  EXCEPTION: "bg-blue-100 text-blue-800",
  MARGIN_FLOOR: "bg-rose-100 text-rose-800",
  LEAK: "bg-purple-100 text-purple-800",
};
const SEV_CHIP: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-200 text-amber-900",
  low: "bg-slate-200 text-slate-700",
};

// Live status of each leak recorded in the 2026-06-29 chain audit (v_ct_leak_monitor,
// migration 0049). Reconciles the frozen LEAK arm of the feed above to today's spine.
type LeakRow = {
  leak_type: string;
  drawing_no: string | null;
  recorded_severity: string | null;
  recorded_rupee_impact: number | string | null;
  recorded_detail: string | null;
  current_status: string;
  status_basis: string | null;
  located_evidence: string | null;
  recorded_at: string | null;
};
const LEAK_STATUS: Record<string, { label: string; chip: string }> = {
  still_open: { label: "Still open", chip: "bg-red-600 text-white" },
  evidence_located: { label: "Evidence located", chip: "bg-blue-100 text-blue-800" },
  resolved: { label: "Resolved", chip: "bg-emerald-600 text-white" },
  now_billed: { label: "Now billed", chip: "bg-emerald-100 text-emerald-800" },
  recorded: { label: "Recorded — re-verify", chip: "bg-slate-200 text-slate-700" },
};
const LEAK_STATUS_ORDER = ["still_open", "evidence_located", "recorded", "now_billed", "resolved"];

function inr(v: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return "—";
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

export default async function InsightFeedPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("v_ct_insight_feed")
    .select("*")
    .order("urgency", { ascending: false })
    .range(0, 999);
  const rows = (data ?? []) as Row[];

  const countKind = (k: string) => rows.filter((r) => r.feed_kind === k).length;
  const critical = rows.filter((r) => r.severity === "critical").length;

  const kpi = [
    { value: critical, label: "Critical signals", sub: "lead the queue", tone: "text-red-600" },
    { value: countKind("EXCEPTION"), label: "Operational", sub: "produce · bill · collect", tone: "" },
    { value: countKind("MARGIN_FLOOR"), label: "Margin-floor", sub: "below-cost / thin quotes", tone: "" },
    { value: countKind("LEAK"), label: "Recorded leaks", sub: "pricing / billing leakage", tone: "" },
  ];

  const TOP = 60;
  const shown = rows.slice(0, TOP);

  // Live reconciliation of the recorded chain-leak audit (frozen 2026-06-29) to today.
  const { data: leakData } = await admin
    .from("v_ct_leak_monitor")
    .select("*")
    .range(0, 999);
  const leaks = (leakData ?? []) as LeakRow[];
  const leakCount = (s: string) => leaks.filter((l) => l.current_status === s).length;
  // Derive the audit date from the source (the frozen built_at), never a hardcoded literal (M-28).
  const recordedAt = leaks.find((l) => l.recorded_at)?.recorded_at?.slice(0, 10) ?? null;
  const leaksSorted = [...leaks].sort((a, b) => {
    const o = LEAK_STATUS_ORDER.indexOf(a.current_status) - LEAK_STATUS_ORDER.indexOf(b.current_status);
    if (o !== 0) return o;
    return Math.abs(Number(b.recorded_rupee_impact ?? 0)) - Math.abs(Number(a.recorded_rupee_impact ?? 0));
  });

  return (
    <PageGuard module="insights">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Insight Feed — What Needs Attention</h1>
          <p className="text-sm text-muted-foreground">
            One ranked stream over the digital-thread spine: operational exceptions
            (<b>produce → bill → collect</b>), <b>margin-floor</b> breaches from the cost gate, and
            recorded <b>chain leaks</b> — typed, role-routed, ranked by urgency (severity → ₹ exposure → age).
            The margin intelligence used to live only inside Engineering; it now surfaces here as actionable signal.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className={`text-2xl font-semibold ${k.tone}`}>{k.value}</div>
              <div className="text-xs font-medium">{k.label}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <div className="text-sm font-medium">
              Prioritised signals{" "}
              <span className="text-xs text-muted-foreground">
                (top {Math.min(TOP, rows.length)} of {rows.length} by urgency)
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              ₹ = per-signal exposure · not additive across types
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Ref</th>
                  <th className="px-3 py-2 font-medium">What</th>
                  <th className="px-3 py-2 text-right font-medium">₹ at risk</th>
                  <th className="px-3 py-2 text-right font-medium">Age</th>
                  <th className="px-3 py-2 font-medium">Owner</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r, i) => (
                  <tr key={i} className="border-b align-top last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${SEV_CHIP[r.severity ?? ""] ?? "bg-slate-200 text-slate-700"}`}>
                        {(r.severity ?? "—").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${KIND_CHIP[r.feed_kind] ?? "bg-slate-100 text-slate-700"}`}>
                        {KIND_LABEL[r.feed_kind] ?? r.feed_kind}
                      </span>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">{r.signal_type}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {r.ref ?? "—"}
                      {r.customer ? <div className="text-[11px] text-muted-foreground">{r.customer}</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.title}</div>
                      {r.detail ? <div className="text-xs text-muted-foreground line-clamp-2">{r.detail}</div> : null}
                      {r.suggested_action ? (
                        <div className="mt-0.5 text-[11px] text-emerald-700">▸ {r.suggested_action}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{inr(r.value_at_risk)}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
                      {r.age_days == null ? "—" : `${r.age_days}d`}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs capitalize text-muted-foreground">{r.owner_role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            Operational exceptions are actioned in <b>My Workspace</b>; margin-floor signals in the
            <b> Engineering · Cost Gate</b>; leaks are evidence-recorded in the chain audit. This feed is the
            read-only window that ranks them together. F002201524 re-pricing remains an MD decision.
          </div>
        </div>

        {leaks.length > 0 ? (
          <div className="rounded-lg border bg-card">
            <div className="border-b px-4 py-2">
              <div className="text-sm font-medium">
                Chain-leak register — live status{" "}
                <span className="text-xs text-muted-foreground">
                  (recorded {recordedAt}, reconciled to today&rsquo;s spine)
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                The <b>Recorded leaks</b> above are a point-in-time audit, frozen on {recordedAt} — they do not
                recompute. This re-grades each against the current digital thread, so a leak that has since been
                <b> closed</b> or <b>located</b> is no longer read as live. <b>Conservative:</b> only the
                cost/BOM-coverage and below-cost-unbilled leaks are auto-graded from a live relation; the rest stay
                <b> recorded</b> (neither asserted open nor closed). Recorded ₹ is the audit figure, never a new claim.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-5">
              {[
                { s: "still_open", sub: "live exposure" },
                { s: "evidence_located", sub: "BOM found — parse backlog" },
                { s: "recorded", sub: "re-verify at source" },
                { s: "now_billed", sub: "no longer unbilled" },
                { s: "resolved", sub: "now costed / closed" },
              ].map((b) => (
                <div key={b.s} className="rounded-lg border bg-background p-3">
                  <div className="text-2xl font-semibold">{leakCount(b.s)}</div>
                  <div className="text-xs font-medium">{LEAK_STATUS[b.s]?.label ?? b.s}</div>
                  <div className="text-xs text-muted-foreground">{b.sub}</div>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Live status</th>
                    <th className="px-3 py-2 font-medium">Leak type</th>
                    <th className="px-3 py-2 font-medium">Drawing</th>
                    <th className="px-3 py-2 text-right font-medium">Recorded ₹</th>
                    <th className="px-3 py-2 font-medium">Status basis (live)</th>
                  </tr>
                </thead>
                <tbody>
                  {leaksSorted.map((l, i) => (
                    <tr key={i} className="border-b align-top last:border-0 hover:bg-muted/40">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${LEAK_STATUS[l.current_status]?.chip ?? "bg-slate-200 text-slate-700"}`}>
                          {LEAK_STATUS[l.current_status]?.label ?? l.current_status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-[11px] text-muted-foreground">
                        {l.leak_type}
                        <span className="ml-1 uppercase">· {(l.recorded_severity ?? "").toLowerCase()}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">{l.drawing_no ?? "—"}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{inr(Math.abs(Number(l.recorded_rupee_impact ?? 0)))}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{l.status_basis ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t px-4 py-2 text-xs text-muted-foreground">
              Phase E#3 — leak detection as a live monitor. <b>FR0206D</b> (₹56.86L, the audit&rsquo;s largest
              &ldquo;critical missing BOM&rdquo;) is reframed: its BOM evidence is located in the inbox (cycle 8) — a
              parse backlog, not missing data. <b>AR8650D</b> is now costed (resolved). Applying a located cost
              (parse → lock canonical variant → propagate) and re-pricing F002201524 remain MD/Arjun decisions.
            </div>
          </div>
        ) : null}
      </div>
    </PageGuard>
  );
}

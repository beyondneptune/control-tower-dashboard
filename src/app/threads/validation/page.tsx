// Day 9: business_threads validation sampling page — reviewer-friendly UX.
//   - Instructions at top (no DB jargon)
//   - Progress bar reviewed / 37
//   - Reviewer + bucket filter (querystring driven)
//   - Buckets ordered by review priority: Crestline → Apex Flow Systems → Low-link-conf → Rahul → Arjun → Mixed
//   - Per-row Review link still drives to /threads/[id]

import Link from "next/link";
import { ClipboardCheck, TriangleAlert } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { reviewerNameFromUser } from "@/lib/reviewer-identity";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";

export const dynamic = "force-dynamic";

interface SampleRow {
  id: string;
  bucket: string;
  reason_picked: string;
  thread_id: string;
}

interface ThreadRow {
  id: string;
  customer_name: string | null;
  primary_po_no: string | null;
  primary_invoice_no: string | null;
  primary_quote_no: string | null;
  current_stage: string;
  confidence_score: number | null;
  latest_activity_at: string;
  missing_data: string[] | null;
}

interface LinkRow {
  thread_id: string;
  link_method: string;
  confidence: number | null;
  tally_natural_key: string | null;
}

interface ReviewRow {
  thread_id: string;
  reviewer: string;
  customer_correct: boolean | null;
  stage_correct: boolean | null;
  tally_link_correct: string | null;
  should_promote: boolean | null;
  reviewed_at: string;
}

const PACK_LABEL = `day11-post-remediation-validation`;

// Day 9 priority order (Crestline → Apex Flow Systems → Low-link-conf → Rahul → Arjun → Mixed)
const BUCKET_PRIORITY = [
  "HAWA_OC1137",
  "FLOWSERVE",
  "LOW_LINK_CONF",
  "YOUNUS_INVOICE",
  "PAVAN_RFQ_PO",
  "MIXED_LOW_CONF",
];

const BUCKET_LABEL: Record<string, string> = {
  HAWA_OC1137: "Crestline OC 1137 (lighthouse case)",
  FLOWSERVE: "Apex Flow Systems threads (largest customer)",
  LOW_LINK_CONF: "Threads with weak Tally evidence",
  YOUNUS_INVOICE: "Invoice/payment threads",
  PAVAN_RFQ_PO: "RFQ / PO / quotation threads",
  MIXED_LOW_CONF: "Lower-confidence mixed",
};

const BUCKET_INSTRUCTIONS: Record<string, string> = {
  HAWA_OC1137: "Validate that the Rahul + Arjun emails are about the same Crestline order. The Tally invoice should match the order context.",
  FLOWSERVE: "Confirm the customer is Apex Flow Systems and the lifecycle stage matches the email evidence. The Tally link is currently ambiguous — don't worry, just say no/N/A if it doesn't look right.",
  LOW_LINK_CONF: "These threads have weak Tally evidence. Mostly your job is to confirm whether the customer + stage are right, regardless of Tally.",
  YOUNUS_INVOICE: "Invoice or payment threads. Check whether the PIPL invoice number / amount matches what the customer was discussing.",
  PAVAN_RFQ_PO: "Quotation / PO threads. Confirm the customer + the PO/RFQ number is real (not a regex false positive).",
  MIXED_LOW_CONF: "Low-confidence threads. Most are likely fine — just validate quickly.",
};

interface PageProps {
  searchParams: Promise<{ reviewer?: string; bucket?: string; view?: string }>;
}

export default async function ThreadValidationPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const reviewerFilter = (sp.reviewer || "").trim();
  const bucketFilter = (sp.bucket || "").trim();
  const viewFilter = (sp.view || "all").trim();   // all | mine | others | unreviewed-by-me

  const sb = createAdminClient();

  // Identify current reviewer from session (cosmetic — DB-level uniqueness on
  // (thread_id, reviewer) is the actual guarantee per migration 0015).
  const sessionSb = await createSessionClient();
  const { data: { user: sessionUser } } = await sessionSb.auth.getUser();
  const me = reviewerNameFromUser(sessionUser);

  let { data: samples } = await sb
    .from("thread_validation_samples")
    .select("id, bucket, reason_picked, thread_id")
    .eq("pack_label", PACK_LABEL);

  if (!samples || samples.length === 0) {
    const { data: latest } = await sb
      .from("thread_validation_samples")
      .select("pack_label")
      .order("inserted_at", { ascending: false })
      .limit(1)
      .single();
    if (latest?.pack_label) {
      const { data: fallback } = await sb
        .from("thread_validation_samples")
        .select("id, bucket, reason_picked, thread_id")
        .eq("pack_label", latest.pack_label);
      samples = fallback;
    }
  }
  const sampleRows = (samples || []) as SampleRow[];
  const threadIds = Array.from(new Set(sampleRows.map((s) => s.thread_id)));

  const { data: threads } = await sb
    .from("business_threads")
    .select(
      "id, customer_name, primary_po_no, primary_invoice_no, primary_quote_no, current_stage, confidence_score, latest_activity_at, missing_data, source_message_ids",
    )
    .in("id", threadIds.length ? threadIds : ["00000000-0000-0000-0000-000000000000"]);
  const threadMap = new Map<string, ThreadRow>();
  for (const t of (threads || []) as ThreadRow[]) threadMap.set(t.id, t);

  const { data: links } = await sb
    .from("business_thread_tally_links")
    .select("thread_id, link_method, confidence, tally_natural_key")
    .in("thread_id", threadIds.length ? threadIds : ["00000000-0000-0000-0000-000000000000"]);
  const linkMap = new Map<string, LinkRow[]>();
  for (const l of (links || []) as LinkRow[]) {
    if (!linkMap.has(l.thread_id)) linkMap.set(l.thread_id, []);
    linkMap.get(l.thread_id)!.push(l);
  }

  const { data: reviews } = await sb
    .from("thread_validation_reviews")
    .select("thread_id, reviewer, customer_correct, stage_correct, tally_link_correct, should_promote, reviewed_at")
    .in("thread_id", threadIds.length ? threadIds : ["00000000-0000-0000-0000-000000000000"]);
  const reviewRows = (reviews || []) as ReviewRow[];
  const reviewMap = new Map<string, ReviewRow[]>();
  for (const r of reviewRows) {
    if (!reviewMap.has(r.thread_id)) reviewMap.set(r.thread_id, []);
    reviewMap.get(r.thread_id)!.push(r);
  }

  const reviewerOptions = Array.from(new Set(reviewRows.map((r) => r.reviewer))).sort();

  // Pack-wide evidence coverage stats
  const allMessageIds = new Set<string>();
  for (const t of (threads || []) as Array<ThreadRow & { source_message_ids?: string[] | null }>) {
    for (const id of t.source_message_ids || []) allMessageIds.add(id);
  }
  const msgIdList = [...allMessageIds];
  const [{ data: msgs }, { data: srcDocs }] = await Promise.all([
    msgIdList.length
      ? sb.from("email_messages").select("id, has_attachment, body_text, body_html, summary").in("id", msgIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; has_attachment: boolean | null; body_text: string | null; body_html: string | null; summary: string | null }> }),
    msgIdList.length
      ? sb.from("source_documents").select("id, message_uuid, parsed_fields").in("message_uuid", msgIdList)
      : Promise.resolve({ data: [] as Array<{ id: string; message_uuid: string | null; parsed_fields: Record<string, unknown> | null }> }),
  ]);
  const msgList = msgs || [];
  const docList = srcDocs || [];
  const packCoverage = {
    emails_total: msgList.length,
    bodies_available: msgList.filter((m) => (m.body_text && m.body_text.length > 20) || (m.body_html && m.body_html.length > 30) || (m.summary && m.summary.length > 20)).length,
    msgs_with_attachment_flag: msgList.filter((m) => m.has_attachment).length,
    attachments_mapped: docList.length,
    attachments_with_text: docList.filter((d) => {
      const pf = d.parsed_fields as { extracted_text?: string } | null;
      return !!pf?.extracted_text && pf.extracted_text.length > 30;
    }).length,
    tally_candidates: links?.length || 0,
    strong_links: (links || []).filter((l) => ["L1_exact_pipl_same_thread", "L1_exact_po_amount_date_match"].includes(l.link_method)).length,
    ambiguous: (links || []).filter((l) => ["L4_ambiguous", "L2_customer_pipl_ambiguous"].includes(l.link_method)).length,
    data_required: (links || []).filter((l) => l.link_method === "L4_data_required").length,
  };

  // Bucket map
  const buckets = new Map<string, SampleRow[]>();
  for (const s of sampleRows) {
    if (!buckets.has(s.bucket)) buckets.set(s.bucket, []);
    buckets.get(s.bucket)!.push(s);
  }
  const orderedBuckets = BUCKET_PRIORITY
    .filter((b) => buckets.has(b))
    .map((b) => [b, buckets.get(b)!] as const)
    .concat(
      Array.from(buckets.entries()).filter(([k]) => !BUCKET_PRIORITY.includes(k)) as [string, SampleRow[]][],
    );

  const reviewedThreads = new Set(reviewRows.map((r) => r.thread_id));
  const totalSampled = threadIds.length;
  const reviewedCount = reviewedThreads.size;
  const progressPct = totalSampled ? Math.round((reviewedCount / totalSampled) * 100) : 0;
  const accuracy = (() => {
    if (reviewedCount === 0) return null;
    const ok = reviewRows.filter((r) => r.customer_correct && r.stage_correct).length;
    return Math.round((ok / reviewedCount) * 100);
  })();

  return (
    <PageGuard module="email-review">
      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xs text-muted-foreground hover:underline">← Back to home</Link>
          <span className="text-xs font-mono text-muted-foreground">Sprint 1 · Day 9 · Sampling workflow</span>
        </div>
        <PageHeader
          title={<><ClipboardCheck className="mr-2 inline size-4 -translate-y-0.5" />Business thread validation</>}
          description="Read each thread, decide if the customer, stage and Tally link look right, then save. Reviews take ~2 minutes each. No data is changed; we just record your judgment."
        />

        {/* Instructions for reviewers — plain English, no DB terms */}
        <SectionCard
          title="How to use this page"
          description="Quick reviewer guide — no database knowledge needed."
        >
          <ol className="ml-5 list-decimal space-y-1 px-4 py-3 text-sm">
            <li><strong>Pick a bucket below</strong> (Crestline first, then Apex Flow Systems, then weak-Tally threads).</li>
            <li><strong>Click &quot;Review →&quot;</strong> on any thread to see the email + document evidence.</li>
            <li><strong>Answer 4 short questions</strong> — Is the customer right? Is the lifecycle stage right? Is the Tally link right? Should this go on the MD dashboard? Add a note if useful.</li>
            <li><strong>Hit Save review</strong>. You&apos;ll come back here.</li>
            <li>Goal: review ≥ 25 threads so we can decide which ones promote to the MD dashboard.</li>
          </ol>
        </SectionCard>

        {/* Sampling status + progress bar */}
        <SectionCard
          title={`Progress (pack ${PACK_LABEL})`}
          description="Once 25 threads are reviewed with ≥85% customer+stage accuracy, the promotion gate unlocks."
        >
          <div className="px-4 py-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Reviewed</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {reviewedCount}<span className="text-muted-foreground"> / {totalSampled}</span>
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Sample size</div>
                <div className="text-2xl font-semibold tabular-nums">{totalSampled}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Accuracy</div>
                <div className="text-2xl font-semibold tabular-nums">{accuracy === null ? "—" : `${accuracy}%`}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Gate target</div>
                <div className="text-2xl font-semibold tabular-nums">≥ 85%</div>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${progressPct}%` }}
                aria-label={`${progressPct}% reviewed`}
              />
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{progressPct}% complete</p>

            {reviewedCount === 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200/40 bg-amber-50/30 p-3 text-sm">
                <TriangleAlert className="mt-0.5 size-4 text-amber-600" />
                <div>
                  <div className="font-medium">Sampling not yet started</div>
                  <div className="text-xs text-muted-foreground">
                    Start with the Crestline OC 1137 thread below — it&apos;s the cleanest case.
                  </div>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Pack-wide evidence coverage — added Day 11 evidence workbench */}
        <SectionCard
          title="Evidence coverage across the pack"
          description="What's readable on the review screen vs. what may need a Zoho/Tally lookup."
        >
          <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs sm:grid-cols-4">
            <div><div className="text-muted-foreground">Emails available</div><div className="font-mono text-lg tabular-nums">{packCoverage.emails_total}</div></div>
            <div><div className="text-muted-foreground">Bodies on screen</div><div className="font-mono text-lg tabular-nums">{packCoverage.bodies_available}</div></div>
            <div><div className="text-muted-foreground">Msgs flagged has_attachment</div><div className="font-mono text-lg tabular-nums">{packCoverage.msgs_with_attachment_flag}</div></div>
            <div><div className="text-muted-foreground">Attachments mapped</div><div className="font-mono text-lg tabular-nums">{packCoverage.attachments_mapped}</div></div>
            <div><div className="text-muted-foreground">Attachment text extracted</div><div className="font-mono text-lg tabular-nums">{packCoverage.attachments_with_text}</div></div>
            <div><div className="text-muted-foreground">Tally link rows</div><div className="font-mono text-lg tabular-nums">{packCoverage.tally_candidates}</div></div>
            <div><div className="text-muted-foreground">Strong Tally links</div><div className="font-mono text-lg tabular-nums">{packCoverage.strong_links}</div></div>
            <div><div className="text-muted-foreground">Ambiguous / Data Required</div><div className="font-mono text-lg tabular-nums">{packCoverage.ambiguous + packCoverage.data_required}</div></div>
          </div>
          <p className="px-4 pb-3 text-[11px] text-muted-foreground">
            Most threads should be decidable from this page&apos;s evidence panels — open Zoho/Tally only when a row notes &quot;text not extracted&quot; for an attachment that&apos;s material to your decision.
          </p>
        </SectionCard>

        {/* Multi-reviewer view tabs */}
        <SectionCard
          title={`Multi-reviewer view${me.name ? ` · you are ${me.name}` : ""}`}
          description="Switch between unreviewed-by-me, reviewed-by-me, reviewed-by-others, or all."
        >
          <nav className="flex flex-wrap gap-2 px-4 py-3 text-xs">
            {[
              { v: "all", label: `All (${totalSampled})` },
              { v: "unreviewed-by-me", label: `Unreviewed by ${me.name || "me"}` },
              { v: "mine", label: `Reviewed by ${me.name || "me"}` },
              { v: "others", label: `Reviewed by others` },
            ].map(({ v, label }) => (
              <Link
                key={v}
                href={`/threads/validation?${new URLSearchParams({
                  ...(bucketFilter ? { bucket: bucketFilter } : {}),
                  ...(reviewerFilter ? { reviewer: reviewerFilter } : {}),
                  view: v,
                }).toString()}`}
                className={`rounded-md border px-2 py-1 ${viewFilter === v ? "bg-blue-600 text-white border-blue-600" : "bg-background hover:bg-accent"}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </SectionCard>

        {/* Filters */}
        <SectionCard title="Filters">
          <form method="get" className="grid grid-cols-1 gap-3 px-4 py-3 text-sm sm:grid-cols-3">
            <input type="hidden" name="view" value={viewFilter} />
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Reviewer (free filter, separate from the tabs above)</span>
              <select name="reviewer" defaultValue={reviewerFilter} className="rounded border bg-background px-2 py-1.5 text-sm">
                <option value="">All reviewers</option>
                {reviewerOptions.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Bucket</span>
              <select name="bucket" defaultValue={bucketFilter} className="rounded border bg-background px-2 py-1.5 text-sm">
                <option value="">All buckets</option>
                {orderedBuckets.map(([b]) => (
                  <option key={b} value={b}>{BUCKET_LABEL[b] || b}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
                Apply filters
              </button>
              <Link href="/threads/validation" className="text-xs text-muted-foreground hover:underline">Clear</Link>
            </div>
          </form>
        </SectionCard>

        {orderedBuckets
          .filter(([b]) => !bucketFilter || b === bucketFilter)
          .map(([bucket, items]) => {
            const filteredItems = items.filter((s) => {
              const rs = reviewMap.get(s.thread_id) || [];
              if (reviewerFilter && !rs.some((r) => r.reviewer === reviewerFilter)) return false;
              if (viewFilter === "mine" && !rs.some((r) => r.reviewer === me.name)) return false;
              if (viewFilter === "others" && (rs.length === 0 || !rs.some((r) => r.reviewer !== me.name))) return false;
              if (viewFilter === "unreviewed-by-me" && rs.some((r) => r.reviewer === me.name)) return false;
              return true;
            });
            const reviewedHere = items.filter((s) => (reviewMap.get(s.thread_id) || []).length > 0).length;
            return (
              <SectionCard
                key={bucket}
                title={BUCKET_LABEL[bucket] || bucket}
                description={`${reviewedHere} of ${items.length} reviewed${reviewerFilter ? ` (filtered)` : ""}`}
              >
                <p className="px-4 pt-2 text-xs text-muted-foreground">
                  {BUCKET_INSTRUCTIONS[bucket] || "Review each thread for customer + stage + Tally link accuracy."}
                </p>
                <table className="mt-2 w-full text-sm">
                  <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Customer</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">PO / Invoice</th>
                      <th className="px-3 py-2 text-right">Conf</th>
                      <th className="px-3 py-2">Tally evidence</th>
                      <th className="px-3 py-2">Last activity</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredItems.map((s) => {
                      const t = threadMap.get(s.thread_id);
                      const tlinks = linkMap.get(s.thread_id) || [];
                      const bestLink = tlinks.sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))[0];
                      return (
                        <tr key={s.id} className="text-xs">
                          <td className="px-3 py-2">{t?.customer_name ?? "—"}</td>
                          <td className="px-3 py-2 font-mono">{t?.current_stage ?? "—"}</td>
                          <td className="px-3 py-2 font-mono">
                            {t?.primary_po_no || t?.primary_invoice_no || t?.primary_quote_no || "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{t?.confidence_score?.toFixed(2) ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            {bestLink && bestLink.tally_natural_key ? (
                              <>
                                <span className="font-mono">{bestLink.tally_natural_key}</span>
                                <span className="ml-1 text-muted-foreground">
                                  ({bestLink.link_method?.includes("ambiguous") ? "ambiguous" : "match"} · {Number(bestLink.confidence).toFixed(2)})
                                </span>
                              </>
                            ) : (
                              <StatusPill tone="warning">No Tally evidence</StatusPill>
                            )}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {t?.latest_activity_at ? new Date(t.latest_activity_at).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {(() => {
                              const rs = reviewMap.get(s.thread_id) || [];
                              const mine = rs.find((r) => r.reviewer === me.name);
                              const others = rs.filter((r) => r.reviewer !== me.name);
                              const elements: React.ReactNode[] = [];
                              if (mine) {
                                elements.push(
                                  <StatusPill key="mine" tone={mine.should_promote ? "success" : "neutral"}>
                                    you · {mine.should_promote ? "promote" : "hold"}
                                  </StatusPill>,
                                );
                              }
                              for (const o of others) {
                                elements.push(
                                  <StatusPill key={`o-${o.reviewer}`} tone="info">
                                    {o.reviewer} · {o.should_promote ? "promote" : "hold"}
                                  </StatusPill>,
                                );
                              }
                              if (!mine) {
                                elements.push(
                                  <Link
                                    key="review"
                                    href={`/threads/${s.thread_id}`}
                                    className="rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700"
                                  >
                                    {rs.length === 0 ? "Review →" : "Add your review →"}
                                  </Link>,
                                );
                              } else {
                                elements.push(
                                  <Link
                                    key="re-open"
                                    href={`/threads/${s.thread_id}`}
                                    className="text-[11px] text-muted-foreground underline"
                                  >
                                    re-open
                                  </Link>,
                                );
                              }
                              return <div className="flex flex-wrap items-center gap-1.5">{elements}</div>;
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-3 text-xs text-muted-foreground">
                          No threads match the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </SectionCard>
            );
          })}

        <p className="text-[11px] text-muted-foreground">
          ⓘ Your reviews are saved as your judgment only. No emails, Tally entries, or other records are changed. Once ≥25
          reviews are in with ≥85% accuracy, we run the promotion logic and certain threads become visible on the MD dashboard.
        </p>
      </div>
    </PageGuard>
  );
}

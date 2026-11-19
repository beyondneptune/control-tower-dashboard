// Day 11 evidence workbench — per-thread review surface.
// Read-only on email_messages, source_documents, extracted_events,
// business_thread_tally_links, tally_bill_wise_outstanding, invoices.
// Writes ONLY to thread_validation_reviews via the embedded ReviewForm.
//
// Panel layout:
//   A. Thread Summary
//   B. Source Emails (full body, first expanded by default)
//   C. Attachments / Documents
//   D. Tally Evidence (ambiguous correctly labeled, candidates shown separately)
//   E. Stage Evidence (why the classifier picked the current_stage)
//   F. Reviewer Decision Area (existing form, kept)
//   G. Evidence Coverage Counter

import Link from "next/link";
import { ClipboardCheck, AlertTriangle, FileText, Mail, Database, Layers } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSessionClient } from "@/lib/supabase/server";
import { reviewerNameFromUser } from "@/lib/reviewer-identity";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { ReviewForm } from "./review-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

interface EmailMessage {
  id: string;
  mailbox_key: string;
  message_id: string | null;
  subject: string | null;
  from_email: string | null;
  from_name: string | null;
  to_emails: string[] | null;
  cc_emails: string[] | null;
  email_datetime: string | null;
  has_attachment: boolean | null;
  body_text: string | null;
  body_html: string | null;
  summary: string | null;
}

interface SourceDocument {
  id: string;
  message_uuid: string | null;
  attachment_name: string | null;
  document_type: string | null;
  classifier_confidence: number | null;
  parsed_fields: Record<string, unknown> | null;
  storage_path: string | null;
  file_size_bytes: number | null;
}

interface ExtractedEvent {
  id: string;
  source_message_ids: string[] | null;
  event_type: string;
  customer_name: string | null;
  vendor_name: string | null;
  po_no: string | null;
  invoice_no: string | null;
  confidence_score: number | null;
  confidence_reason: string | null;
  raw_payload: Record<string, unknown> | null;
}

interface TallyLink {
  id: string;
  thread_id: string;
  tally_table: string | null;
  tally_row_id: string | null;
  tally_natural_key: string | null;
  link_method: string;
  confidence: number | null;
  evidence: Record<string, unknown> | null;
  reason: string | null;
}

interface TallyBill {
  id: string;
  direction: string | null;
  bill_ref: string | null;
  bill_date: string | null;
  counter_party: string | null;
  bill_amount: number | null;
  bill_due_date: string | null;
  days_overdue: number | null;
  snapshot_at: string | null;
}

interface InvoiceRow {
  id: string;
  invoice_no: string | null;
  invoice_date: string | null;
  taxable_value: number | null;
  gst_value: number | null;
  invoice_total: number | null;
  due_date: string | null;
  status: string | null;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function isInternal(fromEmail: string | null | undefined) {
  return !!fromEmail && fromEmail.toLowerCase().endsWith("@meridianindustries.in");
}

function direction(fromEmail: string | null | undefined) {
  if (!fromEmail) return "—";
  if (isInternal(fromEmail)) return "outbound / internal";
  return "inbound";
}

export default async function ThreadDetailPage({ params }: Params) {
  const { id } = await params;
  const sb = createAdminClient();

  // Identify the current reviewer from session — used to prefill the form
  // and to flag "you already reviewed" vs "another reviewer's review" in the
  // Prior Reviews panel.
  const sessionSb = await createSessionClient();
  const { data: { user: sessionUser } } = await sessionSb.auth.getUser();
  const me = reviewerNameFromUser(sessionUser);

  const { data: thread } = await sb.from("business_threads").select("*").eq("id", id).single();

  if (!thread) {
    return (
      <PageGuard module="email-review">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <p className="text-sm">Thread not found.</p>
          <Link href="/threads/validation" className="text-xs underline text-blue-600">
            ← back to validation
          </Link>
        </div>
      </PageGuard>
    );
  }

  // ── Load all evidence in parallel ──────────────────────────────────────
  const msgIds: string[] = thread.source_message_ids?.length
    ? (thread.source_message_ids as string[])
    : ["00000000-0000-0000-0000-000000000000"];

  const [messagesRes, linksRes, docsRes, eventsRes, priorReviewsRes, sampleRes] =
    await Promise.all([
      sb
        .from("email_messages")
        .select("id, mailbox_key, message_id, subject, from_email, from_name, to_emails, cc_emails, email_datetime, has_attachment, body_text, body_html, summary")
        .in("id", msgIds)
        .order("email_datetime", { ascending: false }),
      sb
        .from("business_thread_tally_links")
        .select("*")
        .eq("thread_id", id)
        .order("confidence", { ascending: false }),
      sb
        .from("source_documents")
        .select("id, message_uuid, attachment_name, document_type, classifier_confidence, parsed_fields, storage_path, file_size_bytes")
        .in("message_uuid", msgIds),
      sb
        .from("extracted_events")
        .select("id, source_message_ids, event_type, customer_name, vendor_name, po_no, invoice_no, confidence_score, confidence_reason, raw_payload")
        .overlaps("source_message_ids", msgIds),
      sb
        .from("thread_validation_reviews")
        .select("*")
        .eq("thread_id", id)
        .order("reviewed_at", { ascending: false }),
      sb
        .from("thread_validation_samples")
        .select("bucket, reason_picked, snapshot_taken_at")
        .eq("thread_id", id)
        .order("snapshot_taken_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const messages = (messagesRes.data || []) as EmailMessage[];
  const links = (linksRes.data || []) as TallyLink[];
  const docs = (docsRes.data || []) as SourceDocument[];
  const events = (eventsRes.data || []) as ExtractedEvent[];
  const priorReviews = priorReviewsRes.data || [];
  const sample = sampleRes.data;

  // ── Hydrate Tally candidates referenced by link rows ──────────────────
  // Each L4_ambiguous row carries top_candidates in evidence JSONB. Pull the
  // actual bill rows by bill_ref so we can show real fields. Also follow up
  // any tally_row_id pointers (for strong links).
  const billRefsToFetch = new Set<string>();
  const billIdsToFetch = new Set<string>();
  const invoiceIdsToFetch = new Set<string>();
  for (const l of links) {
    if (l.tally_table === "tally_bill_wise_outstanding" && l.tally_row_id) billIdsToFetch.add(l.tally_row_id);
    if (l.tally_table === "invoices" && l.tally_row_id) invoiceIdsToFetch.add(l.tally_row_id);
    const ev = l.evidence as { top_candidates?: Array<{ pipl?: string }> } | null;
    for (const c of ev?.top_candidates || []) {
      if (c.pipl) billRefsToFetch.add(c.pipl);
    }
  }
  const [billsByRefRes, billsByIdRes, invoicesByIdRes] = await Promise.all([
    billRefsToFetch.size
      ? sb.from("tally_bill_wise_outstanding").select("*").in("bill_ref", [...billRefsToFetch])
      : Promise.resolve({ data: [] as TallyBill[] }),
    billIdsToFetch.size
      ? sb.from("tally_bill_wise_outstanding").select("*").in("id", [...billIdsToFetch])
      : Promise.resolve({ data: [] as TallyBill[] }),
    invoiceIdsToFetch.size
      ? sb.from("invoices").select("*").in("id", [...invoiceIdsToFetch])
      : Promise.resolve({ data: [] as InvoiceRow[] }),
  ]);
  const billsByRef = new Map<string, TallyBill[]>();
  for (const b of (billsByRefRes.data || []) as TallyBill[]) {
    if (!b.bill_ref) continue;
    if (!billsByRef.has(b.bill_ref)) billsByRef.set(b.bill_ref, []);
    billsByRef.get(b.bill_ref)!.push(b);
  }
  const billById = new Map<string, TallyBill>((billsByIdRes.data || []).map((b: TallyBill) => [b.id, b]));
  const invoiceById = new Map<string, InvoiceRow>((invoicesByIdRes.data || []).map((i: InvoiceRow) => [i.id, i]));

  // ── Per-message events (for anchors + classifier reason display) ──────
  function eventsForMessage(msgId: string): ExtractedEvent[] {
    return events.filter((e) => (e.source_message_ids || []).includes(msgId));
  }

  // ── Stage evidence aggregation ────────────────────────────────────────
  const stageEvidence = (() => {
    const eventTypes = new Set(events.map((e) => e.event_type));
    const allReasons = events
      .map((e) => e.confidence_reason)
      .filter((r): r is string => !!r);
    const hasInvoiceEvidence = events.some(
      (e) => e.event_type === "invoice_submission" && (e.invoice_no || /\bPIPL[\s/\-]?\d{3,4}/i.test(e.raw_payload?.subject as string || "")),
    );
    const hasPoEvidence = events.some(
      (e) => (e.event_type === "customer_po" || e.event_type === "customer_payment_followup") && !!e.po_no,
    );
    const hasOfferKeyword = events.some((e) =>
      /\b(offer|quotation|quote|rfq|enquiry|required)\b/i.test(e.raw_payload?.subject as string || ""),
    );
    return { eventTypes: [...eventTypes], allReasons, hasInvoiceEvidence, hasPoEvidence, hasOfferKeyword };
  })();

  // ── Evidence coverage stats ───────────────────────────────────────────
  const cov = {
    emails_available: messages.length,
    bodies_available: messages.filter((m) => (m.body_text && m.body_text.length > 20) || (m.body_html && m.body_html.length > 30) || (m.summary && m.summary.length > 20)).length,
    attachments_total: docs.length,
    attachments_with_extracted_text: docs.filter((d) => {
      const pf = d.parsed_fields as { extracted_text?: string } | null;
      return !!pf?.extracted_text && pf.extracted_text.length > 30;
    }).length,
    messages_with_attachment_flag: messages.filter((m) => m.has_attachment).length,
    tally_candidates: links.length,
    strong_links: links.filter((l) => l.link_method === "L1_exact_pipl_same_thread" || l.link_method === "L1_exact_po_amount_date_match").length,
    ambiguous_links: links.filter((l) => l.link_method === "L4_ambiguous" || l.link_method === "L2_customer_pipl_ambiguous").length,
    data_required: links.filter((l) => l.link_method === "L4_data_required").length,
  };

  return (
    <PageGuard module="email-review">
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 lg:px-6">
        <div className="flex items-center justify-between">
          <Link href="/threads/validation" className="text-xs text-muted-foreground hover:underline">← Back to sample pack</Link>
          <span className="text-xs font-mono text-muted-foreground">
            stage: {thread.current_stage} · confidence {Number(thread.confidence_score).toFixed(2)}
            {sample?.bucket ? ` · bucket ${sample.bucket}` : ""}
          </span>
        </div>
        <PageHeader
          title={<><ClipboardCheck className="mr-2 inline size-4 -translate-y-0.5" />{thread.customer_name || thread.vendor_name || "(unknown counterparty)"}</>}
          description={`Thread review · stage ${thread.current_stage}`}
        />

        {/* ─────────────────────────── A. Thread Summary ─────────────────────────── */}
        <SectionCard title="A · Thread summary" description="What the system thinks this thread is — verify against the evidence below.">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Customer / Vendor</dt>
              <dd className="font-medium">{thread.customer_name || thread.vendor_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Bucket</dt>
              <dd className="font-mono">{sample?.bucket || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Stage</dt>
              <dd className="font-mono">{thread.current_stage}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Confidence</dt>
              <dd className="tabular-nums">{Number(thread.confidence_score).toFixed(2)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Primary PO</dt>
              <dd className="font-mono">{thread.primary_po_no || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Primary Invoice</dt>
              <dd className="font-mono">{thread.primary_invoice_no || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Primary Quote</dt>
              <dd className="font-mono">{thread.primary_quote_no || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Source mailboxes</dt>
              <dd className="font-mono">{[...new Set(messages.map((m) => m.mailbox_key))].join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Latest activity</dt>
              <dd>{fmtDateTime(thread.latest_activity_at)}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs uppercase text-muted-foreground">Missing data</dt>
              <dd className="font-mono text-xs">{(thread.missing_data || []).join(", ") || "(none)"}</dd>
            </div>
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs uppercase text-muted-foreground">Why this confidence</dt>
              <dd className="text-xs">{thread.confidence_reason || "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        {/* ─────────────────────── B. Source Emails (full body) ───────────────────── */}
        <SectionCard
          title={<><Mail className="mr-1.5 inline size-3.5 -translate-y-0.5" />B · Source emails ({messages.length})</>}
          description="Read the actual email content. First message expanded by default; click to expand others."
        >
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground">No source messages on this thread.</p>
          )}
          <div className="space-y-3">
            {messages.map((m, idx) => {
              const msgEvents = eventsForMessage(m.id);
              const msgDocs = docs.filter((d) => d.message_uuid === m.id);
              const bodyText = m.body_text && m.body_text.length > 20 ? m.body_text : "";
              const fallbackContent = m.summary || "";
              const hasFullBody = bodyText.length > 0;
              return (
                <details
                  key={m.id}
                  open={idx === 0}
                  className="rounded-md border bg-muted/10 [&[open]>summary]:border-b"
                >
                  <summary className="flex cursor-pointer items-start justify-between gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{m.mailbox_key}</span>
                        <StatusPill tone={direction(m.from_email) === "inbound" ? "info" : "neutral"} dot={false}>{direction(m.from_email)}</StatusPill>
                        {m.has_attachment && <StatusPill tone="warning" dot={false}>has attachment</StatusPill>}
                      </div>
                      <div className="mt-1 truncate font-medium">{m.subject || "(no subject)"}</div>
                      <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {m.from_name ? `${m.from_name} <${m.from_email}>` : m.from_email} · {fmtDateTime(m.email_datetime)}
                      </div>
                    </div>
                  </summary>
                  <div className="space-y-3 px-3 py-3">
                    <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">From: </span>
                        <span className="font-mono">{m.from_email || "—"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">To: </span>
                        <span className="font-mono">{(m.to_emails || []).join(", ") || "—"}</span>
                      </div>
                      {(m.cc_emails || []).length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Cc: </span>
                          <span className="font-mono">{(m.cc_emails || []).join(", ")}</span>
                        </div>
                      )}
                      <div className="col-span-2">
                        <span className="text-muted-foreground">message_id: </span>
                        <span className="font-mono text-[10px]">{m.message_id || "—"}</span>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="rounded border bg-background p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {hasFullBody ? "Email body" : "Email body (summary only — full body not synced)"}
                      </div>
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                        {hasFullBody ? bodyText : fallbackContent || "(no content extracted)"}
                      </pre>
                    </div>

                    {/* Per-email extracted anchors + classifier rationale */}
                    {msgEvents.length > 0 && (
                      <div className="rounded border bg-amber-50/30 px-3 py-2 dark:bg-amber-950/10">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Classifier output for this email</div>
                        {msgEvents.map((e) => (
                          <div key={e.id} className="text-xs">
                            <span className="font-mono">{e.event_type}</span>
                            {e.customer_name && <> · customer <span className="font-medium">{e.customer_name}</span></>}
                            {e.vendor_name && <> · vendor <span className="font-medium">{e.vendor_name}</span></>}
                            {e.po_no && <> · PO <span className="font-mono">{e.po_no}</span></>}
                            {e.invoice_no && <> · INV <span className="font-mono">{e.invoice_no}</span></>}
                            <span className="ml-1 text-muted-foreground">({Number(e.confidence_score || 0).toFixed(2)})</span>
                            {e.confidence_reason && (
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{e.confidence_reason}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachment hint */}
                    {m.has_attachment && (
                      <div className="text-[11px] text-muted-foreground">
                        {msgDocs.length > 0
                          ? `${msgDocs.length} attachment(s) — see panel C below`
                          : "Attachment present — text not extracted (Data Required)"}
                      </div>
                    )}
                  </div>
                </details>
              );
            })}
          </div>
        </SectionCard>

        {/* ──────────────────────── C. Attachments / Documents ────────────────────── */}
        <SectionCard
          title={<><FileText className="mr-1.5 inline size-3.5 -translate-y-0.5" />C · Attachments / documents ({docs.length})</>}
          description="Read-only — attachment text extracted from PDFs/Excels where available."
        >
          {docs.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">No source_documents rows mapped to this thread&apos;s messages.</p>
              {cov.messages_with_attachment_flag > 0 && (
                <StatusPill tone="warning">
                  <AlertTriangle className="size-3" />
                  {cov.messages_with_attachment_flag} message(s) flagged has_attachment=true · text not extracted (Data Required)
                </StatusPill>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {docs.map((d) => {
                const pf = (d.parsed_fields || {}) as {
                  anchors?: { po_nos?: string[]; invoice_nos?: string[]; drawing_nos?: string[]; quote_nos?: string[] };
                  extracted_text?: string;
                  page_count?: number;
                  text_length?: number;
                  customer_document_extraction?: { customer?: string; po_no?: string; amount?: number };
                };
                const a = pf.anchors || {};
                const extractor = pf.customer_document_extraction || {};
                const previewLen = 600;
                const text = pf.extracted_text || "";
                return (
                  <div key={d.id} className="rounded border bg-muted/10 p-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{d.attachment_name || "(unnamed)"}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono">{d.document_type || "unclassified"}</span>
                          {d.file_size_bytes && <span>· {(d.file_size_bytes / 1024).toFixed(0)} KB</span>}
                          {pf.page_count && <span>· {pf.page_count} page(s)</span>}
                          {d.classifier_confidence != null && <span>· conf {Number(d.classifier_confidence).toFixed(2)}</span>}
                        </div>
                      </div>
                      {d.storage_path && (
                        <a
                          href={`/api/source-docs/${d.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded border px-2 py-1 text-[10px] hover:bg-accent"
                        >
                          open
                        </a>
                      )}
                    </div>

                    {/* Anchors */}
                    {(a.po_nos?.length || a.invoice_nos?.length || a.drawing_nos?.length || a.quote_nos?.length || extractor.customer || extractor.po_no) && (
                      <div className="mt-2 rounded bg-amber-50/40 p-2 font-mono text-[11px] dark:bg-amber-950/10">
                        {(a.po_nos || []).map((v) => <span key={`po-${v}`} className="mr-2">PO:{v}</span>)}
                        {(a.invoice_nos || []).map((v) => <span key={`inv-${v}`} className="mr-2">INV:{v}</span>)}
                        {(a.drawing_nos || []).map((v) => <span key={`drw-${v}`} className="mr-2">DRW:{v}</span>)}
                        {(a.quote_nos || []).map((v) => <span key={`q-${v}`} className="mr-2">Q:{v}</span>)}
                        {extractor.customer && <span className="mr-2">CUSTOMER:{extractor.customer}</span>}
                        {extractor.po_no && <span className="mr-2">PO:{extractor.po_no}</span>}
                        {extractor.amount && <span className="mr-2">AMT:{fmtMoney(extractor.amount)}</span>}
                      </div>
                    )}

                    {/* Extracted text preview */}
                    {text ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-muted-foreground hover:underline">
                          extracted text ({pf.text_length || text.length} chars) — click to expand
                        </summary>
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded border bg-background p-2 text-[11px] leading-relaxed">{text.slice(0, 4000)}{text.length > 4000 ? "\n…(truncated)" : ""}</pre>
                      </details>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted-foreground italic">No extracted text · Data Required</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ───────────────────────── D. Tally Evidence ───────────────────────────── */}
        <SectionCard
          title={<><Database className="mr-1.5 inline size-3.5 -translate-y-0.5" />D · Tally evidence ({links.length} link row{links.length === 1 ? "" : "s"})</>}
          description="Read-only Tally cache. Ambiguous links never displayed as confirmed truth."
        >
          {links.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Tally link rows — Data Required.</p>
          ) : (
            <div className="space-y-3">
              {links.map((l) => {
                const isStrong = l.link_method === "L1_exact_pipl_same_thread" || l.link_method === "L1_exact_po_amount_date_match";
                const isAmbiguous = l.link_method === "L4_ambiguous" || l.link_method === "L2_customer_pipl_ambiguous";
                const isDataReq = l.link_method === "L4_data_required";
                const linkedBill = l.tally_row_id ? billById.get(l.tally_row_id) : null;
                const linkedInvoice = l.tally_row_id ? invoiceById.get(l.tally_row_id) : null;
                const ev = (l.evidence || {}) as { top_candidates?: Array<{ pipl: string; amount?: number; gap_days?: number }> };
                return (
                  <div key={l.id} className="rounded border bg-muted/10 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono">{l.link_method}</span>
                        {isStrong && <StatusPill tone="success">strong</StatusPill>}
                        {isAmbiguous && <StatusPill tone="warning">Ambiguous / Data Required — no confirmed Tally link</StatusPill>}
                        {isDataReq && <StatusPill tone="neutral">Data Required</StatusPill>}
                      </div>
                      <span className="font-mono tabular-nums text-muted-foreground">conf {Number(l.confidence || 0).toFixed(2)}</span>
                    </div>
                    {l.reason && <p className="mt-1 text-[11px] text-muted-foreground">{l.reason}</p>}

                    {/* Strong link — show actual Tally row */}
                    {isStrong && (linkedBill || linkedInvoice || l.tally_natural_key) && (
                      <div className="mt-2 rounded bg-green-50/40 p-2 dark:bg-green-950/10">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Confirmed Tally row</div>
                        {linkedBill && (
                          <dl className="grid grid-cols-2 gap-1 font-mono">
                            <div><dt className="text-muted-foreground">bill_ref</dt><dd>{linkedBill.bill_ref}</dd></div>
                            <div><dt className="text-muted-foreground">bill_date</dt><dd>{fmtDate(linkedBill.bill_date)}</dd></div>
                            <div><dt className="text-muted-foreground">counter_party</dt><dd>{linkedBill.counter_party}</dd></div>
                            <div><dt className="text-muted-foreground">bill_amount</dt><dd>₹ {fmtMoney(linkedBill.bill_amount)}</dd></div>
                            <div><dt className="text-muted-foreground">due_date</dt><dd>{fmtDate(linkedBill.bill_due_date)}</dd></div>
                            <div><dt className="text-muted-foreground">days_overdue</dt><dd>{linkedBill.days_overdue ?? "—"}</dd></div>
                            <div className="col-span-2"><dt className="text-muted-foreground">snapshot</dt><dd>{fmtDateTime(linkedBill.snapshot_at)}</dd></div>
                          </dl>
                        )}
                        {linkedInvoice && (
                          <dl className="grid grid-cols-2 gap-1 font-mono">
                            <div><dt className="text-muted-foreground">invoice_no</dt><dd>{linkedInvoice.invoice_no}</dd></div>
                            <div><dt className="text-muted-foreground">invoice_date</dt><dd>{fmtDate(linkedInvoice.invoice_date)}</dd></div>
                            <div><dt className="text-muted-foreground">taxable</dt><dd>₹ {fmtMoney(linkedInvoice.taxable_value)}</dd></div>
                            <div><dt className="text-muted-foreground">GST</dt><dd>₹ {fmtMoney(linkedInvoice.gst_value)}</dd></div>
                            <div><dt className="text-muted-foreground">total</dt><dd>₹ {fmtMoney(linkedInvoice.invoice_total)}</dd></div>
                            <div><dt className="text-muted-foreground">status</dt><dd>{linkedInvoice.status || "—"}</dd></div>
                            <div className="col-span-2"><dt className="text-muted-foreground">due_date</dt><dd>{fmtDate(linkedInvoice.due_date)}</dd></div>
                          </dl>
                        )}
                        {!linkedBill && !linkedInvoice && l.tally_natural_key && (
                          <div className="font-mono">natural_key: {l.tally_natural_key}</div>
                        )}
                      </div>
                    )}

                    {/* Ambiguous — show candidates separately, NOT as confirmed */}
                    {isAmbiguous && (
                      <div className="mt-2 rounded bg-amber-50/40 p-2 dark:bg-amber-950/10">
                        <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Candidate Tally rows (NOT a confirmed link — for evaluation only)
                        </div>
                        <table className="w-full text-[11px]">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="py-1 pr-2">PIPL</th>
                              <th className="py-1 pr-2">Bill date</th>
                              <th className="py-1 pr-2">Counter party</th>
                              <th className="py-1 pr-2 text-right">Amount</th>
                              <th className="py-1 pr-2">Gap (d)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(ev.top_candidates || []).map((c, i) => {
                              const bills = billsByRef.get(c.pipl) || [];
                              const b = bills[0];
                              return (
                                <tr key={i} className="border-t">
                                  <td className="py-1 pr-2 font-mono">{c.pipl}</td>
                                  <td className="py-1 pr-2">{fmtDate(b?.bill_date)}</td>
                                  <td className="py-1 pr-2">{b?.counter_party || "—"}</td>
                                  <td className="py-1 pr-2 text-right font-mono">₹ {fmtMoney(b?.bill_amount ?? c.amount ?? null)}</td>
                                  <td className="py-1 pr-2 text-muted-foreground">{c.gap_days ?? "—"}</td>
                                </tr>
                              );
                            })}
                            {!ev.top_candidates?.length && (
                              <tr><td colSpan={5} className="py-1 text-muted-foreground">No candidates recorded in evidence.</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {/* ──────────────────────── E. Stage Evidence ────────────────────────────── */}
        <SectionCard
          title={<><Layers className="mr-1.5 inline size-3.5 -translate-y-0.5" />E · Stage evidence — why &quot;{thread.current_stage}&quot;?</>}
          description="What the classifier saw to pick this lifecycle stage."
        >
          <div className="space-y-2 text-xs">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-muted-foreground">Event types seen on this thread:</span>
              {stageEvidence.eventTypes.map((t) => (
                <StatusPill key={t} tone="info" dot={false}>{t}</StatusPill>
              ))}
            </div>
            <ul className="ml-4 list-disc space-y-1 text-[11px]">
              <li>
                <strong>PO evidence:</strong> {stageEvidence.hasPoEvidence ? "✓ present (po_no on event)" : "✗ no PO number on any event"}
              </li>
              <li>
                <strong>Invoice evidence:</strong> {stageEvidence.hasInvoiceEvidence ? "✓ present (invoice_no or PIPL pattern)" : "✗ no invoice number / PIPL pattern"}
              </li>
              <li>
                <strong>Offer / quote / RFQ keyword in subject:</strong> {stageEvidence.hasOfferKeyword ? "✓ present" : "✗ absent"}
              </li>
            </ul>
            <div className="rounded border bg-muted/20 p-2 text-[11px]">
              <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Stage rule applied</div>
              <p>
                Current stage: <span className="font-mono">{thread.current_stage}</span>.
                {thread.current_stage === "invoiced" && " Rule: invoice evidence (invoice_no or PIPL pattern) required."}
                {thread.current_stage === "po_received" && " Rule: PO number on a customer_po or payment_followup event required."}
                {thread.current_stage === "quotation_request_to_finance" && " Rule: subject signals offer/quote/RFQ without strong PO or invoice evidence — OR event_type label fell back from po/invoice without anchor."}
                {thread.current_stage === "bom_drawing_received" && " Rule: BOM or drawing event on customer thread."}
                {thread.current_stage === "rfq_received" && " Rule: default — no clear lifecycle signal yet."}
              </p>
            </div>
            {stageEvidence.allReasons.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[11px] text-muted-foreground hover:underline">classifier reasons ({stageEvidence.allReasons.length}) — click to expand</summary>
                <ul className="mt-1 ml-4 list-disc space-y-0.5 text-[11px]">
                  {stageEvidence.allReasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </details>
            )}
          </div>
        </SectionCard>

        {/* ───────────────────────── F. Reviewer Decision ────────────────────────── */}
        <SectionCard
          title="F · Your review"
          description="Quick judgment. Your answers are stored only as your judgment — nothing on the email, Tally or WhatsApp side is changed."
        >
          <ReviewForm
            threadId={id}
            customerName={thread.customer_name}
            currentStage={thread.current_stage}
            defaultReviewer={me.name}
            existingReviewerNames={priorReviews.map((r) => r.reviewer as string)}
          />
        </SectionCard>

        {/* ───────────────────── G. Evidence Coverage Counter ───────────────────── */}
        <SectionCard title="G · Evidence coverage on this thread" description="Tells you whether you have enough on-screen to decide.">
          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
            <div><div className="text-muted-foreground">Emails available</div><div className="font-mono text-lg tabular-nums">{cov.emails_available}</div></div>
            <div><div className="text-muted-foreground">Bodies available</div><div className="font-mono text-lg tabular-nums">{cov.bodies_available}</div></div>
            <div><div className="text-muted-foreground">Attachments mapped</div><div className="font-mono text-lg tabular-nums">{cov.attachments_total}</div></div>
            <div><div className="text-muted-foreground">Text extracted</div><div className="font-mono text-lg tabular-nums">{cov.attachments_with_extracted_text}</div></div>
            <div><div className="text-muted-foreground">Tally candidates</div><div className="font-mono text-lg tabular-nums">{cov.tally_candidates}</div></div>
            <div><div className="text-muted-foreground">Strong links</div><div className="font-mono text-lg tabular-nums">{cov.strong_links}</div></div>
            <div><div className="text-muted-foreground">Ambiguous</div><div className="font-mono text-lg tabular-nums">{cov.ambiguous_links}</div></div>
            <div><div className="text-muted-foreground">Data required</div><div className="font-mono text-lg tabular-nums">{cov.data_required}</div></div>
          </div>
          {cov.messages_with_attachment_flag > cov.attachments_total && (
            <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
              {cov.messages_with_attachment_flag - cov.attachments_total} message(s) flagged has_attachment=true but no attachment text on screen — judgment may need Zoho lookup for those specific cases.
            </p>
          )}
        </SectionCard>

        {/* Prior reviews — kept */}
        {priorReviews.length > 0 && (
          <SectionCard title={`Prior reviews (${priorReviews.length})`}>
            <table className="w-full text-xs">
              <thead className="bg-muted/30 text-left uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Reviewer</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Tally</th>
                  <th className="px-3 py-2">Real thread</th>
                  <th className="px-3 py-2">Promote</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {priorReviews.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 font-mono">{r.reviewer}</td>
                    <td className="px-3 py-2">{r.customer_correct ? "✓" : "✗"}</td>
                    <td className="px-3 py-2">{r.stage_correct ? "✓" : "✗"}</td>
                    <td className="px-3 py-2">{r.tally_link_correct}</td>
                    <td className="px-3 py-2">{r.is_real_business_thread === null ? "—" : r.is_real_business_thread ? "✓" : "✗"}</td>
                    <td className="px-3 py-2">{r.should_promote ? "✓" : "✗"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.reviewer_note}</td>
                    <td className="px-3 py-2 text-muted-foreground">{fmtDateTime(r.reviewed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        )}
      </div>
    </PageGuard>
  );
}

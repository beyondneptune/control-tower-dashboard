// Server component — loads pending email-derived extracted_events for review.
// Joins to source_connectors for the mailbox display name.

import { createAdminClient } from "@/lib/supabase/admin";
import { EmailReviewView, type EmailEventRow } from "./email-review-view";

export const dynamic = "force-dynamic";

interface RawPayloadShape {
  subject?: string | null;
  from_email?: string | null;
  from_name?: string | null;
  summary_excerpt?: string | null;
  has_attachment?: boolean;
  gst_reference?: string | null;
  action_required?: string | null;
  urgency?: string | null;
  payment_status?: string | null;
}

export default async function EmailReviewPage() {
  const sb = createAdminClient();

  // First 300 pending events; UI shows 100 at a time with filters.
  const { data: events } = await sb
    .from("extracted_events")
    .select(
      "id, inspection_bundle_id, mailbox_key, event_type, event_datetime, customer_name, vendor_name, invoice_no, po_no, amount, due_date, status, responsible_person, confidence_score, confidence_band, confidence_reason, reviewed_status, raw_payload",
    )
    .eq("source_type", "email")
    .eq("reviewed_status", "pending")
    .neq("event_type", "irrelevant")
    .order("confidence_score", { ascending: false })
    .order("event_datetime", { ascending: false })
    .limit(300);

  // Mailbox owner-name lookup (small, fast)
  const { data: connectors } = await sb
    .from("source_connectors")
    .select("mailbox_key, mailbox_owner_name")
    .eq("connector_type", "zoho_mail");
  const ownerByKey = new Map<string, string | null>();
  for (const c of connectors || []) {
    ownerByKey.set(c.mailbox_key as string, (c.mailbox_owner_name as string) || null);
  }

  const rows: EmailEventRow[] = (events || []).map((e) => {
    const rp = ((e.raw_payload as RawPayloadShape | null) ?? {}) as RawPayloadShape;
    return {
      id: e.id as string,
      inspection_bundle_id: (e.inspection_bundle_id as string) ?? null,
      mailbox_key: (e.mailbox_key as string) ?? "(unknown)",
      mailbox_owner_name: ownerByKey.get(e.mailbox_key as string) ?? null,
      event_type: e.event_type as string,
      event_datetime: e.event_datetime as string,
      customer_name: (e.customer_name as string | null) ?? null,
      vendor_name:   (e.vendor_name   as string | null) ?? null,
      invoice_no:    (e.invoice_no    as string | null) ?? null,
      po_no:         (e.po_no         as string | null) ?? null,
      amount:        (e.amount as number | null) ?? null,
      due_date:      (e.due_date      as string | null) ?? null,
      status:        (e.status        as string | null) ?? null,
      responsible_person: (e.responsible_person as string | null) ?? null,
      confidence_score: Number(e.confidence_score) || 0,
      confidence_band:  (e.confidence_band as "high" | "medium" | "low") ?? "low",
      confidence_reason: (e.confidence_reason as string | null) ?? null,
      reviewed_status: e.reviewed_status as string,
      subject: rp.subject ?? null,
      from_email: rp.from_email ?? null,
      from_name: rp.from_name ?? null,
      summary_excerpt: rp.summary_excerpt ?? null,
      has_attachment: !!rp.has_attachment,
      gst_reference: rp.gst_reference ?? null,
      action_required: rp.action_required ?? null,
      urgency: rp.urgency ?? null,
      payment_status: rp.payment_status ?? null,
    };
  });

  // Summary counts for all email events
  const { data: countsRaw } = await sb
    .from("extracted_events")
    .select("reviewed_status, confidence_band, event_type")
    .eq("source_type", "email");
  const totalCount = { high: 0, medium: 0, low: 0, irrelevant: 0, approved: 0, rejected: 0 };
  for (const c of countsRaw || []) {
    const rs = c.reviewed_status as string;
    const cb = c.confidence_band as string;
    const et = c.event_type as string;
    if (rs === "approved") totalCount.approved++;
    else if (rs === "rejected") totalCount.rejected++;
    else if (et === "irrelevant") totalCount.irrelevant++;
    else if (cb === "high") totalCount.high++;
    else if (cb === "medium") totalCount.medium++;
    else totalCount.low++;
  }

  return (
    <EmailReviewView
      initialRows={rows}
      totalCount={totalCount}
      asOf={new Date().toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}
    />
  );
}

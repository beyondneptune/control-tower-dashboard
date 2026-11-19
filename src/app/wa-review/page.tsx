// Server component — loads pending extracted_events with their source raw
// message text for side-by-side review.

import { createAdminClient } from "@/lib/supabase/admin";
import { WaReviewView, type ReviewEventRow } from "./wa-review-view";

export const dynamic = "force-dynamic";

export default async function WaReviewPage() {
  const sb = createAdminClient();

  // Pending events first; cap at 300 for initial load (UI shows 100 at a time
  // with filters). Reviewer paginates by refining filters.
  const { data: events } = await sb
    .from("extracted_events")
    .select(
      "id, inspection_bundle_id, event_type, event_datetime, customer_name, part_name, material_grade, coating_material, powder_supplier, serial_no, process_stage, status, remarks, responsible_person, confidence_score, confidence_band, confidence_reason, reviewed_status, source_message_ids, raw_payload",
    )
    .eq("source_type", "whatsapp")
    .eq("reviewed_status", "pending")
    .neq("event_type", "irrelevant") // skip noise from the queue
    .order("confidence_score", { ascending: false })
    .order("event_datetime", { ascending: false })
    .limit(300);

  // Pull raw text snippets per event by source_message_ids
  const allIds = (events || []).flatMap((e) => (e.source_message_ids as string[] | null) || []);
  const textsById = new Map<string, string>();
  if (allIds.length > 0) {
    const { data: msgs } = await sb
      .from("source_messages")
      .select("id, raw_text, has_media")
      .in("id", allIds.slice(0, 5000)); // safety cap
    for (const m of msgs || []) {
      const t = (m.raw_text as string) || "";
      if (t && !/^(image|video|sticker|audio|gif|document)\s+omitted$/i.test(t.trim())) {
        textsById.set(m.id as string, t);
      }
    }
  }

  const rows: ReviewEventRow[] = (events || []).map((e) => {
    const ids = ((e.source_message_ids as string[] | null) || []).slice(0, 3);
    const samples = ids
      .map((id) => textsById.get(id))
      .filter((t): t is string => !!t)
      .slice(0, 3);
    return {
      id: e.id as string,
      inspection_bundle_id: e.inspection_bundle_id as string | null,
      event_type: e.event_type as string,
      event_datetime: e.event_datetime as string,
      customer_name: (e.customer_name as string | null) ?? null,
      part_name: (e.part_name as string | null) ?? null,
      material_grade: (e.material_grade as string | null) ?? null,
      coating_material: (e.coating_material as string | null) ?? null,
      powder_supplier: (e.powder_supplier as string | null) ?? null,
      serial_no: (e.serial_no as string | null) ?? null,
      process_stage: (e.process_stage as string | null) ?? null,
      status: (e.status as string | null) ?? null,
      remarks: (e.remarks as string | null) ?? null,
      responsible_person: (e.responsible_person as string | null) ?? null,
      confidence_score: Number(e.confidence_score) || 0,
      confidence_band: (e.confidence_band as "high" | "medium" | "low") ?? "low",
      confidence_reason: (e.confidence_reason as string | null) ?? null,
      reviewed_status: e.reviewed_status as string,
      rawTextSamples: samples,
      bundleSize: ((e.source_message_ids as string[] | null) || []).length,
    };
  });

  // Summary counts
  const { data: countsRaw } = await sb
    .from("extracted_events")
    .select("reviewed_status, confidence_band, event_type")
    .eq("source_type", "whatsapp");
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
    <WaReviewView
      initialRows={rows}
      totalCount={totalCount}
      asOf={new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    />
  );
}

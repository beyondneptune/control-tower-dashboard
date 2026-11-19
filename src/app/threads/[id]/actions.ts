"use server";

// Day 8: server action for the reviewer judgment form.
// Day 10: after save, redirect to the next unreviewed thread (bucket-priority order).
// Writes to thread_validation_reviews ONLY. No mutation of Tally / email / WhatsApp.
// No business_threads modification either — that comes via the promotion gate, not per-review.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PACK_LABEL = `day11-post-remediation-validation`;
const BUCKET_PRIORITY = [
  "HAWA_OC1137",
  "FLOWSERVE",
  "LOW_LINK_CONF",
  "YOUNUS_INVOICE",
  "PAVAN_RFQ_PO",
  "MIXED_LOW_CONF",
];

export async function saveThreadReview(formData: FormData) {
  // Authenticate, and bind the reviewer to the signed-in user — never trust a
  // client-supplied reviewer name on an admin-client write (M-16).
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const reviewer = u.user.email ?? u.user.id;

  const thread_id = String(formData.get("thread_id") || "");
  if (!thread_id) return;

  const customer_correct = formData.get("customer_correct") === "true";
  const stage_correct = formData.get("stage_correct") === "true";
  const tally_link_correct = String(formData.get("tally_link_correct") || "");
  const should_promote = formData.get("should_promote") === "true";
  const reviewer_note = String(formData.get("reviewer_note") || "").trim() || null;
  const is_real_business_thread_raw = formData.get("is_real_business_thread");
  const is_real_business_thread =
    is_real_business_thread_raw === "true"
      ? true
      : is_real_business_thread_raw === "false"
        ? false
        : null;

  // Post-Day10 remediation: cascade rule from MD — "if customer_correct=false
  // or stage_correct=false, the dashboard promotion answer must default to No."
  // We enforce server-side too in case the client cascade is bypassed.
  const final_should_promote = customer_correct && stage_correct ? should_promote : false;

  const sb = createAdminClient();
  // Idempotent on (thread_id, reviewer) — backed by the unique index in
  // migration 0015. Double-submits update the same row instead of creating
  // a duplicate.
  await sb.from("thread_validation_reviews").upsert(
    {
      thread_id,
      reviewer,
      customer_correct,
      stage_correct,
      tally_link_correct,
      should_promote: final_should_promote,
      reviewer_note,
      is_real_business_thread,
    },
    { onConflict: "thread_id,reviewer" },
  );

  revalidatePath(`/threads/${thread_id}`);
  revalidatePath("/threads/validation");

  const { data: samples } = await sb
    .from("thread_validation_samples")
    .select("thread_id, bucket")
    .eq("pack_label", PACK_LABEL);
  const sampleRows = (samples || []) as Array<{ thread_id: string; bucket: string }>;
  if (sampleRows.length === 0) redirect("/threads/validation");

  const sampleIds = sampleRows.map((s) => s.thread_id);
  const { data: reviewed } = await sb
    .from("thread_validation_reviews")
    .select("thread_id")
    .in("thread_id", sampleIds);
  const reviewedSet = new Set((reviewed || []).map((r) => r.thread_id as string));
  const unreviewed = sampleRows.filter((s) => !reviewedSet.has(s.thread_id));
  if (unreviewed.length === 0) redirect("/threads/validation");

  unreviewed.sort((a, b) => {
    const ai = BUCKET_PRIORITY.indexOf(a.bucket);
    const bi = BUCKET_PRIORITY.indexOf(b.bucket);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  redirect(`/threads/${unreviewed[0].thread_id}`);
}

"use server";
import "server-only";

/**
 * Server actions for the Email extraction Review & Confirm queue.
 *
 * Mirrors /wa-review/actions.ts (same extracted_events table), but writes
 * audit_log entries with action='email_review_<verb>' so the audit trail
 * can distinguish what source the human approval acted on.
 *
 * IMPORTANT: NO promotion to operational tables. Approving here flips
 * extracted_events.reviewed_status to 'approved' — it does NOT create a
 * row in invoices, bank_transactions, or any other live table. Promotion
 * is a separate, gated step the user hasn't approved yet.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
}

const ALLOWED_ROLES = new Set(["md", "finance", "production"]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", profileId: null, role: null };
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (!role || !ALLOWED_ROLES.has(role)) {
    return { error: "This action is restricted to MD / Finance / Production roles.", profileId: null, role: null };
  }
  return { profileId: user.id, role, error: null };
}

async function recordAudit({
  profileId,
  role,
  action,
  eventId,
  oldVal,
  newVal,
}: {
  profileId: string;
  role: string;
  action: string;
  eventId: string;
  oldVal?: Record<string, unknown>;
  newVal?: Record<string, unknown>;
}) {
  const admin = createAdminClient();
  await admin.from("audit_log").insert({
    user_id: profileId,
    user_role: role,
    action,
    table_name: "extracted_events",
    record_id: eventId,
    old_value: oldVal ?? null,
    new_value: newVal ?? null,
  });
}

export async function approveEmailEvent(
  eventId: string,
  notes?: string,
): Promise<ReviewActionResult> {
  const { profileId, role, error } = await authorize();
  if (error) return { ok: false, error };
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("extracted_events")
    .select("reviewed_status, approval_notes")
    .eq("id", eventId)
    .single();

  const { error: updErr } = await admin
    .from("extracted_events")
    .update({
      reviewed_status: "approved",
      reviewed_by: profileId,
      reviewed_at: new Date().toISOString(),
      approval_notes: notes ?? null,
    })
    .eq("id", eventId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    profileId: profileId!,
    role: role!,
    action: "email_review_approve",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "approved", approval_notes: notes ?? null },
  });

  revalidatePath("/email-review");
  revalidatePath("/");
  return { ok: true };
}

export async function rejectEmailEvent(
  eventId: string,
  notes?: string,
): Promise<ReviewActionResult> {
  const { profileId, role, error } = await authorize();
  if (error) return { ok: false, error };
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("extracted_events")
    .select("reviewed_status, approval_notes")
    .eq("id", eventId)
    .single();

  const { error: updErr } = await admin
    .from("extracted_events")
    .update({
      reviewed_status: "rejected",
      reviewed_by: profileId,
      reviewed_at: new Date().toISOString(),
      approval_notes: notes ?? null,
    })
    .eq("id", eventId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    profileId: profileId!,
    role: role!,
    action: "email_review_reject",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "rejected", approval_notes: notes ?? null },
  });

  revalidatePath("/email-review");
  return { ok: true };
}

export async function markEmailDuplicate(
  eventId: string,
  notes?: string,
): Promise<ReviewActionResult> {
  const { profileId, role, error } = await authorize();
  if (error) return { ok: false, error };
  const admin = createAdminClient();

  const { data: before } = await admin
    .from("extracted_events")
    .select("reviewed_status, approval_notes")
    .eq("id", eventId)
    .single();

  const { error: updErr } = await admin
    .from("extracted_events")
    .update({
      reviewed_status: "superseded",
      reviewed_by: profileId,
      reviewed_at: new Date().toISOString(),
      approval_notes: notes ?? "Marked duplicate",
    })
    .eq("id", eventId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    profileId: profileId!,
    role: role!,
    action: "email_review_mark_duplicate",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "superseded" },
  });

  revalidatePath("/email-review");
  return { ok: true };
}

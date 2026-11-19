"use server";
import "server-only";

/**
 * Server actions for the WhatsApp extraction Review & Confirm queue.
 *
 * Every action:
 *   - re-verifies the user server-side (never trusts client role)
 *   - writes the change to `extracted_events`
 *   - records an audit_log entry (table_name='extracted_events',
 *     action='wa_review_<verb>')
 *   - DOES NOT write to jobs/quality_reports/production_stages/invoices etc.
 *     This is the Phase B boundary — official tables stay clean.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export interface ReviewActionResult {
  ok: boolean;
  error?: string;
}

const ALLOWED_ROLES = new Set(["md", "production", "quality"]);

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated.", profileId: null, role: null };
  const role = (user.app_metadata?.role as string | undefined) ?? null;
  if (!role || !ALLOWED_ROLES.has(role)) {
    return { error: "This action is restricted to MD/production/quality roles.", profileId: null, role: null };
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

export async function approveEvent(
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
    action: "wa_review_approve",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "approved", approval_notes: notes ?? null },
  });

  revalidatePath("/wa-review");
  revalidatePath("/");
  return { ok: true };
}

export async function rejectEvent(
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
    action: "wa_review_reject",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "rejected", approval_notes: notes ?? null },
  });

  revalidatePath("/wa-review");
  return { ok: true };
}

export async function markDuplicate(
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
    action: "wa_review_mark_duplicate",
    eventId,
    oldVal: before ?? undefined,
    newVal: { reviewed_status: "superseded" },
  });

  revalidatePath("/wa-review");
  return { ok: true };
}

export async function editFields(
  eventId: string,
  patch: {
    customer_name?: string | null;
    part_name?: string | null;
    material_grade?: string | null;
    coating_material?: string | null;
    powder_supplier?: string | null;
    serial_no?: string | null;
    linked_route_card_no?: string | null;
    linked_job_card_no?: string | null;
    process_stage?: string | null;
    status?: string | null;
    remarks?: string | null;
  },
  notes?: string,
): Promise<ReviewActionResult> {
  const { profileId, role, error } = await authorize();
  if (error) return { ok: false, error };
  const admin = createAdminClient();

  const allowedKeys = new Set([
    "customer_name",
    "part_name",
    "material_grade",
    "coating_material",
    "powder_supplier",
    "serial_no",
    "linked_route_card_no",
    "linked_job_card_no",
    "process_stage",
    "status",
    "remarks",
  ]);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (allowedKeys.has(k)) clean[k] = v;
  }

  const { data: before } = await admin
    .from("extracted_events")
    .select(Array.from(allowedKeys).join(",") + ",approval_notes")
    .eq("id", eventId)
    .single();

  const { error: updErr } = await admin
    .from("extracted_events")
    .update({ ...clean, approval_notes: notes ?? undefined })
    .eq("id", eventId);
  if (updErr) return { ok: false, error: updErr.message };

  await recordAudit({
    profileId: profileId!,
    role: role!,
    action: "wa_review_edit",
    eventId,
    oldVal: (before as unknown as Record<string, unknown>) ?? undefined,
    newVal: clean,
  });

  revalidatePath("/wa-review");
  return { ok: true };
}

"use server";
// Server actions for the two Operations forms. Both write to the clean ops_* SSOT
// layer (source_kind='form') and attribute the actor. Role-checked in code; writes
// via the admin client. Revalidate so the board reflects the change immediately.
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { Role } from "@/domain/types";

async function actor() {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  const meta = (u.user?.app_metadata ?? {}) as Record<string, unknown>;
  const role = (meta.role as Role) ?? "auditor";
  const email = u.user?.email ?? null;
  return { userId: u.user?.id ?? null, email, role, name: email ?? role };
}

export async function confirmRfq(input: {
  rfq_no?: string | null; customer: string; drawing_no: string; received_date: string;
  part?: string | null; qty?: number | null; candidate_ref?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const a = await actor();
  if (!["md", "sales", "production"].includes(a.role)) return { ok: false, error: "Not permitted for this role" };
  const customer = (input.customer || "").trim();
  const drawing_no = (input.drawing_no || "").trim();
  const received_date = (input.received_date || "").trim();
  // "complete data, no gaps" — an RFQ is not confirmable without these three.
  if (!customer || !drawing_no || !received_date) return { ok: false, error: "Customer, drawing number and received date are all required" };
  const admin = createAdminClient();
  const { error } = await admin.from("ops_rfq").insert({
    rfq_no: input.rfq_no || null, customer, drawing_no, received_date,
    candidate_ref: input.candidate_ref || null,
    confirmed_by: a.name, confirmed_at: new Date().toISOString(), source_kind: "form",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/operations/rfq-confirm");
  revalidatePath("/operations/order-flow");
  return { ok: true };
}

export async function createJob(input: {
  job_no?: string | null; customer: string; drawing_no: string; part_desc?: string | null; qty?: number | null;
  quote_no?: string | null; po_no?: string | null; stage?: string | null; note?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const a = await actor();
  if (!["md", "production", "quality"].includes(a.role)) return { ok: false, error: "Only production can create jobs" };
  const customer = (input.customer || "").trim();
  const drawing_no = (input.drawing_no || "").trim();
  if (!customer || !drawing_no) return { ok: false, error: "Customer and drawing number are required" };
  const admin = createAdminClient();
  const { error } = await admin.from("ops_job").insert({
    job_no: input.job_no || null, customer, drawing_no, part_desc: input.part_desc || null, qty: input.qty ?? null,
    quote_no: input.quote_no || null, po_no: input.po_no || null, stage: input.stage || null, note: input.note || null,
    status: "active", created_by: a.name, created_at: new Date().toISOString(), source_kind: "form",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/operations/jobs");
  revalidatePath("/operations/order-flow");
  return { ok: true };
}

// Rahul confirms/corrects the quote for a single PO LINE (a quote is per-part, so one
// PO spans several quotes). Empty quote_no = clear the override and fall back to the
// drawing auto-match. Kept in ops_line_quote_link; survives every re-ingestion.
export async function linkQuoteToPo(input: { po_no: string; line_no: number; quote_no: string }): Promise<{ ok: boolean; error?: string }> {
  const a = await actor();
  if (!["md", "sales", "finance"].includes(a.role)) return { ok: false, error: "Not permitted for this role" };
  const po_no = (input.po_no || "").trim();
  const line_no = Number(input.line_no);
  const quote_no = (input.quote_no || "").trim();
  if (!po_no || !Number.isFinite(line_no)) return { ok: false, error: "PO and line are required" };
  const admin = createAdminClient();
  if (!quote_no) {
    const { error } = await admin.from("ops_line_quote_link").delete().eq("po_no", po_no).eq("line_no", line_no);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from("ops_line_quote_link").upsert(
      { po_no, line_no, quote_no, linked_by: a.name, linked_at: new Date().toISOString() },
      { onConflict: "po_no,line_no" },
    );
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/operations/link-quotes");
  revalidatePath("/operations/order-flow");
  return { ok: true };
}

export async function updateWip(input: {
  po_no?: string | null; line_no?: number | null; job_id?: number | null; stage?: string | null;
  job_card_no?: string | null; route_card_no?: string | null; weld_report_no?: string | null;
  weld_grade?: string | null; fir_no?: string | null; fir_result?: string | null; qty_done?: number | null;
  note?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const a = await actor();
  if (!["md", "production", "quality"].includes(a.role)) return { ok: false, error: "Only production/quality can update WIP" };
  const po_no = (input.po_no || "").trim() || null;
  const stage = (input.stage || "").trim();
  const anyDoc = [input.job_card_no, input.route_card_no, input.weld_report_no, input.fir_no].some((x) => (x || "").trim());
  if ((!po_no && !input.job_id) || (!stage && !anyDoc)) return { ok: false, error: "Set a stage or at least one production document" };
  const admin = createAdminClient();
  const { error } = await admin.from("ops_wip").insert({
    po_no, line_no: input.line_no ?? null, job_id: input.job_id ?? null, stage: stage || null, note: input.note || null,
    job_card_no: input.job_card_no || null, route_card_no: input.route_card_no || null,
    weld_report_no: input.weld_report_no || null, weld_grade: input.weld_grade || null,
    fir_no: input.fir_no || null, fir_result: input.fir_result || null, qty_done: input.qty_done ?? null,
    updated_by: a.name, updated_at: new Date().toISOString(), source_kind: "form",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/operations/daily-wip");
  revalidatePath("/operations/order-flow");
  return { ok: true };
}

/**
 * Server-side register CRUD + audit. All writes go through here so we get
 * uniform validation, audit logging, evidence-file association, and soft-delete.
 *
 * Reads use the user's RLS-aware client; writes use the admin client to bypass
 * RLS (we do the role check in code, then attribute the actor in audit).
 */

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegister, type CtRegister } from "@/lib/ct-registers";
import type { Role } from "@/domain/types";

interface AuthCtx {
  userId: string | null;
  email: string | null;
  role: Role;
  displayName: string;
}

async function authContext(): Promise<AuthCtx> {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  const meta = (u.user?.app_metadata ?? {}) as Record<string, unknown>;
  const role = (meta.role as Role) ?? "auditor";
  const email = u.user?.email ?? null;
  let displayName = email ?? "(anonymous)";
  if (u.user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", u.user.id)
      .maybeSingle();
    if (profile?.name) displayName = profile.name;
  }
  return { userId: u.user?.id ?? null, email, role, displayName };
}

function canWrite(register: CtRegister, role: Role): boolean {
  if (role === "md") return true;
  return register.writeRoles.includes(role);
}

export interface ListOpts {
  search?: string;
  filters?: Record<string, string | undefined>;
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDesc?: boolean;
}

export async function listRecords(registerKey: string, opts: ListOpts = {}) {
  const reg = getRegister(registerKey);
  if (!reg) throw new Error(`Unknown register: ${registerKey}`);
  const supabase = await createClient();
  const orderBy = opts.orderBy ?? "created_at";
  let q = supabase
    .from(reg.table)
    .select("*", { count: "exact" })
    .is(reg.table === "jobs" ? "ct_deleted_at" : "deleted_at", null)
    .order(orderBy, { ascending: !opts.orderDesc });

  if (opts.search) {
    const cols = reg.fields.filter((f) => f.type === "text").slice(0, 5).map((f) => f.name);
    if (cols.length) {
      const ilike = cols.map((c) => `${c}.ilike.%${opts.search}%`).join(",");
      q = q.or(ilike);
    }
  }
  if (opts.filters) {
    for (const [k, v] of Object.entries(opts.filters)) {
      if (v && v !== "all") q = q.eq(k, v);
    }
  }
  if (opts.limit) q = q.range(opts.offset ?? 0, (opts.offset ?? 0) + opts.limit - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data ?? [], count: count ?? 0 };
}

export async function getRecord(registerKey: string, id: string) {
  const reg = getRegister(registerKey);
  if (!reg) throw new Error(`Unknown register: ${registerKey}`);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(reg.table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function insertRecord(registerKey: string, values: Record<string, unknown>) {
  const reg = getRegister(registerKey);
  if (!reg) throw new Error(`Unknown register: ${registerKey}`);
  const ctx = await authContext();
  if (!canWrite(reg, ctx.role)) {
    throw new Error(`Role ${ctx.role} cannot write to ${reg.key}`);
  }
  const admin = createAdminClient();
  const clean = sanitize(values, reg);
  const created_by_col = reg.table === "jobs" ? null : "created_by";
  const payload: Record<string, unknown> = { ...clean };
  if (created_by_col && ctx.userId) payload[created_by_col] = ctx.userId;
  const { data, error } = await admin.from(reg.table).insert(payload).select("*").single();
  if (error) throw error;
  await audit(reg.table, data.id as string, "insert", null, data, ctx);
  return data;
}

export async function updateRecord(registerKey: string, id: string, values: Record<string, unknown>) {
  const reg = getRegister(registerKey);
  if (!reg) throw new Error(`Unknown register: ${registerKey}`);
  const ctx = await authContext();
  if (!canWrite(reg, ctx.role)) {
    throw new Error(`Role ${ctx.role} cannot write to ${reg.key}`);
  }
  const admin = createAdminClient();
  const { data: before } = await admin.from(reg.table).select("*").eq("id", id).maybeSingle();
  const clean = sanitize(values, reg);
  const updated_by_col = reg.table === "jobs" ? "ct_updated_by" : "updated_by";
  const updated_at_col = reg.table === "jobs" ? "ct_updated_at" : "updated_at";
  const payload: Record<string, unknown> = { ...clean };
  if (ctx.userId) payload[updated_by_col] = ctx.userId;
  payload[updated_at_col] = new Date().toISOString();
  const { data, error } = await admin
    .from(reg.table)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await audit(reg.table, id, "update", before ?? null, data, ctx);
  return data;
}

export async function softDeleteRecord(registerKey: string, id: string) {
  const reg = getRegister(registerKey);
  if (!reg) throw new Error(`Unknown register: ${registerKey}`);
  const ctx = await authContext();
  if (!canWrite(reg, ctx.role)) {
    throw new Error(`Role ${ctx.role} cannot soft-delete in ${reg.key}`);
  }
  const admin = createAdminClient();
  const deleted_at_col = reg.table === "jobs" ? "ct_deleted_at" : "deleted_at";
  const { data: before } = await admin.from(reg.table).select("*").eq("id", id).maybeSingle();
  const { data, error } = await admin
    .from(reg.table)
    .update({ [deleted_at_col]: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await audit(reg.table, id, "soft_delete", before ?? null, data, ctx);
  return data;
}

async function audit(
  register: string,
  recordId: string | null,
  action: string,
  oldValues: unknown,
  newValues: unknown,
  ctx: AuthCtx,
) {
  const admin = createAdminClient();
  await admin.from("control_tower_audit_log").insert({
    actor: ctx.userId,
    actor_email: ctx.email,
    register,
    record_id: recordId,
    action,
    old_values: oldValues,
    new_values: newValues,
  });
}

function sanitize(values: Record<string, unknown>, reg: CtRegister) {
  const allowed = new Set(reg.fields.map((f) => f.name));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!allowed.has(k)) continue;
    if (v === "" || v === undefined) {
      out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export async function listAuditForRecord(register: string, recordId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("control_tower_audit_log")
    .select("*")
    .eq("register", register)
    .eq("record_id", recordId)
    .order("at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function listFilesForRecord(register: string, recordId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("control_tower_files")
    .select("*")
    .eq("linked_register", register)
    .eq("linked_record_id", recordId)
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

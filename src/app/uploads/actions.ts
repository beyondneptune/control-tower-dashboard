"use server";
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Auditor is read-only; everyone else with a real operational role may upload.
const UPLOAD_ROLES = new Set(["md", "finance", "production", "quality", "stores", "purchase", "sales", "hr"]);

export interface UploadResult {
  ok: boolean;
  error?: string;
  fileName?: string;
  uploadedAt?: string;
}

const MAX_SIZE = 50 * 1024 * 1024;

export async function uploadFile(formData: FormData): Promise<UploadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const role = ((user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!UPLOAD_ROLES.has(role)) return { ok: false, error: "Not authorised to upload." };

  const file = formData.get("file") as File | null;
  const cardId = formData.get("cardId") as string | null;
  const department = formData.get("department") as string | null;
  const moduleName = formData.get("moduleName") as string | null;

  if (!file || !cardId || !department || !moduleName) {
    return { ok: false, error: "Missing file or metadata." };
  }
  if (file.size === 0) return { ok: false, error: "File is empty." };
  if (file.size > MAX_SIZE) return { ok: false, error: "File exceeds 50 MB limit." };

  const ts = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${cardId}/${ts}-${safeName}`;
  const ext = file.name.split(".").pop()?.toLowerCase() || "unknown";

  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await admin.storage
    .from("uploads")
    .upload(path, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: `Storage error: ${uploadErr.message}` };

  const { error: dbErr } = await admin.from("uploads").insert({
    uploaded_by: user.email || user.id,
    department: department.split(" / ")[0],
    module_name: moduleName,
    file_name: file.name,
    file_type: ext,
    file_url: path,
    processing_status: "pending",
  });
  if (dbErr) {
    await admin.storage.from("uploads").remove([path]);
    return { ok: false, error: `DB error: ${dbErr.message}` };
  }

  return { ok: true, fileName: file.name, uploadedAt: new Date().toISOString() };
}

export interface RecentUploadRow {
  id: string;
  file: string;
  department: string;
  moduleName: string;
  uploadedAt: string;
  status: "pending" | "processed" | "error";
}

export async function getRecentUploads(): Promise<RecentUploadRow[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("uploads")
    .select("id, file_name, department, module_name, uploaded_at, processing_status")
    .order("uploaded_at", { ascending: false })
    .limit(10);
  if (error || !data) return [];

  return data.map((r) => ({
    id: r.id as string,
    file: r.file_name as string,
    department: r.department as string,
    moduleName: r.module_name as string,
    uploadedAt: r.uploaded_at as string,
    status: r.processing_status as "pending" | "processed" | "error",
  }));
}

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegisterByTable } from "@/lib/ct-registers";
import type { Role } from "@/domain/types";
import crypto from "node:crypto";

const BUCKET = "control-tower-files";
const ALLOWED_MIME = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const register = String(form.get("register") ?? "");
  const recordId = String(form.get("record_id") ?? "");
  if (!(file instanceof File) || !register) {
    return NextResponse.json({ error: "missing file or register" }, { status: 400 });
  }
  // Validate the register against the allow-list so an arbitrary table name can
  // never reach admin.from(); gate upload by that register's owner roles (M-16).
  const reg = getRegisterByTable(register);
  if (!reg) return NextResponse.json({ error: "unknown register" }, { status: 400 });
  // Attaching evidence MUTATES the register row (evidence_file_ids), so gate on writeRoles,
  // not navRoles (Codex #6 — view-only roles must not be able to attach evidence).
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (role !== "md" && !reg.writeRoles.includes(role as Role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  // Content-type allow-list blocks HTML/script upload → same-origin stored XSS.
  if (file.type && !ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: "file type not allowed" }, { status: 400 });
  }

  const admin = createAdminClient();
  // If this upload targets a record, verify it EXISTS before writing anything to storage
  // (Codex #6 — otherwise we orphan a storage object + a file row pointing at no record).
  const evidenceCol = register === "jobs" ? "ct_evidence_file_ids" : "evidence_file_ids";
  let existingEvidence: string[] = [];
  if (recordId) {
    const { data: cur } = await admin
      .from(register)
      .select(`id, ${evidenceCol}`)
      .eq("id", recordId)
      .maybeSingle();
    if (!cur) {
      return NextResponse.json({ error: "linked record not found" }, { status: 404 });
    }
    existingEvidence = ((cur as Record<string, unknown>)[evidenceCol] as string[] | null) ?? [];
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const checksum = crypto.createHash("sha256").update(buf).digest("hex");
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
  const storedPath = `${register}/${recordId || "unlinked"}/${Date.now()}_${safeName}`;

  const up = await admin.storage.from(BUCKET).upload(storedPath, buf, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });

  const ins = await admin
    .from("control_tower_files")
    .insert({
      original_filename: file.name.replace(/[\r\n"]/g, ""),
      stored_path: storedPath,
      mime_type: file.type || null,
      size_bytes: buf.byteLength,
      checksum_sha256: checksum,
      uploaded_by: u.user.id,
      linked_register: register,
      linked_record_id: recordId || null,
    })
    .select("*")
    .single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });

  if (recordId) {
    // Record existence + current evidence were already verified above.
    await admin
      .from(register)
      .update({ [evidenceCol]: [...existingEvidence, ins.data.id] })
      .eq("id", recordId);
  }

  return NextResponse.json({ file: ins.data });
}

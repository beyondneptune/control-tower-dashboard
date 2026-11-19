// Day 11 evidence workbench: read-only attachment streaming.
// Streams from Supabase Storage bucket "email-attachments" to authenticated
// reviewers. Does NOT mutate Tally, Zoho, WhatsApp, or any operational table.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

const ALLOWED_ROLES = new Set(["finance", "sales", "md", "production"]);

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  // Auth-gate every byte-serving route — this previously served any commercial
  // attachment to any caller with the admin client and no check (M-17).
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED_ROLES.has(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const sb = createAdminClient();
  const { data: doc, error } = await sb
    .from("source_documents")
    .select("attachment_name, content_type, storage_path")
    .eq("id", id)
    .single();
  if (error || !doc || !doc.storage_path) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data: file, error: dlErr } = await sb.storage
    .from("email-attachments")
    .download(doc.storage_path);
  if (dlErr || !file) {
    return NextResponse.json({ error: dlErr?.message || "download failed" }, { status: 404 });
  }
  const buf = await file.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": doc.content_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${(doc.attachment_name || "attachment").replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=0",
    },
  });
}

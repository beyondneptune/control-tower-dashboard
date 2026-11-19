import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegisterByTable } from "@/lib/ct-registers";
import type { Role } from "@/domain/types";

const BUCKET = "control-tower-files";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: file, error } = await admin
    .from("control_tower_files")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !file) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Authorize (Codex #5 — was authenticate-only, an IDOR): MD sees everything; the uploader
  // sees their own file; a file linked to a register requires read (nav) access to that
  // register; an unlinked file is restricted to its uploader/MD. Mirrors the upload gate.
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  const isOwner = file.uploaded_by === u.user.id;
  let allowed = role === "md" || isOwner;
  if (!allowed && file.linked_register) {
    const reg = getRegisterByTable(file.linked_register);
    allowed = !!reg && reg.navRoles.includes(role as Role);
  }
  if (!allowed) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const dl = await admin.storage.from(BUCKET).download(file.stored_path);
  if (dl.error) {
    return NextResponse.json({ error: dl.error.message }, { status: 500 });
  }
  const buf = Buffer.from(await dl.data.arrayBuffer());
  const safeName = String(file.original_filename ?? "file").replace(/[\r\n"]/g, "");
  return new NextResponse(buf, {
    headers: {
      "content-type": file.mime_type || "application/octet-stream",
      "content-disposition": `inline; filename="${safeName}"`,
      "x-content-type-options": "nosniff",
      "cache-control": "private, max-age=600",
    },
  });
}

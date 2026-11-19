import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const run = promisify(execFile);
const PDFTOPPM = "/opt/homebrew/bin/pdftoppm";
const ALLOWED_ROLES = new Set(["finance", "sales", "md", "production"]);
const SAFE_ROOTS = ["/Users/weeoto/rahul_ctbackfill", "/Users/weeoto/pavan_ctbackfill"];

async function loadBytes(row: { source_path: string; source_kind: string | null }): Promise<Buffer | null> {
  if (row.source_kind === "folder") {
    const p = resolve(row.source_path); // canonicalise before allow-list (M-17)
    if (!SAFE_ROOTS.some((r) => p === r || p.startsWith(r + sep))) return null;
    return readFile(p);
  }
  const admin = createAdminClient();
  const { data } = await admin.storage.from("email-attachments").download(row.source_path);
  if (!data) return null;
  return Buffer.from(await data.arrayBuffer());
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ seq: string }> },
) {
  const { seq } = await params;
  const page = req.nextUrl.searchParams.get("page"); // when set → render that page as PNG

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return new NextResponse("Unauthorized", { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED_ROLES.has(role)) return new NextResponse("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("ct_wave1_commercial_review")
    .select("source_path, source_kind, doc_no")
    .eq("seq", Number(seq))
    .maybeSingle();
  if (!row?.source_path) return new NextResponse("No evidence", { status: 404 });

  const buf = await loadBytes(row as { source_path: string; source_kind: string | null });
  if (!buf) return new NextResponse("Not found", { status: 404 });

  // ── PNG page render (universal — no browser PDF plugin needed) ──
  if (page) {
    const n = Math.max(1, Math.min(20, Number(page) || 1));
    const dir = await mkdtemp(join(tmpdir(), "ev"));
    try {
      const pdfPath = join(dir, "f.pdf");
      await writeFile(pdfPath, buf);
      await run(PDFTOPPM, ["-png", "-r", "150", "-f", String(n), "-l", String(n), pdfPath, join(dir, "p")]);
      const files = (await readdir(dir)).filter((f) => f.endsWith(".png"));
      if (files.length === 0) return new NextResponse("No such page", { status: 404 });
      const png = await readFile(join(dir, files[0]));
      return new NextResponse(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=600", "X-Content-Type-Options": "nosniff" },
      });
    } catch {
      return new NextResponse("Render error", { status: 500 });
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {}); // no /tmp leak (M-17)
    }
  }

  // ── full PDF (for "open full") ──
  const filename = `${(row.doc_no as string)?.replace(/[^\w.-]/g, "_") || "evidence"}.pdf`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

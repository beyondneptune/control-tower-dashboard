import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { resolve, sep, join, basename, extname } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Serve the exact source DOCUMENT behind an Order Flow stage node (click → the file).
// Auth-gated, read-only, path-traversal-guarded (reuses the /api/evidence SAFE_ROOTS
// pattern, M-17). The node links here with the row's flow_key + stage; we look up the
// order, resolve the stage's document from its source table, and stream the file.
const ALLOWED_ROLES = new Set(["finance", "sales", "md", "production", "quality"]);
const SAFE_ROOTS = [
  "/Users/weeoto/rahul_ctbackfill",
  "/Users/weeoto/pavan_ctbackfill",
  "/Users/weeoto/rahul_dc",
];
const BASE_P = "/Users/weeoto/pavan_ctbackfill/Control Tower Backfill FY26-27 ";
const BASE_Y = "/Users/weeoto/rahul_ctbackfill/Control Tower Backfill FY26-27 ";
const WELD_DIR = `${BASE_P} 04_Weld_Reports`;
const JOBCARD_DIR = `${BASE_P} 01_Job_Cards`;
const INVOICE_DIR = `${BASE_Y} 03_Dispatch_Invoice_Support`;
const QUOTE_DIR = `${BASE_Y} 01_Quotations`;
const PO_DIR = `${BASE_Y} 02_Customer_POs`;
const DC_DIR = process.env.DC_FOLDER || "/Users/weeoto/rahul_dc";

function safeFolderPath(p: string): string | null {
  const r = resolve(p);
  return SAFE_ROOTS.some((root) => r === root || r.startsWith(root + sep)) ? r : null;
}
async function fileFromFolder(fullpath: string): Promise<{ buf: Buffer; name: string } | null> {
  const p = safeFolderPath(fullpath);
  if (!p || !existsSync(p)) return null;
  return { buf: await readFile(p), name: basename(p) };
}
async function fileFromStorage(admin: ReturnType<typeof createAdminClient>, storagePath: string) {
  const { data } = await admin.storage.from("email-attachments").download(storagePath);
  if (!data) return null;
  return { buf: Buffer.from(await data.arrayBuffer()), name: basename(storagePath) };
}
// find a file in a folder whose name contains a token (case-insensitive)
function findInDir(dir: string, token: string): string | null {
  const t = (token || "").trim().toLowerCase();
  if (!t) return null;
  try {
    const f = readdirSync(dir).find((x) => x.toLowerCase().includes(t));
    return f ? join(dir, f) : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  const stage = req.nextUrl.searchParams.get("stage");
  if (!key || !stage) return new NextResponse("Missing key/stage", { status: 400 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return new NextResponse("Unauthorized", { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED_ROLES.has(role)) return new NextResponse("Forbidden", { status: 403 });

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("v_ct_order_flow")
    .select("drawing_no, po_no, po_line, quote_no, invoice_no, dispatch_no")
    .eq("flow_key", key)
    .maybeSingle();
  if (!row) return new NextResponse("Order not found", { status: 404 });

  const drawing = (row.drawing_no as string) || "";
  let doc: { buf: Buffer; name: string } | null = null;
  try {
    if (stage === "rfq") {
      if (drawing) {
        const { data: d } = await admin
          .from("ct_drawing_register").select("source_path")
          .ilike("drawing_no", drawing).not("source_path", "is", null).limit(1).maybeSingle();
        if (d?.source_path) doc = await fileFromFolder(d.source_path as string);
      }
    } else if (stage === "bom") {
      if (drawing) {
        const { data: b } = await admin
          .from("ct_bom_costing").select("storage_path")
          .eq("drawing_no", drawing).eq("is_latest_revision", true)
          .not("storage_path", "is", null).limit(1).maybeSingle();
        if (b?.storage_path) doc = await fileFromStorage(admin, b.storage_path as string);
      }
    } else if (stage === "qc") {
      if (drawing) {
        const { data: w } = await admin
          .from("ct_weld_reports").select("pdf_file")
          .eq("drawing_no", drawing).not("pdf_file", "is", null)
          .order("wr_date", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
        if (w?.pdf_file) doc = await fileFromFolder(join(WELD_DIR, w.pdf_file as string));
      }
    } else if (stage === "invoice") {
      const voucher = ((row.invoice_no as string) || "").split(",")[0].trim();
      if (voucher) {
        const { data: ir } = await admin
          .from("ct_invoice_recon").select("pdf_file")
          .eq("tally_voucher_no", voucher).not("pdf_file", "is", null).limit(1).maybeSingle();
        if (ir?.pdf_file) doc = await fileFromFolder(join(INVOICE_DIR, ir.pdf_file as string));
      }
    } else if (stage === "quote" || stage === "po") {
      const docno = (stage === "po" ? row.po_no : row.quote_no) as string;
      if (docno) {
        const { data: cr } = await admin
          .from("ct_wave1_commercial_review").select("source_path, source_kind")
          .eq("doc_no", docno).not("source_path", "is", null).limit(1).maybeSingle();
        if (cr?.source_path) {
          doc = cr.source_kind === "folder"
            ? await fileFromFolder(cr.source_path as string)
            : await fileFromStorage(admin, cr.source_path as string);
        }
        if (!doc) { // fallback: filename contains the number
          const f = findInDir(stage === "po" ? PO_DIR : QUOTE_DIR, docno.replace(/[^0-9A-Za-z]/g, ""));
          if (f) doc = await fileFromFolder(f);
        }
      }
    } else if (stage === "dispatch") {
      const dc = ((row.dispatch_no as string) || "").trim();
      if (dc && dc.toLowerCase() !== "via invoice") {
        const f = findInDir(DC_DIR, dc);
        if (f) doc = await fileFromFolder(f);
      }
    } else if (stage === "job") {
      const f = findInDir(JOBCARD_DIR, drawing || (row.po_no as string) || "");
      if (f) doc = await fileFromFolder(f);
    }
  } catch {
    doc = null;
  }

  if (!doc) {
    const note = stage === "dispatch"
      ? "Dispatch is recorded via the invoice — no delivery challan on file yet."
      : `No source document on file for the ${stage} stage of this order.`;
    return new NextResponse(note, { status: 404 });
  }

  const ext = extname(doc.name).toLowerCase();
  const ctype = ext === ".pdf" ? "application/pdf"
    : ext === ".png" ? "image/png"
    : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
    : ext === ".xls" ? "application/vnd.ms-excel"
    : ext === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    : "application/octet-stream";
  const inline = ctype.startsWith("application/pdf") || ctype.startsWith("image/");
  return new NextResponse(doc.buf as unknown as BodyInit, {
    headers: {
      "Content-Type": ctype,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${doc.name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

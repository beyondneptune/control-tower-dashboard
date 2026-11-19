import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, sep, basename, join } from "node:path";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Serve an Operations source document as evidence (drawing / PO / quote). Auth-gated,
// path-traversal-guarded (same SAFE_ROOTS pattern as /api/order-flow-doc, M-17).
const ALLOWED = new Set(["finance", "sales", "md", "production", "quality"]);
const SAFE_ROOTS = ["/Users/weeoto/rahul_ctbackfill", "/Users/weeoto/pavan_ctbackfill", "/Users/weeoto/rahul_dc"];
const BASE_Y = "/Users/weeoto/rahul_ctbackfill/Control Tower Backfill FY26-27 ";
const PO_DIR = `${BASE_Y} 02_Customer_POs`;
const QUOTE_DIR = `${BASE_Y} 01_Quotations`;

async function servePdf(fullpath: string) {
  const p = resolve(fullpath);
  if (!SAFE_ROOTS.some((r) => p === r || p.startsWith(r + sep)) || !existsSync(p)) return new NextResponse("Not found", { status: 404 });
  const buf = await readFile(p);
  return new NextResponse(buf as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${basename(p).replace(/"/g, "")}"`, "Cache-Control": "private, no-store" },
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: NextRequest) {
  const drawing = req.nextUrl.searchParams.get("drawing");
  const po = req.nextUrl.searchParams.get("po");
  const quote = req.nextUrl.searchParams.get("quote");
  const email = req.nextUrl.searchParams.get("email");

  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return new NextResponse("Unauthorized", { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED.has(role)) return new NextResponse("Forbidden", { status: 403 });

  const admin = createAdminClient();
  try {
    if (drawing) {
      const { data } = await admin.from("ct_drawing_register").select("source_path").ilike("drawing_no", drawing).not("source_path", "is", null).limit(1).maybeSingle();
      if (data?.source_path) return servePdf(data.source_path as string);
      return new NextResponse("No drawing on file for this enquiry.", { status: 404 });
    }
    if (po) {
      const { data } = await admin.from("ops_customer_po").select("source_file").eq("po_no", po).maybeSingle();
      if (data?.source_file) return servePdf(join(PO_DIR, data.source_file as string));
      return new NextResponse("No PO document on file.", { status: 404 });
    }
    if (quote) {
      const { data } = await admin.from("ops_quote").select("source_file").eq("quote_no", quote).maybeSingle();
      if (data?.source_file) return servePdf(join(QUOTE_DIR, data.source_file as string));
      return new NextResponse("No quote document on file.", { status: 404 });
    }
    if (email) {
      // Serve the enquiry email as SAFE text (escaped — never raw email HTML, XSS).
      const m = (await admin.from("email_messages").select("subject, from_email, from_name, to_emails, email_datetime, body_text").eq("message_id", email).maybeSingle()).data;
      let subject = m?.subject, fromE = m?.from_email, fromN = m?.from_name, toE = m?.to_emails, dt = m?.email_datetime, body = m?.body_text;
      if (!body) body = (await admin.from("email_bodies").select("body_text").eq("message_id", email).maybeSingle()).data?.body_text ?? body;
      if (!subject && !body) {
        const sa = (await admin.from("ct_sweep_attachments").select("subject, from_email, email_datetime, raw_text").eq("message_id", email).limit(1).maybeSingle()).data;
        subject = subject ?? sa?.subject; fromE = fromE ?? sa?.from_email; dt = dt ?? sa?.email_datetime; body = body ?? sa?.raw_text;
      }
      if (!subject && !body && !fromE) return new NextResponse("Email not found.", { status: 404 });
      const html = `<!doctype html><meta charset="utf-8"><title>Enquiry email</title>` +
        `<div style="font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px">` +
        `<div style="color:#555;font-size:13px;border-bottom:1px solid #ddd;padding-bottom:10px;margin-bottom:14px">` +
        `<div><b>From:</b> ${esc(String(fromN || ""))} &lt;${esc(String(fromE || ""))}&gt;</div>` +
        `<div><b>To:</b> ${esc(String(toE || ""))}</div>` +
        `<div><b>Subject:</b> ${esc(String(subject || ""))}</div>` +
        `<div><b>Date:</b> ${esc(String(dt || ""))}</div></div>` +
        `<pre style="white-space:pre-wrap;font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${esc(String(body || "(no text body available)"))}</pre></div>`;
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'", "Cache-Control": "private, no-store" } });
    }
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
  return new NextResponse("Missing drawing/po/quote", { status: 400 });
}

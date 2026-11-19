import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ── RFQ candidate-confirm form ──────────────────────────────────────────────
export interface RfqCandidate {
  id: string;
  rfq_no: string | null;
  customer: string | null;
  drawing_no: string | null;
  received_date: string | null;
  part: string | null;
  qty: number | null;
  drawing_has_file: boolean;      // evidence: a drawing PDF is on file
  received_through: string | null; // evidence: how the enquiry arrived (email)
  chain_evidence: string | null;   // evidence: the email-chain reference
  email_message_id: string | null; // evidence: the enquiry email (viewable)
  email_from: string | null;
  email_subject: string | null;
  email_date: string | null;
}

// Candidates are Arjun's live RFQ-forward emails landing in the MD's inbox. The trigger:
// a customer sends a spec, Arjun builds the BOM and forwards it for confirmation with the
// RFQ number in the subject — e.g.  Re: 03" DRAWING,FICPL-PIPL/RFQ/26-27/046  — where the
// PIPL/RFQ/NN-NN/NNN token IS the RFQ identity. That subject is the "initiate RFQ" signal;
// the email only PROPOSES, a human (Arjun) confirms it into the clean ops_rfq (SSOT).
// Identity = the RFQ number (the drawing is filled in on confirm from the BOM). We never
// fabricate the customer: it is proposed only when the subject's code resolves against
// entity_aliases (e.g. FICPL → Apex Flow Systems Pvt Ltd); tokens like "REG" resolve to
// nothing and are left blank for the human. Live-from-today — historical inbox is ignored.
export async function getRfqCandidates(): Promise<{ candidates: RfqCandidate[]; confirmedCount: number; total: number }> {
  const sb = createAdminClient();
  // already-confirmed identity is the RFQ number
  const { data: confirmed } = await sb.from("ops_rfq").select("rfq_no");
  const done = new Set((confirmed ?? []).map((r) => String(r.rfq_no ?? "").toUpperCase().replace(/\s+/g, "")));

  // Arjun's RFQ-forward emails in the MD's inbox (newest first; subject holds the RFQ no.)
  const { data: emails } = await sb
    .from("email_messages")
    .select("id, message_id, email_datetime, from_email, from_name, subject, mailbox_owner_name")
    .eq("mailbox_owner_name", "Sameer Ahmed")
    .ilike("subject", "%PIPL/RFQ/%")
    .order("email_datetime", { ascending: false })
    .limit(400);

  const RFQ_RE = /PIPL\/RFQ\/\d{2}-\d{2}\/\d+/i;
  const fromArjun = (r: { from_email?: string | null; from_name?: string | null }) =>
    /arjun/i.test(`${r.from_email ?? ""} ${r.from_name ?? ""}`);

  // parse + dedup by RFQ number (list is desc, so the first row seen for a number is newest)
  type Row = { rfq_no: string; part: string | null; code: string | null; subject: string; from: string | null; date: string | null; mid: string | null };
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const e of emails ?? []) {
    if (!fromArjun(e)) continue;
    const subject = String(e.subject ?? "").replace(/&quot;/g, '"');
    const m = subject.match(RFQ_RE);
    if (!m) continue;
    const rfq_no = m[0].toUpperCase();
    const key = rfq_no.replace(/\s+/g, "");
    if (seen.has(key) || done.has(key)) continue;
    seen.add(key);
    // text before the RFQ marker = part descriptor, optionally trailed by a customer code
    const clean = subject.replace(/^\s*(re|fwd?):\s*/i, "").trim();
    const marker = clean.search(/-?PIPL\/RFQ\//i);
    const head = (marker > 0 ? clean.slice(0, marker) : "").replace(/[-,\s]+$/, "").trim();
    let part: string | null = head || null;
    let code: string | null = null;
    const hm = head.match(/^(.*?)\s*[,\-]\s*([A-Za-z]{2,10})$/);
    if (hm) { part = hm[1].trim() || null; code = hm[2].toUpperCase(); }
    rows.push({
      rfq_no, part, code, subject,
      from: (e.from_email ?? e.from_name) as string | null,
      date: e.email_datetime ? String(e.email_datetime).slice(0, 10) : null,
      mid: (e.message_id ?? e.id) as string | null,
    });
  }

  // resolve the proposed customer from the subject code via entity_aliases (never fabricate)
  const codes = Array.from(new Set(rows.map((r) => r.code).filter(Boolean))) as string[];
  const codeMap = new Map<string, string>();
  if (codes.length) {
    const { data: al } = await sb.from("entity_aliases").select("alias_text, canonical_name").in("alias_text", codes);
    for (const a of al ?? []) codeMap.set(String(a.alias_text).toUpperCase(), String(a.canonical_name));
  }

  const candidates: RfqCandidate[] = rows.map((r) => ({
    id: r.rfq_no,
    rfq_no: r.rfq_no,
    customer: r.code ? codeMap.get(r.code) ?? null : null,
    drawing_no: null,                 // not in the subject — Arjun fills it from the BOM on confirm
    received_date: r.date,
    part: r.part,
    qty: null,
    drawing_has_file: false,
    received_through: "Email (Arjun RFQ forward)",
    chain_evidence: null,
    email_message_id: r.mid,
    email_from: r.from,
    email_subject: r.subject,
    email_date: r.date,
  }));

  return { candidates, confirmedCount: done.size, total: candidates.length };
}

// ── Daily production WIP form ────────────────────────────────────────────────
export interface ActiveJob {
  kind: "po" | "floor";
  flow_key: string;
  po_no: string | null;
  line_no: number | null;
  job_id: number | null;
  customer: string | null;
  drawing_no: string | null;
  part: string | null;
  qty: number | null;
  stage: string | null;        // current stage (latest ops_wip)
  job_card_no: string | null;
  route_card_no: string | null;
  weld_report_no: string | null;
  fir_no: string | null;
  fir_result: string | null;
  updated_by: string | null;
  updated_at: string | null;
}

// Every order still in production (link_state='wip') — so no active job is left
// without a status. The current stage is the latest ops_wip for that PO line.
export async function getActiveJobs(): Promise<{ jobs: ActiveJob[]; updatedToday: number }> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("v_ops_order_flow")
    .select("flow_key, po_no, po_line, customer, drawing_no, part_desc, qty, wip_stage, po_date, job_card_no, route_card_no, wip_weld_report, wip_fir_no, wip_fir_result")
    .eq("link_state", "wip")
    .order("po_date", { ascending: false, nullsFirst: false })
    .limit(1000);
  const { data: wip } = await sb.from("ops_wip").select("po_no, line_no, job_id, stage, job_card_no, route_card_no, weld_report_no, fir_no, fir_result, updated_by, updated_at").order("updated_at", { ascending: false });
  const byPoLine = new Map<string, Record<string, unknown>>();
  const byJob = new Map<number, Record<string, unknown>>();
  for (const w of wip ?? []) {
    if (w.job_id != null) { if (!byJob.has(w.job_id as number)) byJob.set(w.job_id as number, w); }
    else { const k = `${w.po_no}#${w.line_no ?? ""}`; if (!byPoLine.has(k)) byPoLine.set(k, w); }
  }
  const today = new Date().toISOString().slice(0, 10);
  let updatedToday = 0;
  const s = (v: unknown) => (v as string | null) ?? null;

  const poJobs: ActiveJob[] = (data ?? []).map((r) => {
    const l = byPoLine.get(`${r.po_no}#${r.po_line ?? ""}`);
    if (l?.updated_at && String(l.updated_at).slice(0, 10) === today) updatedToday++;
    return {
      kind: "po", flow_key: r.flow_key as string, po_no: r.po_no as string, line_no: r.po_line as number | null, job_id: null,
      customer: s(r.customer), drawing_no: s(r.drawing_no), part: s(r.part_desc), qty: r.qty as number | null,
      stage: s(r.wip_stage), job_card_no: s(r.job_card_no), route_card_no: s(r.route_card_no),
      weld_report_no: s(r.wip_weld_report), fir_no: s(r.wip_fir_no), fir_result: s(r.wip_fir_result),
      updated_by: s(l?.updated_by), updated_at: s(l?.updated_at),
    };
  });

  // floor-created active jobs (from the "+ New Job" form) — current values from their latest ops_wip.
  const { data: fj } = await sb.from("ops_job").select("*").eq("status", "active").order("created_at", { ascending: false });
  const floorJobs: ActiveJob[] = (fj ?? []).map((j) => {
    const w = byJob.get(j.id as number);
    if (w?.updated_at && String(w.updated_at).slice(0, 10) === today) updatedToday++;
    return {
      kind: "floor", flow_key: `floor:${j.id}`, po_no: (j.po_no as string | null) ?? null, line_no: null, job_id: j.id as number,
      customer: s(j.customer), drawing_no: s(j.drawing_no), part: s(j.part_desc), qty: j.qty as number | null,
      stage: s(w?.stage) ?? s(j.stage), job_card_no: s(w?.job_card_no) ?? s(j.job_no), route_card_no: s(w?.route_card_no),
      weld_report_no: s(w?.weld_report_no), fir_no: s(w?.fir_no), fir_result: s(w?.fir_result),
      updated_by: s(w?.updated_by), updated_at: s(w?.updated_at),
    };
  });

  return { jobs: [...floorJobs, ...poJobs], updatedToday };
}

// ── The clean Operations board ──────────────────────────────────────────────
export type StageState = "done" | "pre_system" | "pending";
export interface OpsOrderRow {
  flow_key: string; customer: string | null; entity: string | null; drawing_no: string | null; part_desc: string | null;
  qty: number | null; line_value: number | null; po_no: string; po_line: number | null; po_date: string | null;
  rfq_no: string | null; rfq_date: string | null; bom_ref: string | null; bom_date: string | null;
  quote_no: string | null; quote_date: string | null; wip_stage: string | null; weld_count: number | null; qc_date: string | null;
  dc_no: string | null; dispatch_date: string | null; invoice_no: string | null; invoice_date: string | null; billed: number | null;
  rfq_state: StageState; bom_state: StageState; quote_state: StageState; po_state: StageState;
  qc_state: StageState; dispatch_state: StageState; invoice_state: StageState;
  link_state: "complete" | "invoiced" | "wip"; historical: boolean;
}
export interface OpsSummary {
  total: number; complete: number; exceptions: number; wip: number;
  bookValue: number; entities: { entity: string; n: number }[];
}

export async function getOpsOrderFlow(): Promise<{ rows: OpsOrderRow[]; summary: OpsSummary }> {
  const sb = createAdminClient();
  const { data } = await sb.from("v_ops_order_flow").select("*").order("po_date", { ascending: false, nullsFirst: false }).limit(2000);
  const rows = (data ?? []) as unknown as OpsOrderRow[];
  const ent: Record<string, number> = {};
  for (const r of rows) ent[r.entity ?? "other"] = (ent[r.entity ?? "other"] ?? 0) + 1;
  const summary: OpsSummary = {
    total: rows.length,
    complete: rows.filter((r) => r.link_state === "complete").length,
    exceptions: rows.filter((r) => r.link_state === "invoiced").length, // invoiced but an upstream doc is missing
    wip: rows.filter((r) => r.link_state === "wip").length,
    bookValue: rows.reduce((a, r) => a + (Number(r.line_value) || 0), 0),
    entities: Object.entries(ent).map(([entity, n]) => ({ entity, n })).sort((a, b) => b.n - a.n),
  };
  return { rows, summary };
}

// ── Jobs (PO-line jobs + production-created jobs) ───────────────────────────
export interface JobRow {
  source: "po" | "floor"; ref: string;
  customer: string | null; drawing_no: string | null; part: string | null; qty: number | null;
  stage: string | null; status: string; quote_no: string | null; po_no: string | null; job_no: string | null;
}
export async function getJobs(): Promise<{ jobs: JobRow[]; poCount: number; floorCount: number; quotes: QuoteOpt[] }> {
  const sb = createAdminClient();
  const { data: pol } = await sb.from("v_ops_order_flow")
    .select("flow_key, customer, drawing_no, part_desc, qty, wip_stage, link_state, quote_no_ref, po_no, po_date")
    .order("po_date", { ascending: false, nullsFirst: false }).limit(2000);
  const poJobs: JobRow[] = (pol ?? []).map((r) => ({
    source: "po", ref: r.flow_key as string, customer: r.customer as string | null, drawing_no: r.drawing_no as string | null,
    part: r.part_desc as string | null, qty: r.qty as number | null, stage: r.wip_stage as string | null,
    status: r.link_state as string, quote_no: r.quote_no_ref as string | null, po_no: r.po_no as string | null, job_no: null,
  }));
  const { data: fj } = await sb.from("ops_job").select("*").order("created_at", { ascending: false });
  const floorJobs: JobRow[] = (fj ?? []).map((j) => ({
    source: "floor", ref: String(j.id), customer: j.customer as string | null, drawing_no: j.drawing_no as string | null,
    part: j.part_desc as string | null, qty: j.qty as number | null, stage: j.stage as string | null,
    status: j.status as string, quote_no: j.quote_no as string | null, po_no: j.po_no as string | null, job_no: j.job_no as string | null,
  }));
  const { data: quotes } = await sb.from("ops_quote").select("quote_no, customer, quote_date, total_value").order("quote_date", { ascending: false, nullsFirst: false });
  return {
    jobs: [...floorJobs, ...poJobs], poCount: poJobs.length, floorCount: floorJobs.length,
    quotes: (quotes ?? []).map((q) => ({ quote_no: String(q.quote_no), customer: q.customer as string | null, quote_date: q.quote_date as string | null, total_value: q.total_value as number | null })),
  };
}

// ── Quote → PO link, PER LINE (Rahul's authoritative bridge) ───────────────
// A quote is per-part, so we match each PO LINE to its quote by the DRAWING that is
// printed on BOTH documents. Rahul just reverifies the drawing-match and confirms.
const normDraw = (d: string | null | undefined) =>
  String(d || "").toUpperCase().split(/-Y-|\//)[0].replace(/[^A-Z0-9]/g, "").replace(/([0-9])[A-Z]$/, "$1");

export interface QuoteCand { quote_no: string; quote_date: string | null; total_value: number | null; before_po: boolean }
export interface PoQuoteLine {
  po_no: string; line_no: number; drawing_no: string | null; part_desc: string | null;
  auto_quote: string | null; linked_quote: string | null; linked_by: string | null; candidates: QuoteCand[];
}
export interface PoQuoteGroup {
  po_no: string; customer: string | null; po_date: string | null; entity: string | null;
  lines: PoQuoteLine[]; total: number; linked: number; autoOnly: number; unmatched: number;
}
export interface QuoteOpt { quote_no: string; customer: string | null; quote_date: string | null; total_value: number | null }

export async function getPoQuoteLinks(): Promise<{ groups: PoQuoteGroup[]; quotes: QuoteOpt[]; stats: { pos: number; lines: number; linked: number; auto: number; unmatched: number } }> {
  const sb = createAdminClient();
  const [{ data: pos }, { data: lines }, { data: quotes }, { data: qlines }, { data: links }] = await Promise.all([
    sb.from("ops_customer_po").select("po_no, customer, po_date, entity").order("po_date", { ascending: false, nullsFirst: false }),
    sb.from("ops_po_line").select("po_no, line_no, drawing_no, part_desc").limit(4000),
    sb.from("ops_quote").select("quote_no, customer, quote_date, total_value").order("quote_date", { ascending: false, nullsFirst: false }),
    sb.from("ops_quote_line").select("quote_no, drawing_no"),
    sb.from("ops_line_quote_link").select("po_no, line_no, quote_no, linked_by"),
  ]);
  const qById = new Map((quotes ?? []).map((q) => [String(q.quote_no), q]));
  // drawing (normalized) → set of quote numbers that cover it
  const byDraw = new Map<string, Set<string>>();
  for (const ql of qlines ?? []) {
    const k = normDraw(ql.drawing_no as string);
    if (!k) continue;
    if (!byDraw.has(k)) byDraw.set(k, new Set());
    byDraw.get(k)!.add(String(ql.quote_no));
  }
  const linkByLine = new Map((links ?? []).map((l) => [`${l.po_no}#${l.line_no}`, l]));
  const poMeta = new Map((pos ?? []).map((p) => [String(p.po_no), p]));
  const grouped = new Map<string, PoQuoteLine[]>();
  for (const l of lines ?? []) {
    const po_no = String(l.po_no);
    const po = poMeta.get(po_no);
    const poDate = (po?.po_date as string | null) ?? null;
    const cands = [...(byDraw.get(normDraw(l.drawing_no as string)) ?? [])]
      .map((qn) => {
        const q = qById.get(qn);
        return { quote_no: qn, quote_date: (q?.quote_date as string | null) ?? null, total_value: (q?.total_value as number | null) ?? null,
          before_po: !!(poDate && q?.quote_date && (q.quote_date as string) <= poDate) };
      })
      // effective order: quotes dated on/before the PO first, then most recent — matches the board
      .sort((a, b) => (Number(b.before_po) - Number(a.before_po)) || String(b.quote_date ?? "").localeCompare(String(a.quote_date ?? "")));
    const link = linkByLine.get(`${po_no}#${l.line_no}`);
    const row: PoQuoteLine = {
      po_no, line_no: l.line_no as number, drawing_no: l.drawing_no as string | null, part_desc: l.part_desc as string | null,
      auto_quote: cands[0]?.quote_no ?? null,
      linked_quote: (link?.quote_no as string | undefined) ?? null, linked_by: (link?.linked_by as string | undefined) ?? null,
      candidates: cands,
    };
    if (!grouped.has(po_no)) grouped.set(po_no, []);
    grouped.get(po_no)!.push(row);
  }
  let sLines = 0, sLinked = 0, sAuto = 0, sUnmatched = 0;
  const groups: PoQuoteGroup[] = [...grouped.entries()].map(([po_no, ls]) => {
    ls.sort((a, b) => a.line_no - b.line_no);
    const p = poMeta.get(po_no);
    const linked = ls.filter((r) => r.linked_quote).length;
    const autoOnly = ls.filter((r) => !r.linked_quote && r.auto_quote).length;
    const unmatched = ls.filter((r) => !r.linked_quote && !r.auto_quote).length;
    sLines += ls.length; sLinked += linked; sAuto += autoOnly; sUnmatched += unmatched;
    return { po_no, customer: (p?.customer as string | null) ?? null, po_date: (p?.po_date as string | null) ?? null,
      entity: (p?.entity as string | null) ?? null, lines: ls, total: ls.length, linked, autoOnly, unmatched };
  }).sort((a, b) => String(b.po_date ?? "").localeCompare(String(a.po_date ?? "")));
  return {
    groups, stats: { pos: groups.length, lines: sLines, linked: sLinked, auto: sAuto, unmatched: sUnmatched },
    quotes: (quotes ?? []).map((q) => ({ quote_no: String(q.quote_no), customer: q.customer as string | null, quote_date: q.quote_date as string | null, total_value: q.total_value as number | null })),
  };
}

// Generic reader for the clean Operations registers (config in lib/ops-registers.ts).
export async function getOpsRegisterRows(source: string, order?: { col: string; desc: boolean }): Promise<Record<string, unknown>[]> {
  const sb = createAdminClient();
  let q = sb.from(source).select("*").limit(2000);
  if (order) q = q.order(order.col, { ascending: !order.desc, nullsFirst: false });
  const { data } = await q;
  return (data ?? []) as Record<string, unknown>[];
}

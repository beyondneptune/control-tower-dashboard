// Meridian AI — the Control Tower chatbot. Agentic loop: Claude + a read-only SQL tool (ct_chat_sql)
// + a data catalog, so it answers any company question with REAL numbers from the live DB.
// Login-gated; every authenticated user can use it. Needs ANTHROPIC_API_KEY in the server env.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const API = "https://api.anthropic.com/v1/messages";

const SYSTEM = `You are **Meridian AI** — the embedded intelligence of the Meridian Alloys Control Tower.

Meridian is a laser-cladding (laser metal deposition) job shop in India: customers (mostly Apex Flow Systems, ~98% of revenue) send valve/pump parts — mainly valve PLUGS (2"–16"), plus shafts, impellers, seat rings, bonnets — to be hardfaced with Stellite 6 (some Inconel 625, Colmonoy/NiCrBSi, tungsten carbide) and returned. Powder is ~67% of job cost. Everything flows from two documents: the DRAWING and the BOM/costing sheet. Finance truth lives in Tally.

You answer ANY question — finance, production, commercial, engineering, strategy — with REAL numbers you fetch from the database via the run_sql tool (read-only Postgres, returns up to 500 JSON rows). Write a SELECT, read the rows, then answer.

KEY DATA (Postgres schema "public" — get exact columns with: SELECT column_name FROM information_schema.columns WHERE table_name='X'; list tables with SELECT table_name FROM information_schema.tables WHERE table_schema='public'):
• Finance / Tally (truth): v_ct_fin_summary (TB headline — cash, receivables, payables, loans), v_ct_sync_health (Tally freshness per stream), tally_ledger_snapshot, tally_bill_wise_outstanding, v_tally_outstanding_latest, tally_sales_voucher, tally_purchase_voucher.
• Commercial: ct_rfqs (RFQ register), ct_quotations, ct_customer_pos + ct_customer_po_lines (orders, po_value, rate, qty, drawing_no), v_ct_order_funnel, v_ct_quote_conversion.
• Engineering intelligence: ct_drawing_register (drawings — alloy, thickness, material), ct_bom_costing (BOM cost/margin — USE THIS, not legacy ct_bom_cost which is 0% margin), v_ct_should_cost_gate (below-cost/thin gate), v_ct_margin_book, ct_engineering_benchmarks (vs world best-practice), ct_engineering_verdicts (audit: correct/wrong/needs_update), ct_strategy_insights, ct_chain_leaks (rupee leaks), v_ct_predictive_risk, v_ct_insight_feed.
• Production: jobs, ct_execution_thread, ct_weld_reports, ct_qc_records.

RULES (absolute):
- NEVER fabricate a number. Every figure comes from a run_sql result this turn. If a query errors or returns nothing, say exactly that — never guess.
- Finance figures: Tally is the source of truth. Check v_ct_sync_health; if a stream is STALE/DOWN, say so and give the last-synced time before quoting that figure.
- Be concise and executive. Lead with the answer/number, then a brief why. Format money in ₹ (lakh/crore for large amounts: 1L = 100,000; 1cr = 10,000,000).
- If a question is ambiguous, make a sensible assumption and state it. If you genuinely can't answer from the data, say what's missing.
- You may run several queries to build an answer; prefer the curated views above, introspect when unsure. Keep it factual and useful.`;

const TOOLS = [
  {
    name: "run_sql",
    description:
      "Run a single READ-ONLY SQL SELECT/WITH query against Meridian's Postgres and get JSON rows back (max 500). Use it to ground every answer in real data. Introspect schema via information_schema if unsure of table/column names.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "one read-only SELECT or WITH query (no semicolons)" } },
      required: ["query"],
    },
  },
];

type Block = { type: string; text?: string; id?: string; input?: { query?: string }; name?: string };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({
      answer:
        "⚠ Meridian AI isn't connected to its model yet. An administrator needs to set **ANTHROPIC_API_KEY** in the server environment (`.env.local`) and restart the Control Tower.",
      needsKey: true,
    });
  }

  let body: { messages?: { role: string; content: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad request" }, { status: 400 }); }
  const messages: { role: string; content: unknown }[] = (body.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-16)
    .map((m) => ({ role: m.role, content: String(m.content) }));
  if (!messages.length) return NextResponse.json({ error: "no message" }, { status: 400 });

  const admin = createAdminClient();
  let answer = "";
  const queriesRun: string[] = [];

  for (let i = 0; i < 6; i++) {
    const resp = await fetch(API, {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 2048, system: SYSTEM, tools: TOOLS, messages }),
    });
    if (!resp.ok) {
      const detail = (await resp.text()).slice(0, 300);
      return NextResponse.json({ error: `model error ${resp.status}`, detail }, { status: 502 });
    }
    const data = await resp.json();
    const blocks: Block[] = data.content ?? [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    if (text) answer = text;
    const toolUses = blocks.filter((b) => b.type === "tool_use");

    if (data.stop_reason === "tool_use" && toolUses.length) {
      messages.push({ role: "assistant", content: blocks });
      const toolResults = [];
      for (const tu of toolUses) {
        const q = String(tu.input?.query ?? "");
        queriesRun.push(q);
        let content: string;
        try {
          const { data: rows, error } = await admin.rpc("ct_chat_sql", { q });
          content = error ? `ERROR: ${error.message}` : JSON.stringify(rows).slice(0, 12000);
        } catch (e) {
          content = `ERROR: ${(e as Error).message}`;
        }
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content });
      }
      messages.push({ role: "user", content: toolResults });
      continue;
    }
    break; // end_turn
  }

  return NextResponse.json({ answer: answer || "I couldn't work that out from the data — try rephrasing?", queries: queriesRun.length });
}

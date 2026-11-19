// CSV export — "Bill-wise Cleanup List" for the finance team (Rahul).
//
// Returns one row per (direction, counter_party, bill_ref) with everything
// the team needs to look up the bill in Tally and reconcile against receipts.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  // Defense-in-depth (Codex #4): this handler reads ALL Tally outstanding via the service-role
  // admin client (bypasses RLS), so it authorizes IN-ROUTE rather than trusting the middleware
  // gate alone (middleware.ts: "the database remains the real data boundary"). Fail-closed —
  // a missing role is denied, not defaulted to a permitted one.
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "";
  if (!["md", "finance", "auditor"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = createAdminClient();
  const { data } = await sb
    .from("v_tally_outstanding_latest")
    .select("direction, counter_party, bill_date, bill_ref, bill_amount, bill_due_date, days_overdue")
    .order("counter_party")
    .order("bill_date");

  const header = [
    "Direction",
    "Counter party",
    "Bill date",
    "Bill ref (Tally)",
    "Bill amount (Rs)",
    "Due date",
    "Days overdue",
    "Cleanup notes",
  ].join(",");

  const rows = (data || []).map((r) => {
    const amount = Number(r.bill_amount) || 0;
    const days = Number(r.days_overdue) || 0;
    // Auto-suggest cleanup note based on age
    const note =
      days > 365 ? "Almost certainly paid — verify receipt allocation in Tally" :
      days > 90  ? "Likely paid — check receipt voucher matching" :
      days > 0   ? "May be partially paid" :
                   "Not yet due — no action";
    return [
      r.direction,
      csvField(String(r.counter_party ?? "")),
      r.bill_date ?? "",
      csvField(String(r.bill_ref ?? "")),
      amount.toFixed(2),
      r.bill_due_date ?? "",
      days,
      csvField(note),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const filename = `meridian-bill-wise-cleanup-${new Date().toISOString().slice(0,10)}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function csvField(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

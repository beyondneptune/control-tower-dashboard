import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Finance data-freshness surface (GO-LIVE: never silently show stale Tally data).
// Returns per-stream sync health + a one-line summary. Auth-gated, read-only.
export async function GET() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const [streams, summary] = await Promise.all([
    admin.from("v_ct_sync_health").select("*"),
    admin.from("v_ct_sync_health_summary").select("*").maybeSingle(),
  ]);
  return NextResponse.json(
    { streams: streams.data ?? [], summary: summary.data ?? null, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}

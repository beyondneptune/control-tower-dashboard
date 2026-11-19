"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ALLOWED = new Set(["finance", "sales", "md"]);

// Rahul / MD confirms the PO-line ↔ Quote link (or marks it a direct order /
// closes a completed old order). The one human confirmation the documents can't
// supply. Additive + audited — never mutates the thread or Tally.
export async function confirmLink(input: {
  po_no: string;
  po_line: number;
  quote_no: string | null;
  resolution: "linked" | "no_quote_direct_order" | "order_complete" | "keep_open";
  note?: string;
}) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED.has(role)) throw new Error(`Role ${role} cannot validate`);

  // A 'linked' resolution must carry a quote number — otherwise it's a confirmed
  // row with no quote, which is logically corrupt (M-18). Guard server-side; the
  // UI already prevents it on the happy path, but a direct call must not bypass it.
  if (input.resolution === "linked" && !input.quote_no?.trim()) {
    throw new Error("quote_no is required when resolution is 'linked'");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ct_po_quote_link").upsert(
    {
      po_no: input.po_no,
      po_line: input.po_line,
      quote_no: input.resolution === "linked" ? input.quote_no : null,
      resolution: input.resolution,
      note: input.note ?? null,
      confirmed_by: u.user.email ?? role,
      confirmed_at: new Date().toISOString(),
    },
    { onConflict: "po_no,po_line" },
  );
  if (error) throw error;
  revalidatePath("/validation");
}

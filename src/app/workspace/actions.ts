"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const ALLOWED = new Set(["finance", "sales", "md", "production", "quality", "stores", "purchase"]);
// A role may only action its own owner's exceptions (MD may action any).
const ROLE_TO_OWNER: Record<string, string> = {
  finance: "rahul", sales: "rahul", production: "arjun",
  quality: "qc", stores: "stores", purchase: "purchase",
};

// The ONLY human-write path in the Operational Layer. Records an action against
// an exception (approve / reject / comment / correct) — additive + auditable.
// Never mutates the digital thread or live registers.
export async function recordAction(input: {
  ex_type: string;
  ref: string;
  owner_role: string;
  action: "approve" | "reject" | "comment" | "correct";
  comment?: string;
  corrected_field?: string;
  corrected_value?: string;
}) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";
  if (!ALLOWED.has(role)) throw new Error(`Role ${role} cannot act`);
  // Bind the action to the user's own queue — don't trust the client-supplied
  // owner_role to let one role action another's exception (M-16).
  if (role !== "md" && ROLE_TO_OWNER[role] !== input.owner_role) {
    throw new Error("Cannot act on another role's exception");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ct_exception_action").insert({
    ex_type: input.ex_type,
    ref: input.ref,
    owner_role: input.owner_role,
    action: input.action,
    comment: input.comment ?? null,
    corrected_field: input.corrected_field ?? null,
    corrected_value: input.corrected_value ?? null,
    acted_by: u.user.email ?? role,
  });
  if (error) throw error;
  revalidatePath("/workspace");
}

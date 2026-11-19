"use server";
import "server-only";

/**
 * The vendor-payment write boundary. The ONLY way the app mutates payments.
 *
 * Each action re-verifies the user server-side (getUser, not the client role)
 * and calls a SECURITY DEFINER Postgres function that enforces role + maker≠
 * checker (migration 0005). Even a forged client request cannot self-approve:
 * the database refuses it. Every call is recorded by the audit trigger (0004).
 */

import { createClient } from "@/lib/supabase/server";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export async function createVendorPayment(input: {
  vendorId: string;
  amount: number;
  priority: string;
  purpose: string;
}): Promise<ActionResult & { id?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data, error } = await supabase.rpc("create_vendor_payment", {
    p_vendor: input.vendorId,
    p_amount: input.amount,
    p_priority: input.priority,
    p_purpose: input.purpose,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data as string };
}

export async function approveVendorPayment(paymentId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // The DB function rejects non-approver roles AND maker == approver.
  const { error } = await supabase.rpc("approve_vendor_payment", { p_payment: paymentId });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

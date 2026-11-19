"use server";
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export interface BankConfigUpdate {
  id: string;
  limitAmount: number;
  drawingPower: number;
  interestRate: number;
  emiAmount: number;
  emiDueDay: number | null;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  updatedCount?: number;
}

export async function saveBankConfig(updates: BankConfigUpdate[]): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  if (user.app_metadata?.role !== "md") {
    return { ok: false, error: "Only MD can update bank configuration." };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: false, error: "No updates provided." };
  }

  const admin = createAdminClient();
  let updated = 0;
  for (const u of updates) {
    if (typeof u.id !== "string" || u.id.length < 8) continue;
    const row: Record<string, unknown> = {
      limit_amount: Math.max(0, Number(u.limitAmount) || 0),
      drawing_power: Math.max(0, Number(u.drawingPower) || 0),
      interest_rate: Math.max(0, Number(u.interestRate) || 0),
      emi_amount: Math.max(0, Number(u.emiAmount) || 0),
      emi_due_day: u.emiDueDay === null ? null : Math.max(1, Math.min(31, Math.floor(Number(u.emiDueDay)))),
      last_updated: new Date().toISOString(),
    };
    const { error } = await admin.from("bank_accounts").update(row).eq("id", u.id);
    if (error) {
      console.error(`bank-config update failed for ${u.id}: ${error.message}`);
    } else {
      updated++;
    }
  }

  revalidatePath("/settings/bank-config");
  revalidatePath("/");
  revalidatePath("/bank-debt");

  return { ok: true, updatedCount: updated };
}

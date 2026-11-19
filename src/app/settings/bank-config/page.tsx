// Server component — loads bank accounts from local Postgres.
// MD edits sanctioned limits + EMI terms via the client form below.

import { createAdminClient } from "@/lib/supabase/admin";
import { BankConfigForm } from "./bank-config-form";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  bankName: string;
  accountType: string;
  currentBalance: number;
  limitAmount: number;
  drawingPower: number;
  interestRate: number;
  emiAmount: number;
  emiDueDay: number | null;
}

export default async function BankConfigPage() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("bank_accounts")
    .select("id, bank_name, account_type, current_balance, limit_amount, drawing_power, interest_rate, emi_amount, emi_due_day")
    .order("account_type", { ascending: true })
    .order("current_balance", { ascending: false });

  const rows: Row[] = (data || []).map((b) => ({
    id: b.id as string,
    bankName: (b.bank_name as string) ?? "",
    accountType: (b.account_type as string) ?? "current",
    currentBalance: Number(b.current_balance) || 0,
    limitAmount: Number(b.limit_amount) || 0,
    drawingPower: Number(b.drawing_power) || 0,
    interestRate: Number(b.interest_rate) || 0,
    emiAmount: Number(b.emi_amount) || 0,
    emiDueDay: b.emi_due_day == null ? null : Number(b.emi_due_day),
  }));

  return <BankConfigForm initial={rows} />;
}

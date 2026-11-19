// Server component — bank & debt. Tally-ledger view PLUS the source-document view
// derived from Rahul's bank statements (GO-LIVE: bank automation).

import { liveBankAccounts, liveLoanCharges } from "@/data/live";
import { BankDebtView } from "./bank-debt-view";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const fmt = (n: number | null) => (n == null ? "—" : "₹" + Number(n).toLocaleString("en-IN"));
const TYPE_LABEL: Record<string, string> = {
  current: "Current A/c", cash_credit: "Cash Credit (OCC)", term_loan: "Term Loan", gecl_loan: "GECL Loan", other: "Account",
};

export default async function BankDebtPage() {
  const admin = createAdminClient();
  const [banks, charges, stmtRes] = await Promise.all([
    liveBankAccounts(),
    liveLoanCharges(),
    admin.from("v_ct_bank_summary").select("*"),
  ]);
  const stmts = (stmtRes.data ?? []) as Array<Record<string, number | string | null>>;
  const debt = stmts.filter((s) => ["term_loan", "cash_credit", "gecl_loan"].includes(String(s.account_type)))
    .reduce((a, s) => a + (Number(s.closing_balance) || 0), 0);
  const period = stmts[0]?.period_to ? String(stmts[0].period_to) : "latest statement";

  return (
    <div className="space-y-5">
      {stmts.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="text-sm font-medium">Bank statements (from source documents)</span>
            <span className="text-xs text-muted-foreground">as of {period} · total debt <b>{fmt(debt)}</b></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Account</th>
                  <th className="px-3 py-2 text-left">No.</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Drawing power</th>
                  <th className="px-3 py-2 text-right">Interest (FYTD)</th>
                  <th className="px-3 py-2 text-right">Penal</th>
                  <th className="px-3 py-2 text-right">Repaid</th>
                </tr>
              </thead>
              <tbody>
                {stmts.sort((a, b) => (Number(b.closing_balance) || 0) - (Number(a.closing_balance) || 0)).map((s) => (
                  <tr key={String(s.account_no)} className="border-t">
                    <td className="px-3 py-2">{TYPE_LABEL[String(s.account_type)] ?? String(s.account_type)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{String(s.account_no)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(s.closing_balance))} <span className="text-xs text-muted-foreground">{String(s.balance_dr_cr ?? "")}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.interest_rate ? s.interest_rate + "%" : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.drawing_power != null ? fmt(Number(s.drawing_power)) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(s.total_interest))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">{Number(s.total_penal) > 0 ? fmt(Number(s.total_penal)) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(Number(s.total_repayment))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-1.5 text-xs text-muted-foreground">Source: bank statement PDFs in Rahul&apos;s folder · reconcile against the Tally ledgers below.</div>
        </div>
      )}
      <BankDebtView banks={banks} charges={charges} />
    </div>
  );
}

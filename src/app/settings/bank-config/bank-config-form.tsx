"use client";

import { useState, useTransition } from "react";
import { Landmark, Save } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { saveBankConfig, type BankConfigUpdate } from "./actions";

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

function fmtINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function BankConfigForm({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  function update(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save() {
    setStatus(null);
    const updates: BankConfigUpdate[] = rows.map((r) => ({
      id: r.id,
      limitAmount: r.limitAmount,
      drawingPower: r.drawingPower,
      interestRate: r.interestRate,
      emiAmount: r.emiAmount,
      emiDueDay: r.emiDueDay,
    }));
    startTransition(async () => {
      const res = await saveBankConfig(updates);
      if (res.ok) {
        setStatus(`Saved ${res.updatedCount} row(s).`);
      } else {
        setStatus(`Error: ${res.error}`);
      }
    });
  }

  return (
    <PageGuard module="md-dashboard">
      <div className="space-y-5">
        <PageHeader
          title="Bank Configuration"
          description="Set sanctioned limits + EMI schedules. Bank-side data not stored in Tally — MD enters here once per loan."
          actions={
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-md border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <Save className="size-3.5" />
              {pending ? "Saving..." : "Save all"}
            </button>
          }
        />

        {status && (
          <StatusPill tone={status.startsWith("Error") ? "danger" : "success"}>
            {status}
          </StatusPill>
        )}

        <SectionCard
          title="Loan accounts — set sanctioned limit, EMI amount, and due day"
          description="Tally tells us the outstanding principal; you tell us the bank terms. Combined = correct dashboard."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Bank ledger</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Current Balance (Tally)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Sanctioned Limit (₹)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Drawing Power (₹)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Interest Rate (%)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Monthly EMI (₹)</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Due Day (1-31)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Landmark className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{r.bankName}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs uppercase text-muted-foreground">{r.accountType}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{fmtINR(r.currentBalance)}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={r.limitAmount || ""}
                        placeholder="0"
                        onChange={(e) => update(r.id, { limitAmount: Number(e.target.value) || 0 })}
                        className="w-full rounded border bg-background px-2 py-1 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={r.drawingPower || ""}
                        placeholder="0"
                        onChange={(e) => update(r.id, { drawingPower: Number(e.target.value) || 0 })}
                        className="w-full rounded border bg-background px-2 py-1 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        max="30"
                        step="0.01"
                        value={r.interestRate || ""}
                        placeholder="0"
                        onChange={(e) => update(r.id, { interestRate: Number(e.target.value) || 0 })}
                        className="w-full rounded border bg-background px-2 py-1 text-right tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={r.emiAmount || ""}
                        placeholder="0"
                        onChange={(e) => update(r.id, { emiAmount: Number(e.target.value) || 0 })}
                        className="w-full rounded border bg-background px-2 py-1 text-right tabular-nums"
                        disabled={r.accountType === "current"}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={r.emiDueDay ?? ""}
                        placeholder="—"
                        onChange={(e) => update(r.id, { emiDueDay: e.target.value === "" ? null : Number(e.target.value) })}
                        className="w-full rounded border bg-background px-2 py-1 text-right tabular-nums"
                        disabled={r.accountType === "current"}
                      />
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                      No bank accounts yet. Run the masters sync (or the trial balance sync) to populate.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-semibold mb-1">Quick reference — what to enter:</p>
          <ul className="space-y-1">
            <li>• <span className="font-medium">OCC (Cash Credit)</span>: enter Sanctioned Limit. Leave EMI fields blank.</li>
            <li>• <span className="font-medium">Term Loan</span>: enter EMI amount and Due Day (e.g. ₹2,00,000 / day 5).</li>
            <li>• <span className="font-medium">GECLS</span>: enter EMI amount and Due Day per the bank&apos;s repayment schedule.</li>
            <li>• <span className="font-medium">Current accounts</span>: leave everything blank; balance comes from Tally.</li>
          </ul>
        </div>
      </div>
    </PageGuard>
  );
}

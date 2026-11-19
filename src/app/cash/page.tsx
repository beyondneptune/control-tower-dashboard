// Server component — loads live cash position from local Postgres.
// Replaces the Sprint 1 seed-driven cash page (which showed the frozen
// 31-May-2026 demo numbers).
//
// Adds a small banner if there are pending email-review items in the
// FINANCE mailbox (Rahul), so the Finance team's home page surfaces
// the email queue without leaving Cash.

import Link from "next/link";
import { Mail } from "lucide-react";
import { loadEmailIntelligence, loadMdSnapshot } from "@/data/live";
import { StatusPill } from "@/components/kit/status-pill";
import { CashView } from "./cash-view";

export const dynamic = "force-dynamic";

export default async function CashPage() {
  const [snapshot, emailIntel] = await Promise.all([
    loadMdSnapshot(),
    loadEmailIntelligence(),
  ]);
  const finance = emailIntel.mailboxes.find((m) => m.mailbox_role === "finance");

  return (
    <div className="space-y-4">
      {finance && finance.pendingTotal > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-warning" />
            <div>
              <p className="font-medium">
                {finance.pendingTotal} finance email{finance.pendingTotal === 1 ? "" : "s"} awaiting review
              </p>
              <p className="text-xs text-muted-foreground">
                From {finance.mailbox_owner_name ?? finance.mailbox_key}&apos;s inbox · high {finance.pendingHigh} · med {finance.pendingMedium} · low {finance.pendingLow}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill tone="warning" dot>Not on official records</StatusPill>
            <Link
              href="/email-review"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Open Email Review →
            </Link>
          </div>
        </div>
      )}
      <CashView snapshot={snapshot} />
    </div>
  );
}

// Server component — fetches live invoice data from the local Postgres
// (Tally-synced + UI-uploaded). Hands off to <CollectionsView> for render.
//
// Replaces the Sprint 1 seed.ts mock data.

import {
  liveInvoicesWithOutstanding,
  liveReceivablesAgeing,
  liveReceivablesAgeingChart,
} from "@/data/live";
import { CollectionsView } from "./collections-view";

export const dynamic = "force-dynamic"; // always fresh — no caching

export default async function CollectionsPage() {
  const [invoices, ageing, ageingChart] = await Promise.all([
    liveInvoicesWithOutstanding(),
    liveReceivablesAgeing(),
    liveReceivablesAgeingChart(),
  ]);

  return (
    <CollectionsView
      invoices={invoices}
      ageing={ageing}
      ageingChart={ageingChart}
    />
  );
}

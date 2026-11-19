// Server component — loads live stock summary from Tally-synced snapshot.
// Replaces the Sprint 1 seed-driven stores page.

import { loadStockSummary } from "@/data/live";
import { StoresView } from "./stores-view";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const data = await loadStockSummary();
  return <StoresView data={data} />;
}

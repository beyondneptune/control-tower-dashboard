// MD Dashboard — Phase 1B (Tally + Control Tower forms only).
//
// Email/WhatsApp thread intelligence has been retired as a KPI source per the
// 2026-06-17 MD direction. Those routes still exist under /threads/validation
// as archived experimental evidence but no longer feed MD truth.

import { loadCtMdSnapshot } from "@/data/ct-md";
import { CtMdDashboard } from "@/components/dashboards/ct-md-dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await loadCtMdSnapshot();
  return <CtMdDashboard snapshot={snapshot} />;
}

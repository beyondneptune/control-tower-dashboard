// Job Profitability — STANDARD margin (quoted PO price vs BOM standard cost).
//
// Rebuilt off live data (v_ct_job_profitability) — replaces the Sprint-1 seed
// page that was frozen at 31 May. One row per real PO-line work package, cost
// assigned confident-or-blank (BOM standard, part_size-disambiguated), never a
// guessed margin. See src/data/ct-profitability.ts for the truth rules.

import { loadJobProfitability } from "@/data/ct-profitability";
import { JobProfitabilityView } from "@/components/dashboards/job-profitability-view";

export const dynamic = "force-dynamic";

export default async function JobProfitabilityPage() {
  const data = await loadJobProfitability();
  return <JobProfitabilityView data={data} />;
}

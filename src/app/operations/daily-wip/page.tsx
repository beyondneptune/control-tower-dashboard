// Operations → Daily WIP. Production taps each active job's current shop-floor
// stage (the one thing no document emits) → the live production picture, SSOT.
import { Activity } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getActiveJobs } from "@/data/ops";
import { DailyWipClient } from "@/components/dashboards/daily-wip-client";

export const dynamic = "force-dynamic";

export default async function DailyWipPage() {
  const { jobs, updatedToday } = await getActiveJobs();
  return (
    <PageGuard module="ops-daily-wip">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><Activity className="mr-2 inline size-4 -translate-y-0.5" />Daily WIP</>}
          description="Production-floor capture — for every active job, record the stage AND the production documents (Job Card, Route Card, Weld Report, FIR). This is the SSOT for the production & QC stages and completes the Operations Board live."
        />
        <DailyWipClient jobs={jobs} updatedToday={updatedToday} />
      </div>
    </PageGuard>
  );
}

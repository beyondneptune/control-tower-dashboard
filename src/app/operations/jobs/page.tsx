// Operations → Jobs. A job = a Customer-PO line (auto) OR a shop-floor job created
// here when the floor receives work directly. Production creates new jobs with "+ New Job".
import { Factory } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getJobs } from "@/data/ops";
import { JobsClient } from "@/components/dashboards/jobs-client";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const { jobs, poCount, floorCount, quotes } = await getJobs();
  return (
    <PageGuard module="ops-job">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><Factory className="mr-2 inline size-4 -translate-y-0.5" />Jobs</>}
          description="Every job — auto from a PO line, plus shop-floor jobs the production team creates directly. Floor jobs link to their order by the quotation number."
        />
        <JobsClient jobs={jobs} poCount={poCount} floorCount={floorCount} quotes={quotes} />
      </div>
    </PageGuard>
  );
}

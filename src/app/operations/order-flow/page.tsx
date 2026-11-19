// Operations Board — the CLEAN pipeline, read from v_ops_order_flow (SSOT only:
// Rahul/Arjun folders + Tally + forms). No email, no inference. Green / WIP /
// exception, with historical RFQ & Dispatch shown as pre-system.
import { LayoutDashboard } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getOpsOrderFlow } from "@/data/ops";
import { OpsOrderFlowView } from "@/components/dashboards/ops-order-flow-view";

export const dynamic = "force-dynamic";

export default async function OpsOrderFlowPage() {
  const { rows, summary } = await getOpsOrderFlow();
  return (
    <PageGuard module="ops-order-flow">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><LayoutDashboard className="mr-2 inline size-4 -translate-y-0.5" />Operations Board</>}
          description="The clean order book — every stage from a folder document, Tally, or a team form. No email, no inference. RFQ → BOM → Quote → PO → Production → QC → Dispatch → Invoice."
        />
        <OpsOrderFlowView rows={rows} summary={summary} />
      </div>
    </PageGuard>
  );
}

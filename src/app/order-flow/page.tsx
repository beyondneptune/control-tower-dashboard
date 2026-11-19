// Operations → Order Flow: the RFQ→Invoice digital-thread pipeline.
// One row per order-anchor, each stage a clickable node that deep-links to its
// register. Connectivity coloured green/amber/red; WIP in its own scheme. Reveals
// which orders (from 1-Apr-2026) are fully connected vs where documents are missing.

import { Workflow } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getOrderFlow } from "@/data/ct-order-flow";
import { CtOrderFlowView } from "@/components/dashboards/ct-order-flow-view";

export const dynamic = "force-dynamic";

export default async function OrderFlowPage() {
  const { rows, summary, since } = await getOrderFlow("2026-04-01");

  return (
    <PageGuard module="ct-order-flow">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><Workflow className="mr-2 inline size-4 -translate-y-0.5" />Order Flow</>}
          description={`RFQ → Quote → BOM → PO → Job → QC → Dispatch → Invoice · every order since ${since} · click any stage to open its register.`}
        />
        <CtOrderFlowView rows={rows} summary={summary} />
      </div>
    </PageGuard>
  );
}

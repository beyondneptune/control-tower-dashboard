// Operations → RFQ Confirm. Email proposes enquiry candidates; a human confirms
// each into the clean ops_rfq (SSOT). Confirming turns the RFQ stage green.
import { ClipboardCheck } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getRfqCandidates } from "@/data/ops";
import { RfqConfirmClient } from "@/components/dashboards/rfq-confirm-client";

export const dynamic = "force-dynamic";

export default async function RfqConfirmPage() {
  const { candidates, confirmedCount } = await getRfqCandidates();
  return (
    <PageGuard module="ops-rfq-confirm">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><ClipboardCheck className="mr-2 inline size-4 -translate-y-0.5" />RFQ Confirm</>}
          description="NEW enquiries only (from today). Email proposes; you confirm into the clean order book → the RFQ stage goes green. Historical RFQs stay pre-system — we do not backfill the past."
        />
        <RfqConfirmClient candidates={candidates} confirmedCount={confirmedCount} />
      </div>
    </PageGuard>
  );
}

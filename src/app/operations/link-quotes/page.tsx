// Operations → Link Quote↔PO. Rahul confirms which quotation each customer PO
// corresponds to (the PO carries no PIPL quote number). The certain SSOT bridge.
import { Link2 } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getPoQuoteLinks } from "@/data/ops";
import { LinkQuotesClient } from "@/components/dashboards/link-quotes-client";

export const dynamic = "force-dynamic";

export default async function LinkQuotesPage() {
  const { groups, quotes, stats } = await getPoQuoteLinks();
  return (
    <PageGuard module="ops-link-quotes">
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader
          title={<><Link2 className="mr-2 inline size-4 -translate-y-0.5" />Link Quote ↔ PO</>}
          description="A quote is per-part, so each PO LINE is matched to its quotation by the drawing printed on both documents. The match is pre-filled — Rahul opens both docs, reverifies, and confirms."
        />
        <LinkQuotesClient groups={groups} quotes={quotes} stats={stats} />
      </div>
    </PageGuard>
  );
}

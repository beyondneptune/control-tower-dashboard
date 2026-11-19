// Clean Operations register — dynamic route driven by lib/ops-registers.ts.
// Reads an ops_* SSOT table/view only. Fresh replacement for the ct_ registers.
import { notFound } from "next/navigation";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { getOpsRegister } from "@/lib/ops-registers";
import { getOpsRegisterRows } from "@/data/ops";
import { OpsRegisterTable } from "@/components/ct/ops-register-table";

export const dynamic = "force-dynamic";

export default async function OpsRegisterPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const reg = getOpsRegister(key);
  if (!reg) return notFound();
  const rows = await getOpsRegisterRows(reg.source, reg.order);
  return (
    <PageGuard module={reg.module}>
      <div className="space-y-4 p-4 md:p-6">
        <PageHeader title={reg.label} description={`${reg.description} · Source-of-truth only (folders / Tally / forms).`} />
        <OpsRegisterTable register={reg} rows={rows} />
      </div>
    </PageGuard>
  );
}

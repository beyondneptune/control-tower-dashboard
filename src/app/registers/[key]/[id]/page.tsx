import { notFound } from "next/navigation";
import { getRegister } from "@/lib/ct-registers";
import { getRecord, listAuditForRecord, listFilesForRecord } from "@/lib/ct-actions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/kit/page-header";
import { RegisterForm } from "@/components/ct/register-form";
import { EvidencePanel } from "@/components/ct/evidence-panel";
import { AuditTrail } from "@/components/ct/audit-trail";

export default async function RegisterDetailPage({
  params,
}: {
  params: Promise<{ key: string; id: string }>;
}) {
  const { key, id } = await params;
  const reg = getRegister(key);
  if (!reg) return notFound();

  const supabase = await createClient();
  const [record, audit, files, customersRes, vendorsRes, jobsRes] = await Promise.all([
    getRecord(key, id),
    listAuditForRecord(reg.table, id),
    listFilesForRecord(reg.table, id),
    supabase.from("customers").select("id, customer_name").order("customer_name"),
    supabase.from("vendors").select("id, vendor_name").order("vendor_name"),
    supabase.from("jobs").select("id, job_code").order("created_at", { ascending: false }).limit(500),
  ]);
  if (!record) return notFound();

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={`${reg.label}`}
        description={`Record ${(record as Record<string, unknown>)[reg.primary] ?? id}`}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Edit
            </h2>
            <RegisterForm
              register={reg}
              initial={record as Record<string, unknown>}
              recordId={id}
              customers={customersRes.data ?? []}
              vendors={vendorsRes.data ?? []}
              jobs={jobsRes.data ?? []}
            />
          </section>
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Audit history
            </h2>
            <AuditTrail rows={audit} />
          </section>
        </div>
        <div className="space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence files
            </h2>
            <EvidencePanel register={reg.table} recordId={id} files={files} />
          </section>
        </div>
      </div>
    </div>
  );
}

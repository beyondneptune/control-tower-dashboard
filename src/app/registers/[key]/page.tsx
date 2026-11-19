import Link from "next/link";
import { notFound } from "next/navigation";
import { getRegister } from "@/lib/ct-registers";
import { listRecords } from "@/lib/ct-actions";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/kit/page-header";
import { RegisterTable } from "@/components/ct/register-table";
import { ExportButtons } from "@/components/ct/export-buttons";

// Reads a live DB via cookies() → always request-time. Explicitly dynamic; the
// old generateStaticParams was dead (records can't be prerendered from live data).
export const dynamic = "force-dynamic";

export default async function RegisterListPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { key } = await params;
  const { q } = await searchParams;
  const reg = getRegister(key);
  if (!reg) return notFound();

  const supabase = await createClient();
  const [{ rows }, customersRes, vendorsRes] = await Promise.all([
    listRecords(key, { limit: 500, orderBy: reg.table === "jobs" ? "created_at" : "created_at", orderDesc: true }),
    supabase.from("customers").select("id, customer_name").order("customer_name"),
    supabase.from("vendors").select("id, vendor_name").order("vendor_name"),
  ]);

  const customerNameById: Record<string, string> = {};
  for (const c of customersRes.data ?? []) customerNameById[c.id] = c.customer_name;
  const vendorNameById: Record<string, string> = {};
  for (const v of vendorsRes.data ?? []) vendorNameById[v.id] = v.vendor_name;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title={reg.label}
        description={`${reg.description} · Owner: ${reg.owner}. Backup: ${reg.backup}.`}
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons registerKey={reg.key} />
            <Link
              href={`/registers/${reg.key}/new`}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              + New
            </Link>
          </div>
        }
      />
      <RegisterTable
        register={reg}
        rows={rows as Record<string, unknown>[]}
        customerNameById={customerNameById}
        vendorNameById={vendorNameById}
        initialSearch={q ?? ""}
      />
    </div>
  );
}

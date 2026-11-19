import { notFound } from "next/navigation";
import { getRegister } from "@/lib/ct-registers";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/kit/page-header";
import { RegisterForm } from "@/components/ct/register-form";

export default async function RegisterNewPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const reg = getRegister(key);
  if (!reg) return notFound();

  const supabase = await createClient();
  const [customersRes, vendorsRes, jobsRes] = await Promise.all([
    supabase.from("customers").select("id, customer_name").order("customer_name"),
    supabase.from("vendors").select("id, vendor_name").order("vendor_name"),
    supabase.from("jobs").select("id, job_code").order("created_at", { ascending: false }).limit(500),
  ]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title={`New — ${reg.label}`} description={reg.description} />
      <div className="max-w-4xl rounded-lg border bg-card p-4">
        <RegisterForm
          register={reg}
          customers={customersRes.data ?? []}
          vendors={vendorsRes.data ?? []}
          jobs={jobsRes.data ?? []}
        />
      </div>
    </div>
  );
}

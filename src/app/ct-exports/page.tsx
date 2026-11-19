import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/kit/page-header";
import { CT_REGISTERS } from "@/lib/ct-registers";

export const dynamic = "force-dynamic";

export default async function CtExportsPage() {
  const supabase = await createClient();
  const { data: exports } = await supabase
    .from("control_tower_exports")
    .select("id, register, format, row_count, exported_at, download_path")
    .order("exported_at", { ascending: false })
    .limit(200);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader title="Exports" description="Standard downloads + recent export history." />

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Standard downloads
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CT_REGISTERS.map((r) => (
            <div key={r.key} className="rounded-md border bg-card p-3 text-sm">
              <div className="font-medium">{r.label}</div>
              <div className="text-xs text-muted-foreground">Table: {r.table}</div>
              <div className="mt-2 flex gap-3 text-xs">
                <a
                  className="text-primary hover:underline"
                  href={`/registers/${r.key}`}
                >
                  Open register
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent exports
        </h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Register</th>
                <th className="px-3 py-2 text-left font-medium">Format</th>
                <th className="px-3 py-2 text-left font-medium">Rows</th>
                <th className="px-3 py-2 text-left font-medium">Exported</th>
                <th className="px-3 py-2 text-left font-medium">File</th>
              </tr>
            </thead>
            <tbody>
              {(exports ?? []).map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-3 py-1.5">{e.register}</td>
                  <td className="px-3 py-1.5 uppercase">{e.format}</td>
                  <td className="px-3 py-1.5">{e.row_count ?? "—"}</td>
                  <td className="px-3 py-1.5">{new Date(e.exported_at as string).toLocaleString()}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{e.download_path}</td>
                </tr>
              ))}
              {(exports ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                    No exports recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

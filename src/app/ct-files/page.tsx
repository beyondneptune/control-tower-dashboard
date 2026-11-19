import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/kit/page-header";

export const dynamic = "force-dynamic";

export default async function CtFilesPage() {
  const supabase = await createClient();
  const { data: files } = await supabase
    .from("control_tower_files")
    .select("id, original_filename, mime_type, size_bytes, uploaded_at, linked_register, linked_record_id")
    .is("deleted_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(500);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Files / Evidence"
        description="All evidence files uploaded against any Phase 1B register (locally stored on Mac mini, Supabase Storage bucket control-tower-files)."
      />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">File</th>
              <th className="px-3 py-2 text-left font-medium">Register</th>
              <th className="px-3 py-2 text-left font-medium">Linked record</th>
              <th className="px-3 py-2 text-left font-medium">Size</th>
              <th className="px-3 py-2 text-left font-medium">Uploaded</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {(files ?? []).map((f) => (
              <tr key={f.id} className="border-t">
                <td className="px-3 py-1.5">{f.original_filename}</td>
                <td className="px-3 py-1.5">{f.linked_register ?? "—"}</td>
                <td className="px-3 py-1.5 font-mono text-xs">{f.linked_record_id ?? "—"}</td>
                <td className="px-3 py-1.5">{f.size_bytes ? `${Math.round(Number(f.size_bytes) / 1024)} kB` : "—"}</td>
                <td className="px-3 py-1.5">{new Date(f.uploaded_at as string).toLocaleString()}</td>
                <td className="px-3 py-1.5 text-right">
                  <a className="text-primary hover:underline" href={`/api/ct-files/${f.id}`} target="_blank">Download</a>
                </td>
              </tr>
            ))}
            {(files ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">No files yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

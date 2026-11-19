import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegister } from "@/lib/ct-registers";
import type { Role } from "@/domain/types";
import * as XLSX from "xlsx";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = ((u.user.app_metadata as Record<string, unknown>)?.role as string) ?? "auditor";

  const body = await req.json();
  const registerKey = String(body.register ?? "");
  const format = String(body.format ?? "csv");
  const filters = (body.filters ?? {}) as Record<string, string>;

  const reg = getRegister(registerKey);
  if (!reg) return NextResponse.json({ error: "unknown register" }, { status: 400 });
  // A register's data is only exportable by the roles that own that module (M-16:
  // the page gate doesn't cover API routes). MD may export anything.
  if (role !== "md" && !reg.navRoles.includes(role as Role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const allowedCols = new Set(reg.fields.map((f) => f.name));

  const admin = createAdminClient();
  let q = admin
    .from(reg.table)
    .select("*")
    .is(reg.table === "jobs" ? "ct_deleted_at" : "deleted_at", null);
  for (const [k, v] of Object.entries(filters)) {
    // Only allow filtering on known columns — blocks schema/value probing.
    if (v && v !== "all" && allowedCols.has(k)) q = q.eq(k, v);
  }
  const { data, error } = await q.limit(10000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  const exportedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${reg.key}_${exportedAt}.${format}`;

  await admin.from("control_tower_exports").insert({
    exported_by: u.user.id,
    register: reg.table,
    format,
    row_count: rows.length,
    filter_summary: filters,
    download_path: filename,
  });

  if (format === "csv") {
    const headers = rows.length ? Object.keys(rows[0]) : reg.fields.map((f) => f.name);
    const csv = [headers.join(",")]
      .concat(
        rows.map((r) =>
          headers
            .map((h) => {
              const v = (r as Record<string, unknown>)[h];
              if (v === null || v === undefined) return "";
              const s = typeof v === "string" ? v : JSON.stringify(v);
              return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(","),
        ),
      )
      .join("\n");
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv",
        "content-disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // xlsx
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, reg.key.slice(0, 28));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return new NextResponse(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}

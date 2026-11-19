// Engineering · Drawings — the company's building-block catalog (ct_drawing_register).
// Read-only research view: concentration, part/alloy/size mix, deposition-thickness vs global norm.
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";

type Row = Record<string, string | number | null>;
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function tally(rows: Row[], key: string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = (r[key] ?? "").toString().trim();
    if (!v) continue;
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function DrawingsPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("ct_drawing_register").select("*").order("drawing_no");
  const rows = (data ?? []) as Row[];
  const n = rows.length;

  const apexflow = rows.filter((r) => /apexflow/i.test(String(r.customer ?? ""))).length;
  const plugs = rows.filter((r) => /plug/i.test(String(r.part_type ?? ""))).length;
  const stellite = rows.filter((r) => /stellite/i.test(String(r.cladding_alloy ?? ""))).length;
  const withAlloy = rows.filter((r) => r.cladding_alloy).length;
  const withThk = rows.filter((r) => r.deposition_thickness_mm != null).length;
  const thkVals = rows.map((r) => Number(r.deposition_thickness_mm)).filter((x) => x > 0);
  const thkMode = tally(rows.filter((r) => r.deposition_thickness_mm != null), "deposition_thickness_mm")[0];

  const partMix = tally(rows, "part_type");
  const alloyMix = tally(rows, "cladding_alloy");
  const sizeMix = tally(rows, "valve_size");

  const kpi = [
    { label: "Distinct drawings", value: n, sub: "FY26-27 catalog" },
    { label: "Apex Flow Systems", value: `${pct(apexflow, n)}%`, sub: `${apexflow}/${n} — concentration risk` },
    { label: "Valve plugs", value: `${pct(plugs, n)}%`, sub: `${plugs}/${n} of all parts` },
    { label: "Stellite cladding", value: `${pct(stellite, withAlloy)}%`, sub: `${stellite}/${withAlloy} stated — mono-process` },
  ];

  return (
    <PageGuard module="engineering-drawings">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Drawings — Engineering Register</h1>
          <p className="text-sm text-muted-foreground">
            The company&apos;s primary building block. {n} distinct part drawings since 1-Apr, with title-block
            engineering facts (alloy, location, thickness) extracted evidence-only — never guessed.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpi.map((k) => (
            <div key={k.label} className="rounded-lg border bg-card p-3">
              <div className="text-2xl font-semibold">{k.value}</div>
              <div className="text-xs font-medium">{k.label}</div>
              <div className="text-xs text-muted-foreground">{k.sub}</div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Deposition-thickness flag.</b> Meridian&apos;s modal as-deposited spec is{" "}
          <b>{thkMode ? `${thkMode[0]} mm` : "—"}</b> (stated on {withThk}/{n} drawings; range{" "}
          {thkVals.length ? `${Math.min(...thkVals)}–${Math.max(...thkVals)} mm` : "—"}). The global
          single-pass laser-Stellite-6 norm is <b>1.0–1.5 mm</b> — Meridian sits at the upper end, so every
          0.1 mm over the sealing-face need is wasted cobalt powder (powder ≈ 67% of job cost). Confirm
          whether 2.2 mm is customer-mandated or an internal default.
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[["Part mix", partMix], ["Cladding alloy", alloyMix], ["Valve size", sizeMix]].map(([title, mix]) => (
            <div key={title as string} className="rounded-lg border bg-card p-3">
              <div className="mb-2 text-sm font-medium">{title as string}</div>
              <ul className="space-y-1 text-sm">
                {(mix as [string, number][]).slice(0, 8).map(([k, v]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">All drawings ({n})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  {["Drawing", "Rev", "Customer", "Part", "Size", "Base metal", "Cladding", "Location", "Dep. mm", "Conf."].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={String(r.id)} className="border-t hover:bg-accent/30">
                    <td className="px-3 py-1.5 font-mono text-xs">{String(r.drawing_no ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.revision ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.customer ?? "—").replace(/ (India Controls Pvt Ltd|Valves Private Limited)/, "")}</td>
                    <td className="px-3 py-1.5">{String(r.part_type ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.valve_size ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.base_material_grade ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.cladding_alloy ?? "—")}</td>
                    <td className="px-3 py-1.5">{String(r.cladding_location ?? "—")}</td>
                    <td className="px-3 py-1.5">{r.deposition_thickness_mm ?? "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.confidence ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}

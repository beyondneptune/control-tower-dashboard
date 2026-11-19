// Engineering · Strategy — opportunities & risks from the broad business/market/tech sweep
// (ct_strategy_insights): cobalt supply, customer diversification, certifications, alt-tech, risk…
import { createAdminClient } from "@/lib/supabase/admin";
import { PageGuard } from "@/components/kit/page-guard";

export const dynamic = "force-dynamic";
type Row = Record<string, string | null>;

const LABEL: Record<string, string> = {
  "cobalt-powder-supply-market": "Cobalt & powder supply",
  "competitive-landscape": "Competitive landscape",
  "customer-diversification": "Customer diversification",
  "valve-oem-supplier-expectations": "Valve-OEM expectations",
  "alt-surface-technologies": "Alternative technologies",
  "coating-jobshop-financials": "Financials & valuation",
  "automation-robotics-roi": "Automation & robotics",
  "sustainability-circularity-esg": "Sustainability / ESG",
  "certifications-market-access": "Certifications & access",
  "laser-cladding-market-growth": "Market sizing & growth",
  "digital-transformation-roadmap": "Digital transformation",
  "ip-patent-landscape": "IP & patents",
  "adjacent-applications-newrevenue": "Adjacent revenue lines",
  "risk-resilience-framework": "Risk & resilience",
  "commercial-models-value-selling": "Value-based selling",
  "workforce-skills-capability": "Workforce & skills",
};

export default async function StrategyPage() {
  const admin = createAdminClient();
  const { data } = await admin.from("ct_strategy_insights").select("*").range(0, 999);
  const rows = (data ?? []) as Row[];
  const opps = rows.filter((r) => r.kind === "opportunity").length;
  const risks = rows.filter((r) => r.kind === "risk").length;

  const cats = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r.category ?? "other");
    if (!cats.has(k)) cats.set(k, []);
    cats.get(k)!.push(r);
  }

  const kpi = [
    { value: rows.length, label: "Strategy insights", sub: "from 16 market/tech streams" },
    { value: opps, label: "Opportunities", sub: "growth & profit moves" },
    { value: risks, label: "Risks", sub: "threats & mitigations" },
    { value: cats.size, label: "Areas", sub: "supply → customers → tech" },
  ];

  return (
    <PageGuard module="engineering-strategy">
      <div className="space-y-5 p-4 md:p-6">
        <div>
          <h1 className="text-xl font-semibold">Strategy — Beyond the Shop Floor</h1>
          <p className="text-sm text-muted-foreground">
            Opportunities &amp; risks from a deep market/supply/customer/technology sweep, each cited.
            Headline: cobalt <b>+68.9% YoY</b> on a <b>98% single-customer</b> book — diversify revenue, hedge powder, certify for access.
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

        {[...cats.entries()].sort((a, b) => b[1].length - a[1].length).map(([cat, list]) => {
          const o = list.filter((r) => r.kind === "opportunity");
          const x = list.filter((r) => r.kind === "risk");
          return (
            <div key={cat} className="rounded-lg border bg-card">
              <div className="border-b px-4 py-2 text-sm font-medium">{LABEL[cat] ?? cat} <span className="text-xs text-muted-foreground">({list.length})</span></div>
              <div className="grid gap-0 md:grid-cols-2">
                <div className="border-b p-3 md:border-b-0 md:border-r">
                  <div className="mb-1 text-xs font-semibold uppercase text-emerald-700">Opportunities</div>
                  <ul className="space-y-1.5 text-sm">
                    {o.map((r) => (
                      <li key={String(r.id)} className="flex gap-1.5">
                        <span className="text-emerald-600">▸</span>
                        <span className="text-muted-foreground">{String(r.title)}{r.source_url ? <a href={String(r.source_url)} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 hover:underline">↗</a> : null}</span>
                      </li>
                    ))}
                    {!o.length && <li className="text-xs text-muted-foreground">—</li>}
                  </ul>
                </div>
                <div className="p-3">
                  <div className="mb-1 text-xs font-semibold uppercase text-red-700">Risks</div>
                  <ul className="space-y-1.5 text-sm">
                    {x.map((r) => (
                      <li key={String(r.id)} className="flex gap-1.5">
                        <span className="text-red-600">▸</span>
                        <span className="text-muted-foreground">{String(r.title)}{r.source_url ? <a href={String(r.source_url)} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 hover:underline">↗</a> : null}</span>
                      </li>
                    ))}
                    {!x.length && <li className="text-xs text-muted-foreground">—</li>}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PageGuard>
  );
}

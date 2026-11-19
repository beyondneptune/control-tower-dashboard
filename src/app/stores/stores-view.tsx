"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowUpCircle, Boxes, Database, Search, TrendingDown } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { TallyFreshness } from "@/components/kit/tally-freshness";
import { DataTable, type Column } from "@/components/kit/data-table";
import type { LiveStockItem, LiveStockSummary } from "@/data/live";
import { formatINR, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

function formatQty(qty: number, unit: string | null): string {
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(qty);
  return unit ? `${formatted} ${unit}` : formatted;
}

interface Props {
  data: LiveStockSummary;
}

export function StoresView({ data }: Props) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "positive" | "negative" | "zero" | "valued">("all");

  const filtered = useMemo(() => {
    let list = data.items;
    if (filter === "positive") list = list.filter((i) => i.closingQty > 0);
    else if (filter === "negative") list = list.filter((i) => i.closingQty < 0);
    else if (filter === "zero") list = list.filter((i) => i.closingQty === 0);
    else if (filter === "valued") list = list.filter((i) => i.closingValue != null && i.closingValue !== 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.itemName.toLowerCase().includes(q));
    }
    return list;
  }, [data.items, filter, search]);

  const cols: Column<LiveStockItem>[] = [
    {
      key: "name",
      header: "Item",
      render: (r) => <span className="text-sm">{r.itemName}</span>,
    },
    {
      key: "godown",
      header: "Godown",
      className: "text-muted-foreground",
      render: (r) => <span className="text-xs">{r.godown ?? "—"}</span>,
    },
    {
      key: "qty",
      header: "Closing Qty",
      align: "right",
      render: (r) => {
        const tone: StatusTone = r.closingQty < 0 ? "warning" : r.closingQty > 0 ? "success" : "neutral";
        return (
          <span className={`tabular-nums ${r.closingQty < 0 ? "text-warning font-medium" : "font-medium"}`}>
            {formatQty(r.closingQty, r.closingUnit)}
          </span>
        );
      },
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      render: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {r.closingRate == null ? "—" : formatINR(r.closingRate, "full")}
        </span>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      render: (r) => (
        <span className="tabular-nums">
          {r.closingValue == null ? "—" : formatINR(r.closingValue, "full")}
        </span>
      ),
    },
  ];

  const negativePct = data.totalItems > 0 ? (data.negativeQty / data.totalItems) * 100 : 0;

  return (
    <PageGuard module="stores">
      <div className="space-y-5">
        <PageHeader
          title="Stores / Inventory"
          description={`Tally Stock Summary · ${data.totalItems} items`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <TallyFreshness streams="Stock" />
              {data.negativeQty > 0 && (
                <StatusPill tone="warning">
                  {formatNumberIN(data.negativeQty)} items with deficit
                </StatusPill>
              )}
            </div>
          }
        />

        {/* Summary KPIs */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Inventory snapshot
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Total Items"
              value={formatNumberIN(data.totalItems)}
              tone="info"
              icon={<Boxes className="size-4" />}
              sub="All SKUs in Tally Stock Summary"
            />
            <KpiCard
              label="Positive Qty"
              value={formatNumberIN(data.positiveQty)}
              tone="success"
              icon={<ArrowUpCircle className="size-4" />}
              sub="Items physically in stock"
            />
            <KpiCard
              label="Negative Qty (deficit)"
              value={formatNumberIN(data.negativeQty)}
              tone={data.negativeQty > data.positiveQty ? "warning" : "neutral"}
              icon={<TrendingDown className="size-4" />}
              sub="Billed but not yet produced · per Tally"
            />
            <KpiCard
              label="Items with Value"
              value={formatNumberIN(data.itemsWithValue)}
              tone="neutral"
              icon={<Database className="size-4" />}
              sub="SKUs that have a rate set in Tally"
            />
          </div>
        </section>

        {/* Production deficit warning if relevant */}
        {data.negativeQty > 0 && negativePct > 20 && (
          <SectionCard
            title="Production deficit detected"
            description={`${formatNumberIN(data.negativeQty)} items (${negativePct.toFixed(0)}% of catalog) show negative quantities`}
            action={<StatusPill tone="warning" dot>Check with finance</StatusPill>}
          >
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                A large share of items show <span className="font-medium text-foreground">closing balance &lt; 0</span> in
                Tally. This usually means one of:
              </p>
              <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
                <li>The item was sold/issued before the corresponding manufacturing receipt was recorded — temporary state, clears when production voucher is posted.</li>
                <li>Opening stock on day 1 of the FY wasn&apos;t set, so first sale pushes the SKU negative.</li>
                <li>Consumables / sub-assemblies tracked but rarely topped up — Tally shows deficit relative to what was issued.</li>
              </ul>
              <p className="text-xs text-muted-foreground">
                Action: ask finance to review Stock Summary in Tally itself and either post production vouchers
                or correct opening stocks. This dashboard reflects whatever Tally says — no recalculation done here.
              </p>
            </div>
          </SectionCard>
        )}

        {/* Search + filter + table */}
        <SectionCard
          title="All stock items — live from Tally"
          description={`Showing ${formatNumberIN(filtered.length)} of ${formatNumberIN(data.totalItems)}`}
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search item..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48 rounded-md border bg-background px-7 py-1 text-xs"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-md border bg-background px-2 py-1 text-xs"
              >
                <option value="all">All ({data.totalItems})</option>
                <option value="positive">In stock ({data.positiveQty})</option>
                <option value="negative">Deficit ({data.negativeQty})</option>
                <option value="zero">Zero ({data.zeroQty})</option>
                <option value="valued">Valued ({data.itemsWithValue})</option>
              </select>
            </div>
          }
        >
          <DataTable
            columns={cols}
            rows={filtered}
            getRowKey={(r) => r.itemName}
            empty="No matching items."
          />
        </SectionCard>

        {/* Coming-soon: material issues from /uploads */}
        <SectionCard
          title="Material issues per job"
          description="Pending — comes from Meridian /stores/issue form (Phase 1B)"
          action={<StatusPill tone="warning" dot>Pending mobile form</StatusPill>}
        >
          <div className="px-1 py-2 text-sm text-muted-foreground">
            Stores team will use a mobile form to record material issues per job (lot number, qty, job code).
            That data lands in <code className="rounded bg-muted px-1 py-0.5">material_issues</code> and we&apos;ll
            show it here with traceability per powder lot → job.
            <br />
            <span className="text-xs">Inventory closing balance above continues to come from Tally — material issues just track WHERE it went.</span>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

void AlertTriangle; // kept for future "low stock" warning when reorder levels wired

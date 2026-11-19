"use client";

/**
 * Recharts wrappers for the control tower. Data series use hex colors (reliable
 * as SVG fills); chart chrome (grid, axes) uses light neutral tones for the
 * clean white/grey executive look.
 */

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate, formatINRCompact, formatINRFull } from "@/lib/format";
import { chartColors, marginBandColors, priorityColors } from "@/lib/status";
import { MARGIN_BAND_LABEL } from "@/domain/calc/margin";
import type { MarginBand } from "@/domain/types";

const GRID = "#e2e8f0";
const AXIS = "#64748b";

interface TipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}
interface TipProps {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  money?: boolean;
}

function ChartTooltip({ active, payload, label, money = true }: TipProps) {
  if (!active || !payload?.length) return null;
  const head =
    typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label) ? formatDate(label) : label;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {head !== undefined && head !== "" && (
        <p className="mb-1 font-medium text-popover-foreground">{head}</p>
      )}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name && <span>{p.name}:</span>}
          <span className="font-medium tabular-nums text-popover-foreground">
            {money ? formatINRFull(Number(p.value)) : String(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
}

export function CashTrendChart({ data }: { data: { date: string; balance: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="cashFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.c1} stopOpacity={0.28} />
            <stop offset="100%" stopColor={chartColors.c1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(d) => formatDate(d).slice(0, 6)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis
          tickFormatter={(v) => formatINRCompact(v)}
          tick={{ fill: AXIS, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={58}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID }} />
        <Area type="monotone" dataKey="balance" name="Balance" stroke={chartColors.c1} strokeWidth={2} fill="url(#cashFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AgeingBarChart({ data }: { data: { bucket: string; amount: number }[] }) {
  const colors = ["#f59e0b", "#ea580c", "#dc2626", "#991b1b"];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <XAxis dataKey="bucket" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="amount" name="Outstanding" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StageFunnelChart({ data }: { data: { stage: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="stage" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
        <Tooltip content={<ChartTooltip money={false} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="count" name="Jobs" fill={chartColors.c1} radius={[0, 4, 4, 0]} barSize={14}>
          <LabelList dataKey="count" position="right" className="fill-muted-foreground" style={{ fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RevenueFlowChart({ data }: { data: { name: string; value: number }[] }) {
  const colors = [chartColors.slate, chartColors.c1, chartColors.c5, chartColors.c3];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 16, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" name="Value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
          <LabelList dataKey="value" position="top" formatter={(v) => formatINRCompact(Number(v))} style={{ fontSize: 10, fill: AXIS }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PriorityBarChart({ data }: { data: { priority: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <XAxis dataKey="priority" tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tickFormatter={(v) => formatINRCompact(v)} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={58} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="amount" name="Payable" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={priorityColors[d.priority] ?? chartColors.slate} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MarginTooltip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const band = (payload[0].payload?.band as MarginBand) ?? "data-required";
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{MARGIN_BAND_LABEL[band]}</p>
      <p className="text-muted-foreground">{String(payload[0].value)} job(s)</p>
    </div>
  );
}

export function MarginDonutChart({ data }: { data: { band: MarginBand; count: number }[] }) {
  const filtered = data.filter((d) => d.count > 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={filtered} dataKey="count" nameKey="band" innerRadius={52} outerRadius={84} paddingAngle={2} strokeWidth={1}>
          {filtered.map((d, i) => (
            <Cell key={i} fill={marginBandColors[d.band]} />
          ))}
        </Pie>
        <Tooltip content={<MarginTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
}

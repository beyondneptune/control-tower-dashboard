import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type StatusTone } from "@/lib/status";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  className?: string;
}

/**
 * Dense executive KPI tile with a left status rail. The rail colour encodes
 * health (red/amber/green/neutral) so the MD can scan the board in seconds.
 */
export function KpiCard({ label, value, sub, tone = "neutral", icon, className }: KpiCardProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-accent/30", className)}>
      <span className={cn("absolute inset-y-0 left-0 w-1", toneClasses[tone].bar)} aria-hidden />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {icon && <span className={cn("shrink-0", toneClasses[tone].text)}>{icon}</span>}
      </div>
      <p className="mt-1.5 pl-1.5 text-2xl font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {sub && <div className="mt-1.5 pl-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

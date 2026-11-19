import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toneClasses, type StatusTone } from "@/lib/status";

export function StatusDot({ tone, className }: { tone: StatusTone; className?: string }) {
  return <span className={cn("inline-block size-2 rounded-full", toneClasses[tone].dot, className)} />;
}

export function StatusPill({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: StatusTone;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClasses[tone].pill,
        className,
      )}
    >
      {dot && <span className={cn("size-1.5 rounded-full", toneClasses[tone].dot)} />}
      {children}
    </span>
  );
}

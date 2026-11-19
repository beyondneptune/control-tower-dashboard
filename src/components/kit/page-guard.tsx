"use client";

import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useRole } from "@/lib/role-store";
import { canAccess, type ModuleKey } from "@/domain/rbac";
import { ROLE_LABELS } from "@/domain/types";

/**
 * Client-side access gate for the demo. In Sprint 2 the SAME `canAccess` check
 * runs server-side (RLS + server actions) — this UI gate is convenience, not
 * the security boundary.
 */
export function PageGuard({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const role = useRole((s) => s.role);

  if (!canAccess(role, module)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">Restricted module</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The <span className="font-medium">{ROLE_LABELS[role]}</span> role doesn&apos;t have access to this area.
            Switch to a role with permission, or contact the MD.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

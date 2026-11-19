"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useRole } from "@/lib/role-store";

const AuthenticatedShell = dynamic(
  () => import("./authenticated-shell").then((mod) => mod.AuthenticatedShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    ),
  },
);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ready = useRole((s) => s.ready);

  // Auth routes (login, sign-out) render bare — no sidebar/topbar.
  if (pathname === "/login" || pathname.startsWith("/auth")) {
    return <>{children}</>;
  }

  // Hold the role-scoped shell until the verified session role resolves, so no
  // privileged view ever flashes before auth settles.
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <AuthenticatedShell>{children}</AuthenticatedShell>;
}

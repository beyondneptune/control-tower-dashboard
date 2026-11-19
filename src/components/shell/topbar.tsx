"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "./theme-toggle";
import { ROLE_LABELS } from "@/domain/types";
import { useRole } from "@/lib/role-store";
import { NAV_ITEMS } from "@/domain/rbac";

function pageTitle(pathname: string): string {
  const exact = NAV_ITEMS.find((n) => n.href === pathname);
  if (exact) return exact.label;
  const prefix = NAV_ITEMS.find((n) => n.href !== "/" && pathname.startsWith(n.href));
  return prefix?.label ?? "MD Dashboard";
}

export function Topbar() {
  const role = useRole((s) => s.role);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/65 md:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-5" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold tracking-tight">{pageTitle(pathname)}</p>
      </div>

      {/* Live exceptions live in the MD Workspace (v_ct_exceptions_open). The old
          /alerts seed page was removed; the bell is a shortcut to the live queue. */}
      <Link
        href="/workspace"
        aria-label="Open exception queue"
        className="relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Bell className="size-4.5" />
      </Link>

      <ThemeToggle />
      <div className="flex items-center gap-2 pl-1">
        <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{ROLE_LABELS[role]}</span>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            aria-label="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="size-4.5" />
          </button>
        </form>
      </div>
    </header>
  );
}

"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";
import { useRole } from "@/lib/role-store";
import type { Role } from "@/domain/types";

function roleFromUser(user: { app_metadata?: Record<string, unknown> } | null | undefined): Role | null {
  const r = user?.app_metadata?.role;
  return typeof r === "string" ? (r as Role) : null;
}

/**
 * App-wide client providers: theme + tooltip + the auth→role bridge.
 * The role is read from the verified session's app_metadata and pushed into the
 * (cosmetic) role store; it reacts to login/logout/token-refresh.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient();
    const apply = (user: { app_metadata?: Record<string, unknown> } | null | undefined) => {
      const role = roleFromUser(user);
      if (role) useRole.getState().setRole(role);
      else useRole.getState().clear();
    };

    supabase.auth.getUser().then(({ data: { user } }) => apply(user));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user));

    return () => subscription.unsubscribe();
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
    </ThemeProvider>
  );
}

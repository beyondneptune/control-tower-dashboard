"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Topbar } from "./topbar";
import { SyncHealthBanner } from "./sync-health-banner";
import { MeridianChat } from "@/components/chat/meridian-chat";

export function AuthenticatedShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <Topbar />
        <SyncHealthBanner />
        <main className="flex-1 space-y-5 p-4 md:p-6">{children}</main>
      </SidebarInset>
      {/* Meridian AI — available to every authenticated user on every page */}
      <MeridianChat />
    </SidebarProvider>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  Boxes,
  ClipboardList,
  Factory,
  Gauge,
  HandCoins,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  TriangleAlert,
  Truck,
  Upload,
  UserCog,
  Users,
  Wallet,
  Workflow,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { useRole } from "@/lib/role-store";
import { NAV_GROUPS, visibleNav } from "@/domain/rbac";
import { ROLE_LABELS } from "@/domain/types";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Activity,
  Bell,
  TriangleAlert,
  ClipboardList,
  Factory,
  ShieldCheck,
  Boxes,
  ShoppingCart,
  Truck,
  Wallet,
  HandCoins,
  TrendingUp,
  Landmark,
  Users,
  Upload,
  ScrollText,
  Scale,
  Settings,
  UserCog,
  Workflow,
};

export function AppSidebar() {
  const role = useRole((s) => s.role);
  const pathname = usePathname();
  const nav = visibleNav(role);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-1 py-1.5">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Gauge className="size-4" />
          </div>
          <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">Meridian Control Tower</span>
            <span className="truncate text-xs text-muted-foreground">Meridian Alloys Pvt Ltd</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = nav.filter((n) => n.group === group);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group}>
              <SidebarGroupLabel>{group}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] ?? LayoutDashboard;
                    const active =
                      pathname === item.href ||
                      (item.href !== "/" && pathname.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="flex items-center gap-2 px-1 py-1 text-xs group-data-[collapsible=icon]:hidden">
          <span className="size-2 shrink-0 rounded-full bg-success" />
          <span className="text-muted-foreground">Viewing as</span>
          <span className="truncate font-medium">{ROLE_LABELS[role]}</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

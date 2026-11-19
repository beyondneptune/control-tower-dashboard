"use client";

import { Lock, ShieldAlert, UserCog, Users } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { AS_OF, users } from "@/data";
import { ALL_ROLES, ROLE_LABELS, type Role, type User } from "@/domain/types";
import { canAccess, NAV_ITEMS, SEGREGATION_RULES, type NavItem } from "@/domain/rbac";
import { formatDate, formatNumberIN } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

// ── Derived inline — not exported from @/data ────────────────────────────────

const totalUsers = users.length;
const activeUsers = users.filter((u) => u.active).length;
const rolesInUse = new Set(users.map((u) => u.role)).size;
const auditorCount = users.filter((u) => u.role === "auditor").length;

// ── Component ────────────────────────────────────────────────────────────────

const roleTone: Record<Role, StatusTone> = {
  md: "danger",
  finance: "warning",
  production: "info",
  quality: "info",
  stores: "neutral",
  purchase: "neutral",
  sales: "neutral",
  hr: "neutral",
  auditor: "success",
};

const userColumns: Column<User>[] = [
  {
    key: "name",
    header: "Name",
    render: (u) => <span className="font-medium">{u.name}</span>,
  },
  {
    key: "email",
    header: "Email",
    render: (u) => <span className="text-muted-foreground">{u.email}</span>,
  },
  {
    key: "role",
    header: "Role",
    render: (u) => (
      <StatusPill tone={roleTone[u.role]}>{ROLE_LABELS[u.role]}</StatusPill>
    ),
  },
  {
    key: "active",
    header: "Status",
    render: (u) => (
      <StatusPill tone={u.active ? "success" : "neutral"}>
        {u.active ? "Active" : "Inactive"}
      </StatusPill>
    ),
  },
  {
    key: "actions",
    header: "Actions",
    render: () => (
      <button
        disabled
        className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground opacity-50 cursor-not-allowed"
        title="Maker-checker — enforced in Sprint 2/3"
      >
        Edit role
      </button>
    ),
  },
];

// Access matrix: module rows × role columns
// NAV_ITEMS provides all modules; ALL_ROLES provides all roles
// Subset of roles to display (all 9)
const matrixRoles: Role[] = ALL_ROLES;

interface SegRule {
  role: Role;
  cannot: string;
}

const segregationRuleDescriptions: Record<string, string> = {
  "approve-payments": "approve vendor payments",
  "change-qc-status": "change QC status",
  "approve-own-vendor-payment": "approve their own vendor payment (self-approval)",
  "edit-invoice-value": "edit invoice values",
  "mark-invoice-collected": "mark an invoice as collected",
  "change-job-cost": "change job cost entries",
};

export default function UsersPage() {
  return (
    <PageGuard module="user-management">
      <div className="space-y-5">
        <PageHeader
          title="User &amp; Role Management"
          description={`Access control and role assignments · as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone="info">MD-only module</StatusPill>
            </div>
          }
        />

        {/* KPI strip */}
        <KpiGrid>
          <KpiCard
            label="Total users"
            value={formatNumberIN(totalUsers)}
            tone="neutral"
            icon={<Users className="size-4" />}
            sub="All system accounts"
          />
          <KpiCard
            label="Active"
            value={formatNumberIN(activeUsers)}
            tone="success"
            icon={<UserCog className="size-4" />}
            sub="Currently enabled"
          />
          <KpiCard
            label="Roles in use"
            value={formatNumberIN(rolesInUse)}
            tone="info"
            sub={`Of ${ALL_ROLES.length} defined roles`}
          />
          <KpiCard
            label="Read-only (auditor)"
            value={formatNumberIN(auditorCount)}
            tone="neutral"
            sub="Zero write permissions"
          />
        </KpiGrid>

        {/* Users table */}
        <SectionCard
          title="System users"
          description="All accounts registered in the Control Tower"
          bodyClassName="p-0"
        >
          <DataTable<User>
            columns={userColumns}
            rows={users}
            getRowKey={(u) => u.id}
            empty="No users found."
          />
        </SectionCard>

        {/* Access matrix */}
        <SectionCard
          title="Module access matrix"
          description="Check mark = role can open the module. MD has implicit access to every module."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-card border-b border-r border-border px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap min-w-[180px]">
                    Module
                  </th>
                  {matrixRoles.map((role) => (
                    <th
                      key={role}
                      className="border-b border-r border-border px-2 py-2 text-center font-semibold text-muted-foreground whitespace-nowrap"
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] uppercase tracking-wide">
                          {role === "md"
                            ? "MD"
                            : role === "hr"
                            ? "HR"
                            : role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NAV_ITEMS.map((item: NavItem, rowIdx) => (
                  <tr
                    key={item.key}
                    className={rowIdx % 2 === 0 ? "bg-card" : "bg-muted/30"}
                  >
                    <td className="sticky left-0 z-10 border-b border-r border-border px-3 py-2 font-medium whitespace-nowrap bg-inherit">
                      <span className="text-foreground">{item.label}</span>
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.group}
                      </span>
                    </td>
                    {matrixRoles.map((role) => {
                      const allowed = canAccess(role, item.key);
                      return (
                        <td
                          key={role}
                          className="border-b border-r border-border px-2 py-2 text-center"
                        >
                          {allowed ? (
                            <span
                              className="inline-flex size-5 items-center justify-center rounded-full bg-success-soft text-success"
                              title={`${ROLE_LABELS[role]} can access ${item.label}`}
                            >
                              <svg
                                className="size-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M4.5 12.75l6 6 9-13.5"
                                />
                              </svg>
                            </span>
                          ) : (
                            <span
                              className="inline-block size-1.5 rounded-full bg-muted-foreground/20"
                              title={`${ROLE_LABELS[role]} cannot access ${item.label}`}
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        {/* Segregation of duty rules */}
        <SectionCard
          title="Segregation-of-duty rules"
          description="Hard negative permissions — these actions are blocked regardless of module access"
        >
          <div className="space-y-2">
            {SEGREGATION_RULES.map((rule: SegRule) => (
              <div
                key={`${rule.role}-${rule.cannot}`}
                className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger-soft/40 px-4 py-3"
              >
                <Lock className="mt-0.5 size-4 shrink-0 text-danger" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <StatusPill tone={roleTone[rule.role]}>{ROLE_LABELS[rule.role]}</StatusPill>
                    <span className="ml-2 text-foreground">
                      cannot{" "}
                      <span className="font-semibold">
                        {segregationRuleDescriptions[rule.cannot] ?? rule.cannot}
                      </span>
                    </span>
                  </p>
                </div>
              </div>
            ))}

            <div className="mt-3 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-soft/40 px-4 py-3">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">MD override: </span>
                The MD may override any segregation rule with a mandatory written reason. Every
                override is logged immutably to the audit trail and cannot be deleted or amended.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Role legend */}
        <SectionCard
          title="Role reference"
          description="Defined roles and their access philosophy"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_ROLES.map((role) => (
              <div
                key={role}
                className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
              >
                <StatusPill tone={roleTone[role]} dot={false}>
                  {role === "md"
                    ? "MD"
                    : role === "hr"
                    ? "HR"
                    : role.charAt(0).toUpperCase() + role.slice(1)}
                </StatusPill>
                <span className="text-xs text-muted-foreground">
                  {ROLE_LABELS[role]}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Maker-checker enforcement</span> — role
            assignment changes, new user creation, and role deletions are enforced as maker-checker
            workflows in Sprint 2/3. This screen is display + intent only.
          </p>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

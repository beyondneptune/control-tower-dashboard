"use client";

import { AlertCircle, DollarSign, TrendingUp, Users } from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { KpiCard } from "@/components/kit/kpi-card";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import {
  AS_OF,
  employees,
  payroll,
  payrollPendingTotal,
  employeeName,
} from "@/data";
import type { Employee, Payroll } from "@/domain/types";
import { formatDate, formatINR, formatINRFull, formatNumberIN, formatPercent } from "@/lib/format";
import type { StatusTone } from "@/lib/status";

// ── Annual revenue reference (same constant as mdKpis) ───────────────────────
const ANNUAL_REVENUE = 26_700_000;

// ── Derived KPIs (inline — no dedicated export needed) ───────────────────────

/** Sum of all employee monthly salaries. */
const monthlySalaryTotal: number = employees.reduce(
  (s, e) => s + e.monthlySalary,
  0,
);

/** Sum of all salaryPaid across the current payroll run. */
const paidThisMonth: number = payroll.reduce((s, p) => s + p.salaryPaid, 0);

/** Salary cost as a percentage of annualised revenue. */
const salaryPctRevenue: number =
  ((monthlySalaryTotal * 12) / ANNUAL_REVENUE) * 100;

// ── Department cost rollup (derived inline from employees array) ─────────────

interface DeptRollup {
  department: string;
  headcount: number;
  monthlyCost: number;
}

const deptRollup: DeptRollup[] = (() => {
  const map = new Map<string, DeptRollup>();
  for (const emp of employees) {
    const existing = map.get(emp.department);
    if (existing) {
      existing.headcount += 1;
      existing.monthlyCost += emp.monthlySalary;
    } else {
      map.set(emp.department, {
        department: emp.department,
        headcount: 1,
        monthlyCost: emp.monthlySalary,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.monthlyCost - a.monthlyCost);
})();

// ── Payroll row with balance field ───────────────────────────────────────────

interface PayrollRow extends Payroll {
  employeeNameResolved: string;
  balance: number;
}

const payrollRows: PayrollRow[] = payroll.map((p) => ({
  ...p,
  employeeNameResolved: employeeName(p.employeeId),
  balance: p.salaryDue - p.salaryPaid,
}));

// ── Column definitions ────────────────────────────────────────────────────────

const employeeColumns: Column<Employee>[] = [
  {
    key: "employeeName",
    header: "Name",
    render: (e) => <span className="font-medium">{e.employeeName}</span>,
  },
  {
    key: "department",
    header: "Department",
    render: (e) => (
      <span className="text-muted-foreground">{e.department}</span>
    ),
  },
  {
    key: "role",
    header: "Role",
    render: (e) => <span className="text-muted-foreground">{e.role ?? "—"}</span>,
  },
  {
    key: "monthlySalary",
    header: "Monthly Salary",
    align: "right",
    render: (e) => formatINR(e.monthlySalary, "full"),
  },
  {
    key: "active",
    header: "Status",
    align: "center",
    render: (e) => (
      <StatusPill tone={e.active ? "success" : "neutral"}>
        {e.active ? "Active" : "Inactive"}
      </StatusPill>
    ),
  },
];

const payrollColumns: Column<PayrollRow>[] = [
  {
    key: "employeeName",
    header: "Employee",
    render: (r) => (
      <span className="font-medium">{r.employeeNameResolved}</span>
    ),
  },
  {
    key: "month",
    header: "Month",
    render: (r) => (
      <span className="tabular-nums text-muted-foreground">{r.month}</span>
    ),
  },
  {
    key: "salaryDue",
    header: "Due",
    align: "right",
    render: (r) => formatINR(r.salaryDue, "full"),
  },
  {
    key: "salaryPaid",
    header: "Paid",
    align: "right",
    render: (r) =>
      r.salaryPaid > 0 ? (
        <span className="text-success">{formatINR(r.salaryPaid, "full")}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "balance",
    header: "Balance",
    align: "right",
    render: (r) =>
      r.balance > 0 ? (
        <span className="font-medium text-danger">
          {formatINRFull(r.balance)}
        </span>
      ) : (
        <span className="text-muted-foreground">Nil</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    render: (r) => {
      const tone: StatusTone = r.status === "paid" ? "success" : "warning";
      return <StatusPill tone={tone}>{r.status}</StatusPill>;
    },
  },
  {
    key: "paymentDate",
    header: "Payment Date",
    align: "right",
    render: (r) => (
      <span className="text-muted-foreground tabular-nums">
        {r.paymentDate ? formatDate(r.paymentDate) : "—"}
      </span>
    ),
  },
];

const deptColumns: Column<DeptRollup>[] = [
  {
    key: "department",
    header: "Department",
    render: (d) => <span className="font-medium">{d.department}</span>,
  },
  {
    key: "headcount",
    header: "Headcount",
    align: "right",
    render: (d) => formatNumberIN(d.headcount),
  },
  {
    key: "monthlyCost",
    header: "Monthly Cost",
    align: "right",
    render: (d) => formatINR(d.monthlyCost, "full"),
  },
  {
    key: "avgSalary",
    header: "Avg Salary",
    align: "right",
    render: (d) => formatINR(d.monthlyCost / d.headcount, "full"),
  },
  {
    key: "pctTotal",
    header: "% of Payroll",
    align: "right",
    render: (d) => (
      <span className="text-muted-foreground">
        {formatPercent((d.monthlyCost / monthlySalaryTotal) * 100)}
      </span>
    ),
  },
];

// ── KPI tones ─────────────────────────────────────────────────────────────────

const pendingTotal = payrollPendingTotal();
const pendingTone: StatusTone =
  pendingTotal > 100_000 ? "danger" : pendingTotal > 0 ? "warning" : "success";

const salaryPctTone: StatusTone =
  salaryPctRevenue > 15 ? "danger" : salaryPctRevenue > 10 ? "warning" : "success";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PeoplePayrollPage() {
  return (
    <PageGuard module="people-payroll">
      <div className="space-y-5">
        <PageHeader
          title="People & Payroll"
          description={`Meridian Alloys Pvt Ltd · ${formatNumberIN(employees.length)} employees · as of ${formatDate(AS_OF)}`}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill tone={pendingTone}>
                {formatINR(pendingTotal)} pending
              </StatusPill>
              <StatusPill tone="neutral">
                Payroll release: Sprint 3
              </StatusPill>
            </div>
          }
        />

        {/* KPIs */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Payroll Summary — May 2026
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Monthly Salary Bill"
              value={formatINR(monthlySalaryTotal)}
              tone="neutral"
              icon={<Users className="size-4" />}
              sub={`${formatNumberIN(employees.length)} employees on roll`}
            />
            <KpiCard
              label="Paid This Month"
              value={formatINR(paidThisMonth)}
              tone="success"
              icon={<DollarSign className="size-4" />}
              sub={`${payroll.filter((p) => p.status === "paid").length} of ${payroll.length} employees`}
            />
            <KpiCard
              label="Pending Payment"
              value={formatINR(pendingTotal)}
              tone={pendingTone}
              icon={<AlertCircle className="size-4" />}
              sub={`${payroll.filter((p) => p.status !== "paid").length} employees awaiting release`}
            />
            <KpiCard
              label="Salary % of Revenue"
              value={formatPercent(salaryPctRevenue)}
              tone={salaryPctTone}
              icon={<TrendingUp className="size-4" />}
              sub={`Annualised vs ₹2.67 Cr FY25-26 revenue`}
            />
          </div>
        </section>

        {/* Employee roster + department rollup side-by-side on xl */}
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <SectionCard
              title="Employee Roster"
              description="All staff on payroll — active status"
              bodyClassName="p-0"
            >
              <DataTable
                columns={employeeColumns}
                rows={employees}
                getRowKey={(e) => e.id}
                empty="No employees found."
              />
            </SectionCard>
          </div>

          <div className="xl:col-span-1">
            <SectionCard
              title="Department Cost Rollup"
              description="Monthly salary bill by department"
              bodyClassName="p-0"
            >
              <DataTable
                columns={deptColumns}
                rows={deptRollup}
                getRowKey={(d) => d.department}
                empty="No department data."
              />
            </SectionCard>
          </div>
        </section>

        {/* Payroll register */}
        <SectionCard
          title="Payroll Register — May 2026"
          description="Salary due, paid, and balance per employee"
          action={
            <div className="flex items-center gap-1.5 rounded-lg border border-warning/35 bg-warning-soft px-3 py-1.5 text-xs text-amber-700 dark:text-amber-300">
              <AlertCircle className="size-3.5 shrink-0" />
              Payroll release is a maker-checker action — enforced in Sprint 3
            </div>
          }
          bodyClassName="p-0"
        >
          <DataTable
            columns={payrollColumns}
            rows={payrollRows}
            getRowKey={(r) => r.id}
            empty="No payroll records."
          />
        </SectionCard>

        {/* Governance note */}
        <SectionCard
          title="Payroll Governance"
          description="Maker-checker enforcement — Sprint 3 roadmap"
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Payroll release (<code className="rounded bg-muted px-1 py-0.5 text-xs">payroll-release</code>) is a{" "}
              <span className="font-medium text-foreground">sensitive action</span> under the control tower&rsquo;s
              segregation-of-duty rules. The HR Admin prepares the run; Finance or MD approves and releases
              payment. No single user may both prepare and approve the same payroll cycle.
            </p>
            <p>
              Sprint 3 will enforce this via server actions with a mandatory two-step approval flow.
              Until then, the page is display-only — all release buttons are intentionally absent from the UI.
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Maker</p>
                <p className="mt-0.5 font-medium text-foreground">HR / Admin</p>
                <p className="text-xs">Prepares payroll run, enters attendance deductions</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Checker</p>
                <p className="mt-0.5 font-medium text-foreground">Finance</p>
                <p className="text-xs">Verifies amounts against employment contracts</p>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Releaser</p>
                <p className="mt-0.5 font-medium text-foreground">MD or Finance Head</p>
                <p className="text-xs">Approves bank transfer; triggers UTR recording</p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

/**
 * Role-based access control — the authorization contract.
 *
 * Sprint 1 uses this for nav visibility and UI gating with a client-side role
 * switcher (demo). Sprint 2/3 reuses the SAME matrix server-side (Supabase RLS
 * + server actions) so the boundary is enforced, not merely hidden. Treat this
 * file as the canonical permission map for both layers.
 */

import type { Role } from "./types";

export type ModuleKey =
  | "md-dashboard"
  | "workspace"
  | "insights"
  | "predictive-risk"
  | "validation"
  | "cash"
  | "orders-jobs"
  | "production"
  | "quality"
  | "stores"
  | "purchase"
  | "dispatch-billing"
  | "collections"
  | "job-profitability"
  | "bank-debt"
  | "people-payroll"
  | "alerts"
  | "uploads"
  | "email-review"
  | "audit-log"
  | "settings"
  | "user-management"
  // Phase 1B registers
  | "ops-order-flow"
  | "ct-order-flow"
  | "ops-rfq-confirm"
  | "ops-daily-wip"
  | "ops-rfq"
  | "ops-quotation"
  | "ops-customer-po"
  | "ops-job"
  | "ops-qc"
  | "ops-production-docs"
  | "ops-dispatch"
  | "ops-invoice"
  | "ops-link-quotes"
  | "ct-rfq"
  | "ct-quotation"
  | "ct-customer-po"
  | "ct-job"
  | "ct-daily-wip"
  | "ct-material"
  | "ct-vendor-subcontract"
  | "ct-qc"
  | "ct-dispatch"
  | "ct-collection-followup"
  | "ct-exports"
  | "ct-files"
  // Engineering (research — drawings + costing, not the RFQ→dispatch flow)
  | "engineering-drawings"
  | "engineering-costing"
  | "engineering-benchmarks"
  | "engineering-audit"
  | "engineering-cost-gate"
  | "engineering-margin"
  | "engineering-pricing"
  | "engineering-strategy"
  | "thread-archive";

export interface NavItem {
  key: ModuleKey;
  label: string;
  /** lucide-react icon name. */
  icon: string;
  href: string;
  /** Roles allowed to open the module. MD is implicitly always allowed. */
  roles: Role[];
  group: "Command" | "Operations" | "Finance" | "Engineering" | "Governance" | "Admin" | "Legacy" | "Archived";
}

/**
 * Module access. MD is appended to every list automatically by `canAccess`,
 * so MD has master access without being repeated here.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: "md-dashboard", label: "MD Dashboard", icon: "LayoutDashboard", href: "/", roles: [], group: "Command" },
  { key: "workspace", label: "My Workspace", icon: "Inbox", href: "/workspace", roles: ["finance", "sales", "production", "quality", "stores", "purchase"], group: "Command" },
  { key: "insights", label: "Insight Feed", icon: "Bell", href: "/insights", roles: ["finance", "sales", "production"], group: "Command" },
  { key: "predictive-risk", label: "Risk Radar", icon: "Gauge", href: "/risk", roles: ["finance", "sales", "production"], group: "Command" },
  { key: "validation", label: "PO ↔ Quote Validation", icon: "Link2", href: "/validation", roles: ["finance", "sales"], group: "Command" },

  // ── Operations — the CLEAN order flow, SSOT only (ops_* tables/views) ──────
  //  RFQ → BOM → Quote → PO → Job → QC → Dispatch → Invoice
  { key: "ops-order-flow", label: "Operations Board", icon: "LayoutDashboard", href: "/operations/order-flow", roles: ["sales", "production", "finance"], group: "Operations" },
  { key: "ops-rfq", label: "RFQ", icon: "ClipboardList", href: "/operations/registers/rfq", roles: ["sales", "production"], group: "Operations" },
  { key: "ops-rfq-confirm", label: "RFQ Confirm", icon: "ClipboardList", href: "/operations/rfq-confirm", roles: ["sales", "production"], group: "Operations" },
  { key: "ops-quotation", label: "Quotations", icon: "TrendingUp", href: "/operations/registers/quotations", roles: ["sales", "finance"], group: "Operations" },
  { key: "ops-customer-po", label: "Customer POs", icon: "ShoppingCart", href: "/operations/registers/customer-pos", roles: ["finance", "sales", "production"], group: "Operations" },
  { key: "ops-link-quotes", label: "Link Quote ↔ PO", icon: "Scale", href: "/operations/link-quotes", roles: ["finance", "sales"], group: "Operations" },
  { key: "ops-job", label: "Jobs", icon: "Factory", href: "/operations/jobs", roles: ["production", "sales"], group: "Operations" },
  { key: "ops-daily-wip", label: "Daily WIP", icon: "Activity", href: "/operations/daily-wip", roles: ["production"], group: "Operations" },
  { key: "ops-qc", label: "QC / Weld Reports", icon: "ShieldCheck", href: "/operations/registers/qc", roles: ["quality", "production"], group: "Operations" },
  { key: "ops-production-docs", label: "Job / Route / FIR", icon: "ScrollText", href: "/operations/registers/production-docs", roles: ["quality", "production"], group: "Operations" },
  { key: "ops-dispatch", label: "Dispatch", icon: "Truck", href: "/operations/registers/dispatch", roles: ["production", "finance", "sales"], group: "Operations" },
  { key: "ops-invoice", label: "Invoices", icon: "HandCoins", href: "/operations/registers/invoices", roles: ["finance", "sales"], group: "Operations" },

  // ── Legacy Operations — old ct_ registers (email/inferred); retire when trusted ──
  { key: "ct-order-flow", label: "Order Flow (old)", icon: "Workflow", href: "/order-flow", roles: ["sales", "production", "finance"], group: "Legacy" },
  { key: "ct-rfq", label: "RFQ Register (old)", icon: "ClipboardList", href: "/registers/rfq", roles: ["sales", "production"], group: "Legacy" },
  { key: "ct-quotation", label: "Quotation Register (old)", icon: "TrendingUp", href: "/registers/quotation", roles: ["sales", "finance"], group: "Legacy" },
  { key: "ct-customer-po", label: "Customer PO (old)", icon: "ShoppingCart", href: "/registers/customer-po", roles: ["finance", "sales", "production"], group: "Legacy" },
  { key: "ct-job", label: "Job Master (old)", icon: "Factory", href: "/registers/job", roles: ["production", "sales"], group: "Legacy" },
  { key: "ct-material", label: "Material / Shortage", icon: "Boxes", href: "/registers/material", roles: ["stores", "production"], group: "Legacy" },
  { key: "ct-vendor-subcontract", label: "Vendor / Subcontracting", icon: "ShoppingCart", href: "/registers/vendor-subcontract", roles: ["purchase", "production"], group: "Legacy" },
  { key: "ct-daily-wip", label: "Daily WIP (old)", icon: "Activity", href: "/registers/daily-wip", roles: ["production"], group: "Legacy" },
  { key: "ct-qc", label: "QC / NCR (old)", icon: "ShieldCheck", href: "/registers/qc", roles: ["quality", "production"], group: "Legacy" },
  { key: "ct-dispatch", label: "Dispatch (old)", icon: "Truck", href: "/registers/dispatch", roles: ["production", "finance", "sales"], group: "Legacy" },

  { key: "cash", label: "Cash Control", icon: "Wallet", href: "/cash", roles: ["finance"], group: "Finance" },
  { key: "ct-collection-followup", label: "Collection Follow-up", icon: "HandCoins", href: "/registers/collection-followup", roles: ["finance"], group: "Finance" },
  { key: "job-profitability", label: "Job Profitability", icon: "TrendingUp", href: "/job-profitability", roles: ["finance", "auditor"], group: "Finance" },
  { key: "bank-debt", label: "Bank & Debt", icon: "Landmark", href: "/bank-debt", roles: ["finance", "auditor"], group: "Finance" },
  { key: "people-payroll", label: "People & Payroll", icon: "Users", href: "/people-payroll", roles: ["hr", "finance"], group: "Finance" },

  // ── Engineering — research on the company's two life-establishing documents ──
  { key: "engineering-drawings", label: "Drawings", icon: "Factory", href: "/engineering/drawings", roles: ["production", "quality", "finance"], group: "Engineering" },
  { key: "engineering-costing", label: "Costing (BOM)", icon: "TrendingUp", href: "/engineering/costing", roles: ["production", "finance", "quality"], group: "Engineering" },
  { key: "engineering-benchmarks", label: "Best Practice", icon: "ScrollText", href: "/engineering/benchmarks", roles: ["production", "finance", "quality"], group: "Engineering" },
  { key: "engineering-audit", label: "Audit (verdicts)", icon: "ShieldCheck", href: "/engineering/audit", roles: ["production", "finance", "quality"], group: "Engineering" },
  { key: "engineering-cost-gate", label: "Cost Gate", icon: "Wallet", href: "/engineering/cost-gate", roles: ["finance", "production", "sales"], group: "Engineering" },
  { key: "engineering-margin", label: "Margin", icon: "TrendingUp", href: "/engineering/margin", roles: ["finance", "sales", "production"], group: "Engineering" },
  { key: "engineering-pricing", label: "Price Consistency", icon: "Scale", href: "/engineering/pricing", roles: ["finance", "sales", "production"], group: "Engineering" },
  { key: "engineering-strategy", label: "Strategy", icon: "TrendingUp", href: "/engineering/strategy", roles: ["finance", "sales", "production"], group: "Engineering" },

  // /uploads maps to this module in middleware; without a NAV_ITEMS entry canAccess()
  // returned false and blocked the intended uploaders (finance/production). Same class as
  // the commercial-review fix above (M-24 / Codex #13). Cards are GST/bank/ledger/job uploads.
  { key: "uploads", label: "Data Uploads", icon: "Upload", href: "/uploads", roles: ["finance", "production"], group: "Governance" },
  { key: "ct-files", label: "Files / Evidence", icon: "Upload", href: "/ct-files", roles: ["finance", "production", "quality", "stores", "purchase", "sales", "hr", "auditor"], group: "Governance" },
  { key: "ct-exports", label: "Exports", icon: "ScrollText", href: "/ct-exports", roles: ["finance", "production", "quality", "stores", "purchase", "sales", "hr", "auditor"], group: "Governance" },
  { key: "audit-log", label: "Audit Log", icon: "ScrollText", href: "/audit-log", roles: ["auditor"], group: "Governance" },

  { key: "settings", label: "Settings / Masters", icon: "Settings", href: "/settings", roles: [], group: "Admin" },
  { key: "user-management", label: "User & Role Management", icon: "UserCog", href: "/users", roles: [], group: "Admin" },

  // ── Archived experimental evidence (NOT operational truth) ─────────────────
  { key: "thread-archive", label: "Thread Validation (archived)", icon: "ScrollText", href: "/threads/validation", roles: ["auditor"], group: "Archived" },
  { key: "email-review", label: "Email Review (archived)", icon: "ScrollText", href: "/email-review", roles: ["auditor"], group: "Archived" },
];

export const NAV_GROUPS: NavItem["group"][] = ["Command", "Operations", "Finance", "Engineering", "Governance", "Admin", "Legacy", "Archived"];

/** Whether a role can open a module. MD can open everything. */
export function canAccess(role: Role, moduleKey: ModuleKey): boolean {
  if (role === "md") return true;
  const item = NAV_ITEMS.find((n) => n.key === moduleKey);
  if (!item) return false;
  return item.roles.includes(role);
}

/** Nav items visible to a role, in declared order. */
export function visibleNav(role: Role): NavItem[] {
  return NAV_ITEMS.filter((n) => canAccess(role, n.key));
}

// ── Capabilities & maker-checker contract ───────────────────────────────────

/**
 * Sensitive actions that require maker-checker or MD approval before they take
 * effect. Sprint 3 enforces these in server actions; listed here so UI can show
 * "needs approval" affordances consistently.
 */
export type SensitiveAction =
  | "vendor-payment"
  | "margin-below-20"
  | "material-over-estimate-10"
  | "invoice-cancellation"
  | "related-party-txn"
  | "bank-loan-payment"
  | "payroll-release"
  | "record-deletion"
  | "md-override";

export const APPROVAL_REQUIRED: Record<SensitiveAction, string> = {
  "vendor-payment": "Vendor payment requires a checker different from the maker.",
  "margin-below-20": "Job below 20% expected margin requires MD approval.",
  "material-over-estimate-10": "Material issue exceeding estimate by >10% requires approval.",
  "invoice-cancellation": "Invoice cancellation requires MD approval.",
  "related-party-txn": "Related-party transaction must be tagged and approved.",
  "bank-loan-payment": "Bank loan payment requires maker-checker.",
  "payroll-release": "Payroll release requires approval.",
  "record-deletion": "Deletion requires MD / admin approval.",
  "md-override": "MD override requires a mandatory reason.",
};

/**
 * Hard separation-of-duty rules (negative permissions). These are checked in
 * addition to module access; they encode the brief's "X cannot do Y" rules.
 */
export const SEGREGATION_RULES: { role: Role; cannot: string }[] = [
  { role: "production", cannot: "approve-payments" },
  { role: "finance", cannot: "change-qc-status" },
  { role: "purchase", cannot: "approve-own-vendor-payment" },
  { role: "stores", cannot: "edit-invoice-value" },
  { role: "sales", cannot: "mark-invoice-collected" },
  { role: "quality", cannot: "change-job-cost" },
];

/** Read-only roles never mutate. */
export function isReadOnly(role: Role): boolean {
  return role === "auditor";
}

/**
 * The landing route for each role. MD lands on the command centre ("/"); every
 * other role lands on its primary module. The home page redirects non-MD roles
 * here so nobody hits the MD-only dashboard.
 */
export const HOME_ROUTE: Record<Role, string> = {
  md: "/",
  finance: "/cash",
  production: "/workspace",                  // was /production (legacy)
  quality: "/registers/qc",                  // was /quality (legacy)
  stores: "/registers/material",             // was /stores (legacy)
  purchase: "/registers/vendor-subcontract", // was /purchase (legacy)
  sales: "/registers/customer-po",           // was /orders-jobs (legacy)
  hr: "/people-payroll",
  auditor: "/job-profitability",
};

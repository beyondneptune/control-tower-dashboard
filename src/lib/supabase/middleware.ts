import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, HOME_ROUTE, type ModuleKey } from "@/domain/rbac";
import type { Role } from "@/domain/types";

const roles = new Set<Role>([
  "md",
  "finance",
  "production",
  "quality",
  "stores",
  "purchase",
  "sales",
  "hr",
  "auditor",
]);

const routeModules: { prefix: string; module: ModuleKey }[] = [
  { prefix: "/", module: "md-dashboard" },
  { prefix: "/orders-jobs", module: "orders-jobs" },
  { prefix: "/production", module: "production" },
  { prefix: "/quality", module: "quality" },
  { prefix: "/stores", module: "stores" },
  { prefix: "/purchase", module: "purchase" },
  { prefix: "/dispatch-billing", module: "dispatch-billing" },
  { prefix: "/cash", module: "cash" },
  { prefix: "/collections", module: "collections" },
  { prefix: "/job-profitability", module: "job-profitability" },
  { prefix: "/bank-debt", module: "bank-debt" },
  { prefix: "/people-payroll", module: "people-payroll" },
  { prefix: "/uploads", module: "uploads" },
  { prefix: "/audit-log", module: "audit-log" },
  { prefix: "/settings", module: "settings" },
  { prefix: "/users", module: "user-management" },
  // Phase 1B register routes
  { prefix: "/registers/rfq", module: "ct-rfq" },
  { prefix: "/registers/quotation", module: "ct-quotation" },
  { prefix: "/registers/customer-po", module: "ct-customer-po" },
  { prefix: "/registers/job", module: "ct-job" },
  { prefix: "/registers/daily-wip", module: "ct-daily-wip" },
  { prefix: "/registers/material", module: "ct-material" },
  { prefix: "/registers/vendor-subcontract", module: "ct-vendor-subcontract" },
  { prefix: "/registers/qc", module: "ct-qc" },
  { prefix: "/registers/dispatch", module: "ct-dispatch" },
  { prefix: "/registers/collection-followup", module: "ct-collection-followup" },
  { prefix: "/ct-exports", module: "ct-exports" },
  { prefix: "/ct-files", module: "ct-files" },
  { prefix: "/threads", module: "thread-archive" },
  { prefix: "/workspace", module: "workspace" },
  { prefix: "/insights", module: "insights" },
  { prefix: "/risk", module: "predictive-risk" },
  { prefix: "/validation", module: "validation" },
  // Pages that fetch with the service-role admin client in the server component
  // MUST be gated here (the client-side PageGuard runs after data is fetched).
  { prefix: "/email-review", module: "email-review" },
  { prefix: "/wa-review", module: "ct-qc" },
  { prefix: "/order-book", module: "ct-customer-po" },
  { prefix: "/commercial-pipeline", module: "validation" },
  { prefix: "/finance/bill-wise-gap", module: "cash" },
  { prefix: "/finance/data-quality", module: "cash" },
  { prefix: "/engineering/drawings", module: "engineering-drawings" },
  { prefix: "/engineering/costing", module: "engineering-costing" },
  { prefix: "/engineering/benchmarks", module: "engineering-benchmarks" },
  { prefix: "/engineering/audit", module: "engineering-audit" },
  { prefix: "/engineering/cost-gate", module: "engineering-cost-gate" },
  { prefix: "/engineering/margin", module: "engineering-margin" },
  { prefix: "/engineering/pricing", module: "engineering-pricing" },
  { prefix: "/engineering/strategy", module: "engineering-strategy" },
];

function roleFromMetadata(value: unknown): Role | null {
  return typeof value === "string" && roles.has(value as Role) ? (value as Role) : null;
}

function moduleForPath(pathname: string): ModuleKey | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") return "md-dashboard";
  const match = routeModules
    .filter(({ prefix }) => prefix !== "/")
    .find(({ prefix }) => normalized === prefix || normalized.startsWith(`${prefix}/`));
  return match?.module ?? null;
}

/**
 * Refreshes the Supabase auth token on every request and gates access.
 *
 * CRITICAL: refreshed cookies are written to BOTH `request.cookies` (so the
 * rebuilt response carries them) AND `supabaseResponse.cookies`. Writing only
 * one causes the well-known "Auth session missing / random logout" desync.
 * Do NOT run code between createServerClient() and getUser().
 *
 * NOTE: this is the page-level gate. The database remains the real data boundary:
 * every server action / route handler that touches money must still re-check
 * getUser() and rely on RLS.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic =
    pathname === "/login" ||
    pathname === "/auth/signout" ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const role = roleFromMetadata(user.app_metadata?.role);
    if (!role) {
      return new NextResponse("Forbidden: account has no valid app role.", { status: 403 });
    }

    const routeModule = moduleForPath(pathname);
    if (routeModule && !canAccess(role, routeModule)) {
      const url = request.nextUrl.clone();
      url.pathname = HOME_ROUTE[role];
      return NextResponse.redirect(url);
    }
  }

  // Already signed in but sitting on /login → send to the dashboard.
  if (user && pathname === "/login") {
    const role = roleFromMetadata(user.app_metadata?.role);
    if (!role) {
      return new NextResponse("Forbidden: account has no valid app role.", { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = HOME_ROUTE[role];
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

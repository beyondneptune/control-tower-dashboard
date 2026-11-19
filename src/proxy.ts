import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next.js 16: this file is `proxy.ts` and the export is `proxy`
// (the old `middleware.ts` / `middleware` convention is deprecated in v16).
// Runs on the Node.js runtime by default — do not set a `runtime` option here.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Everything except static assets and the /supabase/* proxy path (which
    // rewrites to the local Supabase stack — must bypass our auth gate so
    // the browser can call /supabase/auth/v1/token to log in).
    "/((?!supabase/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

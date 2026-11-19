import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'self'",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Same-origin only: Supabase is proxied via /supabase/* rewrites below,
  // so the browser sees one origin and CSP just needs 'self'.
  "connect-src 'self' ws: wss:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Pin the workspace root — two lockfiles exist (~/ and the project), and
  // Turbopack would otherwise infer the wrong one. cwd = project dir at runtime.
  turbopack: { root: process.cwd() },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Same-origin proxy for the local self-hosted Supabase stack. Browser hits
  // /supabase/auth/v1/token → this Next.js server forwards to local Supabase
  // on 127.0.0.1:54321. Avoids cross-port CORS + CSP issues entirely.
  async rewrites() {
    return [
      {
        source: "/supabase/:path*",
        destination: "http://127.0.0.1:54321/:path*",
      },
    ];
  },
};

export default nextConfig;

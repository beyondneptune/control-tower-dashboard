"use client";

import { useEffect, useState } from "react";
import { StatusPill } from "@/components/kit/status-pill";
import type { StatusTone } from "@/lib/status";

// Authoritative, per-stream Tally freshness pill.
//
// Reads the SAME source as the global <SyncHealthBanner> (/api/sync-health →
// v_ct_sync_health) so every finance surface agrees on freshness — never a
// page-local guess (M-27: a derived/labelled surface must inherit the freshness
// of its real source, and headline by its WEAKEST input). This replaces the
// hardcoded green "LIVE from Tally · as of <today>" labels that asserted live
// data even while Tally was DOWN — a confident-wrong claim on a finance screen.
//
// It never shows a false "LIVE": before the status loads it shows a neutral
// "checking sync…"; if the requested stream isn't tracked it shows "sync
// unknown"; only a genuinely-FRESH stream renders the green LIVE pill.

type Stream = {
  stream: string;
  status: string;
  age_min: number | null;
  last_success: string | null;
  last_error: string | null;
};

const RANK: Record<string, number> = { DOWN: 3, NONE: 2, STALE: 1, FRESH: 0 };

const fmtAge = (m: number | null) =>
  m == null ? "—" : m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;

const fmtWhen = (iso: string | null) => {
  if (!iso) return "never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

export function TallyFreshness({ streams }: { streams: string | string[] }) {
  const want = Array.isArray(streams) ? streams : [streams];
  const [rows, setRows] = useState<Stream[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/sync-health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setRows((d.streams ?? []) as Stream[]);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (rows == null) {
    return (
      <StatusPill tone="neutral" dot>
        checking sync…
      </StatusPill>
    );
  }

  // Headline by the WEAKEST matching stream (DOWN beats STALE beats FRESH).
  const worst =
    rows
      .filter((s) => want.includes(s.stream))
      .sort((a, b) => (RANK[b.status] ?? 0) - (RANK[a.status] ?? 0))[0] ?? null;

  if (!worst) {
    return (
      <StatusPill tone="neutral" dot>
        sync unknown
      </StatusPill>
    );
  }

  const tone: StatusTone =
    worst.status === "FRESH" ? "success" : worst.status === "STALE" ? "warning" : "danger";
  const label =
    worst.status === "FRESH"
      ? "LIVE"
      : worst.status === "STALE"
        ? "TALLY STALE"
        : worst.status === "DOWN"
          ? "TALLY SYNC DOWN"
          : "NO SYNC";
  const when = fmtWhen(worst.last_success);
  const detail =
    worst.status === "FRESH"
      ? `live from Tally · as of ${when}`
      : `last good Tally sync ${when} · ${fmtAge(worst.age_min)} behind${
          worst.status === "DOWN" ? " · Tally unreachable" : ""
        }`;

  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
      <StatusPill tone={tone} dot>
        {label}
      </StatusPill>
      <span className="hidden sm:inline">{detail}</span>
    </span>
  );
}

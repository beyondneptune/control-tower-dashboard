"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type Stream = { stream: string; status: string; age_min: number | null; last_success: string | null; last_error: string | null };
type Health = { streams: Stream[]; summary: { unhealthy_streams: number; any_down: boolean; worst_age_min: number | null } | null };

const fmtAge = (m: number | null) => (m == null ? "—" : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`);

// Global freshness strip. Polls every 60s. Shows a red/amber bar whenever any
// Tally stream is stale or down, so management never sees stale finance data
// without knowing it. Silent (renders nothing) only when everything is FRESH.
export function SyncHealthBanner() {
  const [h, setH] = useState<Health | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/sync-health", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setH(d); })
        .catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!h?.summary || h.summary.unhealthy_streams === 0) return null;

  const down = h.summary.any_down;
  const bad = h.streams.filter((s) => ["STALE", "DOWN", "NONE"].includes(s.status));
  const worst = bad.sort((a, b) => (b.age_min ?? 0) - (a.age_min ?? 0))[0];
  const reason = worst?.last_error?.slice(0, 90);

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-1.5 text-xs md:px-4 ${
        down ? "bg-red-600 text-white" : "bg-amber-500 text-black"
      }`}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <AlertTriangle className="size-3.5" />
        {down ? "Tally sync DOWN" : "Finance data is stale"}
      </span>
      <span>
        {h.summary.unhealthy_streams} stream{h.summary.unhealthy_streams === 1 ? "" : "s"} affected · oldest{" "}
        <b>{fmtAge(h.summary.worst_age_min)}</b> behind
      </span>
      <span className="opacity-90">
        {bad.map((s) => `${s.stream} (${s.status}, ${fmtAge(s.age_min)})`).join(" · ")}
      </span>
      {reason && <span className="opacity-90">— {reason}{down ? " · check Tally is open on the PIPL machine" : ""}</span>}
    </div>
  );
}

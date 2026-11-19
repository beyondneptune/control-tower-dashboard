"use client";

import { useState } from "react";

export function ExportButtons({ registerKey, filters }: { registerKey: string; filters?: Record<string, string> }) {
  const [busy, setBusy] = useState<string | null>(null);

  async function go(format: "csv" | "xlsx") {
    setBusy(format);
    try {
      const res = await fetch("/api/ct-export", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ register: registerKey, format, filters: filters ?? {} }),
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disp = res.headers.get("content-disposition") || "";
      const m = /filename="([^"]+)"/.exec(disp);
      a.download = m?.[1] || `${registerKey}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => go("csv")}
        disabled={busy !== null}
        className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
      >
        {busy === "csv" ? "…" : "Export CSV"}
      </button>
      <button
        onClick={() => go("xlsx")}
        disabled={busy !== null}
        className="rounded-md border px-2 py-1 text-xs hover:bg-accent disabled:opacity-60"
      >
        {busy === "xlsx" ? "…" : "Export XLSX"}
      </button>
    </div>
  );
}

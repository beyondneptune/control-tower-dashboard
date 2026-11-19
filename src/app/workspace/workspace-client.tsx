"use client";
import { useState, useTransition } from "react";
import { recordAction } from "./actions";

export interface Exception {
  ex_type: string;
  severity: string;
  owner_role: string;
  ref: string;
  customer: string | null;
  subject: string | null;
  title: string;
  value_at_risk: number | null;
  suggested_action: string;
}

const sevTone: Record<string, string> = {
  high: "border-red-500/40 bg-red-500/5",
  medium: "border-amber-500/40 bg-amber-500/5",
  low: "border-border bg-card",
};
const fmt = (n: number | null) => (n == null ? null : "₹" + Number(n).toLocaleString("en-IN"));

export function WorkspaceQueue({ exceptions }: { exceptions: Exception[] }) {
  // group by type so the human works a batch at a time
  const groups = exceptions.reduce<Record<string, Exception[]>>((acc, e) => {
    (acc[e.ex_type] ??= []).push(e);
    return acc;
  }, {});
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([type, items]) => (
        <div key={type} className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">
            {type.replace(/_/g, " ")} <span className="text-muted-foreground">· {items.length}</span>
          </div>
          <div className="divide-y">
            {items.map((e) => <Row key={e.ex_type + e.ref} e={e} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ e }: { e: Exception }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  function act(action: "approve" | "reject" | "comment") {
    start(async () => {
      await recordAction({ ex_type: e.ex_type, ref: e.ref, owner_role: e.owner_role, action, comment: comment || undefined });
      setDone(action);
    });
  }
  const v = fmt(e.value_at_risk);

  return (
    <div className={`flex flex-col gap-2 px-4 py-3 text-sm ${done ? "opacity-50" : ""} ${sevTone[e.severity] ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{e.title}</span>
          {v && <span className="ml-2 rounded bg-foreground/10 px-1.5 py-0.5 text-xs tabular-nums">{v}</span>}
          <div className="text-xs text-muted-foreground">
            {e.customer} · {e.subject} · <span className="font-mono">{e.ref}</span>
          </div>
          <div className="text-xs text-muted-foreground">→ {e.suggested_action}</div>
        </div>
        <div className="flex items-center gap-1">
          {done ? (
            <span className="rounded bg-emerald-500/15 px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400">{done}ed ✓</span>
          ) : (
            <>
              <button onClick={() => act("approve")} disabled={pending}
                className="rounded bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700">Approve</button>
              <button onClick={() => act("reject")} disabled={pending}
                className="rounded border px-2.5 py-1 text-xs hover:bg-muted">Reject</button>
              <button onClick={() => setShowComment((s) => !s)} disabled={pending}
                className="rounded border px-2.5 py-1 text-xs hover:bg-muted">Comment</button>
            </>
          )}
        </div>
      </div>
      {showComment && !done && (
        <div className="flex gap-2">
          <input value={comment} onChange={(ev) => setComment(ev.target.value)} placeholder="comment…"
            className="w-full rounded-md border bg-background px-2 py-1 text-xs" />
          <button onClick={() => act("comment")} disabled={pending || !comment}
            className="rounded border px-2.5 py-1 text-xs hover:bg-muted">Save</button>
        </div>
      )}
    </div>
  );
}

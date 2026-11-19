interface AuditRow {
  id: number | string;
  at: string;
  actor_email: string | null;
  action: string;
  new_values: unknown;
}

export function AuditTrail({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) {
    return <div className="text-sm text-muted-foreground">No audit entries yet.</div>;
  }
  return (
    <ol className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.id} className="rounded border bg-card p-2">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">{r.action}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(r.at).toLocaleString()} · {r.actor_email ?? "(system)"}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

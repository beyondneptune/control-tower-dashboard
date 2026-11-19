"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CtRegister } from "@/lib/ct-registers";

interface Customer { id: string; customer_name: string; }
interface Vendor { id: string; vendor_name: string; }
interface JobOpt { id: string; job_code: string; }

interface Props {
  register: CtRegister;
  initial?: Record<string, unknown>;
  customers: Customer[];
  vendors: Vendor[];
  jobs: JobOpt[];
  recordId?: string;
}

export function RegisterForm({ register, initial, customers, vendors, jobs, recordId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, unknown>>(() => initial ?? {});
  const [error, setError] = useState<string | null>(null);

  function setField(name: string, v: unknown) {
    setValues((p) => ({ ...p, [name]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/ct-register/${register.key}${recordId ? `/${recordId}` : ""}`, {
        method: recordId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error || `Save failed (${res.status})`);
        return;
      }
      const j = await res.json();
      router.push(`/registers/${register.key}/${j.id}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {register.fields.map((f) => {
          if (f.showInForm === false) return null;
          const v = values[f.name];
          return (
            <label key={f.name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {f.label}
                {f.required && <span className="text-destructive">*</span>}
              </span>
              {f.type === "textarea" && (
                <textarea
                  className="min-h-[60px] rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                />
              )}
              {f.type === "select" && (
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  required={f.required}
                >
                  <option value="">—</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
              {f.type === "boolean" && (
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={v === true ? "true" : v === false ? "false" : ""}
                  onChange={(e) => setField(f.name, e.target.value === "true" ? true : e.target.value === "false" ? false : null)}
                >
                  <option value="">—</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              )}
              {f.type === "customer" && (
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  required={f.required}
                >
                  <option value="">—</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.customer_name}</option>
                  ))}
                </select>
              )}
              {f.type === "vendor" && (
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  required={f.required}
                >
                  <option value="">—</option>
                  {vendors.map((vd) => (
                    <option key={vd.id} value={vd.id}>{vd.vendor_name}</option>
                  ))}
                </select>
              )}
              {f.type === "job" && (
                <select
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  required={f.required}
                >
                  <option value="">—</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.job_code}</option>
                  ))}
                </select>
              )}
              {(f.type === "text") && (
                <input
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value)}
                  required={f.required}
                />
              )}
              {(f.type === "number" || f.type === "currency") && (
                <input
                  type="number"
                  step="any"
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as number) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value === "" ? null : Number(e.target.value))}
                  required={f.required}
                />
              )}
              {f.type === "date" && (
                <input
                  type="date"
                  className="rounded-md border bg-background px-2 py-1"
                  value={(v as string) ?? ""}
                  onChange={(e) => setField(f.name, e.target.value || null)}
                  required={f.required}
                />
              )}
              {f.hint && <span className="text-xs text-muted-foreground">{f.hint}</span>}
            </label>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : recordId ? "Update" : "Create"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

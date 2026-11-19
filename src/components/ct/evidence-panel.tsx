"use client";

import { useState, useRef } from "react";

interface FileRec {
  id: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
}

interface Props {
  register: string;
  recordId: string;
  files: FileRec[];
}

export function EvidencePanel({ register, recordId, files: initial }: Props) {
  const [files, setFiles] = useState<FileRec[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("register", register);
      fd.append("record_id", recordId);
      const res = await fetch("/api/ct-files", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `upload failed (${res.status})`);
      }
      const j = await res.json();
      setFiles((p) => [j.file, ...p]);
    } catch (e: unknown) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
          disabled={busy}
          className="text-sm"
        />
        {busy && <span className="text-xs text-muted-foreground">Uploading…</span>}
      </div>
      {err && <div className="text-sm text-destructive">{err}</div>}
      <ul className="divide-y rounded-md border bg-card">
        {files.length === 0 && (
          <li className="p-2 text-sm text-muted-foreground">No evidence files yet.</li>
        )}
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between p-2 text-sm">
            <span className="truncate" title={f.original_filename}>{f.original_filename}</span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {f.size_bytes ? `${Math.round((f.size_bytes ?? 0) / 1024)} kB` : "—"}
              <a className="text-primary hover:underline" href={`/api/ct-files/${f.id}`} target="_blank">
                Download
              </a>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

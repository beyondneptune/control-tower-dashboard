"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Upload,
  UploadCloud,
} from "lucide-react";
import { PageGuard } from "@/components/kit/page-guard";
import { PageHeader } from "@/components/kit/page-header";
import { SectionCard } from "@/components/kit/section-card";
import { StatusPill } from "@/components/kit/status-pill";
import { DataTable, type Column } from "@/components/kit/data-table";
import { formatDate } from "@/lib/format";
import { AS_OF } from "@/data";
import type { StatusTone } from "@/lib/status";
import { getRecentUploads, uploadFile, type RecentUploadRow } from "./actions";

// ── Upload card types ────────────────────────────────────────────────────────

interface UploadCardDef {
  id: string;
  title: string;
  department: string;
  description: string;
  formats: string[];
  icon: React.ReactNode;
}

const UPLOAD_CARDS: UploadCardDef[] = [
  {
    id: "gstr1",
    title: "GSTR-1 Sales",
    department: "Finance",
    description: "Monthly outward supply statement exported from Tally / GST portal",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileSpreadsheet className="size-5 text-chart-1" />,
  },
  {
    id: "gstr2",
    title: "GSTR-2 Purchases",
    department: "Finance",
    description: "Inward supply (2A / 2B reconciliation) from GST portal",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileSpreadsheet className="size-5 text-chart-1" />,
  },
  {
    id: "bank-statement",
    title: "Bank Statement",
    department: "Finance",
    description: "Regional current a/c & OCC statement — auto-categorises entries",
    formats: ["csv", "xlsx", "xls"],
    icon: <FileText className="size-5 text-success" />,
  },
  {
    id: "salary-register",
    title: "Salary Register",
    department: "HR / Admin",
    description: "Monthly payroll register with employee-wise gross, deductions, net",
    formats: ["xlsx", "xls"],
    icon: <FileSpreadsheet className="size-5 text-warning" />,
  },
  {
    id: "customer-ledger",
    title: "Customer Ledger",
    department: "Finance / Sales",
    description: "Customer-wise receivable ledger for reconciliation and ageing",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileText className="size-5 text-chart-1" />,
  },
  {
    id: "vendor-ledger",
    title: "Vendor Ledger",
    department: "Finance / Purchase",
    description: "Vendor-wise payable ledger — matches against purchase register",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileText className="size-5 text-chart-1" />,
  },
  {
    id: "purchase-register",
    title: "Purchase Register",
    department: "Purchase",
    description: "All inward supplier invoices for the period — GRN-linked",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileSpreadsheet className="size-5 text-warning" />,
  },
  {
    id: "sales-register",
    title: "Sales Register",
    department: "Sales / Dispatch",
    description: "All outward customer invoices — mapped to job codes automatically",
    formats: ["xlsx", "xls", "csv"],
    icon: <FileSpreadsheet className="size-5 text-success" />,
  },
  {
    id: "production-job-csv",
    title: "Production Job CSV",
    department: "Production",
    description: "Daily job-stage update file — bulk updates kanban positions",
    formats: ["csv"],
    icon: <FileText className="size-5 text-warning" />,
  },
  {
    id: "route-card",
    title: "Route Card Files",
    department: "Production / Quality",
    description: "Scanned / PDF route cards per job — linked to job code on upload",
    formats: ["pdf", "jpg", "png"],
    icon: <FileText className="size-5 text-neutral-500" />,
  },
  {
    id: "quality-report",
    title: "Quality Report Files",
    department: "Quality",
    description: "Inspection reports, PT/VT/FIR results — tagged to job and stage",
    formats: ["pdf", "xlsx", "xls", "jpg"],
    icon: <FileText className="size-5 text-neutral-500" />,
  },
];

// ── Upload deadlines ─────────────────────────────────────────────────────────

interface DeadlineRow {
  id: string;
  department: string;
  deadlines: string;
  note: string;
}

const DEADLINE_ROWS: DeadlineRow[] = [
  { id: "d-finance",    department: "Finance",          deadlines: "9:30 AM  ·  6:00 PM",                 note: "Opening position + day-close bank" },
  { id: "d-production", department: "Production",       deadlines: "10:00 AM  ·  3:00 PM  ·  6:00 PM",   note: "Morning plan, mid-shift update, day-close" },
  { id: "d-quality",    department: "Quality",          deadlines: "Immediately after inspection",         note: "No batch delay — each inspection event triggers upload" },
  { id: "d-stores",     department: "Stores",           deadlines: "Immediately after issue / receipt",   note: "Real-time inventory accuracy required" },
  { id: "d-purchase",   department: "Purchase",         deadlines: "11:00 AM  ·  5:00 PM",                note: "GRN + vendor invoice matching window" },
  { id: "d-sales",      department: "Sales / Dispatch", deadlines: "11:00 AM  ·  6:00 PM",                note: "Dispatch confirmation + invoice cut-off" },
  { id: "d-hr",         department: "HR / Admin",       deadlines: "10:30 AM",                            note: "Attendance register before payroll freeze" },
];

const deadlineCols: Column<DeadlineRow>[] = [
  {
    key: "department",
    header: "Department",
    render: (r) => <span className="font-medium">{r.department}</span>,
  },
  {
    key: "deadlines",
    header: "Daily cut-off(s)",
    render: (r) => <span className="tabular-nums text-muted-foreground">{r.deadlines}</span>,
  },
  {
    key: "note",
    header: "Note",
    className: "text-muted-foreground",
    render: (r) => <span className="text-xs">{r.note}</span>,
  },
];

// ── Recent imports (live from uploads table) ─────────────────────────────────

type ImportStatus = "processed" | "pending" | "error";

const statusToneMap: Record<ImportStatus, StatusTone> = {
  processed: "success",
  pending:   "warning",
  error:     "danger",
};

const statusLabelMap: Record<ImportStatus, string> = {
  processed: "Processed",
  pending:   "Pending",
  error:     "Error",
};

const statusIconMap: Record<ImportStatus, React.ReactNode> = {
  processed: <CheckCircle2 className="size-3.5 text-success" />,
  pending:   <Loader2 className="size-3.5 animate-spin text-warning" />,
  error:     <AlertCircle className="size-3.5 text-danger" />,
};

const recentCols: Column<RecentUploadRow>[] = [
  {
    key: "file",
    header: "File",
    render: (r) => (
      <span className="flex items-center gap-1.5 font-medium">
        {statusIconMap[r.status]}
        {r.file}
      </span>
    ),
  },
  {
    key: "department",
    header: "Department",
    render: (r) => <span className="text-muted-foreground">{r.department}</span>,
  },
  {
    key: "uploadedAt",
    header: "Uploaded",
    align: "right",
    render: (r) => <span className="text-muted-foreground">{formatDate(r.uploadedAt)}</span>,
  },
  {
    key: "status",
    header: "Status",
    align: "right",
    render: (r) => (
      <StatusPill tone={statusToneMap[r.status]}>{statusLabelMap[r.status]}</StatusPill>
    ),
  },
];

// ── Dropzone card component ──────────────────────────────────────────────────

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; name: string }
  | { kind: "success"; name: string }
  | { kind: "error"; name: string; message: string };

function UploadDropzone({ card, onUploaded }: { card: UploadCardDef; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>({ kind: "idle" });

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!card.formats.includes(ext)) {
        setState({
          kind: "error",
          name: file.name,
          message: `Format .${ext} not accepted. Use ${card.formats.map((f) => "." + f).join(", ")}.`,
        });
        return;
      }
      setState({ kind: "uploading", name: file.name });
      const fd = new FormData();
      fd.set("file", file);
      fd.set("cardId", card.id);
      fd.set("department", card.department);
      fd.set("moduleName", card.title);
      const result = await uploadFile(fd);
      if (result.ok) {
        setState({ kind: "success", name: file.name });
        onUploaded();
      } else {
        setState({ kind: "error", name: file.name, message: result.error ?? "Upload failed." });
      }
    },
    [card, onUploaded],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }

  const busy = state.kind === "uploading";

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        {card.icon}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight">{card.title}</h3>
          <p className="truncate text-xs text-muted-foreground">{card.department}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <p className="text-xs text-muted-foreground">{card.description}</p>

        <div
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => !busy && onDrop(e)}
          role="button"
          tabIndex={0}
          aria-label="Drop files here or click to choose"
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/40 py-6 transition-colors ${
            busy ? "cursor-wait opacity-60" : "cursor-pointer hover:bg-muted/60"
          }`}
        >
          <UploadCloud className="size-7 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Drop files here, or <span className="font-medium text-foreground">choose file</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Accepted: {card.formats.map((f) => `.${f}`).join(", ")}
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept={card.formats.map((f) => "." + f).join(",")}
          onChange={onPick}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="size-3.5" />
            Choose file
          </button>
          <UploadStatusLine state={state} />
        </div>
      </div>
    </div>
  );
}

function UploadStatusLine({ state }: { state: UploadState }) {
  if (state.kind === "idle") {
    return <p className="text-[10px] text-muted-foreground">Stored privately · server-side</p>;
  }
  if (state.kind === "uploading") {
    return (
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Uploading…
      </p>
    );
  }
  if (state.kind === "success") {
    return (
      <p className="flex items-center gap-1 text-[10px] text-success">
        <CheckCircle2 className="size-3" />
        Uploaded
      </p>
    );
  }
  return (
    <p
      className="flex items-center gap-1 text-[10px] text-danger"
      title={state.message}
    >
      <AlertCircle className="size-3" />
      Failed
    </p>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function UploadsPage() {
  const [recent, setRecent] = useState<RecentUploadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const rows = await getRecentUploads();
    setRecent(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    // One-shot initial load on mount; subsequent updates go through `refresh`
    // (button click + post-upload). Not a cascading subscription.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return (
    <PageGuard module="uploads">
      <div className="space-y-5">
        <PageHeader
          title="Uploads / Imports"
          description={`Data ingestion hub · as of ${formatDate(AS_OF)} · all departments`}
          actions={
            <StatusPill tone="warning" dot>
              Files saved · parsing wired in Sprint 3
            </StatusPill>
          }
        />

        {/* ── Upload cards grid ── */}
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Import types
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {UPLOAD_CARDS.map((card) => (
              <UploadDropzone key={card.id} card={card} onUploaded={refresh} />
            ))}
          </div>
        </section>

        {/* ── Daily deadlines ── */}
        <SectionCard
          title="Daily upload deadlines"
          description="Late submission automatically raises an upload-missed alert (red) in the alert engine"
          bodyClassName="p-0"
          action={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              IST
            </div>
          }
        >
          <DataTable
            columns={deadlineCols}
            rows={DEADLINE_ROWS}
            getRowKey={(r) => r.id}
            empty="No deadlines configured."
          />
        </SectionCard>

        {/* ── Recent imports ── */}
        <SectionCard
          title="Recent imports"
          description="Live — last 10 uploaded files across all departments"
          bodyClassName="p-0"
          action={
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
            >
              <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          }
        >
          <DataTable
            columns={recentCols}
            rows={recent}
            getRowKey={(r) => r.id}
            empty={loading ? "Loading…" : "No uploads yet. Use a card above to upload your first file."}
          />
          <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
            Files are stored privately in Supabase Storage bucket{" "}
            <code className="rounded bg-muted px-1 py-0.5">uploads</code>. Each row above is a record in the{" "}
            <code className="rounded bg-muted px-1 py-0.5">uploads</code> table. Auto-parsing into the relevant module tables is the Sprint 3 deliverable.
          </p>
        </SectionCard>
      </div>
    </PageGuard>
  );
}

// Config for the CLEAN Operations registers — each reads an ops_* SSOT table/view
// only (folders + Tally + forms; no email, no inference). Rendered by the generic
// /operations/registers/[key] page. This is the fresh replacement for the old ct_
// registers, which are being sidelined to the Legacy group.
import type { ModuleKey } from "@/domain/rbac";

export interface OpsCol {
  field: string;
  label: string;
  type?: "date" | "money" | "num" | "bool" | "file" | "state";
}
export interface OpsRegister {
  key: string;
  label: string;
  module: ModuleKey;
  source: string; // ops_* table or view
  description: string;
  order?: { col: string; desc: boolean };
  columns: OpsCol[];
}

export const OPS_REGISTERS: OpsRegister[] = [
  {
    key: "rfq", label: "RFQ", module: "ops-rfq", source: "ops_rfq",
    description: "Confirmed enquiries (SSOT). New RFQs are confirmed in RFQ Confirm; historical ones stay pre-system.",
    order: { col: "received_date", desc: true },
    columns: [
      { field: "rfq_no", label: "RFQ No" }, { field: "customer", label: "Customer" },
      { field: "drawing_no", label: "Drawing" }, { field: "received_date", label: "Received", type: "date" },
      { field: "confirmed_by", label: "Confirmed by" }, { field: "confirmed_at", label: "Confirmed at", type: "date" },
    ],
  },
  {
    key: "quotations", label: "Quotations", module: "ops-quotation", source: "ops_quote",
    description: "Quotations from Rahul's folder — value reconciled. Source-of-truth documents.",
    order: { col: "quote_date", desc: true },
    columns: [
      { field: "quote_no", label: "Quote No" }, { field: "customer", label: "Customer" },
      { field: "quote_date", label: "Date", type: "date" }, { field: "total_value", label: "Total", type: "money" },
      { field: "reconciled", label: "Reconciled", type: "bool" }, { field: "source_file", label: "Document", type: "file" },
    ],
  },
  {
    key: "customer-pos", label: "Customer POs", module: "ops-customer-po", source: "ops_customer_po",
    description: "Customer purchase orders from Rahul's folder — every total reconciled to the PDF (GST + non-line charges).",
    order: { col: "po_date", desc: true },
    columns: [
      { field: "po_no", label: "PO No" }, { field: "customer", label: "Customer" }, { field: "entity", label: "Entity" },
      { field: "po_date", label: "Date", type: "date" }, { field: "total_value", label: "Total", type: "money" },
      { field: "quote_no_ref", label: "Quote" }, { field: "reconciled", label: "Reconciled", type: "bool" },
      { field: "source_file", label: "Document", type: "file" },
    ],
  },
  {
    key: "qc", label: "QC / Weld Reports", module: "ops-qc", source: "ops_weld_report",
    description: "Weld reports (QC evidence) from Arjun's folder — signed, numbered source documents.",
    order: { col: "wr_date", desc: true },
    columns: [
      { field: "wr_no", label: "WR No" }, { field: "drawing_no", label: "Drawing" },
      { field: "wr_date", label: "Date", type: "date" }, { field: "grade", label: "Grade" },
      { field: "pdf_file", label: "Document", type: "file" },
    ],
  },
  {
    key: "production-docs", label: "Job / Route / FIR", module: "ops-production-docs", source: "ops_production_doc",
    description: "Job Cards, Route Cards & FIR — auto-ingested per-document from Arjun's folder (named with the drawing). A FIR also turns QC green.",
    order: { col: "doc_date", desc: true },
    columns: [
      { field: "doc_kind", label: "Type" }, { field: "doc_no", label: "Doc No" }, { field: "drawing_no", label: "Drawing" },
      { field: "po_no", label: "PO" }, { field: "doc_date", label: "Date", type: "date" }, { field: "source_file", label: "Document", type: "file" },
    ],
  },
  {
    key: "dispatch", label: "Dispatch", module: "ops-dispatch", source: "ops_dispatch",
    description: "Delivery challans from Rahul's DC folder (live from today). Historical dispatch is pre-system.",
    order: { col: "dispatch_date", desc: true },
    columns: [
      { field: "dc_no", label: "DC No" }, { field: "po_no", label: "PO" }, { field: "drawing_no", label: "Drawing" },
      { field: "dispatch_date", label: "Date", type: "date" }, { field: "source_file", label: "Document", type: "file" },
    ],
  },
  {
    key: "invoices", label: "Invoices", module: "ops-invoice", source: "ops_invoice",
    description: "Sales invoices — value truth = Tally, PDF evidence from Rahul's folder. Reconciled.",
    order: { col: "invoice_date", desc: true },
    columns: [
      { field: "invoice_no", label: "Invoice No" }, { field: "customer", label: "Customer" },
      { field: "invoice_date", label: "Date", type: "date" }, { field: "total", label: "Total", type: "money" },
      { field: "po_no_ref", label: "PO" }, { field: "drawing_ref", label: "Drawing" },
      { field: "reconciled", label: "Reconciled", type: "bool" }, { field: "pdf_file", label: "Document", type: "file" },
    ],
  },
];

export const getOpsRegister = (key: string) => OPS_REGISTERS.find((r) => r.key === key);

/**
 * Phase 1B register catalogue — single source of truth for the 10 registers
 * (RFQ → Collection Follow-up). Each entry describes the table, the columns
 * shown in the list/edit/detail views, who owns it, and which roles may edit.
 *
 * The /register/[key] pages use this catalogue to render dynamically; no
 * per-register page code needed.
 */

import type { Role } from "@/domain/types";

export type CtFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "boolean"
  | "customer"
  | "vendor"
  | "job";

export interface CtField {
  name: string;
  label: string;
  type: CtFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  showInTable?: boolean;
  showInForm?: boolean;
  /** Hint shown beneath the field in the form. */
  hint?: string;
}

export interface CtRegister {
  key: string;
  label: string;
  table: string;
  owner: string;
  backup: string;
  description: string;
  /** Roles that can WRITE (insert/update). Read is for any authenticated app role. */
  writeRoles: Role[];
  /** Roles for which the register appears in their nav. */
  navRoles: Role[];
  navGroup: "Command" | "Operations" | "Finance" | "Governance" | "Admin";
  icon: string;
  primary: string; // primary identifier shown in row title
  fields: CtField[];
  /** Columns shown in the list view (in order). */
  tableColumns: string[];
  /** Indexed views/filters available. */
  filters?: { name: string; label: string; type: "text" | "select" | "date_range"; options?: string[] }[];
}

const STATUS_RFQ = ["received","under_review","awaiting_info","ready_for_quote","dropped"];
const STATUS_QUOTE = ["draft","pending_approval","approved","sent","revised","won","lost"];
const STATUS_PO = ["received","technical_review","job_created","on_hold","cancelled","completed"];
const STATUS_VENDOR = ["to_send","sent","in_process","received","delayed","closed","cancelled"];
const STATUS_DISPATCH = ["ready","partially_dispatched","dispatched","held","cancelled"];
const STAGE_WIP = [
  "material_received","pre_machining","lmd_cladding","post_machining",
  "heat_treatment","qc","rework","dispatch_ready","hold","dispatched",
];
const STATUS_WIP = ["not_started","in_progress","hold","completed"];
const DELAY_REASONS = ["none","material","drawing","machine","vendor","qc","manpower","customer","finance","other"];
const QC_STAGES = ["incoming","in_process","final"];
const QC_RESULTS = ["pass","hold","rework","reject"];
const MATERIAL_TYPES = ["customer_material","powder","gas","consumable","subcontract_item","other"];
const PROCESSES = ["pre_machining","post_machining","pwht","testing","transport","material","other"];
const CUSTOMER_RESPONSE = ["promise","query","dispute","deduction","no_response","paid","other"];

const opt = (vals: string[]) => vals.map((v) => ({ value: v, label: v.replace(/_/g, " ") }));

export const CT_REGISTERS: CtRegister[] = [
  {
    key: "rfq",
    label: "RFQ Intake",
    table: "ct_rfqs",
    owner: "Arjun / Commercial-Production",
    backup: "Rahul (if Finance receives the RFQ)",
    description: "Whenever a new enquiry/RFQ is received from a customer.",
    writeRoles: ["sales", "production"],
    navRoles: ["sales", "production"],
    navGroup: "Operations",
    icon: "ClipboardList",
    primary: "rfq_no",
    tableColumns: ["rfq_no", "customer_name", "part_name", "drawing_no", "received_date", "confirm_status", "quote_no", "source_label"],
    fields: [
      { name: "rfq_no", label: "RFQ No", type: "text", showInTable: true },
      { name: "confirm_status", label: "Confirm", type: "text", showInTable: true },
      { name: "quote_no", label: "Quote No", type: "text", showInTable: true },
      { name: "source_label", label: "Source", type: "text", showInTable: true },
      { name: "customer_id", label: "Customer", type: "customer", required: true, showInTable: true },
      { name: "received_date", label: "Received date", type: "date", required: true },
      { name: "received_through", label: "Received through", type: "text", hint: "Email / WhatsApp / Phone / Meeting" },
      { name: "customer_contact", label: "Customer contact", type: "text" },
      { name: "part_name", label: "Part name", type: "text", showInTable: true },
      { name: "drawing_no", label: "Drawing No", type: "text" },
      { name: "drawing_revision", label: "Drawing revision", type: "text" },
      { name: "material_grade", label: "Material grade", type: "text" },
      { name: "coating_spec", label: "Coating spec", type: "text" },
      { name: "quantity", label: "Quantity", type: "number", showInTable: true },
      { name: "required_quote_date", label: "Required quote date", type: "date" },
      { name: "technical_owner", label: "Technical owner", type: "text" },
      { name: "quote_owner", label: "Quote owner", type: "text" },
      { name: "status", label: "Status", type: "select", required: true, options: opt(STATUS_RFQ), showInTable: true },
      { name: "next_action", label: "Next action", type: "text", showInTable: true },
      { name: "due_date", label: "Due date", type: "date", showInTable: true },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "status", label: "Status", type: "select", options: STATUS_RFQ },
      { name: "received_date", label: "Received date", type: "date_range" },
    ],
  },
  {
    key: "quotation",
    label: "Quotation Control",
    table: "ct_quotations",
    owner: "Rahul / Arjun",
    backup: "Sameer / Imtiyaz (approval visibility)",
    description: "Whenever a quote is prepared, sent, or revised.",
    writeRoles: ["sales", "finance"],
    navRoles: ["sales", "finance"],
    navGroup: "Operations",
    icon: "TrendingUp",
    primary: "quote_no",
    tableColumns: ["quote_no", "customer_name", "quote_date", "total_value", "approval_status", "status", "follow_up_date"],
    fields: [
      { name: "quote_no", label: "Quote No", type: "text", showInTable: true },
      { name: "rfq_id", label: "Linked RFQ", type: "text", hint: "RFQ UUID (optional)" },
      { name: "customer_id", label: "Customer", type: "customer", required: true, showInTable: true },
      { name: "quote_date", label: "Quote date", type: "date", required: true, showInTable: true },
      { name: "quote_value", label: "Quote value", type: "currency" },
      { name: "gst_value", label: "GST value", type: "currency" },
      { name: "total_value", label: "Total value", type: "currency", showInTable: true },
      { name: "estimated_cost", label: "Estimated cost", type: "currency" },
      { name: "expected_margin", label: "Expected margin %", type: "number" },
      { name: "approval_status", label: "Approval status", type: "text" },
      { name: "approved_by", label: "Approved by", type: "text" },
      { name: "approval_date", label: "Approval date", type: "date" },
      { name: "sent_date", label: "Sent date", type: "date" },
      { name: "follow_up_date", label: "Follow-up date", type: "date", showInTable: true },
      { name: "status", label: "Status", type: "select", required: true, options: opt(STATUS_QUOTE), showInTable: true },
      { name: "win_loss_reason", label: "Win/loss reason", type: "textarea" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "status", label: "Status", type: "select", options: STATUS_QUOTE },
      { name: "quote_date", label: "Quote date", type: "date_range" },
    ],
  },
  {
    key: "customer-po",
    label: "Customer PO / Order Intake",
    table: "ct_customer_pos",
    owner: "Rahul (Finance receives PO) / Arjun (Production receives PO)",
    backup: "Arjun validates technical details",
    description: "Whenever a customer PO is received — this is the Order Book source of truth.",
    writeRoles: ["finance", "sales", "production"],
    navRoles: ["finance", "sales", "production"],
    navGroup: "Operations",
    icon: "ShoppingCart",
    primary: "customer_po_no",
    tableColumns: ["customer_po_no", "customer_name", "po_date", "total_value", "delivery_date", "status", "create_job"],
    fields: [
      { name: "customer_id", label: "Customer", type: "customer", required: true, showInTable: true },
      { name: "customer_po_no", label: "Customer PO No", type: "text", required: true, showInTable: true },
      { name: "po_date", label: "PO date", type: "date", required: true, showInTable: true },
      { name: "po_value", label: "PO value", type: "currency" },
      { name: "gst_value", label: "GST value", type: "currency" },
      { name: "total_value", label: "Total value", type: "currency", showInTable: true },
      { name: "delivery_date", label: "Delivery date", type: "date", showInTable: true },
      { name: "payment_terms", label: "Payment terms", type: "text" },
      { name: "quote_id", label: "Linked quote", type: "text", hint: "Quote UUID (optional)" },
      { name: "rfq_id", label: "Linked RFQ", type: "text", hint: "RFQ UUID (optional)" },
      { name: "part_name", label: "Part name", type: "text" },
      { name: "drawing_no", label: "Drawing No", type: "text" },
      { name: "drawing_revision", label: "Drawing revision", type: "text" },
      { name: "quantity", label: "Quantity", type: "number" },
      { name: "rate", label: "Rate", type: "currency" },
      { name: "material_grade", label: "Material grade", type: "text" },
      { name: "coating_spec", label: "Coating spec", type: "text" },
      { name: "customer_material_required", label: "Customer material required", type: "boolean" },
      { name: "priority", label: "Priority", type: "select", options: opt(["high","medium","low"]) },
      { name: "status", label: "Status", type: "select", required: true, options: opt(STATUS_PO), showInTable: true },
      { name: "create_job", label: "Create job?", type: "boolean", showInTable: true },
      { name: "linked_job_id", label: "Linked Job", type: "job" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "status", label: "Status", type: "select", options: STATUS_PO },
      { name: "po_date", label: "PO date", type: "date_range" },
    ],
  },
  {
    key: "job",
    label: "Job Master",
    table: "jobs",
    owner: "Arjun / Production",
    backup: "Rahul can create a draft from PO; Arjun completes technical details",
    description: "Once per confirmed order/job — links PO to production. Backbone of WIP.",
    writeRoles: ["production"],
    navRoles: ["production", "sales"],
    navGroup: "Operations",
    icon: "Factory",
    primary: "job_code",
    tableColumns: ["job_code", "customer_id", "part_name", "quantity", "ct_status", "ct_expected_dispatch_date", "ct_delay_reason"],
    fields: [
      { name: "job_code", label: "Job No", type: "text", required: true, showInTable: true },
      { name: "ct_linked_customer_po_id", label: "Linked Customer PO", type: "text", hint: "ct_customer_pos UUID" },
      { name: "customer_id", label: "Customer", type: "customer", required: true, showInTable: true },
      { name: "customer_po_no", label: "Customer PO No", type: "text" },
      { name: "part_name", label: "Part name", type: "text", showInTable: true },
      { name: "quantity", label: "Quantity", type: "number", showInTable: true },
      { name: "ct_customer_material_or_own_material", label: "Customer material or own?", type: "select", options: opt(["customer","own"]) },
      { name: "drawing_no", label: "Drawing No", type: "text" },
      { name: "ct_drawing_revision", label: "Drawing revision", type: "text" },
      { name: "material_grade", label: "Material grade", type: "text" },
      { name: "coating_material", label: "Coating spec", type: "text" },
      { name: "ct_route_type", label: "Route type", type: "text", hint: "Process route summary" },
      { name: "ct_special_instructions", label: "Special instructions", type: "textarea" },
      { name: "ct_planned_start_date", label: "Planned start date", type: "date" },
      { name: "ct_planned_dispatch_date", label: "Planned dispatch date", type: "date" },
      { name: "ct_expected_dispatch_date", label: "Expected dispatch date", type: "date", showInTable: true },
      { name: "priority", label: "Priority", type: "select", options: opt(["high","medium","low"]) },
      { name: "owner", label: "Owner", type: "text" },
      { name: "stage", label: "Current stage (legacy)", type: "text" },
      { name: "ct_status", label: "Status", type: "select", required: true, options: opt(["not_started","in_progress","hold","qc_pending","dispatch_ready","dispatched","invoiced","closed","cancelled"]), showInTable: true },
      { name: "ct_delay_reason", label: "Delay reason", type: "select", options: opt(DELAY_REASONS), showInTable: true },
      { name: "ct_next_action", label: "Next action", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "ct_status", label: "Status", type: "select", options: ["not_started","in_progress","hold","qc_pending","dispatch_ready","dispatched","invoiced","closed","cancelled"] },
    ],
  },
  {
    key: "daily-wip",
    label: "Daily WIP Update",
    table: "ct_daily_wip_updates",
    owner: "Arjun / Production Supervisor",
    backup: "Shift lead / operator",
    description: "Daily, for active jobs only. Existing route cards/weld reports are uploaded as evidence — no re-entry.",
    writeRoles: ["production"],
    navRoles: ["production"],
    navGroup: "Operations",
    icon: "Factory",
    primary: "job_no",
    tableColumns: ["job_no", "update_date", "customer", "current_stage", "status", "delay_reason", "expected_dispatch_date"],
    fields: [
      { name: "job_id", label: "Job", type: "job", required: true },
      { name: "job_no", label: "Job No", type: "text", showInTable: true },
      { name: "update_date", label: "Update date", type: "date", required: true, showInTable: true },
      { name: "customer", label: "Customer", type: "text" },
      { name: "part_name", label: "Part name", type: "text" },
      { name: "quantity_total", label: "Qty total", type: "number" },
      { name: "qty_completed", label: "Qty completed", type: "number" },
      { name: "qty_pending", label: "Qty pending", type: "number" },
      { name: "current_stage", label: "Current stage", type: "select", required: true, options: opt(STAGE_WIP), showInTable: true },
      { name: "status", label: "Status", type: "select", required: true, options: opt(STATUS_WIP), showInTable: true },
      { name: "on_time", label: "On time?", type: "boolean" },
      { name: "delay_reason", label: "Delay reason", type: "select", options: opt(DELAY_REASONS), showInTable: true },
      { name: "blocker_owner", label: "Blocker owner", type: "text" },
      { name: "required_help", label: "Required help", type: "textarea" },
      { name: "next_action", label: "Next action", type: "text" },
      { name: "expected_stage_completion_date", label: "Expected stage completion", type: "date" },
      { name: "expected_dispatch_date", label: "Expected dispatch date", type: "date", showInTable: true },
      { name: "updated_by", label: "Updated by (name)", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "current_stage", label: "Current stage", type: "select", options: STAGE_WIP },
      { name: "status", label: "Status", type: "select", options: STATUS_WIP },
      { name: "update_date", label: "Update date", type: "date_range" },
    ],
  },
  {
    key: "material",
    label: "Material / Shortage",
    table: "ct_material_shortages",
    owner: "Stores / Arjun",
    backup: "Rahul (vendor/payment dependency)",
    description: "When material is received, issued, or blocking a job.",
    writeRoles: ["stores", "production", "purchase"],
    navRoles: ["stores", "production"],
    navGroup: "Operations",
    icon: "Boxes",
    primary: "item_name",
    tableColumns: ["job_no", "material_type", "item_name", "required_qty", "available_qty", "shortage", "expected_inward_date"],
    fields: [
      { name: "job_id", label: "Job", type: "job" },
      { name: "job_no", label: "Job No", type: "text", showInTable: true },
      { name: "material_type", label: "Material type", type: "select", required: true, options: opt(MATERIAL_TYPES), showInTable: true },
      { name: "item_name", label: "Item name", type: "text", required: true, showInTable: true },
      { name: "required_qty", label: "Required qty", type: "number" },
      { name: "available_qty", label: "Available qty", type: "number" },
      { name: "issued_qty", label: "Issued qty", type: "number" },
      { name: "uom", label: "UoM", type: "text" },
      { name: "shortage", label: "Shortage?", type: "boolean", showInTable: true },
      { name: "shortage_reason", label: "Shortage reason", type: "textarea" },
      { name: "expected_inward_date", label: "Expected inward date", type: "date", showInTable: true },
      { name: "vendor_or_source", label: "Vendor / source", type: "text" },
      { name: "payment_hold", label: "Payment hold?", type: "boolean" },
      { name: "batch_lot_no", label: "Batch / Lot No", type: "text" },
      { name: "issue_date", label: "Issue date", type: "date" },
      { name: "issued_by", label: "Issued by", type: "text" },
      { name: "received_by", label: "Received by", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "material_type", label: "Material type", type: "select", options: MATERIAL_TYPES },
    ],
  },
  {
    key: "vendor-subcontract",
    label: "Vendor / Subcontracting",
    table: "ct_vendor_subcontracts",
    owner: "Arjun / Purchase coordination",
    backup: "Rahul (vendor PO/payment status)",
    description: "Whenever an outside process or vendor item is used.",
    writeRoles: ["purchase", "production"],
    navRoles: ["purchase", "production"],
    navGroup: "Operations",
    icon: "ShoppingCart",
    primary: "vendor_po_no",
    tableColumns: ["vendor_po_no", "vendor_name", "process_or_item", "sent_date", "due_date", "status"],
    fields: [
      { name: "vendor_id", label: "Vendor", type: "vendor", required: true, showInTable: true },
      { name: "vendor_po_no", label: "Vendor PO No", type: "text", showInTable: true },
      { name: "linked_job_id", label: "Linked Job", type: "job" },
      { name: "process_or_item", label: "Process / item", type: "select", required: true, options: opt(PROCESSES), showInTable: true },
      { name: "quantity", label: "Quantity", type: "number" },
      { name: "value", label: "Value", type: "currency" },
      { name: "sent_date", label: "Sent date", type: "date", showInTable: true },
      { name: "due_date", label: "Due date", type: "date", showInTable: true },
      { name: "received_date", label: "Received date", type: "date" },
      { name: "status", label: "Status", type: "select", required: true, options: opt(STATUS_VENDOR), showInTable: true },
      { name: "delay_reason", label: "Delay reason", type: "textarea" },
      { name: "payment_required", label: "Payment required?", type: "boolean" },
      { name: "advance_paid", label: "Advance paid?", type: "boolean" },
      { name: "bill_received", label: "Bill received?", type: "boolean" },
      { name: "tally_vendor_link", label: "Tally vendor link", type: "text", hint: "Tally vendor ledger reference (optional)" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
    filters: [
      { name: "status", label: "Status", type: "select", options: STATUS_VENDOR },
    ],
  },
  {
    key: "qc",
    label: "QC / NCR / Dispatch Readiness",
    table: "ct_qc_records",
    owner: "QC / Production",
    backup: "Arjun",
    description: "At QC hold points and before dispatch.",
    writeRoles: ["quality", "production"],
    navRoles: ["quality", "production"],
    navGroup: "Operations",
    icon: "ShieldCheck",
    primary: "ncr_no",
    tableColumns: ["job_no", "inspection_stage", "inspection_date", "result", "ncr_required", "final_qc_cleared", "dispatch_ready"],
    fields: [
      { name: "job_id", label: "Job", type: "job", required: true },
      { name: "job_no", label: "Job No", type: "text", showInTable: true },
      { name: "inspection_stage", label: "Inspection stage", type: "select", required: true, options: opt(QC_STAGES), showInTable: true },
      { name: "inspection_date", label: "Inspection date", type: "date", showInTable: true },
      { name: "inspector", label: "Inspector", type: "text" },
      { name: "result", label: "Result", type: "select", required: true, options: opt(QC_RESULTS), showInTable: true },
      { name: "ncr_required", label: "NCR required?", type: "boolean", showInTable: true },
      { name: "ncr_no", label: "NCR No", type: "text" },
      { name: "issue_description", label: "Issue description", type: "textarea" },
      { name: "root_cause", label: "Root cause", type: "textarea" },
      { name: "rework_required", label: "Rework required?", type: "boolean" },
      { name: "cost_impact_estimate", label: "Cost impact estimate", type: "currency" },
      { name: "final_qc_cleared", label: "Final QC cleared?", type: "boolean", showInTable: true },
      { name: "dispatch_ready", label: "Dispatch ready?", type: "boolean", showInTable: true },
      { name: "pending_items", label: "Pending items", type: "textarea" },
      { name: "expected_clearance_date", label: "Expected clearance date", type: "date" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    key: "dispatch",
    label: "Dispatch Handover / Invoice Trigger",
    table: "ct_dispatch_handovers",
    owner: "Production / Dispatch",
    backup: "Rahul (invoicing)",
    description: "Whenever a job is ready or dispatched — prevents dispatch-to-invoice gaps.",
    writeRoles: ["production", "finance"],
    navRoles: ["production", "finance", "sales"],
    navGroup: "Operations",
    icon: "Truck",
    primary: "dc_challan_no",
    tableColumns: ["job_no", "customer_name", "dispatch_date", "dispatch_status", "invoice_required", "invoice_raised", "tally_invoice_no"],
    fields: [
      { name: "job_id", label: "Job", type: "job", required: true },
      { name: "job_no", label: "Job No", type: "text", showInTable: true },
      { name: "customer_id", label: "Customer", type: "customer", showInTable: true },
      { name: "qty_ready", label: "Qty ready", type: "number" },
      { name: "qty_dispatched", label: "Qty dispatched", type: "number" },
      { name: "dispatch_date", label: "Dispatch date", type: "date", showInTable: true },
      { name: "dc_challan_no", label: "DC / Challan No", type: "text" },
      { name: "dispatch_status", label: "Dispatch status", type: "select", required: true, options: opt(STATUS_DISPATCH), showInTable: true },
      { name: "invoice_required", label: "Invoice required?", type: "boolean", showInTable: true },
      { name: "invoice_raised", label: "Invoice raised?", type: "boolean", showInTable: true },
      { name: "tally_invoice_no", label: "Tally invoice No", type: "text", showInTable: true },
      { name: "reason_if_invoice_pending", label: "Reason invoice pending", type: "textarea" },
      { name: "transporter", label: "Transporter", type: "text" },
      { name: "lr_no", label: "LR No", type: "text" },
      { name: "customer_acknowledgement", label: "Customer acknowledgement", type: "text" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
  {
    key: "collection-followup",
    label: "Collection Follow-up / Dispute",
    table: "ct_collection_followups",
    owner: "Rahul / Finance",
    backup: "MD (escalation)",
    description: "Daily/weekly for overdue or key invoices. Tally gives the invoice/outstanding — this form captures the follow-up.",
    writeRoles: ["finance"],
    navRoles: ["finance"],
    navGroup: "Finance",
    icon: "HandCoins",
    primary: "tally_invoice_no",
    tableColumns: ["tally_invoice_no", "customer_name", "outstanding_amount", "due_date", "ageing_days", "customer_response", "expected_receipt_date"],
    fields: [
      { name: "customer_id", label: "Customer", type: "customer", required: true, showInTable: true },
      { name: "tally_invoice_no", label: "Tally invoice No", type: "text", showInTable: true },
      { name: "invoice_date", label: "Invoice date", type: "date" },
      { name: "outstanding_amount", label: "Outstanding amount", type: "currency", showInTable: true },
      { name: "due_date", label: "Due date", type: "date", showInTable: true },
      { name: "ageing_days", label: "Ageing days", type: "number" },
      { name: "last_followup_date", label: "Last follow-up date", type: "date" },
      { name: "customer_response", label: "Customer response", type: "select", options: opt(CUSTOMER_RESPONSE), showInTable: true },
      { name: "expected_receipt_date", label: "Expected receipt date", type: "date", showInTable: true },
      { name: "owner", label: "Owner", type: "text" },
      { name: "next_action", label: "Next action", type: "text" },
      { name: "dispute", label: "Dispute?", type: "boolean" },
      { name: "deduction", label: "Deduction?", type: "boolean" },
      { name: "dispute_reason", label: "Dispute reason", type: "textarea" },
      { name: "documents_needed", label: "Documents needed", type: "textarea" },
      { name: "escalate_to_md", label: "Escalate to MD?", type: "boolean" },
      { name: "remarks", label: "Remarks", type: "textarea" },
    ],
  },
];

export function getRegister(key: string): CtRegister | undefined {
  return CT_REGISTERS.find((r) => r.key === key);
}

export function getRegisterByTable(table: string): CtRegister | undefined {
  return CT_REGISTERS.find((r) => r.table === table);
}

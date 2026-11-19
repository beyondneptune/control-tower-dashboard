/**
 * Meridian Alloys Control Tower — domain model (single source of truth).
 *
 * Entity shapes used across the calc engine, mock data, and UI. Field names are
 * camelCase; the Supabase data layer (Sprint 2) maps these to the snake_case
 * columns defined in the SQL schema.
 *
 * SAFETY CONVENTION — `number | null`:
 *   A monetary/cost/quantity field typed `number | null` uses `null` to mean
 *   "not yet known / data required". NEVER coerce unknown to 0 — that fabricates
 *   margins and cash positions. Calc functions MUST propagate the unknown state
 *   (see domain/calc/margin.ts).
 */

// ── Identity & access ───────────────────────────────────────────────────────

export type Role =
  | "md"
  | "finance"
  | "production"
  | "quality"
  | "stores"
  | "purchase"
  | "sales"
  | "hr"
  | "auditor";

export const ROLE_LABELS: Record<Role, string> = {
  md: "MD / Super Admin",
  finance: "Finance",
  production: "Production",
  quality: "Quality",
  stores: "Stores / Inventory",
  purchase: "Purchase",
  sales: "Sales / Dispatch",
  hr: "HR / Admin",
  auditor: "Auditor (Read-only)",
};

export const ALL_ROLES: Role[] = [
  "md",
  "finance",
  "production",
  "quality",
  "stores",
  "purchase",
  "sales",
  "hr",
  "auditor",
];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

// ── Shared enums ────────────────────────────────────────────────────────────

/** RAG status used across alerts, KPIs, and ageing. */
export type Severity = "red" | "amber" | "green";

/** Margin traffic-light bands. `data-required` = cost incomplete, NOT zero. */
export type MarginBand = "green" | "light-green" | "amber" | "red" | "dark-red" | "data-required";

export const PAYMENT_PRIORITIES = ["P1", "P2", "P3", "P4", "P5"] as const;
export type PaymentPriority = (typeof PAYMENT_PRIORITIES)[number];

export const PRIORITY_MEANING: Record<PaymentPriority, string> = {
  P1: "Stops production if unpaid",
  P2: "Bank / statutory / legal critical",
  P3: "Payroll / labour critical",
  P4: "Important but deferrable",
  P5: "Discretionary — can hold",
};

export type Criticality = "high" | "medium" | "low";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type QCStatus = "pending" | "accepted" | "hold" | "rework";

/** The kanban lifecycle every job flows through, in order. */
export const JOB_STAGES = [
  "PO Received",
  "Material Received",
  "Pre-DP",
  "LMD",
  "PWHT / Proof Machining",
  "Post-DP",
  "Final QC",
  "Ready Dispatch",
  "Dispatched",
  "Invoiced",
  "Collected",
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export function stageIndex(stage: JobStage): number {
  return JOB_STAGES.indexOf(stage);
}

export type JobPriority = "high" | "medium" | "low";

// ── Core entities ───────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  customerName: string;
  gstin?: string;
  billingAddress?: string;
  paymentTermsDays: number;
  creditLimit: number;
  keyContact?: string;
  email?: string;
  phone?: string;
  active: boolean;
}

export interface Vendor {
  id: string;
  vendorName: string;
  gstin?: string;
  category?: string;
  paymentTermsDays: number;
  criticality: Criticality;
  active: boolean;
}

export interface Job {
  id: string;
  jobCode: string;
  customerId: string;
  quoteNo?: string;
  customerPoNo?: string;
  partName: string;
  partCode?: string;
  drawingNo?: string;
  materialGrade?: string;
  coatingMaterial?: string;
  powderSupplier?: string;
  quantity: number;
  quotedValue: number;
  expectedMarginPercent?: number;
  requiredDispatchDate: string; // ISO
  stage: JobStage;
  priority: JobPriority;
  owner?: string;
  remarks?: string;
  createdAt: string;
}

export interface Quotation {
  id: string;
  jobId: string;
  quoteNo: string;
  quoteDate: string;
  customerId: string;
  quotedValue: number;
  materialEstimate: number;
  powderEstimate: number;
  labourEstimate: number;
  machineEstimate: number;
  powerEstimate: number;
  jobworkEstimate: number;
  overheadEstimate: number;
  financeCostEstimate: number;
  marginEstimate: number;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: string;
}

export interface ProductionStage {
  id: string;
  jobId: string;
  stageName: string;
  plannedStart?: string;
  plannedFinish?: string;
  actualStart?: string;
  actualFinish?: string;
  responsiblePerson?: string;
  delayDays: number;
  delayReason?: string;
  status: "pending" | "in-progress" | "done" | "delayed";
  remarks?: string;
}

export interface RouteCard {
  id: string;
  jobId: string;
  routeCardNo: string;
  date?: string;
  wpsNo?: string;
  welderName?: string;
  machineNo?: string;
  preheatTemp?: string;
  interpassTemp?: string;
  coatingThicknessRequired?: string;
  coatingThicknessActual?: string;
  ptBeforeStatus?: string;
  ptAfterStatus?: string;
  vtStatus?: string;
  firStatus?: string;
  qcRemarks?: string;
  uploadedFileUrl?: string;
}

export interface QualityReport {
  id: string;
  jobId: string;
  inspectionStage?: string;
  dpBeforeLmd?: string;
  dpAfterLmd?: string;
  dpAfterPwht?: string;
  vtResult?: string;
  firStatus?: string;
  qcStatus: QCStatus;
  ncrNo?: string;
  reworkRequired: boolean;
  reworkReason?: string;
  qcReleasedBy?: string;
  qcReleaseDate?: string;
  uploadedFileUrl?: string;
  remarks?: string;
}

export interface MaterialIssue {
  id: string;
  jobId: string;
  itemName: string;
  itemCategory?: string;
  supplier?: string;
  lotNo?: string;
  uom?: string;
  qtyIssued: number;
  qtyReturned: number;
  qtyConsumed: number;
  unitCost: number;
  totalCost: number;
  issuedBy?: string;
  issueDate?: string;
}

export interface InventoryItem {
  id: string;
  itemName: string;
  itemCategory?: string;
  supplier?: string;
  grade?: string;
  lotNo?: string;
  uom?: string;
  openingQty: number;
  receivedQty: number;
  issuedQty: number;
  returnedQty: number;
  closingQty: number;
  unitCost: number;
  reorderLevel: number;
  lastUpdated: string;
}

export interface Invoice {
  id: string;
  jobId: string;
  customerId: string;
  invoiceNo: string;
  invoiceDate: string;
  taxableValue: number;
  gstValue: number;
  invoiceTotal: number;
  dueDate: string;
  submittedToCustomer: boolean;
  submissionDate?: string;
  status: "open" | "part-paid" | "paid" | "cancelled";
}

export interface Collection {
  id: string;
  invoiceId: string;
  customerId: string;
  receiptDate: string;
  amountReceived: number;
  bankAccount?: string;
  utrRef?: string;
  deductionAmount: number;
  deductionReason?: string;
  balancePending: number;
}

export interface Purchase {
  id: string;
  vendorId: string;
  invoiceNo: string;
  invoiceDate: string;
  category?: string;
  taxableValue: number;
  gstValue: number;
  totalValue: number;
  linkedJobId?: string;
  dueDate: string;
  paymentStatus: PaymentStatus;
}

export interface PurchaseRequest {
  id: string;
  vendorId: string;
  linkedJobId?: string;
  itemName: string;
  quantity: number;
  estimatedRate: number;
  estimatedTotal: number;
  criticality: Criticality;
  requestedBy?: string;
  requestDate: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  approvalDate?: string;
  remarks?: string;
}

export interface VendorPayment {
  id: string;
  vendorId: string;
  paymentDate?: string;
  amount: number;
  bankAccount?: string;
  utrRef?: string;
  priority: PaymentPriority;
  approvedBy?: string;
  purpose?: string;
  remarks?: string;
  approvalStatus: ApprovalStatus;
  dueDate?: string;
}

export interface BankAccount {
  id: string;
  bankName: string;
  accountNoMasked?: string;
  accountType: "current" | "occ" | "term-loan" | "gecls";
  limitAmount: number;
  drawingPower: number;
  interestRate: number;
  currentBalance: number;
  lastUpdated: string;
}

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  txnDate: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
  counterparty?: string;
  category?: string;
  linkedCustomerId?: string;
  linkedVendorId?: string;
  linkedJobId?: string;
  linkedInvoiceId?: string;
  isRelatedParty: boolean;
  remarks?: string;
}

export interface DebtSchedule {
  id: string;
  loanAccountId: string;
  dueDate: string;
  principalDue: number;
  interestDue: number;
  totalDue: number;
  amountPaid: number;
  overdueAmount: number;
  penalCharges: number;
  status: "due" | "paid" | "overdue";
}

export interface Employee {
  id: string;
  employeeName: string;
  department: string;
  role?: string;
  monthlySalary: number;
  active: boolean;
}

export interface Attendance {
  id: string;
  employeeId: string;
  attendanceDate: string;
  status: "present" | "absent" | "leave" | "half-day";
  overtimeHours: number;
  remarks?: string;
}

export interface Payroll {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  salaryDue: number;
  salaryPaid: number;
  paymentDate?: string;
  bankRef?: string;
  status: PaymentStatus;
}

export interface ExpenseRequest {
  id: string;
  department: string;
  requestedBy?: string;
  expenseDate: string;
  expenseCategory?: string;
  amount: number;
  linkedJobId?: string;
  purpose?: string;
  uploadedFileUrl?: string;
  approvalStatus: ApprovalStatus;
  approvedBy?: string;
  paymentStatus: PaymentStatus;
}

// ── Governance & system ─────────────────────────────────────────────────────

export type AlertType =
  | "cash-low"
  | "cash-below-mustpay"
  | "occ-high"
  | "drawing-power-zero"
  | "penal-charge"
  | "invoice-overdue"
  | "promise-missed"
  | "job-delayed"
  | "ready-not-dispatched"
  | "dispatched-not-invoiced"
  | "cost-over-quote"
  | "powder-over-estimate"
  | "negative-margin"
  | "vendor-overdue"
  | "payroll-cash-risk"
  | "upload-missed"
  | "stock-below-reorder"
  | "material-over-estimate";

export interface Alert {
  id: string;
  alertDate: string;
  alertType: AlertType;
  severity: Severity;
  relatedModule: string;
  relatedRecordId?: string;
  message: string;
  owner?: Role;
  dueDate?: string;
  status: "open" | "ack" | "resolved";
  resolutionNote?: string;
}

export interface Approval {
  id: string;
  moduleName: string;
  recordId: string;
  approvalType: string;
  requestedBy: string;
  requestedAt: string;
  checker?: string;
  checkedAt?: string;
  approver?: string;
  approvedAt?: string;
  status: ApprovalStatus;
  rejectionReason?: string;
  overrideReason?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: Role;
  action: "insert" | "update" | "delete" | "approve" | "reject" | "override" | "login";
  tableName: string;
  recordId?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface Upload {
  id: string;
  uploadedBy: string;
  department: string;
  moduleName: string;
  fileName: string;
  fileType: string;
  fileUrl?: string;
  uploadedAt: string;
  processingStatus: "pending" | "processed" | "error";
  remarks?: string;
}

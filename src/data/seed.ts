/**
 * Demo seed data for Meridian Alloys Control Tower.
 *
 * A single coherent scenario as of AS_OF (31-May-2026). IDs are cross-
 * referenced (invoices → jobs → customers, etc.) so the calc engine and every
 * dashboard render real, consistent numbers. Deliberately seeded to exercise a
 * realistic spread of alerts. Replaced by Supabase queries in Sprint 2.
 */

import type {
  BankAccount,
  BankTransaction,
  Collection,
  Customer,
  DebtSchedule,
  Employee,
  InventoryItem,
  Invoice,
  Job,
  MaterialIssue,
  Payroll,
  Purchase,
  PurchaseRequest,
  Quotation,
  QualityReport,
  User,
  Vendor,
  VendorPayment,
} from "@/domain/types";
import type { JobCostBreakdown } from "@/domain/calc/margin";

/** The "today" the demo is frozen at. */
export const AS_OF = "2026-05-31";

export const customers: Customer[] = [
  { id: "c1", customerName: "Apex Flow Systems Pvt Ltd", gstin: "37MERID1234Z1Z5", paymentTermsDays: 45, creditLimit: 5_000_000, keyContact: "R. Kumar", email: "purchase@apexflow.example", phone: "+91 98480 11111", active: true, billingAddress: "Patancheru, Telangana" },
  { id: "c2", customerName: "Evergreen Energy Valves Private Limited", gstin: "37MERID1234Z1Z5", paymentTermsDays: 30, creditLimit: 3_000_000, keyContact: "M. Prasad", email: "stores@srienergy.example", phone: "+91 98660 22222", active: true, billingAddress: "Visakhapatnam, AP" },
  { id: "c3", customerName: "Crestline Valves and Tubes Pvt Ltd", gstin: "37MERID1234Z1Z5", paymentTermsDays: 30, creditLimit: 2_500_000, keyContact: "S. Khan", email: "po@hawavalves.example", phone: "+91 98200 33333", active: true, billingAddress: "Navi Mumbai, MH" },
  { id: "c4", customerName: "Pipeworks Engineers", gstin: "37MERID1234Z1Z5", paymentTermsDays: 30, creditLimit: 1_500_000, keyContact: "K. Nair", email: "accounts@pipeworks.example", phone: "+91 99490 44444", active: true, billingAddress: "Vijayawada, AP" },
];

export const vendors: Vendor[] = [
  { id: "v1", vendorName: "Hardface Stellite Powders", gstin: "37MERID1234Z1Z5", category: "Powder", paymentTermsDays: 30, criticality: "high", active: true },
  { id: "v2", vendorName: "Unigas Industrial Gases", category: "Gas / Consumables", paymentTermsDays: 15, criticality: "high", active: true },
  { id: "v3", vendorName: "Precision Machining Co", category: "Jobwork — Machining", paymentTermsDays: 30, criticality: "medium", active: true },
  { id: "v4", vendorName: "Regional Heat Treaters", category: "Jobwork — PWHT", paymentTermsDays: 30, criticality: "medium", active: true },
  { id: "v5", vendorName: "Deccan Steels", category: "Base Material", paymentTermsDays: 45, criticality: "medium", active: true },
  { id: "v6", vendorName: "National Abrasives", category: "Consumables", paymentTermsDays: 30, criticality: "low", active: true },
];

export const jobs: Job[] = [
  { id: "j1", jobCode: "MER-0420", customerId: "c1", quoteNo: "Q-0420", customerPoNo: "AFS-PO-9912", partName: "Gate Valve Seat Ring (Stellite 6)", partCode: "GVS-6-04", drawingNo: "DRG-04-220", materialGrade: "ASTM A182 F22", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 8, quotedValue: 1_085_000, expectedMarginPercent: 32, requiredDispatchDate: "2026-05-10", stage: "Collected", priority: "high", owner: "Kiran", createdAt: "2026-03-01" },
  { id: "j2", jobCode: "MER-0421", customerId: "c2", quoteNo: "Q-0421", customerPoNo: "EEV-PO-3321", partName: "Ball Valve Trim Hardfacing", partCode: "BVT-21", drawingNo: "DRG-21-118", materialGrade: "SS 316", coatingMaterial: "Stellite 21", powderSupplier: "Hardface Alloys", quantity: 12, quotedValue: 840_000, expectedMarginPercent: 28, requiredDispatchDate: "2026-04-18", stage: "Invoiced", priority: "high", owner: "Kiran", createdAt: "2026-02-20" },
  { id: "j3", jobCode: "MER-0422", customerId: "c3", quoteNo: "Q-0422", customerPoNo: "CLV-PO-7740", partName: "Wedge Gate Hardfacing", partCode: "WGH-22", drawingNo: "DRG-22-090", materialGrade: "ASTM A216 WCB", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 6, quotedValue: 620_000, expectedMarginPercent: 24, requiredDispatchDate: "2026-05-22", stage: "Dispatched", priority: "medium", owner: "Vikram", createdAt: "2026-03-15", remarks: "LR pending invoice" },
  { id: "j4", jobCode: "MER-0423", customerId: "c4", quoteNo: "Q-0423", customerPoNo: "PWE-PO-1180", partName: "Globe Valve Disc Coating", partCode: "GVD-23", drawingNo: "DRG-23-051", materialGrade: "SS 410", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 4, quotedValue: 310_000, expectedMarginPercent: 18, requiredDispatchDate: "2026-05-26", stage: "Ready Dispatch", priority: "medium", owner: "Vikram", createdAt: "2026-04-02" },
  { id: "j5", jobCode: "MER-0424", customerId: "c1", quoteNo: "Q-0424", customerPoNo: "AFS-PO-9988", partName: "Check Valve Seat (Inconel 625)", partCode: "CVS-24", drawingNo: "DRG-24-203", materialGrade: "ASTM A182 F91", coatingMaterial: "Inconel 625", powderSupplier: "Hardface Alloys", quantity: 10, quotedValue: 980_000, expectedMarginPercent: 30, requiredDispatchDate: "2026-06-12", stage: "Final QC", priority: "high", owner: "Priya", createdAt: "2026-04-10" },
  { id: "j6", jobCode: "MER-0425", customerId: "c2", quoteNo: "Q-0425", customerPoNo: "EEV-PO-3390", partName: "Butterfly Valve Edge Hardfacing", partCode: "BVE-25", drawingNo: "DRG-25-077", materialGrade: "SS 316L", coatingMaterial: "Stellite 21", powderSupplier: "Hardface Alloys", quantity: 14, quotedValue: 550_000, expectedMarginPercent: 22, requiredDispatchDate: "2026-05-25", stage: "LMD", priority: "high", owner: "Vikram", createdAt: "2026-04-18", remarks: "Behind schedule" },
  { id: "j7", jobCode: "MER-0426", customerId: "c3", quoteNo: "Q-0426", customerPoNo: "CLV-PO-7811", partName: "Plug Valve Sleeve Coating", partCode: "PVS-26", drawingNo: "DRG-26-140", materialGrade: "ASTM A105", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 8, quotedValue: 420_000, expectedMarginPercent: 26, requiredDispatchDate: "2026-06-15", stage: "PWHT / Proof Machining", priority: "medium", owner: "Kiran", createdAt: "2026-04-25" },
  { id: "j8", jobCode: "MER-0427", customerId: "c4", quoteNo: "Q-0427", customerPoNo: "PWE-PO-1205", partName: "Needle Valve Tip Hardfacing", partCode: "NVT-27", drawingNo: "DRG-27-019", materialGrade: "SS 410", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 20, quotedValue: 290_000, expectedMarginPercent: 19, requiredDispatchDate: "2026-06-20", stage: "Post-DP", priority: "low", owner: "Vikram", createdAt: "2026-05-01" },
  { id: "j9", jobCode: "MER-0428", customerId: "c1", quoteNo: "Q-0428", customerPoNo: "AFS-PO-10010", partName: "Control Valve Cage (Inconel)", partCode: "CVC-28", drawingNo: "DRG-28-260", materialGrade: "ASTM A182 F91", coatingMaterial: "Inconel 625", powderSupplier: "Hardface Alloys", quantity: 6, quotedValue: 710_000, expectedMarginPercent: 31, requiredDispatchDate: "2026-06-28", stage: "Pre-DP", priority: "high", owner: "Priya", createdAt: "2026-05-08" },
  { id: "j10", jobCode: "MER-0429", customerId: "c2", quoteNo: "Q-0429", customerPoNo: "EEV-PO-3420", partName: "Gate Valve Wedge (large)", partCode: "GVW-29", drawingNo: "DRG-29-301", materialGrade: "ASTM A216 WCB", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 5, quotedValue: 660_000, expectedMarginPercent: 27, requiredDispatchDate: "2026-07-02", stage: "Material Received", priority: "medium", owner: "Kiran", createdAt: "2026-05-14" },
  { id: "j11", jobCode: "MER-0430", customerId: "c3", quoteNo: "Q-0430", customerPoNo: "CLV-PO-7901", partName: "Ball Valve Seat Hardfacing", partCode: "BVS-30", drawingNo: "DRG-30-066", materialGrade: "SS 316", coatingMaterial: "Stellite 21", powderSupplier: "Hardface Alloys", quantity: 10, quotedValue: 380_000, expectedMarginPercent: 23, requiredDispatchDate: "2026-07-10", stage: "PO Received", priority: "low", owner: "Vikram", createdAt: "2026-05-26" },
  { id: "j12", jobCode: "MER-0419", customerId: "c1", quoteNo: "Q-0419", customerPoNo: "AFS-PO-9870", partName: "Severe-Service Trim (rework-heavy)", partCode: "SST-19", drawingNo: "DRG-19-200", materialGrade: "ASTM A182 F22", coatingMaterial: "Stellite 6", powderSupplier: "Hardface Alloys", quantity: 9, quotedValue: 980_000, expectedMarginPercent: 15, requiredDispatchDate: "2026-04-30", stage: "Collected", priority: "high", owner: "Kiran", createdAt: "2026-02-05", remarks: "Heavy rework — margin loss" },
];

/**
 * Actual cost components per job. `null` = data required (NOT zero). j5 is mid-
 * production with logistics unknown → "data required"; j12 overran into a loss.
 */
export const jobCosts: Record<string, JobCostBreakdown> = {
  j1: { material: 250_000, purchases: 120_000, labour: 150_000, machine: 90_000, power: 25_000, jobwork: 60_000, rework: 0, logistics: 30_000 },
  j2: { material: 210_000, purchases: 95_000, labour: 120_000, machine: 70_000, power: 20_000, jobwork: 48_000, rework: 12_000, logistics: 22_000 },
  j3: { material: 160_000, purchases: 70_000, labour: 95_000, machine: 55_000, power: 16_000, jobwork: 40_000, rework: 0, logistics: 18_000 },
  j5: { material: 280_000, purchases: 110_000, labour: 140_000, machine: 85_000, power: 24_000, jobwork: 55_000, rework: 0, logistics: null }, // data required
  j12: { material: 400_000, purchases: 200_000, labour: 250_000, machine: 150_000, power: 40_000, jobwork: 90_000, rework: 80_000, logistics: 40_000 }, // loss
};

export const quotations: Quotation[] = [
  { id: "qt1", jobId: "j1", quoteNo: "Q-0420", quoteDate: "2026-02-25", customerId: "c1", quotedValue: 1_085_000, materialEstimate: 245_000, powderEstimate: 130_000, labourEstimate: 145_000, machineEstimate: 88_000, powerEstimate: 24_000, jobworkEstimate: 58_000, overheadEstimate: 60_000, financeCostEstimate: 20_000, marginEstimate: 315_000, approvalStatus: "approved", approvedBy: "MD", approvalDate: "2026-02-26" },
  { id: "qt6", jobId: "j6", quoteNo: "Q-0425", quoteDate: "2026-04-15", customerId: "c2", quotedValue: 550_000, materialEstimate: 120_000, powderEstimate: 50_000, labourEstimate: 95_000, machineEstimate: 55_000, powerEstimate: 16_000, jobworkEstimate: 40_000, overheadEstimate: 35_000, financeCostEstimate: 12_000, marginEstimate: 127_000, approvalStatus: "approved", approvedBy: "MD", approvalDate: "2026-04-16" },
  { id: "qt11", jobId: "j11", quoteNo: "Q-0430", quoteDate: "2026-05-24", customerId: "c3", quotedValue: 380_000, materialEstimate: 95_000, powderEstimate: 38_000, labourEstimate: 70_000, machineEstimate: 40_000, powerEstimate: 12_000, jobworkEstimate: 30_000, overheadEstimate: 25_000, financeCostEstimate: 8_000, marginEstimate: 62_000, approvalStatus: "pending" },
];

export const invoices: Invoice[] = [
  // j1 collected
  { id: "inv1", jobId: "j1", customerId: "c1", invoiceNo: "MER/25-26/118", invoiceDate: "2026-05-08", taxableValue: 1_085_000, gstValue: 195_300, invoiceTotal: 1_280_300, dueDate: "2026-06-22", submittedToCustomer: true, submissionDate: "2026-05-08", status: "paid" },
  // j2 invoiced, OVERDUE >30 days, partial collection
  { id: "inv2", jobId: "j2", customerId: "c2", invoiceNo: "MER/25-26/101", invoiceDate: "2026-04-05", taxableValue: 840_000, gstValue: 151_200, invoiceTotal: 991_200, dueDate: "2026-04-25", submittedToCustomer: true, submissionDate: "2026-04-06", status: "part-paid" },
  // j12 collected (loss job, but billed/collected fine)
  { id: "inv12", jobId: "j12", customerId: "c1", invoiceNo: "MER/25-26/094", invoiceDate: "2026-04-22", taxableValue: 980_000, gstValue: 176_400, invoiceTotal: 1_156_400, dueDate: "2026-06-06", submittedToCustomer: true, submissionDate: "2026-04-22", status: "paid" },
];

export const collections: Collection[] = [
  { id: "col1", invoiceId: "inv1", customerId: "c1", receiptDate: "2026-05-28", amountReceived: 1_280_300, bankAccount: "Regional Current", utrRef: "UTR9912XX", deductionAmount: 0, balancePending: 0 },
  { id: "col2", invoiceId: "inv2", customerId: "c2", receiptDate: "2026-05-15", amountReceived: 500_000, bankAccount: "Regional Current", utrRef: "UTR3321YY", deductionAmount: 0, balancePending: 491_200 },
  { id: "col12", invoiceId: "inv12", customerId: "c1", receiptDate: "2026-05-20", amountReceived: 1_156_400, bankAccount: "Regional Current", utrRef: "UTR9870ZZ", deductionAmount: 0, balancePending: 0 },
];

export const purchases: Purchase[] = [
  { id: "pu1", vendorId: "v1", invoiceNo: "KEN-5521", invoiceDate: "2026-05-02", category: "Powder", taxableValue: 178_000, gstValue: 32_040, totalValue: 210_040, linkedJobId: "j5", dueDate: "2026-05-20", paymentStatus: "unpaid" },
  { id: "pu2", vendorId: "v2", invoiceNo: "PRX-8841", invoiceDate: "2026-05-18", category: "Gas", taxableValue: 64_000, gstValue: 11_520, totalValue: 75_520, dueDate: "2026-06-02", paymentStatus: "unpaid" },
  { id: "pu3", vendorId: "v3", invoiceNo: "SAI-2203", invoiceDate: "2026-05-10", category: "Jobwork", taxableValue: 88_000, gstValue: 15_840, totalValue: 103_840, linkedJobId: "j3", dueDate: "2026-06-09", paymentStatus: "unpaid" },
  { id: "pu4", vendorId: "v5", invoiceNo: "COR-1190", invoiceDate: "2026-04-28", category: "Base Material", taxableValue: 142_000, gstValue: 25_560, totalValue: 167_560, linkedJobId: "j10", dueDate: "2026-06-12", paymentStatus: "partial" },
];

export const vendorPayments: VendorPayment[] = [
  { id: "vp1", vendorId: "v1", amount: 210_040, priority: "P1", purpose: "Stellite 6 powder — stops production if unpaid", approvalStatus: "pending", dueDate: "2026-05-20" },
  { id: "vp2", vendorId: "v2", amount: 75_520, priority: "P1", purpose: "Argon — stops welding if unpaid", approvalStatus: "pending", dueDate: "2026-06-02" },
  { id: "vp3", vendorId: "v3", amount: 103_840, priority: "P4", purpose: "Machining jobwork", approvalStatus: "pending", dueDate: "2026-06-09" },
];

export const purchaseRequests: PurchaseRequest[] = [
  { id: "pr1", vendorId: "v1", linkedJobId: "j9", itemName: "Inconel 625 Powder (10 kg)", quantity: 10, estimatedRate: 14_500, estimatedTotal: 145_000, criticality: "high", requestedBy: "Stores", requestDate: "2026-05-27", approvalStatus: "pending" },
  { id: "pr2", vendorId: "v6", itemName: "Grinding wheels (set)", quantity: 12, estimatedRate: 900, estimatedTotal: 10_800, criticality: "low", requestedBy: "Stores", requestDate: "2026-05-29", approvalStatus: "pending" },
];

export const bankAccounts: BankAccount[] = [
  { id: "b1", bankName: "Regional Bank — Current A/c", accountNoMasked: "XXXX4021", accountType: "current", limitAmount: 0, drawingPower: 0, interestRate: 0, currentBalance: 420_000, lastUpdated: "2026-05-31" },
  { id: "b2", bankName: "National Bank — OCC", accountNoMasked: "XXXX7788", accountType: "occ", limitAmount: 5_000_000, drawingPower: 380_000, interestRate: 10.5, currentBalance: 4_600_000, lastUpdated: "2026-05-31" },
  { id: "b3", bankName: "National Bank — Term Loan", accountNoMasked: "XXXX5510", accountType: "term-loan", limitAmount: 3_000_000, drawingPower: 0, interestRate: 9.5, currentBalance: 1_800_000, lastUpdated: "2026-05-31" },
  { id: "b4", bankName: "National Bank — GECLS", accountNoMasked: "XXXX6643", accountType: "gecls", limitAmount: 2_500_000, drawingPower: 0, interestRate: 7.5, currentBalance: 1_200_000, lastUpdated: "2026-05-31" },
];

/** Penal charges live on the term loan; surfaced to the alert engine. */
export const bankPenalCharges: Record<string, number> = { b3: 8_500 };

export const debtSchedule: DebtSchedule[] = [
  { id: "d1", loanAccountId: "b3", dueDate: "2026-06-05", principalDue: 75_000, interestDue: 14_250, totalDue: 89_250, amountPaid: 0, overdueAmount: 0, penalCharges: 0, status: "due" },
  { id: "d2", loanAccountId: "b4", dueDate: "2026-06-07", principalDue: 52_000, interestDue: 7_500, totalDue: 59_500, amountPaid: 0, overdueAmount: 0, penalCharges: 0, status: "due" },
  { id: "d3", loanAccountId: "b3", dueDate: "2026-05-05", principalDue: 75_000, interestDue: 14_250, totalDue: 89_250, amountPaid: 80_750, overdueAmount: 8_500, penalCharges: 8_500, status: "overdue" },
];

export const employees: Employee[] = [
  { id: "e1", employeeName: "Production Head", department: "Production", role: "Production Head", monthlySalary: 45_000, active: true },
  { id: "e2", employeeName: "Senior Welder", department: "Production", role: "Senior Welder", monthlySalary: 28_000, active: true },
  { id: "e3", employeeName: "QC Engineer", department: "Quality", role: "QC Engineer", monthlySalary: 32_000, active: true },
  { id: "e4", employeeName: "Stores In-charge", department: "Stores", role: "Stores In-charge", monthlySalary: 26_000, active: true },
  { id: "e5", employeeName: "Accounts Executive", department: "Finance", role: "Accounts Executive", monthlySalary: 38_000, active: true },
  { id: "e6", employeeName: "Purchase Officer", department: "Purchase", role: "Purchase Officer", monthlySalary: 30_000, active: true },
  { id: "e7", employeeName: "HR Admin", department: "HR / Admin", role: "HR Admin", monthlySalary: 27_000, active: true },
  { id: "e8", employeeName: "Machinist", department: "Production", role: "Machinist", monthlySalary: 25_000, active: true },
];

export const payroll: Payroll[] = employees.map((e, i) => ({
  id: `pay-${e.id}`,
  employeeId: e.id,
  month: "2026-05",
  salaryDue: e.monthlySalary,
  salaryPaid: i < 3 ? e.monthlySalary : 0, // first 3 paid, rest pending
  paymentDate: i < 3 ? "2026-05-30" : undefined,
  status: i < 3 ? "paid" : "unpaid",
}));

export const inventoryItems: InventoryItem[] = [
  { id: "i1", itemName: "Stellite 6 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", grade: "Stellite 6", lotNo: "LOT-5521", uom: "kg", openingQty: 18, receivedQty: 10, issuedQty: 16, returnedQty: 0, closingQty: 12, unitCost: 12_800, reorderLevel: 10, lastUpdated: "2026-05-30" },
  { id: "i2", itemName: "Stellite 21 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", grade: "Stellite 21", lotNo: "LOT-5530", uom: "kg", openingQty: 12, receivedQty: 0, issuedQty: 8, returnedQty: 0, closingQty: 4, unitCost: 13_500, reorderLevel: 8, lastUpdated: "2026-05-29" }, // below reorder
  { id: "i3", itemName: "Inconel 625 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", grade: "Inconel 625", lotNo: "LOT-5544", uom: "kg", openingQty: 20, receivedQty: 5, issuedQty: 10, returnedQty: 0, closingQty: 15, unitCost: 14_500, reorderLevel: 10, lastUpdated: "2026-05-30" },
  { id: "i4", itemName: "Argon Gas Cylinders", itemCategory: "Gas", supplier: "Unigas", lotNo: "AR-2210", uom: "nos", openingQty: 8, receivedQty: 4, issuedQty: 6, returnedQty: 0, closingQty: 6, unitCost: 1_650, reorderLevel: 5, lastUpdated: "2026-05-31" },
  { id: "i5", itemName: "Grinding Wheels", itemCategory: "Consumables", supplier: "National Abrasives", lotNo: "GW-119", uom: "nos", openingQty: 14, receivedQty: 0, issuedQty: 11, returnedQty: 0, closingQty: 3, unitCost: 900, reorderLevel: 10, lastUpdated: "2026-05-28" }, // below reorder
];

export const materialIssues: MaterialIssue[] = [
  { id: "mi1", jobId: "j6", itemName: "Stellite 21 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", lotNo: "LOT-5530", uom: "kg", qtyIssued: 4.2, qtyReturned: 0, qtyConsumed: 4.2, unitCost: 13_500, totalCost: 56_700, issuedBy: "Stores", issueDate: "2026-05-22" }, // estimate 50k → overrun
  { id: "mi2", jobId: "j5", itemName: "Inconel 625 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", lotNo: "LOT-5544", uom: "kg", qtyIssued: 2.5, qtyReturned: 0, qtyConsumed: 2.5, unitCost: 14_500, totalCost: 36_250, issuedBy: "Stores", issueDate: "2026-05-26" }, // estimate 30k → overrun
  { id: "mi3", jobId: "j3", itemName: "Stellite 6 Powder", itemCategory: "Powder", supplier: "Hardface Alloys", lotNo: "LOT-5521", uom: "kg", qtyIssued: 3.0, qtyReturned: 0.2, qtyConsumed: 2.8, unitCost: 12_800, totalCost: 35_840, issuedBy: "Stores", issueDate: "2026-05-12" },
];

/** Powder estimate (quoted) per job, for variance alerts. */
export const powderEstimates: Record<string, number> = { j6: 50_000, j5: 30_000, j3: 38_000 };

export const qualityReports: QualityReport[] = [
  { id: "qr1", jobId: "j5", inspectionStage: "Final QC", dpBeforeLmd: "Accepted", dpAfterLmd: "Accepted", vtResult: "Accepted", firStatus: "Pending", qcStatus: "pending", reworkRequired: false, remarks: "Awaiting FIR sign-off" },
  { id: "qr2", jobId: "j3", inspectionStage: "Post-DP", dpAfterLmd: "Accepted", dpAfterPwht: "Accepted", vtResult: "Accepted", firStatus: "Cleared", qcStatus: "accepted", reworkRequired: false, qcReleasedBy: "Quality", qcReleaseDate: "2026-05-24" },
  { id: "qr3", jobId: "j12", inspectionStage: "Final QC", dpAfterLmd: "Rework", qcStatus: "rework", ncrNo: "NCR-19", reworkRequired: true, reworkReason: "Porosity in weld overlay — re-coat", remarks: "Caused margin loss" },
];

export const users: User[] = [
  { id: "u-md", name: "Meridian MD", email: "md@meridian.example", role: "md", active: true },
  { id: "u-fin", name: "Finance Desk", email: "finance@meridian.example", role: "finance", active: true },
  { id: "u-prod", name: "Production Desk", email: "production@meridian.example", role: "production", active: true },
  // Day 11 validation: Arjun is the production-side reviewer (Apex Flow Systems/Crestline/RFQ/PO/BOM bucket owner)
  { id: "u-arjun", name: "Arjun Varma", email: "arjun@meridian.example", role: "production", active: true },
  { id: "u-qa", name: "Quality Desk", email: "quality@meridian.example", role: "quality", active: true },
  { id: "u-store", name: "Stores Desk", email: "stores@meridian.example", role: "stores", active: true },
  { id: "u-pur", name: "Purchase Desk", email: "purchase@meridian.example", role: "purchase", active: true },
  { id: "u-sales", name: "Sales Desk", email: "sales@meridian.example", role: "sales", active: true },
  { id: "u-hr", name: "HR Desk", email: "hr@meridian.example", role: "hr", active: true },
  { id: "u-aud", name: "External Auditor", email: "auditor@meridian.example", role: "auditor", active: true },
];

/** Today's cash inputs (Finance daily upload), for the cash-control forecast. */
export const cashToday = {
  openingCash: 420_000,
  confirmedReceipts: 0,
  expectedReceipts: 491_200, // expected from Evergreen Energy overdue invoice
  approvedPayments: 285_560, // P1 vendor + part EMI
};

export const bankTransactions: BankTransaction[] = [
  { id: "bt1", bankAccountId: "b1", txnDate: "2026-05-28", description: "Receipt — Apex Flow Systems MER/25-26/118", debit: 0, credit: 1_280_300, balance: 420_000, counterparty: "Apex Flow Systems", category: "Collection", linkedCustomerId: "c1", linkedInvoiceId: "inv1", isRelatedParty: false },
  { id: "bt2", bankAccountId: "b1", txnDate: "2026-05-20", description: "Promoter unsecured loan infusion", debit: 0, credit: 500_000, balance: 0, counterparty: "Promoter (Director)", category: "Related-party funding", isRelatedParty: true, remarks: "Bridge for P1 vendor dues" },
  { id: "bt3", bankAccountId: "b1", txnDate: "2026-05-22", description: "Vendor payment — Deccan Steels", debit: 167_560, credit: 0, balance: 0, counterparty: "Deccan Steels", category: "Vendor payment", linkedVendorId: "v5", isRelatedParty: false },
];

/** Closing-balance trend for the Regional current account (weekly), most recent last. */
export const cashTrendSeries: { date: string; balance: number }[] = [
  { date: "2026-04-05", balance: 310_000 },
  { date: "2026-04-12", balance: 265_000 },
  { date: "2026-04-19", balance: 540_000 },
  { date: "2026-04-26", balance: 295_000 },
  { date: "2026-05-03", balance: 210_000 },
  { date: "2026-05-10", balance: 188_000 },
  { date: "2026-05-17", balance: 96_000 },
  { date: "2026-05-24", balance: 612_000 },
  { date: "2026-05-31", balance: 420_000 },
];

/** Job timestamps the alert engine needs but that aren't on the base Job row. */
export const readySince: Record<string, string> = { j4: "2026-05-27" };
export const dispatchedSince: Record<string, string> = { j3: "2026-05-28" };

/** Department uploads missed against today's deadlines. */
export const uploadsMissed: { department: string; module: string; role: import("@/domain/types").Role }[] = [
  { department: "Production", module: "3:00 PM production update", role: "production" },
];

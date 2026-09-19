// Data model — mirrors the Firestore collections.
// Dates are stored as ISO "YYYY-MM-DD" strings; timestamps as ISO datetime strings.

export interface ShopProfile {
  businessName: string;
  address: string;
  gstin: string;
  state: string;
  stateCode: string;
  phone?: string;
  email?: string;
  bankName: string;
  accountNumber: string;
  branch: string;
  ifsc: string;
  authorisedSignatoryName: string;
  invoicePrefix?: string;
  defaultGstRate?: number;
}

export interface Customer {
  id: string;
  name: string;
  address: string;
  gstin?: string;
  state: string;
  stateCode: string;
  phone?: string;
  email?: string;
  createdAt: string;
}

export type JobStatus = "In Progress" | "Completed";

export interface Job {
  id: string;
  description: string;
  customerId: string;
  dateCreated: string;
  dateCompleted?: string | null;
  status: JobStatus;
  invoiceId?: string | null;
  notes?: string;
}

export interface LineItem {
  slNo: number;
  description: string;
  hsnSacCode: string;
  quantity: number;
  unit: string;
  ratePerUnit: number;
  amount: number;
}

export type TaxType = "CGST_SGST" | "IGST";
export type InvoiceStatus = "Draft" | "Sent" | "Paid";

export interface Invoice {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  customerId: string;
  deliveryNote?: string;
  paymentTerms?: string;
  supplierRef?: string;
  otherRef?: string;
  buyerOrderNo?: string;
  buyerOrderDate?: string;
  despatchDocNo?: string;
  despatchThrough?: string;
  destination?: string;
  deliveryTerms?: string;
  lineItems: LineItem[];
  taxableValue: number;
  taxType: TaxType;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  roundOff: number;
  totalAmount: number;
  status: InvoiceStatus;
  jobId?: string | null;
  notes?: string;
  createdAt: string;
}

export type PaymentType = "Advance" | "Full Payment" | "Balance Payment";

export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  date: string;
  type: PaymentType;
  linkedInvoiceId?: string | null;
  notes?: string;
  createdAt: string;
}

export const INDIAN_STATES: { name: string; code: string }[] = [
  { name: "Andaman and Nicobar Islands", code: "35" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Assam", code: "18" },
  { name: "Bihar", code: "10" },
  { name: "Chandigarh", code: "04" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26" },
  { name: "Delhi", code: "07" },
  { name: "Goa", code: "30" },
  { name: "Gujarat", code: "24" },
  { name: "Haryana", code: "06" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu and Kashmir", code: "01" },
  { name: "Jharkhand", code: "20" },
  { name: "Karnataka", code: "29" },
  { name: "Kerala", code: "32" },
  { name: "Ladakh", code: "38" },
  { name: "Lakshadweep", code: "31" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Maharashtra", code: "27" },
  { name: "Manipur", code: "14" },
  { name: "Meghalaya", code: "17" },
  { name: "Mizoram", code: "15" },
  { name: "Nagaland", code: "13" },
  { name: "Odisha", code: "21" },
  { name: "Puducherry", code: "34" },
  { name: "Punjab", code: "03" },
  { name: "Rajasthan", code: "08" },
  { name: "Sikkim", code: "11" },
  { name: "Tamil Nadu", code: "33" },
  { name: "Telangana", code: "36" },
  { name: "Tripura", code: "16" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "Uttarakhand", code: "05" },
  { name: "West Bengal", code: "19" },
];

export const UNITS = ["Nos", "Kg", "Mtr", "Sq.Ft", "Set", "Pcs", "Hrs", "Lot"];

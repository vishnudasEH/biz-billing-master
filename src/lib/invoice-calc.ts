import type { Invoice, LineItem, TaxType } from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function determineTaxType(shopStateCode: string, customerStateCode: string): TaxType {
  const a = (shopStateCode || "").trim();
  const b = (customerStateCode || "").trim();
  if (!a || !b) return "CGST_SGST";
  return a === b ? "CGST_SGST" : "IGST";
}

export interface Totals {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  roundOff: number;
  totalAmount: number;
}

/** gstRate is the TOTAL GST %, e.g. 18 → CGST 9 + SGST 9, or IGST 18. */
export function computeTotals(lineItems: LineItem[], taxType: TaxType, gstRate: number): Totals {
  const taxableValue = round2(lineItems.reduce((s, li) => s + (Number(li.amount) || 0), 0));
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (taxType === "IGST") {
    igstAmount = round2((taxableValue * gstRate) / 100);
  } else {
    cgstAmount = round2((taxableValue * (gstRate / 2)) / 100);
    sgstAmount = round2((taxableValue * (gstRate / 2)) / 100);
  }
  const gross = round2(taxableValue + cgstAmount + sgstAmount + igstAmount);
  const totalAmount = Math.round(gross);
  const roundOff = round2(totalAmount - gross);
  return { taxableValue, cgstAmount, sgstAmount, igstAmount, roundOff, totalAmount };
}

export function gstRateOf(inv: Pick<Invoice, "taxType" | "cgstRate" | "igstRate">): number {
  return inv.taxType === "IGST" ? inv.igstRate : inv.cgstRate * 2;
}

/** Suggest next invoice number: takes the max numeric suffix and increments. */
export function nextInvoiceNo(existing: string[], prefix = ""): string {
  let max = 0;
  for (const no of existing) {
    const m = no.match(/(\d+)\s*$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

// ---------- Number to words (Indian system) ----------
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? " " + ONES[o] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(ONES[h] + " Hundred");
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

export function numberToWordsIndian(num: number): string {
  if (!Number.isFinite(num)) return "";
  num = Math.floor(Math.abs(num));
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10_000_000);
  const lakh = Math.floor((num % 10_000_000) / 100_000);
  const thousand = Math.floor((num % 100_000) / 1000);
  const hundred = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(numberToWordsIndian(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ");
}

/** e.g. 1234.50 → "INR One Thousand Two Hundred Thirty Four and Fifty Paise Only" */
export function amountInWords(total: number): string {
  const rupees = Math.floor(total);
  const paise = Math.round((total - rupees) * 100);
  let s = "INR " + numberToWordsIndian(rupees);
  if (paise) s += " and " + twoDigits(paise) + " Paise";
  return s + " Only";
}

export function formatINR(n: number, opts: { decimals?: number } = {}): string {
  const d = opts.decimals ?? 2;
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(n || 0);
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

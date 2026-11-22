import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Customer, Invoice, Job, Payment, ShopProfile } from "./types";
import { customerBalance } from "./db";
import { formatDate, formatINR, todayISO } from "./invoice-calc";
import { LOGO_PNG_BASE64 } from "./logo-data";

const M = 12; // margin in mm

export function buildCustomerStatementPdf(
  customer: Customer,
  jobs: Job[],
  invoices: Invoice[],
  payments: Payment[],
  shop?: ShopProfile | null,
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const CW = W - M * 2;
  let y = M;

  // Colors matching Balaji Wood Kraft
  const brownDark: [number, number, number] = [101, 58, 28]; // #653a1c
  const brownMedium: [number, number, number] = [140, 85, 45]; // #8c552d
  const bgWarm: [number, number, number] = [252, 248, 242]; // #fcf8f2
  const textDark: [number, number, number] = [40, 30, 24]; // #281e18
  const borderTone: [number, number, number] = [185, 155, 125];

  const text = (
    s: string | string[],
    x: number,
    yy: number,
    o: Parameters<typeof pdf.text>[3] = {},
  ) => pdf.text(s || "", x, yy, o);

  // Outer decorative border
  pdf.setDrawColor(...borderTone);
  pdf.setLineWidth(0.5);
  pdf.rect(M, M, CW, 273);
  pdf.setLineWidth(0.25);

  // Header Box
  pdf.setFillColor(...bgWarm);
  pdf.rect(M + 1, M + 1, CW - 2, 32, "F");

  // Top-Left Header Logo
  try {
    pdf.addImage(LOGO_PNG_BASE64, "PNG", M + 3, y + 2.5, 26, 26);
  } catch (e) {
    console.warn("Logo load notice:", e);
  }

  // Shop Info
  pdf.setTextColor(...brownDark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  text("BALAJI WOOD KRAFT", W / 2, y + 7, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...brownMedium);
  text("CNC ROUTER & 2D / 3D WOOD WORK SPECIALIST", W / 2, y + 12, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  text(
    shop?.address ||
      "No: 439/238/1, GROUND FLOOR, Sydenhams Street, Raja Muthiah Salai, CHOOLAI, CHENNAI -600112",
    W / 2,
    y + 17,
    { align: "center" },
  );

  text(
    `Mobile: ${shop?.phone || "8668021629"}   |   Email: ${shop?.email || "balajiwoodkrafts@gmail.com"}`,
    W / 2,
    y + 22,
    { align: "center" },
  );

  // Document Title Ribbon
  pdf.setFillColor(...brownDark);
  pdf.roundedRect(W / 2 - 45, y + 25, 90, 7, 1.5, 1.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  text("CUSTOMER ACCOUNT STATEMENT", W / 2, y + 30, { align: "center" });

  y += 35;

  // Customer Information Card & Statement Meta
  const half = (CW - 4) / 2;
  const leftX = M + 2;
  const rightX = M + 2 + half;

  pdf.setDrawColor(...borderTone);
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, half, 26, "F");
  pdf.rect(leftX, y, half, 26);
  pdf.rect(rightX, y, half, 26, "F");
  pdf.rect(rightX, y, half, 26);

  // Left: Customer details
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("STATEMENT FOR:", leftX + 3, y + 5);

  pdf.setFontSize(9.5);
  pdf.setTextColor(...textDark);
  text(customer.name || "Customer", leftX + 3, y + 10.5);

  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  text(
    `Mobile: ${customer.phone || "—"}   |   Email: ${customer.email || "—"}`,
    leftX + 3,
    y + 15.5,
  );
  text(
    `Address: ${customer.address || "Chennai"}   |   GSTIN: ${customer.gstin || "Unregistered"}`,
    leftX + 3,
    y + 20.5,
  );

  // Right: Statement Meta & Balance summary
  const balanceInfo = customerBalance(customer.id, jobs, payments);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("STATEMENT SUMMARY", rightX + 3, y + 5);

  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(`Statement Date: ${formatDate(todayISO())}`, rightX + 3, y + 10.5);
  text(`Total Job Work / Invoiced: Rs. ${formatINR(balanceInfo.invoiced)}`, rightX + 3, y + 15.5);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(
    balanceInfo.balance > 0 ? 180 : 30,
    balanceInfo.balance > 0 ? 40 : 130,
    balanceInfo.balance > 0 ? 30 : 60,
  );
  text(`Current Balance Due: Rs. ${formatINR(balanceInfo.balance)}`, rightX + 3, y + 21);

  y += 29;

  // SECTION 1: Job Work Orders & Invoices Table
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...brownDark);
  text(`1. JOB WORK ORDERS & INVOICES (${jobs.length})`, leftX, y + 4);
  y += 6;

  const jobTableBody = jobs.map((j) => [
    formatDate(j.date || j.dateCreated),
    j.jobNo || "JW-order",
    j.description ||
      (j.items?.[0]?.description
        ? `${j.items[0].description} (+${j.items.length - 1} items)`
        : "CNC Job Work"),
    j.status || "Received",
    `Rs. ${formatINR(Number(j.total) || 0)}`,
  ]);

  if (jobTableBody.length === 0) {
    jobTableBody.push(["—", "—", "No job work orders recorded", "—", "Rs. 0"]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: M + 2, right: M + 2 },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: borderTone,
      lineWidth: 0.2,
      textColor: textDark,
    },
    headStyles: {
      fillColor: brownDark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 28, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { cellWidth: 26 },
      4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    head: [["Date", "Job No / Ref", "Description of Work", "Status", "Amount"]],
    body: jobTableBody,
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // SECTION 2: Payments Received Table
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...brownDark);
  text(`2. PAYMENTS RECEIVED (${payments.length})`, leftX, y + 4);
  y += 6;

  const payTableBody = payments.map((p) => {
    const job = jobs.find((j) => j.id === p.jobId);
    return [
      formatDate(p.date),
      p.mode || "Cash",
      p.type || "Payment",
      job ? `Job: ${job.jobNo || "JW"}` : p.reference || p.notes || "Payment received",
      `Rs. ${formatINR(Number(p.amount) || 0)}`,
    ];
  });

  if (payTableBody.length === 0) {
    payTableBody.push(["—", "—", "—", "No payments recorded yet", "Rs. 0"]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: M + 2, right: M + 2 },
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: borderTone,
      lineWidth: 0.2,
      textColor: textDark,
    },
    headStyles: {
      fillColor: brownMedium,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 24, fontStyle: "bold" },
      2: { cellWidth: 28 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 32, halign: "right", fontStyle: "bold" },
    },
    head: [["Date", "Mode", "Type", "Reference / Linked Order", "Amount Paid"]],
    body: payTableBody,
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  // Check if we need to advance to avoid overlapping footer
  if (y > 235) {
    pdf.addPage();
    y = M + 10;
  }

  // Account Ledger Final Reconciliation Box
  const summaryBoxH = 22;
  pdf.setDrawColor(...borderTone);
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, CW - 4, summaryBoxH, "F");
  pdf.rect(leftX, y, CW - 4, summaryBoxH);

  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(`Total Job Work Value: Rs. ${formatINR(balanceInfo.invoiced)}`, leftX + 4, y + 6);
  text(`Total Payments Received: Rs. ${formatINR(balanceInfo.received)}`, leftX + 4, y + 12);

  pdf.setFontSize(10.5);
  pdf.setFont("helvetica", "bold");
  const isPending = balanceInfo.balance > 0;
  pdf.setTextColor(isPending ? 180 : 30, isPending ? 40 : 130, isPending ? 30 : 60);
  text(`NET BALANCE DUE: Rs. ${formatINR(balanceInfo.balance)}`, leftX + 4, y + 18);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(
    "Status: " + (isPending ? "Payment Pending" : "Account Clear / Settled"),
    W - M - 6,
    y + 18,
    {
      align: "right",
    },
  );

  y += summaryBoxH + 8;

  // Signatures
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  text("Customer Confirmation Signature: __________________", leftX + 4, y + 12);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("for BALAJI WOOD KRAFT", W - M - 6, y + 4, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  text("Authorized Signatory", W - M - 6, y + 14, { align: "right" });

  // Footnote
  pdf.setFontSize(7);
  pdf.setTextColor(140, 120, 110);
  text(
    "* This is a computer-generated account statement from Balaji Wood Kraft. For questions regarding balance, please call 8668021629.",
    W / 2,
    280,
    { align: "center" },
  );

  return pdf;
}

export function downloadCustomerStatementPdf(
  customer: Customer,
  jobs: Job[],
  invoices: Invoice[],
  payments: Payment[],
  shop?: ShopProfile | null,
) {
  const pdf = buildCustomerStatementPdf(customer, jobs, invoices, payments, shop);
  const cleanName = (customer.name || "Customer").replace(/[^\w-]+/g, "_");
  pdf.save(`Statement-${cleanName}-${todayISO()}.pdf`);
}

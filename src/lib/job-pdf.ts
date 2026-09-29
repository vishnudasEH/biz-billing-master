import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Job, Payment, ShopProfile } from "./types";
import { amountInWords, formatDate, formatINR } from "./invoice-calc";
import { jobAdvance, jobBalance, jobPayments } from "./db";
import { LOGO_PNG_BASE64 } from "./logo-data";

const M = 12; // margin in mm
const WOOD_TYPES_LIST = ["Wood", "MDF", "Plywood", "WPC", "Korian", "WPC Door", "ACP", "Others"];

export function buildJobPdf(
  job: Job,
  payments: Payment[],
  shop?: ShopProfile | null,
  logoStyle: "header" | "watermark" | "both" = "header",
) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const CW = W - M * 2;
  let y = M;

  // Colors: Warm brown / wood theme matching Balaji Wood Kraft paper slip
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
  const line = (x1: number, y1: number, x2: number, y2: number) => pdf.line(x1, y1, x2, y2);

  // Outer decorative border
  pdf.setDrawColor(...borderTone);
  pdf.setLineWidth(0.6);
  pdf.rect(M, M, CW, 273);
  pdf.setLineWidth(0.25);

  // Option A: Subtle center watermark
  if (logoStyle === "watermark" || logoStyle === "both") {
    try {
      const gStateClass = (
        pdf as unknown as { GState?: new (opts: { opacity: number }) => unknown }
      ).GState;
      if (gStateClass) {
        pdf.saveGraphicsState();
        pdf.setGState(new gStateClass({ opacity: 0.08 }));
        const wSize = 75;
        pdf.addImage(LOGO_PNG_BASE64, "PNG", (W - wSize) / 2, 115, wSize, wSize);
        pdf.restoreGraphicsState();
      }
    } catch (e) {
      console.warn("PDF Watermark note:", e);
    }
  }

  // Header banner box
  pdf.setFillColor(...bgWarm);
  pdf.rect(M + 1, M + 1, CW - 2, 33, "F");

  // Option B: Header Logo (top-left, default)
  if (logoStyle === "header" || logoStyle === "both") {
    try {
      pdf.addImage(LOGO_PNG_BASE64, "PNG", M + 3, y + 2.5, 27, 27);
    } catch (e) {
      console.warn("PDF Logo note:", e);
    }
  }

  // Shop Name & Branding (offset nicely with logo)
  pdf.setTextColor(...brownDark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  text("BALAJI WOOD KRAFT", W / 2, y + 8, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(...brownMedium);
  text("CNC ROUTER & 2D / 3D WOOD WORK SPECIALIST", W / 2, y + 13, { align: "center" });

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  text(
    shop?.address ||
      "No: 439/238/1, GROUND FLOOR, Sydenhams Street, Raja Muthiah Salai, CHOOLAI, CHENNAI -600112",
    W / 2,
    y + 18,
    { align: "center" },
  );

  text(
    `Mobile: ${shop?.phone || "8668021629"}   |   Email: ${shop?.email || "balajiwoodkrafts@gmail.com"}`,
    W / 2,
    y + 23,
    { align: "center" },
  );

  // Title Ribbon
  pdf.setFillColor(...brownDark);
  pdf.roundedRect(W / 2 - 42, y + 26, 84, 7, 1.5, 1.5, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  text("JOB WORK ORDER", W / 2, y + 31, { align: "center" });

  y += 36;

  // Metadata grid
  const half = (CW - 4) / 2;
  const leftX = M + 2;
  const rightX = M + 2 + half;

  pdf.setDrawColor(...borderTone);
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, half, 31);
  pdf.rect(rightX, y, half, 31);

  // Left col: Order & Customer details
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Job No:", leftX + 3, y + 5.5);
  pdf.setFontSize(9.5);
  text(job.jobNo || "JW-0000", leftX + 22, y + 5.5);

  pdf.setFontSize(7.5);
  text("Customer:", leftX + 3, y + 12);
  pdf.setFontSize(9);
  pdf.setTextColor(...textDark);
  text(job.customerName || "Customer", leftX + 22, y + 12);

  pdf.setFontSize(7.5);
  pdf.setTextColor(...brownDark);
  text("Mobile:", leftX + 3, y + 18);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(job.mobile || "—", leftX + 22, y + 18);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Design File:", leftX + 3, y + 24);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(job.designFileId || "—", leftX + 22, y + 24);

  // Right col: Date, Delivery, Material
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Date:", rightX + 3, y + 5.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(formatDate(job.date || job.dateCreated), rightX + 32, y + 5.5);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Delivery Date:", rightX + 3, y + 12);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(job.deliveryDate ? formatDate(job.deliveryDate) : "As scheduled", rightX + 32, y + 12);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Material Supplied:", rightX + 3, y + 18);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(job.materialSuppliedBy || "Customer", rightX + 32, y + 18);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("Status:", rightX + 3, y + 24);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(job.status || "Received", rightX + 32, y + 24);

  y += 33;

  // Wood types section with checkboxes
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, CW - 4, 13, "F");
  pdf.rect(leftX, y, CW - 4, 13);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...brownDark);
  text("WOOD / MATERIAL TYPE:", leftX + 3, y + 4.5);

  let woodX = leftX + 44;
  let woodY = y + 4.5;
  const selectedTypes = new Set(job.woodTypes || []);

  WOOD_TYPES_LIST.forEach((wt, idx) => {
    if (idx === 4) {
      woodX = leftX + 44;
      woodY = y + 10;
    }
    const isChecked = selectedTypes.has(wt);

    // Draw checkbox box
    pdf.setDrawColor(...brownDark);
    pdf.rect(woodX, woodY - 2.8, 3.2, 3.2);

    if (isChecked) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...brownDark);
      text("X", woodX + 0.8, woodY - 0.4);
    }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...textDark);
    const label = wt === "Others" && job.woodTypeOther ? `Others (${job.woodTypeOther})` : wt;
    text(label, woodX + 4.5, woodY - 0.4);

    woodX += idx === 7 ? 40 : 28;
  });

  y += 15;

  // Line items table
  const items = (job.items || []).length
    ? job.items
    : [
        {
          slNo: 1,
          description: job.description || "CNC Wood Engraving / Job Work",
          size: "",
          amount: Number(job.total) || 0,
        },
      ];

  const tableBody = items.map((it, idx) => [
    String(it.slNo ?? idx + 1),
    it.description || "",
    it.size || "—",
    formatINR(it.amount || 0),
  ]);

  // Ensure at least 4 rows for clean paper-slip look if fewer items
  while (tableBody.length < 4) {
    tableBody.push([String(tableBody.length + 1), "", "", ""]);
  }

  autoTable(pdf, {
    startY: y,
    margin: { left: M + 2, right: M + 2 },
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 2,
      lineColor: borderTone,
      lineWidth: 0.25,
      textColor: textDark,
    },
    headStyles: {
      fillColor: brownDark,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      1: { cellWidth: "auto", halign: "left" },
      2: { cellWidth: 42, halign: "center" },
      3: { cellWidth: 36, halign: "right" },
    },
    head: [["Sl", "Description of Work", "Size / Quantity", "Amount (Rs.)"]],
    body: tableBody,
  });

  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

  // Calculation of advance & balance
  const advance = jobAdvance(job.id, payments);
  const total = Number(job.total) || 0;
  const balance = Math.round((total - advance) * 100) / 100;
  const jpList = jobPayments(job.id, payments);

  // Determine modes used
  const modesUsed = new Set<string>();
  jpList.forEach((p) => {
    if (p.mode) modesUsed.add(p.mode);
  });
  if (modesUsed.size === 0) modesUsed.add("Cash");

  // Summary box (Total, Advance, Balance) & Payment details
  const summaryBoxH = 34;
  pdf.setDrawColor(...borderTone);
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, half, summaryBoxH);
  pdf.rect(rightX, y, half, summaryBoxH);

  // Left box: Payment details & notes
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...brownDark);
  text("PAYMENT DETAILS", leftX + 3, y + 5);

  let modeX = leftX + 3;
  const modes = ["Cash", "GPay", "Bank"];
  modes.forEach((m) => {
    const checked = modesUsed.has(m);
    pdf.setDrawColor(...brownDark);
    pdf.rect(modeX, y + 8, 3, 3);
    if (checked) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...brownDark);
      text("X", modeX + 0.7, y + 10.4);
    }
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...textDark);
    text(m, modeX + 4.5, y + 10.4);
    modeX += 20;
  });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...brownDark);
  text("Notes / UPI Reference:", leftX + 3, y + 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  const noteText = pdf.splitTextToSize(
    job.notes || "Thank you for choosing Balaji Wood Kraft.",
    half - 6,
  ) as string[];
  text(noteText.slice(0, 3), leftX + 3, y + 22);

  // Right box: Financial totals
  const rx = rightX + 3;
  const rvx = rightX + half - 4;

  pdf.setFontSize(8.5);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...textDark);
  text("Total Amount:", rx, y + 7);
  text(`Rs. ${formatINR(total)}`, rvx, y + 7, { align: "right" });

  pdf.setTextColor(...brownMedium);
  text("Advance Paid:", rx, y + 15);
  text(`Rs. ${formatINR(advance)}`, rvx, y + 15, { align: "right" });

  line(rightX + 2, y + 19, rightX + half - 2, y + 19);

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(balance > 0 ? 180 : 30, balance > 0 ? 40 : 130, balance > 0 ? 30 : 60);
  text("Balance Due:", rx, y + 27);
  text(`Rs. ${formatINR(Math.max(0, balance))}`, rvx, y + 27, { align: "right" });

  y += summaryBoxH + 4;

  // Total in words
  pdf.setFillColor(...bgWarm);
  pdf.rect(leftX, y, CW - 4, 8, "F");
  pdf.rect(leftX, y, CW - 4, 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...brownDark);
  text("Total in words:", leftX + 3, y + 5.2);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text(amountInWords(total), leftX + 26, y + 5.2);

  y += 12;

  // Signatures
  const sigBoxH = 26;
  pdf.rect(leftX, y, half, sigBoxH);
  pdf.rect(rightX, y, half, sigBoxH);

  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...textDark);
  text("Customer's Acceptance Signature:", leftX + 3, y + 5);
  text("Date: _____________", leftX + 3, y + sigBoxH - 3);

  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...brownDark);
  text("for BALAJI WOOD KRAFT", rightX + half - 3, y + 5, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...textDark);
  text("Authorized Signatory", rightX + half - 3, y + sigBoxH - 3, { align: "right" });

  // Footnote
  pdf.setFontSize(6.5);
  pdf.setTextColor(140, 120, 110);
  text(
    "* Job work done as per customer specification. Goods once processed cannot be returned. Please retain slip for collection.",
    W / 2,
    y + sigBoxH + 5,
    { align: "center" },
  );

  return pdf;
}

export function downloadJobPdf(
  job: Job,
  payments: Payment[],
  shop?: ShopProfile | null,
  logoStyle: "header" | "watermark" | "both" = "header",
) {
  const pdf = buildJobPdf(job, payments, shop, logoStyle);
  const name = `JobOrder-${(job.jobNo || "JW").replace(/[^\w-]+/g, "_")}.pdf`;
  pdf.save(name);
}

export function openJobPdf(
  job: Job,
  payments: Payment[],
  shop?: ShopProfile | null,
  logoStyle: "header" | "watermark" | "both" = "header",
) {
  const pdf = buildJobPdf(job, payments, shop, logoStyle);
  try {
    const url = pdf.output("bloburl");
    const opened = window.open(url as unknown as string, "_blank");
    if (!opened || opened.closed || typeof opened.closed === "undefined") {
      // Fallback if popup was blocked: trigger download
      downloadJobPdf(job, payments, shop, logoStyle);
    }
  } catch {
    downloadJobPdf(job, payments, shop, logoStyle);
  }
}

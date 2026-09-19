import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Customer, Invoice, ShopProfile } from "./types";
import { amountInWords, formatDate, formatINR, gstRateOf } from "./invoice-calc";

const M = 12; // margin mm

export function buildInvoicePdf(inv: Invoice, shop: ShopProfile, customer: Customer | null) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const W = pdf.internal.pageSize.getWidth();
  const CW = W - M * 2;
  let y = M;

  const text = (s: string, x: number, yy: number, o: Parameters<typeof pdf.text>[3] = {}) =>
    pdf.text(s || "", x, yy, o);
  const line = (x1: number, y1: number, x2: number, y2: number) => pdf.line(x1, y1, x2, y2);

  pdf.setLineWidth(0.25);

  // Title
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  text("TAX INVOICE", W / 2, y + 4, { align: "center" });
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  text("(Original for Recipient)", W - M, y + 4, { align: "right" });
  y += 8;

  // Header box: seller (left) + invoice meta (right)
  const half = CW / 2;
  const boxTop = y;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10.5);
  text(shop.businessName || "Business Name", M + 2, y + 5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const sellerLines = pdf.splitTextToSize(
    [shop.address, `GSTIN/UIN: ${shop.gstin}`, `State Name: ${shop.state}, Code: ${shop.stateCode}`]
      .concat(shop.phone ? [`Contact: ${shop.phone}`] : [], shop.email ? [`E-Mail: ${shop.email}`] : [])
      .filter(Boolean)
      .join("\n"),
    half - 4,
  ) as string[];
  text(sellerLines, M + 2, y + 10);
  const sellerH = 10 + sellerLines.length * 3.6 + 2;

  // Meta grid on right: 2 columns × 6 rows
  const meta: [string, string][] = [
    ["Invoice No.", inv.invoiceNo],
    ["Dated", formatDate(inv.invoiceDate)],
    ["Delivery Note", inv.deliveryNote ?? ""],
    ["Mode/Terms of Payment", inv.paymentTerms ?? ""],
    ["Supplier's Ref.", inv.supplierRef ?? ""],
    ["Other Reference(s)", inv.otherRef ?? ""],
    ["Buyer's Order No.", inv.buyerOrderNo ?? ""],
    ["Dated", formatDate(inv.buyerOrderDate)],
    ["Despatch Document No.", inv.despatchDocNo ?? ""],
    ["Despatched through", inv.despatchThrough ?? ""],
    ["Destination", inv.destination ?? ""],
    ["Terms of Delivery", inv.deliveryTerms ?? ""],
  ];
  const rx = M + half;
  const cellW = half / 2;
  const rowH = 9;
  let ry = boxTop;
  for (let i = 0; i < meta.length; i += 2) {
    for (let c = 0; c < 2; c++) {
      const [k, v] = meta[i + c];
      const x = rx + c * cellW;
      pdf.setFontSize(6.5);
      pdf.setTextColor(90);
      text(k, x + 1.5, ry + 3);
      pdf.setTextColor(0);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      text(String(v || ""), x + 1.5, ry + 7);
      pdf.setFont("helvetica", "normal");
      pdf.rect(x, ry, cellW, rowH);
    }
    ry += rowH;
  }
  const metaH = ry - boxTop;

  // Buyer block under seller (left column)
  const buyerTop = boxTop + sellerH;
  line(M, buyerTop, M + half, buyerTop);
  pdf.setFontSize(7);
  pdf.setTextColor(90);
  text("Buyer (Bill to)", M + 2, buyerTop + 3.5);
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  text(customer?.name || "", M + 2, buyerTop + 8.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  const buyerLines = pdf.splitTextToSize(
    [
      customer?.address,
      customer?.gstin ? `GSTIN/UIN: ${customer.gstin}` : "",
      customer ? `State Name: ${customer.state}, Code: ${customer.stateCode}` : "",
      customer?.phone ? `Contact: ${customer.phone}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    half - 4,
  ) as string[];
  text(buyerLines, M + 2, buyerTop + 13);
  const buyerH = 13 + buyerLines.length * 3.6 + 2;
  const headerH = Math.max(sellerH + buyerH, metaH);
  pdf.rect(M, boxTop, half, headerH);
  pdf.rect(rx, boxTop, half, headerH);
  y = boxTop + headerH;

  // Items table
  const gst = gstRateOf(inv);
  const body = inv.lineItems.map((li) => [
    String(li.slNo),
    li.description,
    li.hsnSacCode,
    `${li.quantity} ${li.unit}`,
    formatINR(li.ratePerUnit),
    li.unit,
    formatINR(li.amount),
  ]);
  const taxRows: string[][] = [];
  if (inv.taxType === "IGST") {
    taxRows.push(["", `IGST @ ${inv.igstRate}%`, "", "", "", "", formatINR(inv.igstAmount)]);
  } else {
    taxRows.push(["", `CGST @ ${inv.cgstRate}%`, "", "", "", "", formatINR(inv.cgstAmount)]);
    taxRows.push(["", `SGST @ ${inv.sgstRate}%`, "", "", "", "", formatINR(inv.sgstAmount)]);
  }
  if (inv.roundOff) taxRows.push(["", "Round Off", "", "", "", "", formatINR(inv.roundOff)]);

  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 1.6, lineColor: 0, lineWidth: 0.25, textColor: 0 },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center" },
      1: { cellWidth: "auto" },
      2: { cellWidth: 20, halign: "center" },
      3: { cellWidth: 22, halign: "right" },
      4: { cellWidth: 22, halign: "right" },
      5: { cellWidth: 14, halign: "center" },
      6: { cellWidth: 28, halign: "right" },
    },
    head: [["Sl", "Description of Goods / Services", "HSN/SAC", "Quantity", "Rate", "per", "Amount"]],
    body: [
      ...body,
      ...taxRows.map((r) => r.map((c, i) => (i === 1 ? { content: c, styles: { fontStyle: "italic" as const, halign: "right" as const } } : c))),
      [
        { content: "", styles: {} },
        { content: "Total", styles: { fontStyle: "bold", halign: "right" } },
        "",
        {
          content: `${inv.lineItems.reduce((s, l) => s + Number(l.quantity || 0), 0)}`,
          styles: { fontStyle: "bold", halign: "right" },
        },
        "",
        "",
        { content: `₹ ${formatINR(inv.totalAmount)}`, styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
  });
  // jspdf-autotable attaches lastAutoTable to the doc instance
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // Amount in words
  pdf.rect(M, y, CW, 12);
  pdf.setFontSize(7);
  pdf.setTextColor(90);
  text("Amount Chargeable (in words)", M + 2, y + 3.5);
  pdf.setTextColor(0);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  text(amountInWords(inv.totalAmount), M + 2, y + 8.5);
  pdf.setFont("helvetica", "normal");
  text("E. & O.E", W - M - 2, y + 3.5, { align: "right" });
  y += 12;

  // Tax summary table
  const hsn = inv.lineItems[0]?.hsnSacCode || "";
  const taxHead =
    inv.taxType === "IGST"
      ? [["HSN/SAC", "Taxable Value", "IGST Rate", "IGST Amount", "Total Tax Amount"]]
      : [["HSN/SAC", "Taxable Value", "CGST Rate", "CGST Amount", "SGST Rate", "SGST Amount", "Total Tax Amount"]];
  const totalTax = inv.cgstAmount + inv.sgstAmount + inv.igstAmount;
  const taxBody =
    inv.taxType === "IGST"
      ? [
          [hsn, formatINR(inv.taxableValue), `${inv.igstRate}%`, formatINR(inv.igstAmount), formatINR(totalTax)],
          ["Total", formatINR(inv.taxableValue), "", formatINR(inv.igstAmount), formatINR(totalTax)],
        ]
      : [
          [hsn, formatINR(inv.taxableValue), `${inv.cgstRate}%`, formatINR(inv.cgstAmount), `${inv.sgstRate}%`, formatINR(inv.sgstAmount), formatINR(totalTax)],
          ["Total", formatINR(inv.taxableValue), "", formatINR(inv.cgstAmount), "", formatINR(inv.sgstAmount), formatINR(totalTax)],
        ];
  autoTable(pdf, {
    startY: y,
    margin: { left: M, right: M },
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 1.4, lineColor: 0, lineWidth: 0.25, textColor: 0, halign: "right" },
    headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { halign: "left" } },
    head: taxHead,
    body: taxBody,
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === taxBody.length - 1) d.cell.styles.fontStyle = "bold";
    },
  });
  y = (pdf as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  pdf.setFontSize(8);
  text(`Tax Amount (in words): ${amountInWords(totalTax)}   (GST ${gst}%)`, M, y + 4.5);
  y += 8;

  // Footer: declaration + bank details (left), signature (right)
  const footTop = y;
  const footH = 34;
  pdf.rect(M, footTop, CW, footH);
  line(M + half, footTop, M + half, footTop + footH);
  pdf.setFontSize(7);
  pdf.setTextColor(90);
  text("Declaration", M + 2, footTop + 4);
  pdf.setTextColor(0);
  pdf.setFontSize(7.5);
  text(
    pdf.splitTextToSize(
      "We declare that this invoice shows the actual price of the goods/services described and that all particulars are true and correct.",
      half - 4,
    ) as string[],
    M + 2,
    footTop + 8,
  );
  pdf.setFontSize(7);
  pdf.setTextColor(90);
  text("Company's Bank Details", M + 2, footTop + 18);
  pdf.setTextColor(0);
  pdf.setFontSize(8);
  text(
    [
      `Bank Name: ${shop.bankName}`,
      `A/c No.: ${shop.accountNumber}`,
      `Branch & IFS Code: ${shop.branch} & ${shop.ifsc}`,
    ],
    M + 2,
    footTop + 22,
  );

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  text(`for ${shop.businessName}`, W - M - 2, footTop + 5, { align: "right" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  text("Authorised Signatory", W - M - 2, footTop + footH - 3, { align: "right" });
  if (shop.authorisedSignatoryName) {
    text(shop.authorisedSignatoryName, W - M - 2, footTop + footH - 7, { align: "right" });
  }

  pdf.setFontSize(7);
  pdf.setTextColor(120);
  text("This is a Computer Generated Invoice", W / 2, footTop + footH + 5, { align: "center" });
  pdf.setTextColor(0);

  return pdf;
}

export function downloadInvoicePdf(inv: Invoice, shop: ShopProfile, customer: Customer | null) {
  const pdf = buildInvoicePdf(inv, shop, customer);
  pdf.save(`Invoice-${inv.invoiceNo.replace(/[^\w-]+/g, "_")}.pdf`);
}

export function openInvoicePdf(inv: Invoice, shop: ShopProfile, customer: Customer | null) {
  const pdf = buildInvoicePdf(inv, shop, customer);
  const url = pdf.output("bloburl");
  window.open(url as unknown as string, "_blank");
}

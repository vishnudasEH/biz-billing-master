import type { Job, Payment, ShopProfile } from "./types";
import { formatDate, formatINR } from "./invoice-calc";
import { jobAdvance, jobBalance, jobPayments } from "./db";
import { LOGO_PNG_BASE64 } from "./logo-data";
import { downloadJobPdf } from "./job-pdf";

const WOOD_TYPES_LIST = ["Wood", "MDF", "Plywood", "WPC", "Korian", "WPC Door", "ACP", "Others"];

/**
 * Builds clean, printable HTML for the Balaji Wood Kraft Job Work Order.
 * Supports:
 * - Option B: Header Logo (top-left, default)
 * - Option A: Watermark Logo (large subtle center watermark)
 * - Both: Header logo + subtle center watermark
 */
export function buildJobBillHtml(
  job: Job,
  payments: Payment[],
  shop?: ShopProfile | null,
  logoStyle: "header" | "watermark" | "both" = "header",
): string {
  const total = Number(job.total) || 0;
  const advance = jobAdvance(job.id, payments);
  const balance = jobBalance(job, payments);
  const jPayments = jobPayments(job.id, payments);

  const modesUsed = new Set<string>();
  jPayments.forEach((p) => {
    if (p.mode) modesUsed.add(p.mode);
  });
  if (modesUsed.size === 0) modesUsed.add("Cash");

  const selectedWoodTypes = new Set(job.woodTypes || []);

  const items =
    (job.items || []).length > 0
      ? job.items
      : [
          {
            slNo: 1,
            description: job.description || "CNC Wood Engraving / Job Work",
            size: "—",
            amount: total,
          },
        ];

  // Generate spacer rows if fewer than 4 items for authentic paper slip appearance
  const emptyRowsCount = Math.max(0, 4 - items.length);

  const shopPhone = shop?.phone || "8668021629";
  const shopEmail = shop?.email || "balajiwoodkrafts@gmail.com";
  const shopAddress =
    shop?.address ||
    "No: 439/238/1, GROUND FLOOR, Sydenhams Street, Raja Muthiah Salai, CHOOLAI, CHENNAI -600112";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Job Work Order - ${job.jobNo || "JW"}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      color: #281e18;
      background: #ffffff;
      font-size: 12px;
      line-height: 1.35;
      padding: 10px;
    }
    .slip-container {
      width: 100%;
      max-width: 760px;
      margin: 0 auto;
      border: 2px solid #b99b7d;
      border-radius: 6px;
      background: #fffdf9;
      padding: 16px;
      position: relative;
      overflow: hidden;
    }
    /* Option A: Center Watermark */
    .watermark-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 290px;
      height: 290px;
      opacity: 0.06;
      filter: grayscale(100%);
      pointer-events: none;
      z-index: 0;
    }
    .content-wrapper {
      position: relative;
      z-index: 1;
    }
    .header-box {
      background: #fcf8f2;
      border: 1px solid #b99b7d;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-logo {
      width: 72px;
      height: 72px;
      object-fit: contain;
      flex-shrink: 0;
      border-radius: 4px;
    }
    .header-info {
      flex: 1;
      text-align: center;
    }
    .shop-title {
      font-size: 20px;
      font-weight: 900;
      color: #653a1c;
      letter-spacing: -0.5px;
      margin-bottom: 2px;
    }
    .shop-subtitle {
      font-size: 11px;
      font-weight: 800;
      color: #8c552d;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .shop-address {
      font-size: 10.5px;
      color: #42342c;
      line-height: 1.25;
    }
    .shop-contact {
      font-size: 10.5px;
      color: #42342c;
      margin-top: 3px;
      font-weight: 500;
    }
    .ribbon-wrap {
      margin-top: 8px;
      text-align: center;
    }
    .ribbon {
      display: inline-block;
      background: #653a1c;
      color: #ffffff;
      padding: 3px 24px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-bottom: 8px;
    }
    .meta-card {
      border: 1px solid #b99b7d;
      background: #fcf8f2;
      border-radius: 4px;
      padding: 8px 10px;
      font-size: 11.5px;
    }
    .meta-row {
      display: flex;
      margin-bottom: 4px;
    }
    .meta-row:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      width: 105px;
      font-weight: 700;
      color: #653a1c;
      flex-shrink: 0;
    }
    .meta-val {
      color: #281e18;
      font-weight: 600;
      word-break: break-word;
    }
    .wood-box {
      border: 1px solid #b99b7d;
      background: #fcf8f2;
      border-radius: 4px;
      padding: 8px 10px;
      margin-bottom: 8px;
      font-size: 11px;
    }
    .wood-title {
      font-weight: 800;
      color: #653a1c;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .wood-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px 8px;
    }
    .checkbox-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 11px;
      color: #382c24;
    }
    .check-box {
      width: 14px;
      height: 14px;
      border: 1px solid #653a1c;
      border-radius: 2px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      font-weight: 900;
      background: #ffffff;
      flex-shrink: 0;
    }
    .check-box.checked {
      background: #653a1c;
      color: #ffffff;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      border: 1px solid #b99b7d;
      font-size: 11.5px;
    }
    .items-table th {
      background: #653a1c;
      color: #ffffff;
      font-weight: 700;
      padding: 6px 8px;
      text-align: left;
      border-right: 1px solid #8c552d;
    }
    .items-table th:last-child {
      border-right: none;
      text-align: right;
    }
    .items-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #e3d3c1;
      border-right: 1px solid #e3d3c1;
      background: #ffffff;
    }
    .items-table td:last-child {
      border-right: none;
      text-align: right;
    }
    .summary-card {
      border: 1px solid #b99b7d;
      background: #fcf8f2;
      border-radius: 4px;
      padding: 8px 10px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
      font-size: 12px;
    }
    .totals-row.balance {
      font-size: 13px;
      font-weight: 800;
      color: #653a1c;
      border-top: 1px solid #b99b7d;
      padding-top: 4px;
      margin-top: 4px;
    }
    .sign-box {
      border: 1px solid #b99b7d;
      background: #fcf8f2;
      border-radius: 4px;
      padding: 12px 14px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .sign-line {
      border-top: 1px dashed #8c552d;
      width: 140px;
      padding-top: 4px;
      font-size: 10px;
      color: #715848;
    }
    .footnote {
      text-align: center;
      font-size: 9px;
      color: #8c7362;
      font-style: italic;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="slip-container">
    ${
      logoStyle === "watermark" || logoStyle === "both"
        ? `<img class="watermark-overlay" src="${LOGO_PNG_BASE64}" alt="Watermark" />`
        : ""
    }

    <div class="content-wrapper">
      <!-- Header Area with Option B: Top-Left Header Logo -->
      <div class="header-box">
        ${
          logoStyle === "header" || logoStyle === "both"
            ? `<img class="header-logo" src="${LOGO_PNG_BASE64}" alt="Balaji Wood Kraft Logo" />`
            : ""
        }
        <div class="header-info">
          <div class="shop-title">BALAJI WOOD KRAFT</div>
          <div class="shop-subtitle">CNC ROUTER & 2D / 3D WOOD WORK SPECIALIST</div>
          <div class="shop-address">${shopAddress}</div>
          <div class="shop-contact">
            Mobile: <strong>${shopPhone}</strong> &nbsp;|&nbsp; Email: ${shopEmail}
          </div>
          <div class="ribbon-wrap">
            <span class="ribbon">JOB WORK ORDER</span>
          </div>
        </div>
      </div>

      <!-- Metadata Grid: Customer & Order Details -->
      <div class="grid-2">
        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Job Order No:</span>
            <span class="meta-val" style="font-family: monospace; font-size: 13px; font-weight: 800; color: #653a1c;">
              ${job.jobNo || "JW-0000"}
            </span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Customer Name:</span>
            <span class="meta-val">${job.customerName || "Customer"}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Contact Mobile:</span>
            <span class="meta-val" style="font-family: monospace;">${job.mobile || "—"}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Design File ID:</span>
            <span class="meta-val" style="font-family: monospace;">${job.designFileId || "—"}</span>
          </div>
        </div>

        <div class="meta-card">
          <div class="meta-row">
            <span class="meta-label">Order Date:</span>
            <span class="meta-val">${formatDate(job.date || job.dateCreated)}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Delivery Date:</span>
            <span class="meta-val">${job.deliveryDate ? formatDate(job.deliveryDate) : "As scheduled"}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Material Supplied:</span>
            <span class="meta-val">${job.materialSuppliedBy || "Customer"}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Work Status:</span>
            <span class="meta-val" style="color: #653a1c;">${job.status || "Received"}</span>
          </div>
        </div>
      </div>

      <!-- Wood / Material Types Checklist -->
      <div class="wood-box">
        <div class="wood-title">WOOD / MATERIAL TYPE:</div>
        <div class="wood-grid">
          ${WOOD_TYPES_LIST.map((wt) => {
            const isChecked = selectedWoodTypes.has(wt);
            const label =
              wt === "Others" && job.woodTypeOther ? `Others (${job.woodTypeOther})` : wt;
            return `
              <div class="checkbox-item">
                <span class="check-box ${isChecked ? "checked" : ""}">${isChecked ? "✓" : ""}</span>
                <span style="${isChecked ? "font-weight: 700; color: #653a1c;" : ""}">${label}</span>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Items Table -->
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 36px; text-align: center;">Sl</th>
            <th>Description of Work</th>
            <th style="width: 120px; text-align: center;">Size / Qty</th>
            <th style="width: 100px;">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (it, idx) => `
            <tr>
              <td style="text-align: center; color: #736154; font-family: monospace;">${it.slNo ?? idx + 1}</td>
              <td style="font-weight: 600;">${it.description || "CNC Job Work"}</td>
              <td style="text-align: center; font-family: monospace;">${it.size || "—"}</td>
              <td style="font-family: monospace; font-weight: 700;">₹${formatINR(it.amount || 0)}</td>
            </tr>
          `,
            )
            .join("")}

          ${Array.from({ length: emptyRowsCount })
            .map(
              (_, i) => `
            <tr style="height: 24px;">
              <td style="text-align: center; color: #c4b5a5; font-family: monospace;">${items.length + i + 1}</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
              <td>&nbsp;</td>
            </tr>
          `,
            )
            .join("")}
        </tbody>
      </table>

      <!-- Summary & Payment Details Grid -->
      <div class="grid-2">
        <div class="summary-card">
          <div style="font-weight: 700; color: #653a1c; font-size: 11px; margin-bottom: 6px; text-transform: uppercase;">
            PAYMENT DETAILS:
          </div>
          <div style="display: flex; gap: 14px; margin-bottom: 6px;">
            ${["Cash", "GPay", "Bank"]
              .map((m) => {
                const isChecked = modesUsed.has(m);
                return `
                <div style="display: flex; align-items: center; gap: 4px; font-size: 11px;">
                  <span class="check-box ${isChecked ? "checked" : ""}">${isChecked ? "✓" : ""}</span>
                  <span style="${isChecked ? "font-weight: 700; color: #653a1c;" : ""}">${m === "GPay" ? "GPay / UPI" : m}</span>
                </div>
              `;
              })
              .join("")}
          </div>
          <div style="border-top: 1px solid #e3d3c1; padding-top: 4px; font-size: 11px; color: #42342c;">
            <strong>Notes / Ref:</strong> ${job.notes || "Thank you for choosing Balaji Wood Kraft."}
          </div>
        </div>

        <div class="summary-card">
          <div class="totals-row">
            <span>Total Work Amount:</span>
            <span style="font-family: monospace; font-weight: 700;">₹${formatINR(total)}</span>
          </div>
          <div class="totals-row" style="color: #047857;">
            <span>Advance Paid:</span>
            <span style="font-family: monospace; font-weight: 600;">₹${formatINR(advance)}</span>
          </div>
          <div class="totals-row balance">
            <span>Balance Due:</span>
            <span style="font-family: monospace; ${balance > 0 ? "color: #c2410c;" : "color: #047857;"}">
              ${balance > 0 ? `₹${formatINR(balance)}` : "PAID (₹0)"}
            </span>
          </div>
        </div>
      </div>

      <!-- Signatures Box -->
      <div class="sign-box">
        <div>
          <div class="sign-line">Customer Signature</div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #653a1c; font-size: 11px; margin-bottom: 24px;">for BALAJI WOOD KRAFT</div>
          <div class="sign-line" style="margin-left: auto;">Authorized Signatory</div>
        </div>
      </div>

      <div class="footnote">
        * Job work done as per customer specification. Goods once processed cannot be returned. Please retain slip for collection.
      </div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers an isolated print of the Job Work Order bill.
 * Creates a dedicated hidden iframe, writes the complete formatted HTML,
 * and calls window.print() inside that iframe.
 * If printing is blocked by iframe sandboxing, falls back gracefully to PDF download.
 */
export function printJobBill(
  job: Job,
  payments: Payment[],
  shop?: ShopProfile | null,
  logoStyle: "header" | "watermark" | "both" = "header",
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const html = buildJobBillHtml(job, payments, shop, logoStyle);

      // Create hidden iframe for isolated print
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.visibility = "hidden";
      iframe.setAttribute("aria-hidden", "true");

      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (!doc || !iframe.contentWindow) {
        document.body.removeChild(iframe);
        downloadJobPdf(job, payments, shop, logoStyle);
        resolve(false);
        return;
      }

      doc.open();
      doc.write(html);
      doc.close();

      // Give images & layout time to settle, then print
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          resolve(true);
        } catch {
          // Fallback to PDF download if print() was restricted
          downloadJobPdf(job, payments, shop, logoStyle);
          resolve(false);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1500);
        }
      }, 350);
    } catch {
      downloadJobPdf(job, payments, shop, logoStyle);
      resolve(false);
    }
  });
}

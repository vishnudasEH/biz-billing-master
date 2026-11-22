import type { Customer, Invoice, Job, Payment } from "./types";
import { formatDate, todayISO } from "./invoice-calc";

/**
 * Escapes a single CSV field properly according to RFC 4180.
 * Wraps with quotes if it contains commas, double quotes, or newlines.
 */
function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Downloads a generated CSV string in the browser.
 */
function downloadCsv(content: string, filename: string) {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 1. Export Customers CSV
export function exportCustomersCsv(customers: Customer[]) {
  const headers = [
    "ID",
    "Customer Name",
    "Phone / Mobile",
    "Email",
    "Address",
    "GSTIN / UIN",
    "State",
    "State Code",
    "Monthly GST Billing",
    "Created Date",
  ];

  const rows = customers.map((c) => [
    escapeCsv(c.id),
    escapeCsv(c.name),
    escapeCsv(c.phone || ""),
    escapeCsv(c.email || ""),
    escapeCsv(c.address || ""),
    escapeCsv(c.gstin || ""),
    escapeCsv(c.state || ""),
    escapeCsv(c.stateCode || ""),
    escapeCsv(c.monthlyGstBilling ? "Yes" : "No"),
    escapeCsv(c.createdAt ? c.createdAt.slice(0, 10) : ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadCsv(csvContent, `BalajiWoodKraft_Customers_${todayISO()}.csv`);
}

// 2. Export Jobs CSV
export function exportJobsCsv(jobs: Job[], customers: Customer[]) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));

  const headers = [
    "ID",
    "Job Order No",
    "Date",
    "Customer ID",
    "Customer Name (Resolved)",
    "Mobile",
    "Design File ID",
    "Wood Types",
    "Wood Type Other",
    "Material Supplied By",
    "Total Items Count",
    "Work Items Summary",
    "Total Amount (INR)",
    "Notes",
    "Delivery Date",
    "Status",
    "Linked Invoice ID",
    "Created At",
  ];

  const rows = jobs.map((j) => {
    const itemsSummary = (j.items || [])
      .map(
        (it) => `${it.description || "Work"}${it.size ? ` (${it.size})` : ""}: ₹${it.amount || 0}`,
      )
      .join("; ");

    return [
      escapeCsv(j.id),
      escapeCsv(j.jobNo || ""),
      escapeCsv(j.date || (j.dateCreated ? j.dateCreated.slice(0, 10) : "")),
      escapeCsv(j.customerId),
      escapeCsv(j.customerName || custMap.get(j.customerId) || "Customer"),
      escapeCsv(j.mobile || ""),
      escapeCsv(j.designFileId || ""),
      escapeCsv((j.woodTypes || []).join(", ")),
      escapeCsv(j.woodTypeOther || ""),
      escapeCsv(j.materialSuppliedBy || "Customer"),
      escapeCsv(j.items?.length || 1),
      escapeCsv(itemsSummary || j.description || ""),
      escapeCsv(Number(j.total) || 0),
      escapeCsv(j.notes || ""),
      escapeCsv(j.deliveryDate || ""),
      escapeCsv(j.status || "Received"),
      escapeCsv(j.invoiceId || ""),
      escapeCsv(j.createdAt ? j.createdAt.slice(0, 10) : ""),
    ];
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadCsv(csvContent, `BalajiWoodKraft_JobOrders_${todayISO()}.csv`);
}

// 3. Export Invoices CSV
export function exportInvoicesCsv(invoices: Invoice[], customers: Customer[]) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));

  const headers = [
    "ID",
    "Invoice No",
    "Invoice Date",
    "Customer ID",
    "Customer Name (Resolved)",
    "Taxable Value (INR)",
    "Tax Type",
    "CGST Rate (%)",
    "CGST Amount (INR)",
    "SGST Rate (%)",
    "SGST Amount (INR)",
    "IGST Rate (%)",
    "IGST Amount (INR)",
    "Round Off",
    "Total Amount (INR)",
    "Status",
    "Linked Job ID",
    "Notes",
    "Line Items Summary",
    "Created At",
  ];

  const rows = invoices.map((inv) => {
    const itemsSummary = (inv.lineItems || [])
      .map(
        (it) => `${it.description} [${it.quantity} ${it.unit} @ ₹${it.ratePerUnit}]: ₹${it.amount}`,
      )
      .join("; ");

    return [
      escapeCsv(inv.id),
      escapeCsv(inv.invoiceNo),
      escapeCsv(inv.invoiceDate || ""),
      escapeCsv(inv.customerId),
      escapeCsv(custMap.get(inv.customerId) || "Customer"),
      escapeCsv(inv.taxableValue || 0),
      escapeCsv(inv.taxType || "CGST_SGST"),
      escapeCsv(inv.cgstRate || 0),
      escapeCsv(inv.cgstAmount || 0),
      escapeCsv(inv.sgstRate || 0),
      escapeCsv(inv.sgstAmount || 0),
      escapeCsv(inv.igstRate || 0),
      escapeCsv(inv.igstAmount || 0),
      escapeCsv(inv.roundOff || 0),
      escapeCsv(inv.totalAmount || 0),
      escapeCsv(inv.status || "Draft"),
      escapeCsv(inv.jobId || ""),
      escapeCsv(inv.notes || ""),
      escapeCsv(itemsSummary),
      escapeCsv(inv.createdAt ? inv.createdAt.slice(0, 10) : ""),
    ];
  });

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadCsv(csvContent, `BalajiWoodKraft_Invoices_${todayISO()}.csv`);
}

// 4. Export Payments CSV
export function exportPaymentsCsv(
  payments: Payment[],
  customers: Customer[],
  jobs: Job[],
  invoices: Invoice[],
) {
  const custMap = new Map(customers.map((c) => [c.id, c.name]));
  const jobMap = new Map(jobs.map((j) => [j.id, j.jobNo]));
  const invMap = new Map(invoices.map((i) => [i.id, i.invoiceNo]));

  const headers = [
    "ID",
    "Payment Date",
    "Customer ID",
    "Customer Name (Resolved)",
    "Amount (INR)",
    "Payment Mode",
    "Payment Type",
    "Linked Job ID",
    "Job Order No (Resolved)",
    "Linked Invoice ID",
    "Invoice No (Resolved)",
    "Reference / UPI",
    "Notes",
    "Created At",
  ];

  const rows = payments.map((p) => [
    escapeCsv(p.id),
    escapeCsv(p.date || ""),
    escapeCsv(p.customerId),
    escapeCsv(custMap.get(p.customerId) || "Customer"),
    escapeCsv(Number(p.amount) || 0),
    escapeCsv(p.mode || "Cash"),
    escapeCsv(p.type || "Advance"),
    escapeCsv(p.jobId || ""),
    escapeCsv(p.jobId ? jobMap.get(p.jobId) || "" : ""),
    escapeCsv(p.linkedInvoiceId || ""),
    escapeCsv(p.linkedInvoiceId ? invMap.get(p.linkedInvoiceId) || "" : ""),
    escapeCsv(p.reference || ""),
    escapeCsv(p.notes || ""),
    escapeCsv(p.createdAt ? p.createdAt.slice(0, 10) : ""),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  downloadCsv(csvContent, `BalajiWoodKraft_Payments_${todayISO()}.csv`);
}

import { useState } from "react";
import { toast } from "sonner";
import { Printer, Download, Edit3, X, Check, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { jobAdvance, jobBalance, jobPayments, useShopProfile } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import { downloadJobPdf } from "@/lib/job-pdf";
import { printJobBill } from "@/lib/job-print";
import { LOGO_PNG_BASE64 } from "@/lib/logo-data";
import type { Job, Payment } from "@/lib/types";

const WOOD_TYPES_LIST = ["Wood", "MDF", "Plywood", "WPC", "Korian", "WPC Door", "ACP", "Others"];

export function JobBillPreviewDialog({
  job,
  payments,
  open,
  onOpenChange,
  onEditRequested,
}: {
  job: Job;
  payments: Payment[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequested?: (job: Job) => void;
}) {
  const { data: shopProfile } = useShopProfile();
  // Header logo by default (Option B), easily switchable to Watermark (Option A) or Both
  const [logoStyle, setLogoStyle] = useState<"header" | "watermark" | "both">("header");
  const [printing, setPrinting] = useState(false);

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
            description: job.description || "CNC Job Work",
            size: "—",
            amount: total,
          },
        ];

  const handlePrint = async () => {
    setPrinting(true);
    try {
      toast.info("Preparing bill for printing…");
      await printJobBill(job, payments, shopProfile, logoStyle);
    } catch {
      toast.error("Could not trigger browser print, downloading PDF instead.");
      downloadJobPdf(job, payments, shopProfile, logoStyle);
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = () => {
    try {
      downloadJobPdf(job, payments, shopProfile, logoStyle);
      toast.success("Job Work Order PDF downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download PDF");
    }
  };

  const handleEdit = () => {
    onOpenChange(false);
    onEditRequested?.(job);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] overflow-y-auto sm:max-w-3xl p-3 sm:p-6 bg-muted/40">
        <DialogHeader className="border-b pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold font-display flex items-center gap-2">
                <Eye className="h-5 w-5 text-amber-700" />
                <span>Job Work Order Bill Preview</span>
                <span className="rounded bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 px-2 py-0.5 text-xs font-mono font-bold">
                  {job.jobNo || "JW-0000"}
                </span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review complete bill details before printing or sharing with customer
              </p>
            </div>

            {/* Logo Layout Options: Option B Header Logo (Default) or Option A Watermark */}
            <div className="flex items-center gap-1 text-xs bg-card border rounded-lg p-1 shadow-2xs">
              <span className="text-[11px] text-muted-foreground px-1.5 font-medium">
                Logo Style:
              </span>
              <button
                type="button"
                onClick={() => setLogoStyle("header")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  logoStyle === "header"
                    ? "bg-amber-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Header Logo in top-left corner (Default)"
              >
                Header Logo
              </button>
              <button
                type="button"
                onClick={() => setLogoStyle("watermark")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  logoStyle === "watermark"
                    ? "bg-amber-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Subtle watermark in center of bill"
              >
                Watermark
              </button>
              <button
                type="button"
                onClick={() => setLogoStyle("both")}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-all ${
                  logoStyle === "both"
                    ? "bg-amber-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Both Header logo and Watermark"
              >
                Both
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Printable Job Slip Preview Container */}
        <div className="py-2">
          <div
            id="printable-bill"
            className="relative mx-auto w-full max-w-2xl bg-[#fffdf9] text-[#281e18] border-2 border-[#b99b7d] rounded-lg shadow-sm p-4 sm:p-6 overflow-hidden select-text"
            style={{ fontFamily: "'Manrope', system-ui, sans-serif" }}
          >
            {/* Option A: Large Subtle Center Watermark */}
            {(logoStyle === "watermark" || logoStyle === "both") && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
                style={{ zIndex: 0 }}
              >
                <img
                  src={LOGO_PNG_BASE64}
                  alt="Watermark"
                  className="w-72 h-72 object-contain opacity-[0.06] grayscale"
                />
              </div>
            )}

            {/* Bill Content Wrapper */}
            <div className="relative z-10 space-y-3.5">
              {/* Header Section with Option B: Top-Left Header Logo */}
              <div className="bg-[#fcf8f2] border border-[#b99b7d] rounded-md p-3 relative">
                <div className="flex items-center gap-3">
                  {/* Top-Left Header Logo */}
                  {(logoStyle === "header" || logoStyle === "both") && (
                    <div className="shrink-0">
                      <img
                        src={LOGO_PNG_BASE64}
                        alt="Balaji Wood Kraft Logo"
                        className="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-md"
                      />
                    </div>
                  )}

                  {/* Shop Typography and Contact Details */}
                  <div className="flex-1 text-center pr-1 sm:pr-2">
                    <h1
                      className="text-lg sm:text-2xl font-black tracking-tight text-[#653a1c]"
                      style={{ fontFamily: "'Sora', sans-serif" }}
                    >
                      BALAJI WOOD KRAFT
                    </h1>
                    <p className="text-[11px] sm:text-xs font-bold text-[#8c552d] tracking-wider uppercase mt-0.5">
                      CNC ROUTER & 2D / 3D WOOD WORK SPECIALIST
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-[#42342c] leading-tight mt-1">
                      {shopProfile?.address ||
                        "No: 439/238/1, GROUND FLOOR, Sydenhams Street, Raja Muthiah Salai, CHOOLAI, CHENNAI -600112"}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-[#42342c] font-medium mt-0.5">
                      Mobile:{" "}
                      <span className="font-bold font-mono">
                        {shopProfile?.phone || "8668021629"}
                      </span>{" "}
                      | Email: {shopProfile?.email || "balajiwoodkrafts@gmail.com"}
                    </p>
                  </div>
                </div>

                {/* Title Ribbon */}
                <div className="mt-2.5 flex justify-center">
                  <span className="inline-block bg-[#653a1c] text-white px-6 py-1 rounded text-xs sm:text-sm font-bold tracking-wider uppercase">
                    JOB WORK ORDER
                  </span>
                </div>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Left Column: Order & Customer Details */}
                <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-2.5 space-y-1.5">
                  <div className="flex">
                    <span className="w-24 font-bold text-[#653a1c]">Job No:</span>
                    <span className="font-mono font-bold text-sm text-[#281e18]">
                      {job.jobNo || "JW-0000"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 font-bold text-[#653a1c]">Customer:</span>
                    <span className="font-bold text-[#281e18]">
                      {job.customerName || "Customer"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-24 font-bold text-[#653a1c]">Mobile:</span>
                    <span className="font-mono text-[#281e18]">{job.mobile || "—"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-24 font-bold text-[#653a1c]">Design File:</span>
                    <span className="font-mono text-[#281e18]">{job.designFileId || "—"}</span>
                  </div>
                </div>

                {/* Right Column: Date, Delivery, Material, Status */}
                <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-2.5 space-y-1.5">
                  <div className="flex">
                    <span className="w-28 font-bold text-[#653a1c]">Order Date:</span>
                    <span className="font-mono text-[#281e18]">
                      {formatDate(job.date || job.dateCreated)}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-bold text-[#653a1c]">Delivery Date:</span>
                    <span className="font-mono text-[#281e18]">
                      {job.deliveryDate ? formatDate(job.deliveryDate) : "As scheduled"}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-bold text-[#653a1c]">Material By:</span>
                    <span className="text-[#281e18]">{job.materialSuppliedBy || "Customer"}</span>
                  </div>
                  <div className="flex">
                    <span className="w-28 font-bold text-[#653a1c]">Status:</span>
                    <span className="font-semibold text-[#653a1c]">{job.status || "Received"}</span>
                  </div>
                </div>
              </div>

              {/* Wood / Material Types Checklist */}
              <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-2.5 text-xs">
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="font-bold text-[#653a1c] text-[11px] uppercase tracking-wide">
                    WOOD / MATERIAL TYPE:
                  </span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 text-[11px]">
                  {WOOD_TYPES_LIST.map((wt) => {
                    const checked = selectedWoodTypes.has(wt);
                    return (
                      <div key={wt} className="flex items-center gap-1 select-none">
                        <span
                          className={`inline-grid h-3.5 w-3.5 place-items-center border border-[#653a1c] rounded-xs text-[9px] font-bold ${
                            checked ? "bg-[#653a1c] text-white" : "bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span
                          className={`truncate ${
                            checked ? "font-bold text-[#653a1c]" : "text-[#42342c]"
                          }`}
                        >
                          {wt === "Others" && job.woodTypeOther ? job.woodTypeOther : wt}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Itemized Work Specification Table */}
              <div className="border border-[#b99b7d] rounded overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#653a1c] text-white font-bold">
                    <tr>
                      <th className="p-2 w-10 text-center border-r border-[#8c552d]">Sl</th>
                      <th className="p-2 border-r border-[#8c552d]">Description of Work</th>
                      <th className="p-2 w-32 text-center border-r border-[#8c552d]">Size / Qty</th>
                      <th className="p-2 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3d3c1]">
                    {items.map((it, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="p-2 text-center font-mono border-r border-[#e3d3c1] text-muted-foreground">
                          {it.slNo ?? idx + 1}
                        </td>
                        <td className="p-2 font-medium border-r border-[#e3d3c1]">
                          {it.description || "CNC Job Work"}
                        </td>
                        <td className="p-2 text-center font-mono border-r border-[#e3d3c1]">
                          {it.size || "—"}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          ₹{formatINR(it.amount || 0)}
                        </td>
                      </tr>
                    ))}

                    {/* Spacer rows for authentic slip look if items < 3 */}
                    {items.length < 3 &&
                      Array.from({ length: 3 - items.length }).map((_, i) => (
                        <tr key={`spacer-${i}`} className="bg-white/50">
                          <td className="p-2 text-center font-mono border-r border-[#e3d3c1] text-muted-foreground/30">
                            {items.length + i + 1}
                          </td>
                          <td className="p-2 border-r border-[#e3d3c1]">&nbsp;</td>
                          <td className="p-2 border-r border-[#e3d3c1]">&nbsp;</td>
                          <td className="p-2">&nbsp;</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Summary & Payment Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {/* Left Column: Payment Details & Notes */}
                <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-2.5 space-y-1.5">
                  <span className="font-bold text-[#653a1c] block text-[11px] uppercase tracking-wide">
                    PAYMENT DETAILS:
                  </span>
                  <div className="flex items-center gap-4 text-xs font-semibold">
                    {["Cash", "GPay", "Bank"].map((m) => {
                      const isChecked = modesUsed.has(m);
                      return (
                        <div key={m} className="flex items-center gap-1.5">
                          <span
                            className={`inline-grid h-3.5 w-3.5 place-items-center border border-[#653a1c] rounded-xs text-[9px] font-bold ${
                              isChecked ? "bg-[#653a1c] text-white" : "bg-white text-transparent"
                            }`}
                          >
                            ✓
                          </span>
                          <span
                            className={isChecked ? "text-[#653a1c] font-bold" : "text-[#42342c]"}
                          >
                            {m === "GPay" ? "GPay / UPI" : m}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-[#b99b7d]/50 pt-1 text-[11px]">
                    <span className="font-semibold text-[#653a1c]">Notes / Ref:</span>{" "}
                    <span className="text-[#42342c]">
                      {job.notes || "Thank you for choosing Balaji Wood Kraft."}
                    </span>
                  </div>
                </div>

                {/* Right Column: Financial Totals */}
                <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-2.5 space-y-1 text-xs">
                  <div className="flex justify-between font-bold">
                    <span className="text-[#42342c]">Total Work Amount:</span>
                    <span className="font-mono text-sm">₹{formatINR(total)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-700">
                    <span>Advance Paid:</span>
                    <span className="font-mono">₹{formatINR(advance)}</span>
                  </div>
                  <div className="border-t border-[#b99b7d] pt-1 flex justify-between font-black text-sm">
                    <span className="text-[#653a1c]">Balance Due:</span>
                    <span
                      className={`font-mono ${balance > 0 ? "text-[#c2410c]" : "text-emerald-700"}`}
                    >
                      {balance > 0 ? `₹${formatINR(balance)}` : "PAID (₹0)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures Box */}
              <div className="border border-[#b99b7d] bg-[#fcf8f2] rounded p-3 grid grid-cols-2 gap-4 text-xs pt-6">
                <div>
                  <div className="border-t border-dashed border-[#8c552d] pt-1 w-36">
                    <span className="text-[10px] text-muted-foreground block">
                      Customer Signature
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-[#653a1c] text-[11px]">for BALAJI WOOD KRAFT</p>
                  <div className="border-t border-dashed border-[#8c552d] pt-1 w-36 ml-auto mt-4">
                    <span className="text-[10px] text-muted-foreground block">
                      Authorized Signatory
                    </span>
                  </div>
                </div>
              </div>

              {/* Footnote */}
              <p className="text-[9px] text-center text-muted-foreground italic">
                * Job work done as per customer specification. Goods once processed cannot be
                returned. Please retain slip for collection.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-wrap items-center justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-amber-600/40 text-amber-900 dark:text-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              onClick={handleEdit}
            >
              <Edit3 className="h-3.5 w-3.5 text-amber-600" />
              <span>Edit Job Order</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleDownload}
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Download PDF</span>
            </Button>

            <Button
              size="sm"
              className="gap-1.5 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white shadow-xs"
              onClick={handlePrint}
              disabled={printing}
            >
              <Printer className="h-3.5 w-3.5" />
              <span>{printing ? "Preparing Print…" : "Print Bill"}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

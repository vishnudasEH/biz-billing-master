import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Calendar, CheckSquare, FileText, Layers, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { customersApi, invoicesApi, jobsApi, paymentsApi, useShopProfile } from "@/lib/db";
import {
  computeTotals,
  determineTaxType,
  formatINR,
  nextInvoiceNo,
  todayISO,
} from "@/lib/invoice-calc";
import type { Invoice, Job, LineItem } from "@/lib/types";

export function MonthlyInvoiceDialog({ trigger }: { trigger?: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: customers = [] } = customersApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: invoices = [] } = invoicesApi.useList();
  const { data: payments = [] } = paymentsApi.useList();
  const { data: shopProfile } = useShopProfile();

  const createInvoice = invoicesApi.useCreate();
  const updateJob = jobsApi.useUpdate();

  // Wizard state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const currentMonthStr = useMemo(() => todayISO().slice(0, 7), []);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [lineItemMode, setLineItemMode] = useState<"perJob" | "combined">("perJob");
  const [hsnCode, setHsnCode] = useState("998831");
  const [gstRate, setGstRate] = useState<number>(shopProfile?.defaultGstRate ?? 18);
  const [invoiceDate, setInvoiceDate] = useState(todayISO());

  // Filter customers - monthlyGstBilling highlighted
  const gstEligibleCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      if (a.monthlyGstBilling && !b.monthlyGstBilling) return -1;
      if (!a.monthlyGstBilling && b.monthlyGstBilling) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [customers]);

  const customer = customers.find((c) => c.id === selectedCustomerId);

  // Completed jobs for this customer that are NOT yet invoiced
  const unInvoicedJobs = useMemo(() => {
    if (!selectedCustomerId) return [];
    return jobs.filter(
      (j) => j.customerId === selectedCustomerId && j.status === "Completed" && !j.invoiceId,
    );
  }, [jobs, selectedCustomerId]);

  // When customer changes, pre-select all un-invoiced completed jobs
  const handleCustomerChange = (custId: string) => {
    setSelectedCustomerId(custId);
    const available = jobs.filter(
      (j) => j.customerId === custId && j.status === "Completed" && !j.invoiceId,
    );
    setSelectedJobIds(available.map((j) => j.id));
  };

  const toggleJob = (id: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(id) ? prev.filter((jid) => jid !== id) : [...prev, id],
    );
  };

  const toggleAllJobs = () => {
    if (selectedJobIds.length === unInvoicedJobs.length) {
      setSelectedJobIds([]);
    } else {
      setSelectedJobIds(unInvoicedJobs.map((j) => j.id));
    }
  };

  const selectedJobs = useMemo(() => {
    return unInvoicedJobs.filter((j) => selectedJobIds.includes(j.id));
  }, [unInvoicedJobs, selectedJobIds]);

  // Sum of job totals
  const totalJobAmount = useMemo(() => {
    return selectedJobs.reduce((s, j) => s + (Number(j.total) || 0), 0);
  }, [selectedJobs]);

  // Payments already received against these jobs
  const paymentsReceived = useMemo(() => {
    const jobIdsSet = new Set(selectedJobIds);
    return payments
      .filter((p) => p.jobId && jobIdsSet.has(p.jobId))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [payments, selectedJobIds]);

  // Generate line items based on user choice
  const generatedLineItems: LineItem[] = useMemo(() => {
    if (selectedJobs.length === 0) return [];

    if (lineItemMode === "perJob") {
      return selectedJobs.map((j, idx) => {
        const itemDescriptions = (j.items || [])
          .map((it) => `${it.description || "Job work"}${it.size ? ` (${it.size})` : ""}`)
          .join(", ");
        const desc = `${j.jobNo || `Job #${idx + 1}`}: ${itemDescriptions || j.description || "CNC Wood Work"} (JOB WORK)`;
        const amt = Number(j.total) || 0;
        return {
          slNo: idx + 1,
          description: desc,
          hsnSacCode: hsnCode,
          quantity: 1,
          unit: "Job",
          ratePerUnit: amt,
          amount: amt,
        };
      });
    } else {
      // Combined line
      const jobNos = selectedJobs.map((j) => j.jobNo || "JW").join(", ");
      const combinedDesc = `CNC ROUTER & WOOD WORK DESIGN - JOBS [${jobNos}] (JOB WORK)`;
      return [
        {
          slNo: 1,
          description: combinedDesc,
          hsnSacCode: hsnCode,
          quantity: 1,
          unit: "Job",
          ratePerUnit: totalJobAmount,
          amount: totalJobAmount,
        },
      ];
    }
  }, [selectedJobs, lineItemMode, hsnCode, totalJobAmount]);

  const taxType = determineTaxType(shopProfile?.stateCode ?? "", customer?.stateCode ?? "");
  const totals = computeTotals(generatedLineItems, taxType, Number(gstRate) || 0);
  const amountDue = Math.max(0, Math.round((totals.totalAmount - paymentsReceived) * 100) / 100);

  const handleCreate = async () => {
    if (!selectedCustomerId) {
      toast.error("Please select a customer");
      return;
    }
    if (selectedJobIds.length === 0) {
      toast.error("Please select at least one completed job work order");
      return;
    }

    setBusy(true);
    try {
      const suggestedNo = nextInvoiceNo(
        invoices.map((i) => i.invoiceNo),
        shopProfile?.invoicePrefix ?? "",
      );
      const half = (Number(gstRate) || 0) / 2;

      const payload: Omit<Invoice, "id"> = {
        invoiceNo: suggestedNo,
        invoiceDate,
        customerId: selectedCustomerId,
        lineItems: generatedLineItems,
        taxableValue: totals.taxableValue,
        taxType,
        cgstRate: taxType === "IGST" ? 0 : half,
        cgstAmount: totals.cgstAmount,
        sgstRate: taxType === "IGST" ? 0 : half,
        sgstAmount: totals.sgstAmount,
        igstRate: taxType === "IGST" ? Number(gstRate) || 0 : 0,
        igstAmount: totals.igstAmount,
        roundOff: totals.roundOff,
        totalAmount: totals.totalAmount,
        status: "Draft",
        notes: `Monthly invoice for ${selectedMonth} covering ${selectedJobs.length} job orders. Advances received: Rs. ${formatINR(paymentsReceived)}.`,
        createdAt: new Date().toISOString(),
      };

      const newInvoiceId = await createInvoice.mutateAsync(payload);

      // Link invoiceId to all included jobs so they cannot be billed again
      for (const job of selectedJobs) {
        await updateJob.mutateAsync({
          id: job.id,
          data: { invoiceId: newInvoiceId },
        });
      }

      toast.success(`Monthly Invoice ${suggestedNo} created for ${selectedJobs.length} jobs!`);
      setOpen(false);
      navigate({ to: "/invoices/$id", params: { id: newInvoiceId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create monthly invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5 font-medium bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" />
            <span>Create Monthly Invoice</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl px-4 py-5 sm:px-6">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
            <span>Create Monthly GST Invoice</span>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary font-mono">
              From Jobs
            </span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Bundle a customer's completed job work orders into an official GST tax invoice.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Step 1: Customer & Month */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="monthly-cust" className="text-xs font-semibold">
                Select Customer
              </Label>
              <select
                id="monthly-cust"
                className="field-select"
                value={selectedCustomerId}
                onChange={(e) => handleCustomerChange(e.target.value)}
              >
                <option value="">-- Choose customer --</option>
                {gstEligibleCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.monthlyGstBilling ? "★ (GST Monthly)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="monthly-month" className="text-xs font-semibold">
                Month
              </Label>
              <Input
                id="monthly-month"
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </div>
          </div>

          {/* Step 2: Uninvoiced Completed Jobs List */}
          {selectedCustomerId && (
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-xs font-semibold">Completed Job Orders</Label>
                  <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5">
                    {unInvoicedJobs.length} available
                  </span>
                </div>
                {unInvoicedJobs.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-primary"
                    onClick={toggleAllJobs}
                  >
                    {selectedJobIds.length === unInvoicedJobs.length ? (
                      <>
                        <Square className="h-3.5 w-3.5" /> Deselect all
                      </>
                    ) : (
                      <>
                        <CheckSquare className="h-3.5 w-3.5" /> Select all ({unInvoicedJobs.length})
                      </>
                    )}
                  </Button>
                )}
              </div>

              {unInvoicedJobs.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No un-invoiced completed jobs found for this customer.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {unInvoicedJobs.map((j) => {
                    const isChecked = selectedJobIds.includes(j.id);
                    return (
                      <div
                        key={j.id}
                        onClick={() => toggleJob(j.id)}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-amber-50/70 border-amber-300 dark:bg-amber-950/30"
                            : "bg-card border-border hover:bg-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            className="rounded border-input text-primary focus:ring-primary h-4 w-4"
                            checked={isChecked}
                            onChange={() => toggleJob(j.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <p className="font-semibold text-foreground font-mono">
                              {j.jobNo || "JW-order"} · {j.description || "Wood job work"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Date: {j.date} · {j.woodTypes?.join(", ") || "Wood"}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-foreground">
                          ₹{formatINR(j.total || 0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Line Item Formatting & Settings */}
          {selectedJobs.length > 0 && (
            <div className="space-y-3 rounded-lg border bg-card p-3.5">
              <Label className="text-xs font-semibold">Invoice Presentation</Label>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={lineItemMode === "perJob" ? "default" : "outline"}
                  className="h-10 text-xs flex items-center justify-center gap-1.5"
                  onClick={() => setLineItemMode("perJob")}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>One line per job ({selectedJobs.length})</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={lineItemMode === "combined" ? "default" : "outline"}
                  className="h-10 text-xs flex items-center justify-center gap-1.5"
                  onClick={() => setLineItemMode("combined")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>One combined total line</span>
                </Button>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <Label className="text-[11px] text-muted-foreground">HSN/SAC Code</Label>
                  <Input
                    className="h-8 text-xs font-mono"
                    value={hsnCode}
                    onChange={(e) => setHsnCode(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">GST %</Label>
                  <Input
                    type="number"
                    className="h-8 text-xs font-mono"
                    value={gstRate}
                    onChange={(e) => setGstRate(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-muted-foreground">Invoice Date</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs font-mono"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Financial Calculation Summary */}
              <div className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span>Selected Jobs Total (Taxable):</span>
                  <span className="font-mono font-medium">₹{formatINR(totals.taxableValue)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>
                    GST (
                    {taxType === "IGST"
                      ? `IGST ${gstRate}%`
                      : `CGST ${gstRate / 2}% + SGST ${gstRate / 2}%`}
                    ):
                  </span>
                  <span className="font-mono">
                    ₹{formatINR(totals.cgstAmount + totals.sgstAmount + totals.igstAmount)}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1 text-foreground">
                  <span>Gross Invoice Total:</span>
                  <span className="font-mono text-sm">₹{formatINR(totals.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Less: Payments Received on these jobs:</span>
                  <span className="font-mono font-medium">− ₹{formatINR(paymentsReceived)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-dashed pt-1 text-amber-700 dark:text-amber-400">
                  <span>Net Amount Due:</span>
                  <span className="font-mono text-sm">₹{formatINR(amountDue)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0 border-t pt-3">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || selectedJobs.length === 0}
            onClick={handleCreate}
            className="font-medium"
          >
            {busy ? "Generating…" : `Create Invoice (${selectedJobs.length} Jobs)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

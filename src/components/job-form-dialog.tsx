import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Printer, Trash2, Upload, UserPlus, Check, Calculator } from "lucide-react";
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
import {
  customersApi,
  jobsApi,
  paymentsApi,
  useShopProfile,
  nextJobNo,
  jobAdvance,
} from "@/lib/db";
import { formatINR, round2, todayISO } from "@/lib/invoice-calc";
import { downloadJobPdf } from "@/lib/job-pdf";
import { printJobBill } from "@/lib/job-print";
import {
  WOOD_TYPES,
  type Customer,
  type Job,
  type JobItem,
  type JobStatus,
  type PaymentMode,
} from "@/lib/types";

export interface JobFormInput {
  jobNo: string;
  date: string;
  customerId: string;
  customerName: string;
  mobile: string;
  designFileId: string;
  woodTypes: string[];
  woodTypeOther: string;
  materialSuppliedBy: string;
  items: JobItem[];
  notes: string;
  deliveryDate: string;
  status: JobStatus;
  advance: number;
  paymentMode: PaymentMode;
}

const emptyItem = (slNo: number): JobItem => ({
  slNo,
  description: "",
  size: "",
  amount: 0,
});

export function JobFormDialog({
  initial,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onSaved,
}: {
  initial?: Job;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (job: Job) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [showQtyRateHelpers, setShowQtyRateHelpers] = useState(false);

  // Success dialog after saving: option to print immediately
  const [savedJobData, setSavedJobData] = useState<Job | null>(null);
  const [savedSuccessModal, setSavedSuccessModal] = useState(false);

  const qc = useQueryClient();
  const { data: customers = [] } = customersApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: payments = [] } = paymentsApi.useList();
  const { data: shopProfile } = useShopProfile();

  const createJob = jobsApi.useCreate();
  const updateJob = jobsApi.useUpdate();
  const createCustomer = customersApi.useCreate();
  const createPayment = paymentsApi.useCreate();
  const updatePayment = paymentsApi.useUpdate();
  const removePayment = paymentsApi.useRemove();

  const [busy, setBusy] = useState(false);

  // Form State
  const [jobNo, setJobNo] = useState("");
  const [date, setDate] = useState(todayISO());
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [designFileId, setDesignFileId] = useState("");
  const [woodTypes, setWoodTypes] = useState<string[]>([]);
  const [woodTypeOther, setWoodTypeOther] = useState("");
  const [materialSuppliedBy, setMaterialSuppliedBy] = useState("Customer");
  const [items, setItems] = useState<JobItem[]>([emptyItem(1)]);
  const [notes, setNotes] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [status, setStatus] = useState<JobStatus>("Received");
  const [advance, setAdvance] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Cash");

  // Reset or Populate form
  useEffect(() => {
    if (!open) return;

    if (initial) {
      setJobNo(initial.jobNo || "");
      setDate(initial.date || initial.dateCreated || todayISO());
      setCustomerId(initial.customerId || "");
      setCustomerName(initial.customerName || "");
      setMobile(initial.mobile || "");
      setCustomerSearch(initial.customerName || "");
      setDesignFileId(initial.designFileId || "");
      setWoodTypes(initial.woodTypes || []);
      setWoodTypeOther(initial.woodTypeOther || "");
      setMaterialSuppliedBy(initial.materialSuppliedBy || "Customer");
      setItems(
        initial.items?.length
          ? initial.items
          : [
              {
                ...emptyItem(1),
                description: initial.description || "",
                amount: initial.total || 0,
              },
            ],
      );
      setNotes(initial.notes || "");
      setDeliveryDate(initial.deliveryDate || "");
      setStatus(initial.status || "Received");

      const existingAdvance = jobAdvance(initial.id, payments);
      setAdvance(existingAdvance);
      const existingPay = payments.find((p) => p.jobId === initial.id);
      if (existingPay?.mode) setPaymentMode(existingPay.mode);
    } else {
      // New Job
      const generated = nextJobNo(jobs);
      setJobNo(generated);
      setDate(todayISO());
      setCustomerId("");
      setCustomerName("");
      setMobile("");
      setCustomerSearch("");
      setDesignFileId("");
      setWoodTypes(["MDF"]);
      setWoodTypeOther("");
      setMaterialSuppliedBy("Customer");
      setItems([emptyItem(1)]);
      setNotes("");
      setDeliveryDate("");
      setStatus("Received");
      setAdvance(0);
      setPaymentMode("Cash");
    }
  }, [open, initial, jobs, payments]);

  // Total calculation
  const total = useMemo(() => {
    return round2(items.reduce((s, it) => s + (Number(it.amount) || 0), 0));
  }, [items]);

  const balance = useMemo(() => {
    return Math.max(0, round2(total - (Number(advance) || 0)));
  }, [total, advance]);

  // Customer Autocomplete list
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone && c.phone.includes(q)))
      .slice(0, 5);
  }, [customers, customerSearch]);

  const selectCustomer = (c: Customer) => {
    setCustomerId(c.id);
    setCustomerName(c.name);
    setMobile(c.phone || "");
    setCustomerSearch(c.name);
  };

  const toggleWoodType = (wt: string) => {
    setWoodTypes((prev) => (prev.includes(wt) ? prev.filter((t) => t !== wt) : [...prev, wt]));
  };

  // Item row operations
  const setItem = (idx: number, patch: Partial<JobItem>) => {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        if (showQtyRateHelpers && ("quantity" in patch || "rate" in patch)) {
          if (next.quantity !== undefined && next.rate !== undefined && next.rate > 0) {
            next.amount = round2(next.quantity * next.rate);
          }
        }
        return next;
      }),
    );
  };

  const addItemRow = () => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) {
      setItems([emptyItem(1)]);
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, slNo: i + 1 })));
  };

  // JSON Import handler
  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (!parsed || typeof parsed !== "object") {
        toast.error("Invalid JSON format");
        return;
      }

      if (parsed.jobNo) setJobNo(String(parsed.jobNo).trim());
      if (parsed.date) setDate(String(parsed.date).trim());
      if (parsed.customerName) {
        const cName = String(parsed.customerName).trim();
        setCustomerName(cName);
        setCustomerSearch(cName);
        // Try matching existing customer
        const matched = customers.find(
          (c) =>
            c.name.toLowerCase() === cName.toLowerCase() ||
            (parsed.mobile && c.phone === String(parsed.mobile).trim()),
        );
        if (matched) {
          setCustomerId(matched.id);
          setMobile(matched.phone || String(parsed.mobile || ""));
        } else {
          setCustomerId("");
          setMobile(String(parsed.mobile || ""));
        }
      }
      if (parsed.mobile) setMobile(String(parsed.mobile).trim());
      if (parsed.designFileId) setDesignFileId(String(parsed.designFileId).trim());
      if (Array.isArray(parsed.woodTypes)) setWoodTypes(parsed.woodTypes);
      if (parsed.woodTypeOther) setWoodTypeOther(String(parsed.woodTypeOther).trim());
      if (parsed.materialSuppliedBy)
        setMaterialSuppliedBy(String(parsed.materialSuppliedBy).trim());
      if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(
          parsed.items.map(
            (it: { description?: string; size?: string; amount?: number }, idx: number) => ({
              slNo: idx + 1,
              description: String(it.description || ""),
              size: String(it.size || ""),
              amount: Number(it.amount) || 0,
            }),
          ),
        );
      }
      if (parsed.advance !== undefined) setAdvance(Number(parsed.advance) || 0);
      if (parsed.paymentMode) {
        const mode = String(parsed.paymentMode);
        if (mode === "Cash" || mode === "GPay" || mode === "Bank") setPaymentMode(mode);
      }
      if (parsed.notes) setNotes(String(parsed.notes).trim());

      setImportModalOpen(false);
      setImportJsonText("");
      toast.success("Job Work Order pre-filled from JSON. Review and save!");
    } catch {
      toast.error("Failed to parse JSON. Please check syntax.");
    }
  };

  // Save handler (Supports both New and Edit)
  const handleSave = async () => {
    const finalJobNo = jobNo.trim() || nextJobNo(jobs);
    const finalCustName = customerName.trim() || customerSearch.trim();

    if (!finalCustName) {
      toast.error("Customer name is required");
      return;
    }

    // Check unique jobNo
    const existingSameNo = jobs.find(
      (j) => j.id !== initial?.id && (j.jobNo || "").toLowerCase() === finalJobNo.toLowerCase(),
    );
    if (existingSameNo) {
      toast.error(`Job No. "${finalJobNo}" is already used. Please provide a unique number.`);
      return;
    }

    // Valid items
    const validItems = items.filter((it) => it.description.trim() || it.amount > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one work item row");
      return;
    }

    setBusy(true);
    try {
      let finalCustId = customerId;

      // Create new customer if not selected
      if (!finalCustId) {
        const matched = customers.find(
          (c) =>
            c.name.toLowerCase() === finalCustName.toLowerCase() ||
            (mobile && c.phone === mobile.trim()),
        );
        if (matched) {
          finalCustId = matched.id;
        } else {
          finalCustId = await createCustomer.mutateAsync({
            name: finalCustName,
            address: "",
            phone: mobile.trim() || undefined,
            state: "Tamil Nadu",
            stateCode: "33",
            createdAt: todayISO(),
          });
        }
      }

      const jobPayload: Omit<Job, "id"> = {
        jobNo: finalJobNo,
        date: date || todayISO(),
        customerId: finalCustId,
        customerName: finalCustName,
        mobile: mobile.trim() || undefined,
        designFileId: designFileId.trim() || undefined,
        woodTypes,
        woodTypeOther: woodTypes.includes("Others") ? woodTypeOther.trim() : undefined,
        materialSuppliedBy: materialSuppliedBy.trim() || "Customer",
        items: items.map((it, idx) => ({
          slNo: idx + 1,
          description: it.description.trim() || "CNC Wood Work",
          size: it.size.trim(),
          amount: Number(it.amount) || 0,
        })),
        total,
        notes: notes.trim() || undefined,
        deliveryDate: deliveryDate || null,
        status,
        invoiceId: initial?.invoiceId ?? null,
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        description: items[0]?.description || "Job Work",
      };

      let currentJobId = initial?.id;
      if (initial) {
        await updateJob.mutateAsync({ id: initial.id, data: jobPayload });
      } else {
        currentJobId = await createJob.mutateAsync(jobPayload);
      }

      // Handle Advance Payment for both New AND Edit
      if (currentJobId) {
        const existingPayments = payments.filter((p) => p.jobId === currentJobId);
        const existingAdvance =
          existingPayments.find((p) => p.type === "Advance") || existingPayments[0];

        if (initial) {
          if (existingAdvance) {
            if (advance > 0) {
              await updatePayment.mutateAsync({
                id: existingAdvance.id,
                data: {
                  amount: Number(advance),
                  mode: paymentMode,
                  date: date || todayISO(),
                  customerId: finalCustId,
                  reference: notes.trim() || undefined,
                  notes: `Advance for ${finalJobNo} via ${paymentMode}`,
                },
              });
            } else {
              // Advance reduced to 0, remove previous advance
              await removePayment.mutateAsync(existingAdvance.id);
            }
          } else if (advance > 0) {
            // No prior payment, add new advance payment
            await createPayment.mutateAsync({
              jobId: currentJobId,
              customerId: finalCustId,
              amount: Number(advance),
              date: date || todayISO(),
              mode: paymentMode,
              type: "Advance",
              reference: notes.trim() || undefined,
              notes: `Advance for ${finalJobNo} via ${paymentMode}`,
              createdAt: new Date().toISOString(),
            });
          }
        } else {
          // Newly created job with advance
          if (advance > 0) {
            await createPayment.mutateAsync({
              jobId: currentJobId,
              customerId: finalCustId,
              amount: Number(advance),
              date: date || todayISO(),
              mode: paymentMode,
              type: "Advance",
              reference: notes.trim() || undefined,
              notes: `Advance for ${finalJobNo} via ${paymentMode}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // Ensure cache is updated everywhere
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["customers"] });

      const fullJob: Job = { id: currentJobId!, ...jobPayload };
      setSavedJobData(fullJob);
      toast.success(initial ? "Job Work Order updated successfully!" : "Job Work Order created!");
      setOpen(false);
      onSaved?.(fullJob);

      // Offer immediate print modal if newly created
      if (!initial) {
        setSavedSuccessModal(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save Job Work Order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl px-4 py-5 sm:px-6">
          <DialogHeader className="border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <DialogTitle className="text-lg font-bold font-display flex items-center gap-2">
                  <span>{initial ? "Edit Job Work Order" : "New Job Work Order"}</span>
                  <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 text-xs font-mono font-bold text-amber-900 dark:text-amber-200">
                    {jobNo || "JW-"}
                  </span>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Balaji Wood Kraft · CNC & Wood Job Work Slip
                </p>
              </div>

              {!initial && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setImportModalOpen(true)}
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import JSON</span>
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Row 1: Job No & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="job-no" className="text-xs font-semibold">
                  Job No. (Slip #)
                </Label>
                <Input
                  id="job-no"
                  value={jobNo}
                  onChange={(e) => setJobNo(e.target.value)}
                  placeholder="JW-0001"
                  className="font-mono font-semibold"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="job-date" className="text-xs font-semibold">
                  Date
                </Label>
                <Input
                  id="job-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Row 2: Customer Search / Selection */}
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Customer Details</Label>
                {customerId && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Linked to customer record
                  </span>
                )}
              </div>

              <div className="relative">
                <Input
                  placeholder="Search customer by name or phone…"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerName(e.target.value);
                    setCustomerId("");
                  }}
                  className="font-medium"
                />
                {filteredCustomers.length > 0 && customerSearch && !customerId && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left rounded px-3 py-2 text-xs hover:bg-accent flex items-center justify-between transition-colors"
                        onClick={() => selectCustomer(c)}
                      >
                        <span className="font-semibold text-foreground">{c.name}</span>
                        <span className="font-mono text-muted-foreground">
                          {c.phone || "No phone"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="cust-mobile" className="text-[11px] text-muted-foreground">
                    Mobile Number
                  </Label>
                  <Input
                    id="cust-mobile"
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="design-file" className="text-[11px] text-muted-foreground">
                    Design File ID / Name
                  </Label>
                  <Input
                    id="design-file"
                    placeholder="e.g. BAL-042-3D"
                    value={designFileId}
                    onChange={(e) => setDesignFileId(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Wood / Material Types */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Wood / Material Type</Label>
                <span className="text-[11px] text-muted-foreground">Select all that apply</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WOOD_TYPES.map((wt) => {
                  const isSelected = woodTypes.includes(wt);
                  return (
                    <button
                      key={wt}
                      type="button"
                      onClick={() => toggleWoodType(wt)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all select-none ${
                        isSelected
                          ? "bg-amber-600 text-white border-amber-700 shadow-xs"
                          : "bg-background text-foreground hover:bg-muted border-input"
                      }`}
                    >
                      <span
                        className={`grid h-3.5 w-3.5 place-items-center rounded-xs border text-[9px] ${
                          isSelected ? "border-white bg-white/20" : "border-muted-foreground"
                        }`}
                      >
                        {isSelected ? "✓" : ""}
                      </span>
                      {wt}
                    </button>
                  );
                })}
              </div>

              {woodTypes.includes("Others") && (
                <div className="pt-1.5">
                  <Input
                    placeholder="Specify other material (e.g. Teak Wood, HDF, Brass)"
                    value={woodTypeOther}
                    onChange={(e) => setWoodTypeOther(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>

            {/* Row 4: Material Supplied By & Delivery Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Material Supplied By</Label>
                <div className="flex gap-2">
                  {["Customer", "Shop"].map((src) => (
                    <Button
                      key={src}
                      type="button"
                      variant={materialSuppliedBy === src ? "default" : "outline"}
                      size="sm"
                      className="flex-1 h-9"
                      onClick={() => setMaterialSuppliedBy(src)}
                    >
                      {src}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery-date" className="text-xs font-semibold">
                  Delivery Date (Optional)
                </Label>
                <Input
                  id="delivery-date"
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            {/* Row 5: Repeating Work Items */}
            <div className="space-y-2 border-t pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">Items / Work Specification</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Direct amount entered; size is free text (e.g. "6x6 mm", "206.5 sqft")
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowQtyRateHelpers(!showQtyRateHelpers)}
                >
                  <Calculator className="h-3 w-3" />
                  <span>{showQtyRateHelpers ? "Hide Qty/Rate" : "Qty/Rate Helper"}</span>
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((it, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border bg-card p-3 space-y-2 shadow-xs transition-colors hover:border-primary/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-muted font-mono text-[10px] font-bold text-muted-foreground">
                        {idx + 1}
                      </span>
                      <Input
                        placeholder="Description of work (e.g. Lower Engraving, Jali Cutting)"
                        value={it.description}
                        onChange={(e) => setItem(idx, { description: e.target.value })}
                        className="flex-1 text-sm font-medium"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {showQtyRateHelpers && (
                        <>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Qty</Label>
                            <Input
                              type="number"
                              step="any"
                              placeholder="1"
                              value={it.quantity ?? ""}
                              onChange={(e) =>
                                setItem(idx, { quantity: Number(e.target.value) || 0 })
                              }
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground">Rate (₹)</Label>
                            <Input
                              type="number"
                              step="any"
                              placeholder="0"
                              value={it.rate ?? ""}
                              onChange={(e) => setItem(idx, { rate: Number(e.target.value) || 0 })}
                              className="h-8 text-xs font-mono"
                            />
                          </div>
                        </>
                      )}
                      <div className="col-span-1">
                        <Label className="text-[10px] text-muted-foreground">
                          Size (Free Text)
                        </Label>
                        <Input
                          placeholder='e.g. "6x6 mm", "4x2 ft"'
                          value={it.size}
                          onChange={(e) => setItem(idx, { size: e.target.value })}
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="col-span-1">
                        <Label className="text-[10px] text-muted-foreground font-semibold text-foreground">
                          Amount (₹)
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          value={it.amount || ""}
                          onChange={(e) => setItem(idx, { amount: Number(e.target.value) || 0 })}
                          className="h-8 text-xs font-mono font-bold"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full h-9 border-dashed text-xs gap-1.5"
                onClick={addItemRow}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Row</span>
              </Button>
            </div>

            {/* Row 6: Advance & Payment Mode & Total Summary (Fully editable for both new and existing jobs) */}
            <div className="rounded-lg border border-amber-200/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3">
              <div className="flex flex-wrap items-baseline justify-between border-b border-amber-200/50 pb-2">
                <span className="text-sm font-semibold text-foreground">Total Order Amount</span>
                <span className="font-display text-2xl font-bold font-mono text-foreground">
                  ₹{formatINR(total)}
                </span>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="adv-amt" className="text-xs font-semibold">
                      Advance Received (₹)
                    </Label>
                    <Input
                      id="adv-amt"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={advance || ""}
                      onChange={(e) => setAdvance(Number(e.target.value) || 0)}
                      className="font-mono font-semibold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold">Payment Mode</Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(["Cash", "GPay", "Bank"] as PaymentMode[]).map((m) => (
                        <Button
                          key={m}
                          type="button"
                          size="sm"
                          variant={paymentMode === m ? "default" : "outline"}
                          className={`h-9 text-xs font-medium ${
                            paymentMode === m ? "bg-amber-700 text-white hover:bg-amber-800" : ""
                          }`}
                          onClick={() => setPaymentMode(m)}
                        >
                          {m}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-amber-200/50">
                  <span className="text-muted-foreground">Balance Due on Completion:</span>
                  <span
                    className={`font-mono text-base ${
                      balance > 0
                        ? "text-amber-700 dark:text-amber-400 font-bold"
                        : "text-emerald-600 font-bold"
                    }`}
                  >
                    {balance > 0 ? `₹${formatINR(balance)}` : "Fully Paid (₹0)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Row 7: Notes & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="job-notes" className="text-xs font-semibold">
                  Notes / UPI Reference
                </Label>
                <Input
                  id="job-notes"
                  placeholder="e.g. UPI Ref / Customer remarks"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="job-status" className="text-xs font-semibold">
                  Order Status
                </Label>
                <select
                  id="job-status"
                  className="field-select h-10"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as JobStatus)}
                >
                  <option value="Received">Received</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0 border-t pt-3">
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={handleSave}
              className="bg-amber-700 hover:bg-amber-800 text-white font-semibold h-10 px-6"
            >
              {busy ? "Saving…" : initial ? "Update Job Order" : "Save Job Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={setImportModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Import Handwritten Slip JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <p className="text-muted-foreground">
              Paste the structured JSON from handwritten notes or slip scanner. It will pre-fill the
              form for your review before saving.
            </p>
            <textarea
              rows={9}
              className="w-full rounded-md border font-mono text-xs p-2.5 bg-muted/40"
              placeholder={`{
  "customerName": "Ramesh Wood Works",
  "mobile": "9840123456",
  "designFileId": "FLOWER-2D",
  "woodTypes": ["Plywood", "MDF"],
  "items": [{ "description": "Lower Engraving", "size": "6x6 mm", "amount": 1200 }],
  "advance": 500,
  "paymentMode": "GPay"
}`}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setImportModalOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImportJson} disabled={!importJsonText.trim()}>
              Fill Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Modal: Instant Print / Share PDF */}
      <Dialog open={savedSuccessModal} onOpenChange={setSavedSuccessModal}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
              Job Work Order Saved!
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              {savedJobData?.jobNo} · {savedJobData?.customerName}
            </p>
            <p>
              Total: <strong className="font-mono">₹{formatINR(savedJobData?.total || 0)}</strong>
              {advance > 0 && ` · Advance: ₹${formatINR(advance)} (${paymentMode})`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (savedJobData) printJobBill(savedJobData, payments, shopProfile);
              }}
            >
              <Printer className="h-4 w-4 text-emerald-600" />
              <span>Print Bill</span>
            </Button>
            <Button
              className="gap-2 bg-amber-700 hover:bg-amber-800 text-white"
              onClick={() => {
                if (savedJobData) downloadJobPdf(savedJobData, payments, shopProfile);
              }}
            >
              <FileText className="h-4 w-4" />
              <span>Download PDF</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 text-xs"
            onClick={() => setSavedSuccessModal(false)}
          >
            Done / Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

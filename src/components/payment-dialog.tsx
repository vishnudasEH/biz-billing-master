import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { customersApi, invoicesApi, jobBalance, jobsApi, paymentsApi } from "@/lib/db";
import { formatINR, todayISO } from "@/lib/invoice-calc";
import type { Payment, PaymentMode, PaymentType } from "@/lib/types";

export type PaymentInput = Omit<Payment, "id">;

export function PaymentDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: ReactNode;
  initial?: Partial<PaymentInput>;
  onSave: (p: PaymentInput) => Promise<unknown>;
}) {
  const customers = customersApi.useList();
  const invoices = invoicesApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: allPayments = [] } = paymentsApi.useList();
  const createCustomer = customersApi.useCreate();

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const blank = (): PaymentInput => ({
    customerId: initial?.customerId ?? "",
    jobId: initial?.jobId ?? null,
    amount: initial?.amount ?? 0,
    date: initial?.date ?? todayISO(),
    mode: (initial?.mode as PaymentMode) ?? "Cash",
    type: initial?.type ?? "Advance",
    reference: initial?.reference ?? "",
    linkedInvoiceId: initial?.linkedInvoiceId ?? null,
    notes: initial?.notes ?? "",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });

  const [f, setF] = useState<PaymentInput>(blank);

  useEffect(() => {
    if (open) {
      setF({
        customerId: initial?.customerId ?? "",
        jobId: initial?.jobId ?? null,
        amount: initial?.amount ?? 0,
        date: initial?.date ?? todayISO(),
        mode: (initial?.mode as PaymentMode) ?? "Cash",
        type: initial?.type ?? "Advance",
        reference: initial?.reference ?? "",
        linkedInvoiceId: initial?.linkedInvoiceId ?? null,
        notes: initial?.notes ?? "",
        createdAt: initial?.createdAt ?? new Date().toISOString(),
      });
      setShowAddCustomer(false);
      setNewCustName("");
      setNewCustPhone("");
    }
  }, [open, initial]);

  const custInvoices = (invoices.data ?? []).filter(
    (i) => i.customerId === f.customerId && i.status !== "Draft",
  );

  const selectedJob = jobs.find((j) => j.id === f.jobId);
  const selectedJobBalance = selectedJob ? Math.max(0, jobBalance(selectedJob, allPayments)) : null;

  const handleQuickAddCustomer = async () => {
    if (!newCustName.trim()) {
      toast.error("Please enter customer name");
      return;
    }
    try {
      const newId = await createCustomer.mutateAsync({
        name: newCustName.trim(),
        phone: newCustPhone.trim() || undefined,
        address: "Chennai, Tamil Nadu",
        state: "Tamil Nadu",
        stateCode: "33",
        createdAt: new Date().toISOString(),
      });
      setF((prev) => ({ ...prev, customerId: newId }));
      setShowAddCustomer(false);
      toast.success(`Customer "${newCustName.trim()}" added`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create customer");
    }
  };

  const save = async (): Promise<void> => {
    if (!f.customerId) {
      toast.error("Please select a customer");
      return;
    }
    if (!(f.amount > 0)) {
      toast.error("Amount must be greater than 0");
      return;
    }
    if (!f.date) {
      toast.error("Date is required");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...f,
        amount: Number(f.amount),
        notes: f.notes?.trim() || undefined,
        reference: f.reference?.trim() || undefined,
      });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save payment");
    } finally {
      setBusy(false);
    }
  };

  // Normalization for type
  const normalizedType =
    f.type === "Balance" || f.type === "Balance Payment"
      ? "Balance Payment"
      : f.type === "Full" || f.type === "Full Payment"
        ? "Full Payment"
        : "Advance";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-bold">
            {initial?.customerId ? "Edit Payment Record" : "Record Customer Payment"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3.5 py-1">
          {/* Customer Selection with Quick Add */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Customer</Label>
              <button
                type="button"
                onClick={() => setShowAddCustomer(!showAddCustomer)}
                className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold hover:underline flex items-center gap-1"
              >
                <UserPlus className="h-3 w-3" />
                <span>{showAddCustomer ? "Cancel" : "+ Quick Add"}</span>
              </button>
            </div>

            {showAddCustomer ? (
              <div className="rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 p-2.5 space-y-2">
                <Input
                  placeholder="New Customer Name"
                  className="h-8 text-xs bg-background"
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                />
                <Input
                  placeholder="Mobile / Phone (Optional)"
                  className="h-8 text-xs bg-background"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs w-full bg-amber-700 hover:bg-amber-800 text-white"
                  onClick={handleQuickAddCustomer}
                >
                  Create & Select Customer
                </Button>
              </div>
            ) : (
              <select
                className="field-select text-sm h-10 w-full rounded-md border border-input bg-card px-3"
                value={f.customerId}
                onChange={(e) => {
                  const newCustId = e.target.value;
                  const jobBelongs = jobs.find((j) => j.id === f.jobId)?.customerId === newCustId;
                  setF({
                    ...f,
                    customerId: newCustId,
                    jobId: jobBelongs ? f.jobId : null,
                    linkedInvoiceId: null,
                  });
                }}
              >
                <option value="">Select customer…</option>
                {(customers.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Amount & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="h-10 font-mono font-bold text-sm"
                value={f.amount || ""}
                onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Date</Label>
              <Input
                type="date"
                className="h-10 text-sm font-mono"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
          </div>

          {/* Type & Payment Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Payment Type</Label>
              <select
                className="field-select text-sm h-10 w-full rounded-md border border-input bg-card px-3"
                value={normalizedType}
                onChange={(e) => setF({ ...f, type: e.target.value as PaymentType })}
              >
                <option value="Advance">Advance</option>
                <option value="Balance Payment">Balance Payment</option>
                <option value="Full Payment">Full Payment</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Mode</Label>
              <select
                className="field-select text-sm h-10 w-full rounded-md border border-input bg-card px-3"
                value={f.mode ?? "Cash"}
                onChange={(e) => setF({ ...f, mode: e.target.value as PaymentMode })}
              >
                <option value="Cash">Cash (Physical Drawer)</option>
                <option value="GPay">GPay / UPI</option>
                <option value="Bank">Bank Transfer / NEFT</option>
              </select>
            </div>
          </div>

          {/* Linked Job Work Order */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Linked Job Work Order (Optional)</Label>
              {selectedJobBalance !== null && (
                <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 font-semibold">
                  Job Balance: ₹{formatINR(selectedJobBalance)}
                </span>
              )}
            </div>
            <select
              className="field-select text-xs sm:text-sm h-10 w-full rounded-md border border-input bg-card px-3"
              value={f.jobId ?? ""}
              onChange={(e) => {
                const chosenJobId = e.target.value || null;
                const chosenJob = jobs.find((j) => j.id === chosenJobId);
                const targetCustId = chosenJob ? chosenJob.customerId : f.customerId;
                setF({
                  ...f,
                  jobId: chosenJobId,
                  customerId: targetCustId,
                });
              }}
            >
              <option value="">None / General Customer Payment</option>
              {jobs
                .filter((j) => !f.customerId || j.customerId === f.customerId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNo || "JW-order"} · {j.customerName} (₹{formatINR(j.total)})
                  </option>
                ))}
            </select>
          </div>

          {/* Linked Tax Invoice */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Linked Tax Invoice (Optional)</Label>
            <select
              className="field-select text-xs sm:text-sm h-10 w-full rounded-md border border-input bg-card px-3"
              value={f.linkedInvoiceId ?? ""}
              onChange={(e) => setF({ ...f, linkedInvoiceId: e.target.value || null })}
            >
              <option value="">None</option>
              {custInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNo} · ₹{formatINR(i.totalAmount)}
                </option>
              ))}
            </select>
          </div>

          {/* Reference & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Reference / UPI ID / Chq #</Label>
              <Input
                placeholder="UPI ref / Cheque #"
                className="h-9 text-xs"
                value={f.reference ?? ""}
                onChange={(e) => setF({ ...f, reference: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Notes</Label>
              <Input
                placeholder="e.g. Received at shop"
                className="h-9 text-xs"
                value={f.notes ?? ""}
                onChange={(e) => setF({ ...f, notes: e.target.value })}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold"
            disabled={busy}
            onClick={save}
          >
            {busy ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

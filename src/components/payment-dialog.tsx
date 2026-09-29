import { useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { customersApi, invoicesApi } from "@/lib/db";
import { todayISO } from "@/lib/invoice-calc";
import type { Payment, PaymentType } from "@/lib/types";

export type PaymentInput = Omit<Payment, "id">;
const TYPES: PaymentType[] = ["Advance", "Full Payment", "Balance Payment"];

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
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const blank = (): PaymentInput => ({
    customerId: initial?.customerId ?? "",
    jobId: initial?.jobId ?? null,
    amount: initial?.amount ?? 0,
    date: initial?.date ?? todayISO(),
    mode: initial?.mode ?? "Cash",
    type: initial?.type ?? "Advance",
    reference: initial?.reference ?? "",
    linkedInvoiceId: initial?.linkedInvoiceId ?? null,
    notes: initial?.notes ?? "",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });
  const [f, setF] = useState<PaymentInput>(blank);
  const custInvoices = (invoices.data ?? []).filter(
    (i) => i.customerId === f.customerId && i.status !== "Draft",
  );
  const save = async (): Promise<void> => {
    if (!f.customerId) {
      toast.error("Select a customer");
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
      await onSave(f);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setF(blank());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.customerId ? "Edit payment" : "Record payment"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <select
              className="field-select"
              value={f.customerId}
              onChange={(e) => setF({ ...f, customerId: e.target.value, linkedInvoiceId: null })}
            >
              <option value="">Select customer</option>
              {(customers.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={f.amount || ""}
                onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={f.date}
                onChange={(e) => setF({ ...f, date: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className="field-select"
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value as PaymentType })}
              >
                <option value="Advance">Advance</option>
                <option value="Balance">Balance</option>
                <option value="Full">Full Payment</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Mode</Label>
              <select
                className="field-select"
                value={f.mode ?? "Cash"}
                onChange={(e) => setF({ ...f, mode: e.target.value as Payment["mode"] })}
              >
                <option value="Cash">Cash</option>
                <option value="GPay">GPay / UPI</option>
                <option value="Bank">Bank</option>
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Linked Job Work Order (optional)</Label>
            <select
              className="field-select"
              value={f.jobId ?? ""}
              onChange={(e) => setF({ ...f, jobId: e.target.value || null })}
            >
              <option value="">None</option>
              {jobs
                .filter((j) => !f.customerId || j.customerId === f.customerId)
                .map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobNo || "JW-order"} · {j.customerName} (₹{j.total})
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Linked invoice (optional)</Label>
            <select
              className="field-select"
              value={f.linkedInvoiceId ?? ""}
              onChange={(e) => setF({ ...f, linkedInvoiceId: e.target.value || null })}
            >
              <option value="">None</option>
              {custInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNo} · ₹{i.totalAmount}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={f.notes ?? ""} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={busy} onClick={save}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

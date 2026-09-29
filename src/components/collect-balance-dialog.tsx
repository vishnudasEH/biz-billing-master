import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Banknote, Landmark, Smartphone } from "lucide-react";
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
import { paymentsApi, jobAdvance, jobBalance, jobsApi } from "@/lib/db";
import { formatINR, todayISO } from "@/lib/invoice-calc";
import type { Job, Payment, PaymentMode } from "@/lib/types";

export function CollectBalanceDialog({
  job,
  payments,
  trigger,
  onCollected,
}: {
  job: Job;
  payments: Payment[];
  trigger?: ReactNode;
  onCollected?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const createPayment = paymentsApi.useCreate();
  const updateJob = jobsApi.useUpdate();

  const total = Number(job.total) || 0;
  const advance = jobAdvance(job.id, payments);
  const remaining = Math.max(0, jobBalance(job, payments));

  const [amount, setAmount] = useState<number>(remaining);
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [date, setDate] = useState<string>(todayISO());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [markDelivered, setMarkDelivered] = useState(job.status === "Completed");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setAmount(remaining);
      setMode("Cash");
      setDate(todayISO());
      setReference("");
      setNotes("");
      setMarkDelivered(job.status === "Completed");
    }
  };

  const handleSave = async () => {
    if (amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    if (amount > remaining + 0.01) {
      const confirmExtra = confirm(
        `Amount entered (₹${formatINR(amount)}) is more than remaining balance (₹${formatINR(remaining)}). Continue?`,
      );
      if (!confirmExtra) return;
    }

    setBusy(true);
    try {
      await createPayment.mutateAsync({
        jobId: job.id,
        customerId: job.customerId,
        amount: Number(amount),
        date,
        mode,
        type: "Balance",
        reference: reference.trim() || undefined,
        notes:
          notes.trim() ||
          `Balance payment for Job ${job.jobNo || "order"} via ${mode}${reference ? ` (${reference})` : ""}`,
        createdAt: new Date().toISOString(),
      });

      if (markDelivered && job.status !== "Delivered") {
        await updateJob.mutateAsync({
          id: job.id,
          data: { status: "Delivered" },
        });
      }

      toast.success(`Received ₹${formatINR(amount)} via ${mode}`);
      setOpen(false);
      onCollected?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-medium">
            Collect ₹{formatINR(remaining)}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-base sm:text-lg">
            <span>Collect Balance</span>
            <span className="text-sm font-mono font-bold text-primary">
              {job.jobNo || "Job Order"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Job summary card */}
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Customer:</span>
              <span className="font-semibold text-foreground">{job.customerName}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Total Job Order:</span>
              <span className="font-mono font-medium">₹{formatINR(total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Advance Paid so far:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                ₹{formatINR(advance)}
              </span>
            </div>
            <div className="border-t border-amber-200/50 pt-1.5 flex justify-between items-center text-sm font-bold">
              <span className="text-amber-900 dark:text-amber-200">Balance Pending:</span>
              <span className="text-amber-700 dark:text-amber-400 text-base font-mono">
                ₹{formatINR(remaining)}
              </span>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="pay-amount">Amount to Collect (₹)</Label>
              <button
                type="button"
                className="text-xs text-primary hover:underline font-medium"
                onClick={() => setAmount(remaining)}
              >
                Full balance (₹{formatINR(remaining)})
              </button>
            </div>
            <Input
              id="pay-amount"
              type="number"
              step="1"
              min="1"
              className="text-lg font-mono font-semibold"
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>

          {/* Payment Mode chips */}
          <div className="space-y-1.5">
            <Label>Payment Mode</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={mode === "Cash" ? "default" : "outline"}
                className="h-11 flex items-center justify-center gap-2 font-medium"
                onClick={() => setMode("Cash")}
              >
                <Banknote className="h-4 w-4 text-emerald-500" />
                <span>Cash</span>
              </Button>
              <Button
                type="button"
                variant={mode === "GPay" ? "default" : "outline"}
                className="h-11 flex items-center justify-center gap-2 font-medium"
                onClick={() => setMode("GPay")}
              >
                <Smartphone className="h-4 w-4 text-blue-500" />
                <span>GPay / UPI</span>
              </Button>
              <Button
                type="button"
                variant={mode === "Bank" ? "default" : "outline"}
                className="h-11 flex items-center justify-center gap-2 font-medium"
                onClick={() => setMode("Bank")}
              >
                <Landmark className="h-4 w-4 text-purple-500" />
                <span>Bank</span>
              </Button>
            </div>
          </div>

          {/* Date & Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Payment Date</Label>
              <Input
                id="pay-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">UPI Ref / Cheque No</Label>
              <Input
                id="pay-ref"
                placeholder={mode === "GPay" ? "UPI Trans ID" : "Ref / Cheque"}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Status option */}
          {job.status === "Completed" && (
            <label className="flex items-center gap-2.5 pt-1 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-input h-4 w-4 text-primary focus:ring-primary"
                checked={markDelivered}
                onChange={(e) => setMarkDelivered(e.target.checked)}
              />
              <span className="font-medium text-foreground">
                Mark Job Work as <strong className="text-emerald-600">Delivered</strong>
              </span>
            </label>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || amount <= 0}
            onClick={handleSave}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {busy ? "Saving…" : `Confirm ₹${formatINR(amount)} (${mode})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

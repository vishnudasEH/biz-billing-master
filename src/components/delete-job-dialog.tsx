import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { jobsApi, paymentsApi } from "@/lib/db";
import { formatINR, formatDate } from "@/lib/invoice-calc";
import type { Job } from "@/lib/types";

export function DeleteJobDialog({
  job,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  onDeleted,
}: {
  job: Job;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = setControlledOpen ?? setInternalOpen;
  const [busy, setBusy] = useState(false);

  const qc = useQueryClient();
  const removeJob = jobsApi.useRemove();
  const { data: payments = [] } = paymentsApi.useList();
  const removePayment = paymentsApi.useRemove();

  const handleDelete = async () => {
    setBusy(true);
    try {
      // 1. Delete all payments linked to this job
      const linkedPayments = payments.filter((p) => p.jobId === job.id);
      for (const p of linkedPayments) {
        await removePayment.mutateAsync(p.id);
      }

      // 2. Delete the job record from Firestore
      await removeJob.mutateAsync(job.id);

      // 3. Force invalidate queries to guarantee instant UI update
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["payments"] });

      toast.success(`Job Work Order ${job.jobNo || ""} deleted successfully`);
      setOpen(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete job order");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Delete Job Work Order
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Are you sure you want to delete this job order?
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3.5 space-y-2 text-xs my-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Job Order No:</span>
            <span className="font-mono font-bold text-foreground text-sm">
              {job.jobNo || "JW-order"}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Order Date:</span>
            <span className="font-mono text-foreground">
              {formatDate(job.date || job.dateCreated)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Customer:</span>
            <span className="font-semibold text-foreground">{job.customerName || "Customer"}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Total Value:</span>
            <span className="font-mono font-bold text-foreground">
              ₹{formatINR(job.total || 0)}
            </span>
          </div>
          <p className="text-[11px] text-destructive pt-2 border-t border-border font-medium">
            This will permanently remove the job record and its associated payment logs.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={busy}
            onClick={handleDelete}
            className="gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            <span>{busy ? "Deleting…" : "Yes, Delete Order"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

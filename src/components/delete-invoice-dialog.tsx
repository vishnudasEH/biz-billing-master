import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShieldAlert, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { getInvoiceAssociatedPayments, invoicesApi, jobsApi } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import type { Invoice, Job, Payment } from "@/lib/types";

export function DeleteInvoiceDialog({
  invoice,
  open,
  onOpenChange,
  customerName,
  jobs,
  payments,
  onDeleted,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string | undefined;
  jobs: Job[];
  payments: Payment[];
  onDeleted?: () => void;
}) {
  const qc = useQueryClient();
  const updateInvoice = invoicesApi.useUpdate();
  const updateJob = jobsApi.useUpdate();
  const [busy, setBusy] = useState(false);
  const [acknowledgeJobPayments, setAcknowledgeJobPayments] = useState(false);

  useEffect(() => {
    if (open) {
      setAcknowledgeJobPayments(false);
    }
  }, [open, invoice?.id]);

  if (!invoice) return null;

  const { linkedJobs, directPayments, jobOnlyPayments, directTotal, jobOnlyTotal } =
    getInvoiceAssociatedPayments(invoice, jobs, payments);

  const hasDirectPayments = directPayments.length > 0;
  const hasJobOnlyPayments = !hasDirectPayments && jobOnlyPayments.length > 0;
  const canConfirmDelete = !hasDirectPayments && (!hasJobOnlyPayments || acknowledgeJobPayments);

  const handleSoftDelete = async () => {
    if (!canConfirmDelete || busy) return;
    setBusy(true);
    try {
      // 1. Soft-delete invoice record so historical data remains recoverable for accounting/audit
      await updateInvoice.mutateAsync({
        id: invoice.id,
        data: {
          isDeleted: true,
          deletedAt: new Date().toISOString(),
        },
      });

      // 2. Unlink only jobs currently pointing to this invoice (never delete Job Work Orders)
      const jobsToUnlink = jobs.filter((j) => j.invoiceId === invoice.id);
      for (const job of jobsToUnlink) {
        await updateJob.mutateAsync({
          id: job.id,
          data: { invoiceId: null },
        });
      }

      // 3. Immediately refresh invoice and job listings
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["jobs"] }),
      ]);

      toast.success(`Invoice ${invoice.invoiceNo} archived and removed from active register`);
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialogContent className="sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle
            className={`flex items-center gap-2 ${
              hasDirectPayments ? "text-amber-700 dark:text-amber-400" : "text-destructive"
            }`}
          >
            {hasDirectPayments ? (
              <ShieldAlert className="h-5 w-5 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 shrink-0" />
            )}
            <span>
              {hasDirectPayments
                ? "Cannot Delete Invoice with Linked Payments"
                : `Delete Invoice ${invoice.invoiceNo}?`}
            </span>
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground pt-1">
              {/* Invoice summary block */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between gap-2">
                  <span>Invoice No:</span>
                  <span className="font-mono font-bold text-foreground">{invoice.invoiceNo}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Customer:</span>
                  <span className="font-semibold text-foreground">
                    {customerName || "Customer"}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Invoice Date:</span>
                  <span className="font-mono text-foreground">
                    {formatDate(invoice.invoiceDate)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Grand Total:</span>
                  <span className="font-mono font-bold text-foreground">
                    ₹{formatINR(invoice.totalAmount)}
                  </span>
                </div>
                {linkedJobs.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span>Linked Job Orders:</span>
                    <span className="font-medium text-foreground">
                      {linkedJobs.length} order{linkedJobs.length === 1 ? "" : "s"}
                    </span>
                  </div>
                )}
              </div>

              {/* Branch 1: Direct payments linked to this invoice -> Prevent deletion */}
              {hasDirectPayments ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-2 text-xs text-amber-950 dark:text-amber-200">
                  <p className="font-semibold">
                    {directPayments.length} payment transaction
                    {directPayments.length === 1 ? "" : "s"} totaling ₹{formatINR(directTotal)}{" "}
                    {directPayments.length === 1 ? "is" : "are"} directly linked to this invoice.
                  </p>
                  <ul className="space-y-1 border-t border-amber-200/80 dark:border-amber-900 pt-1.5 max-h-28 overflow-y-auto">
                    {directPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 font-mono">
                        <span>
                          {formatDate(p.date)} · {p.mode || "Cash"} · {p.type}
                        </span>
                        <span className="font-semibold">₹{formatINR(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="leading-relaxed">
                    To protect your financial ledger and audit trail, associated payment
                    transactions are never automatically deleted. Review or unlink these payments on
                    the Payments page before deleting this invoice, or keep this invoice record
                    intact.
                  </p>
                </div>
              ) : hasJobOnlyPayments ? (
                /* Branch 2: Job-order payments exist on included jobs -> Warn + require confirmation */
                <div className="space-y-2.5">
                  <div className="rounded-lg border border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30 p-3 space-y-1.5 text-xs text-amber-950 dark:text-amber-200">
                    <p className="font-semibold">
                      Included job orders have {jobOnlyPayments.length} existing payment
                      {jobOnlyPayments.length === 1 ? "" : "s"} totaling ₹{formatINR(jobOnlyTotal)}.
                    </p>
                    <p className="leading-relaxed">
                      These payments belong to the original Job Work Order(s). Archiving
                      (soft-deleting) this invoice will <strong>not</strong> delete any payment
                      records, Job Work Orders, customer accounts, or other invoices.
                    </p>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-md border bg-card p-2.5 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-input"
                      checked={acknowledgeJobPayments}
                      onChange={(e) => setAcknowledgeJobPayments(e.target.checked)}
                    />
                    <span>
                      I understand this invoice will be archived (soft-deleted) while all Job Work
                      Orders and ₹{formatINR(jobOnlyTotal)} in payment records remain intact.
                    </span>
                  </label>
                </div>
              ) : (
                /* Branch 3: No associated payments -> Clear soft-delete confirmation */
                <div className="space-y-1.5 text-xs leading-relaxed">
                  <p>
                    This invoice will be archived (soft-deleted) and removed from your active
                    invoice list. Historical records remain recoverable for accounting and audit
                    purposes.
                  </p>
                  {linkedJobs.length > 0 && (
                    <p>
                      The {linkedJobs.length} linked Job Work Order
                      {linkedJobs.length === 1 ? "" : "s"} will remain intact and become available
                      for future invoicing again. Customer records and other invoices will not be
                      modified.
                    </p>
                  )}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="mt-2">
          <AlertDialogCancel disabled={busy}>
            {hasDirectPayments ? "Close" : "Cancel"}
          </AlertDialogCancel>

          {hasDirectPayments ? (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/payments" onClick={() => onOpenChange(false)}>
                <Wallet className="h-4 w-4" />
                <span>Review Payments</span>
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !canConfirmDelete}
              onClick={handleSoftDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>{busy ? "Deleting…" : "Delete Invoice"}</span>
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

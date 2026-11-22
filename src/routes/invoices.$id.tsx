import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore, ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InvoiceForm } from "@/components/invoice-form";
import { DeleteInvoiceDialog } from "@/components/delete-invoice-dialog";
import {
  customersApi,
  getInvoiceAssociatedPayments,
  invoicesApi,
  isInvoiceActive,
  jobsApi,
  paymentsApi,
  useShopProfile,
} from "@/lib/db";
import { amountInWords, formatDate, formatINR, todayISO } from "@/lib/invoice-calc";
import { downloadInvoicePdf, openInvoicePdf } from "@/lib/invoice-pdf";
import { pageMeta } from "@/lib/page-meta";

const AUTO_NOTE = "Recorded when invoice was marked paid";

export const Route = createFileRoute("/invoices/$id")({
  head: () => pageMeta("Invoice details", "Review, edit and download a GST tax invoice."),
  component: InvoiceDetail,
});

function InvoiceDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const invoice = invoicesApi.useOne(id);
  const customers = customersApi.useList();
  const shop = useShopProfile();
  const jobs = jobsApi.useList();
  const update = invoicesApi.useUpdate();
  const payments = paymentsApi.useList();
  const createPay = paymentsApi.useCreate();
  const removePay = paymentsApi.useRemove();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [markUnpaidDialogOpen, setMarkUnpaidDialogOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed");

  if (invoice.isPending || customers.isPending || shop.isPending) {
    return (
      <AppShell title="Invoice">
        <p className="py-6 text-sm text-muted-foreground">Loading invoice…</p>
      </AppShell>
    );
  }

  if (invoice.error || customers.error || shop.error) {
    return (
      <AppShell title="Invoice">
        <div className="space-y-3">
          <p role="alert" className="text-sm text-destructive">
            Unable to load invoice.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link to="/invoices">Back to Invoices</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const inv = invoice.data;
  if (!inv) {
    return (
      <AppShell title="Invoice">
        <div className="space-y-3 py-6">
          <p className="font-medium text-foreground">Invoice not found.</p>
          <p className="text-sm text-muted-foreground">
            The requested invoice record does not exist or may have been permanently removed.
          </p>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/invoices">
              <ArrowLeft className="h-4 w-4" /> Back to Invoices
            </Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const customer = customers.data?.find((c) => c.id === inv.customerId) ?? null;
  const allJobs = jobs.data ?? [];
  const allPayments = payments.data ?? [];
  const {
    linkedJobs: invoiceJobs,
    directPayments: linked,
    allAssociated: uniquePayments,
    totalAssociated: totalReceived,
  } = getInvoiceAssociatedPayments(inv, allJobs, allPayments);

  const amountDue = Math.max(0, Math.round(((inv.totalAmount || 0) - totalReceived) * 100) / 100);
  const autoPayments = linked.filter((p) => p.notes === AUTO_NOTE);
  const isArchived = !isInvoiceActive(inv);
  const lineItems = inv.lineItems ?? [];

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await update.mutateAsync({
        id: inv.id,
        data: { isDeleted: false, deletedAt: null },
      });
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Invoice ${inv.invoiceNo} restored to active register`);
    } catch (e) {
      fail(e);
    } finally {
      setRestoring(false);
    }
  };

  const handleConfirmMarkPaid = async () => {
    try {
      if (amountDue > 0) {
        await createPay.mutateAsync({
          customerId: inv.customerId,
          amount: amountDue,
          date: todayISO(),
          mode: "Cash",
          type: totalReceived > 0 ? "Balance" : "Full",
          linkedInvoiceId: id,
          notes: AUTO_NOTE,
          createdAt: new Date().toISOString(),
        });
      }
      await update.mutateAsync({ id, data: { status: "Paid" } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
      ]);
      setMarkPaidDialogOpen(false);
      toast.success("Invoice marked paid");
    } catch (e) {
      fail(e);
    }
  };

  const handleMarkUnpaid = async (alsoRemoveAutoPayments: boolean) => {
    try {
      if (alsoRemoveAutoPayments && autoPayments.length > 0) {
        for (const p of autoPayments) {
          await removePay.mutateAsync(p.id);
        }
      }
      await update.mutateAsync({ id, data: { status: "Sent" } });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
      ]);
      setMarkUnpaidDialogOpen(false);
      toast.success("Invoice marked unpaid");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <AppShell
      title={inv.invoiceNo}
      actions={
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/invoices">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Invoices</span>
            </Link>
          </Button>
          {!isArchived && (
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </div>
      }
    >
      {isArchived && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30 p-4 text-sm text-amber-950 dark:text-amber-200">
          <div>
            <p className="font-semibold">Archived / Soft-Deleted Invoice</p>
            <p className="text-xs opacity-90 mt-0.5">
              This invoice was archived
              {inv.deletedAt ? ` on ${formatDate(inv.deletedAt.slice(0, 10))}` : ""} and is hidden
              from active listings. It remains preserved for accounting and audit records.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={restoring}
            onClick={handleRestore}
            className="gap-1.5 bg-background"
          >
            <ArchiveRestore className="h-4 w-4" />
            <span>{restoring ? "Restoring…" : "Restore Invoice"}</span>
          </Button>
        </div>
      )}

      {editing && !isArchived ? (
        <InvoiceForm initial={inv} onSaved={() => setEditing(false)} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              disabled={!shop.data}
              onClick={() => {
                if (shop.data) downloadInvoicePdf(inv, shop.data, customer);
              }}
            >
              Download PDF
            </Button>
            <Button
              variant="outline"
              disabled={!shop.data}
              onClick={() => {
                if (shop.data) openInvoicePdf(inv, shop.data, customer);
              }}
            >
              Print / preview
            </Button>
            {!isArchived && inv.status === "Draft" && (
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { id, data: { status: "Sent" } },
                    {
                      onSuccess: () => toast.success("Invoice marked sent"),
                      onError: fail,
                    },
                  )
                }
              >
                Mark sent
              </Button>
            )}
            {!isArchived && inv.status === "Sent" && (
              <Button
                variant="outline"
                disabled={update.isPending || createPay.isPending}
                onClick={() => setMarkPaidDialogOpen(true)}
              >
                Mark paid
              </Button>
            )}
            {!isArchived && inv.status === "Paid" && (
              <Button
                variant="outline"
                disabled={update.isPending || removePay.isPending}
                onClick={() => {
                  if (autoPayments.length > 0) {
                    setMarkUnpaidDialogOpen(true);
                  } else {
                    void handleMarkUnpaid(false);
                  }
                }}
              >
                Mark unpaid
              </Button>
            )}
            {!isArchived && (
              <Button
                variant="destructive"
                className="gap-1.5"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete</span>
              </Button>
            )}
          </div>

          <section className="max-w-4xl">
            <div className="flex flex-wrap justify-between gap-4 border-y py-6">
              <div>
                <h2 className="font-display text-xl">{shop.data?.businessName || "Tax invoice"}</h2>
                {shop.data?.gstin && (
                  <p className="text-sm text-muted-foreground">GSTIN: {shop.data.gstin}</p>
                )}
                <h3 className="mt-5 font-semibold">{customer?.name ?? "Customer unavailable"}</h3>
                {customer?.address && <p className="text-sm">{customer.address}</p>}
                {customer?.state && (
                  <p className="text-sm text-muted-foreground">
                    {customer.state}
                    {customer.stateCode ? ` (State Code: ${customer.stateCode})` : ""}
                  </p>
                )}
                {customer?.phone && (
                  <p className="text-sm text-muted-foreground">Phone: {customer.phone}</p>
                )}
                {customer?.gstin && <p className="text-sm font-mono">GSTIN: {customer.gstin}</p>}
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Invoice Date
                </p>
                <p className="font-mono font-medium">{formatDate(inv.invoiceDate)}</p>
                {inv.billingMonth && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Billing Month: <span className="font-mono">{inv.billingMonth}</span>
                  </p>
                )}
                <p className="mt-2 font-semibold text-primary">{inv.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {inv.taxType === "IGST" ? "Inter-state (IGST)" : "Intra-state (CGST + SGST)"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-4 pr-3">Description</th>
                    <th className="px-2">HSN/SAC</th>
                    <th className="px-2">Qty</th>
                    <th className="px-2 text-right">Rate</th>
                    <th className="pl-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((it, n) => (
                    <tr key={n} className="border-b">
                      <td className="min-w-40 py-4 pr-3">{it.description}</td>
                      <td className="px-2 font-mono text-xs">{it.hsnSacCode}</td>
                      <td className="px-2 whitespace-nowrap">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="px-2 text-right tnum">{formatINR(it.ratePerUnit)}</td>
                      <td className="pl-2 text-right tnum">{formatINR(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto mt-5 max-w-xs space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Taxable value</dt>
                <dd className="tnum">₹{formatINR(Number(inv.taxableValue) || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>CGST {inv.cgstRate ? `(${inv.cgstRate}%)` : ""}</dt>
                <dd className="tnum">₹{formatINR(Number(inv.cgstAmount) || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>SGST {inv.sgstRate ? `(${inv.sgstRate}%)` : ""}</dt>
                <dd className="tnum">₹{formatINR(Number(inv.sgstAmount) || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>IGST {inv.igstRate ? `(${inv.igstRate}%)` : ""}</dt>
                <dd className="tnum">₹{formatINR(Number(inv.igstAmount) || 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Round off</dt>
                <dd className="tnum">₹{formatINR(Number(inv.roundOff) || 0)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold text-base">
                <dt>Grand Total</dt>
                <dd className="tnum">₹{formatINR(Number(inv.totalAmount) || 0)}</dd>
              </div>
              {totalReceived > 0 && (
                <>
                  <div className="flex justify-between text-emerald-600 font-medium border-t pt-2">
                    <dt>Payments Received</dt>
                    <dd className="tnum font-mono">− ₹{formatINR(totalReceived)}</dd>
                  </div>
                  <div className="flex justify-between text-base font-bold text-amber-700 dark:text-amber-400">
                    <dt>Amount Due</dt>
                    <dd className="tnum font-mono">₹{formatINR(amountDue)}</dd>
                  </div>
                </>
              )}
            </dl>

            <p className="mt-6 border-t py-4 text-sm">{amountInWords(inv.totalAmount)}</p>
            {inv.notes && <p className="text-sm text-muted-foreground">{inv.notes}</p>}

            {/* Included Job Work Orders */}
            {invoiceJobs.length > 0 && (
              <div className="mt-8 border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Included Job Work Orders ({invoiceJobs.length})
                </h4>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted border-b font-semibold">
                      <tr>
                        <th className="p-2">Job No</th>
                        <th className="p-2">Date</th>
                        <th className="p-2">Customer</th>
                        <th className="p-2">Material</th>
                        <th className="p-2 text-right">Job Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {invoiceJobs.map((j) => (
                        <tr key={j.id} className="hover:bg-muted/30">
                          <td className="p-2 font-mono font-semibold text-primary">
                            <Link to="/jobs">{j.jobNo || "JW-order"}</Link>
                          </td>
                          <td className="p-2 font-mono">{formatDate(j.date || j.dateCreated)}</td>
                          <td className="p-2">{j.customerName || customer?.name || "Customer"}</td>
                          <td className="p-2 text-muted-foreground">
                            {j.woodTypes?.join(", ") || "Wood"}
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            ₹{formatINR(j.total || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Associated Payments History */}
            {uniquePayments.length > 0 && (
              <div className="mt-8 border-t pt-4">
                <h4 className="text-sm font-semibold mb-2 text-foreground">
                  Associated Payments ({uniquePayments.length})
                </h4>
                <div className="rounded-lg border overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted border-b font-semibold">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Mode</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Reference / Notes</th>
                        <th className="p-2 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {uniquePayments.map((p) => (
                        <tr key={p.id}>
                          <td className="p-2 font-mono">{formatDate(p.date)}</td>
                          <td className="p-2">{p.mode || "Cash"}</td>
                          <td className="p-2">{p.type}</td>
                          <td className="p-2 text-muted-foreground">
                            {p.reference || p.notes || "—"}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{formatINR(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {/* Safe Invoice Soft-Delete AlertDialog */}
      <DeleteInvoiceDialog
        invoice={inv}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        customerName={customer?.name}
        jobs={allJobs}
        payments={allPayments}
        onDeleted={() => {
          void navigate({ to: "/invoices" });
        }}
      />

      {/* Mark Paid Confirmation Dialog */}
      <AlertDialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Invoice {inv.invoiceNo} as Paid?</AlertDialogTitle>
            <AlertDialogDescription>
              {amountDue > 0
                ? `This will mark the invoice as Paid and record a Cash payment of ₹${formatINR(amountDue)} linked to this invoice.`
                : "This will update the invoice status to Paid."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmMarkPaid}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Unpaid Confirmation Dialog */}
      <AlertDialog open={markUnpaidDialogOpen} onOpenChange={setMarkUnpaidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Invoice {inv.invoiceNo} as Unpaid?</AlertDialogTitle>
            <AlertDialogDescription>
              There {autoPayments.length === 1 ? "is" : "are"} {autoPayments.length} payment
              {autoPayments.length === 1 ? "" : "s"} recorded automatically when this invoice was
              marked paid. Choose whether to keep or remove those automatic payment entries.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-wrap gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="outline" onClick={() => void handleMarkUnpaid(false)}>
              Keep Payments &amp; Mark Unpaid
            </Button>
            <Button variant="destructive" onClick={() => void handleMarkUnpaid(true)}>
              Remove Auto Payment &amp; Mark Unpaid
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

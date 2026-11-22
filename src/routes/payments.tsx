import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Banknote,
  Landmark,
  Plus,
  Search,
  Smartphone,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { PaymentDialog } from "@/components/payment-dialog";
import { DailyReconciliationCard } from "@/components/daily-reconciliation-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { customersApi, invoicesApi, jobsApi, paymentsApi } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import { pageMeta } from "@/lib/page-meta";
import type { Payment, PaymentMode } from "@/lib/types";

export const Route = createFileRoute("/payments")({
  head: () =>
    pageMeta(
      "Payments",
      "Record advances, balance and full payments from customers, plus daily cash reconciliation.",
    ),
  component: PaymentsPage,
});

const MODE_ICONS: Record<PaymentMode, React.ReactNode> = {
  Cash: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
  GPay: <Smartphone className="h-3.5 w-3.5 text-blue-600" />,
  Bank: <Landmark className="h-3.5 w-3.5 text-purple-600" />,
};

function normalizePaymentMode(m?: string): PaymentMode {
  if (!m) return "Cash";
  const s = m.toLowerCase();
  if (s.includes("gpay") || s.includes("upi")) return "GPay";
  if (s.includes("bank") || s.includes("neft") || s.includes("rtgs")) return "Bank";
  return "Cash";
}

function PaymentsPage() {
  const qc = useQueryClient();
  const paymentsQuery = paymentsApi.useList();
  const customersQuery = customersApi.useList();
  const invoicesQuery = invoicesApi.useAllList();
  const jobsQuery = jobsApi.useList();

  const create = paymentsApi.useCreate();
  const update = paymentsApi.useUpdate();
  const remove = paymentsApi.useRemove();

  const rawPayments = paymentsQuery.data;
  const rawCustomers = customersQuery.data;
  const rawInvoices = invoicesQuery.data;
  const rawJobs = jobsQuery.data;

  const payments = useMemo(() => rawPayments ?? [], [rawPayments]);
  const customers = useMemo(() => rawCustomers ?? [], [rawCustomers]);
  const invoices = useMemo(() => rawInvoices ?? [], [rawInvoices]);
  const jobs = useMemo(() => rawJobs ?? [], [rawJobs]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<string>("All");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  // Delete payment modal state
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);
  const invoiceMap = useMemo(
    () =>
      new Map(
        invoices.map((i) => [
          i.id,
          i.isDeleted || i.deletedAt ? `${i.invoiceNo} (Archived)` : i.invoiceNo,
        ]),
      ),
    [invoices],
  );
  const jobMap = useMemo(() => new Map(jobs.map((j) => [j.id, j.jobNo])), [jobs]);

  // Filter & sort payments
  const filteredPayments = useMemo(() => {
    return payments
      .filter((p) => {
        const normMode = normalizePaymentMode(p.mode);
        if (modeFilter !== "All" && normMode !== modeFilter) return false;
        if (selectedCustomerId && p.customerId !== selectedCustomerId) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const cust = (customerMap.get(p.customerId) || "").toLowerCase();
          const jn = (p.jobId ? jobMap.get(p.jobId) || "" : "").toLowerCase();
          const inum = (
            p.linkedInvoiceId ? invoiceMap.get(p.linkedInvoiceId) || "" : ""
          ).toLowerCase();
          const ref = (p.reference || "").toLowerCase();
          const note = (p.notes || "").toLowerCase();
          const amt = String(p.amount || "");
          if (
            !cust.includes(q) &&
            !jn.includes(q) &&
            !inum.includes(q) &&
            !ref.includes(q) &&
            !note.includes(q) &&
            !amt.includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [payments, modeFilter, selectedCustomerId, searchQuery, customerMap, jobMap, invoiceMap]);

  const handleCreated = async (p: Omit<Payment, "id">) => {
    await create.mutateAsync(p);
    await qc.invalidateQueries({ queryKey: ["payments"] });
    await qc.invalidateQueries({ queryKey: ["jobs"] });
    await qc.invalidateQueries({ queryKey: ["customers"] });
    toast.success("Payment recorded successfully");
  };

  const handleUpdated = async (id: string, d: Partial<Payment>) => {
    await update.mutateAsync({ id, data: d });
    await qc.invalidateQueries({ queryKey: ["payments"] });
    await qc.invalidateQueries({ queryKey: ["jobs"] });
    await qc.invalidateQueries({ queryKey: ["customers"] });
    toast.success("Payment updated");
  };

  const confirmDelete = async () => {
    if (!paymentToDelete) return;
    try {
      await remove.mutateAsync(paymentToDelete.id);
      await qc.invalidateQueries({ queryKey: ["payments"] });
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Payment record deleted");
      setPaymentToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete payment");
    }
  };

  return (
    <AppShell
      title="Payments & Cash Reconciliation"
      actions={
        <PaymentDialog
          trigger={
            <Button
              size="sm"
              className="gap-1.5 font-semibold bg-amber-700 hover:bg-amber-800 text-white"
            >
              <Plus className="h-4 w-4" /> Record Payment
            </Button>
          }
          onSave={handleCreated}
        />
      }
    >
      <div className="space-y-6">
        {/* Daily Cash Reconciliation Card (Feature 3: End-of-day register & drawer check) */}
        <DailyReconciliationCard jobs={jobs} payments={payments} />

        {/* Filter & Search Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-base text-foreground">
              Payment Transaction History ({filteredPayments.length})
            </h2>

            {/* Mode Filter Pills */}
            <div className="flex items-center gap-1.5 text-xs">
              {["All", "Cash", "GPay", "Bank"].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModeFilter(m)}
                  className={`px-3 py-1 rounded-full font-semibold border transition-all ${
                    modeFilter === m
                      ? "bg-amber-700 text-white border-amber-800 shadow-xs"
                      : "bg-card text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  {m === "GPay" ? "GPay / UPI" : m}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
            <div className="sm:col-span-2 relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 h-10 text-sm bg-card"
                placeholder="Search by customer, job #, invoice #, UPI reference, amount…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by customer"
                className="field-select h-10 text-xs sm:text-sm flex-1 bg-card rounded-md border border-input px-3"
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {(selectedCustomerId || searchQuery || modeFilter !== "All") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-xs text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => {
                    setSelectedCustomerId("");
                    setSearchQuery("");
                    setModeFilter("All");
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Payments List */}
        {paymentsQuery.error && (
          <p role="alert" className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
            Unable to load payments list. Please check connection.
          </p>
        )}

        {paymentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading payments…</p>
        ) : filteredPayments.length === 0 ? (
          <div className="py-12 text-muted-foreground text-center rounded-xl border border-dashed bg-muted/10 space-y-2">
            <Wallet className="h-8 w-8 mx-auto text-muted-foreground/60" />
            <p className="font-semibold text-foreground text-sm">No payment records found</p>
            <p className="text-xs">
              {payments.length === 0
                ? "No payments recorded yet. Click 'Record Payment' to add one."
                : "No payments match the current filters."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPayments.map((p) => {
              const normMode = normalizePaymentMode(p.mode);
              const modeIcon = MODE_ICONS[normMode] || MODE_ICONS.Cash;
              const customerName = customerMap.get(p.customerId) || "Customer";
              const jobOrderNo = p.jobId ? jobMap.get(p.jobId) : null;
              const invoiceOrderNo = p.linkedInvoiceId ? invoiceMap.get(p.linkedInvoiceId) : null;

              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-amber-600/30 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      {p.customerId ? (
                        <Link
                          to="/customers/$id"
                          params={{ id: p.customerId }}
                          className="font-bold text-sm text-foreground hover:underline hover:text-primary"
                        >
                          {customerName}
                        </Link>
                      ) : (
                        <span className="font-bold text-sm text-foreground">{customerName}</span>
                      )}

                      <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {modeIcon}
                        <span>{normMode === "GPay" ? "GPay / UPI" : normMode}</span>
                      </span>

                      <span className="rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                        {p.type || "Payment"}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                      <span className="font-mono">{formatDate(p.date)}</span>
                      {jobOrderNo && (
                        <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-900 px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                          Job: {jobOrderNo}
                        </span>
                      )}
                      {invoiceOrderNo && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          Inv: {invoiceOrderNo}
                        </span>
                      )}
                      {(p.reference || p.notes) && (
                        <span className="text-muted-foreground italic truncate max-w-xs">
                          · {p.reference || p.notes}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="tnum font-mono font-bold text-base text-emerald-600 dark:text-emerald-400 mr-2">
                      ₹{formatINR(p.amount)}
                    </span>

                    <PaymentDialog
                      initial={p}
                      trigger={
                        <Button size="sm" variant="outline" className="h-8 text-xs">
                          Edit
                        </Button>
                      }
                      onSave={(d) => handleUpdated(p.id, d)}
                    />

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setPaymentToDelete(p)}
                      title="Delete Payment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Deleting Payment (No window.confirm in iframe) */}
      <AlertDialog
        open={Boolean(paymentToDelete)}
        onOpenChange={(open) => !open && setPaymentToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Payment Record?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment of{" "}
              <strong>₹{paymentToDelete ? formatINR(paymentToDelete.amount) : "0"}</strong> for{" "}
              <strong>
                {paymentToDelete ? customerMap.get(paymentToDelete.customerId) || "Customer" : ""}
              </strong>
              ? This will adjust the customer balance and job work order records accordingly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

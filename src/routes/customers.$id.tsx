import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Building,
  Copy,
  Download,
  FileDown,
  FileText,
  Hammer,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CustomerDialog } from "@/components/customer-dialog";
import { JobFormDialog } from "@/components/job-form-dialog";
import { PaymentDialog } from "@/components/payment-dialog";
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
import {
  customerBalance,
  customersApi,
  invoicesApi,
  jobAdvance,
  jobBalance,
  jobsApi,
  paymentsApi,
  useShopProfile,
} from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import { downloadCustomerStatementPdf } from "@/lib/customer-statement-pdf";
import { pageMeta } from "@/lib/page-meta";
import type { Job, Payment } from "@/lib/types";

export const Route = createFileRoute("/customers/$id")({
  head: () =>
    pageMeta(
      "Customer Ledger & Statement",
      "Customer ledger, statement export, repeat order actions, invoices, jobs and payment history.",
    ),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const customer = customersApi.useOne(id);
  const invoices = invoicesApi.useList();
  const payments = paymentsApi.useList();
  const jobs = jobsApi.useList();
  const { data: shopProfile } = useShopProfile();

  const update = customersApi.useUpdate();
  const remove = customersApi.useRemove();
  const createPayment = paymentsApi.useCreate();
  const navigate = useNavigate();

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const c = customer.data;
  const queries = [customer, invoices, payments, jobs];

  const ci = useMemo(
    () =>
      (invoices.data?.filter((i) => i.customerId === id) ?? []).sort((a, b) =>
        (b.invoiceDate || "").localeCompare(a.invoiceDate || ""),
      ),
    [invoices.data, id],
  );

  const cp = useMemo(
    () =>
      (payments.data?.filter((p) => p.customerId === id) ?? []).sort((a, b) =>
        (b.date || "").localeCompare(a.date || ""),
      ),
    [payments.data, id],
  );

  const cj = useMemo(
    () =>
      (jobs.data?.filter((j) => j.customerId === id) ?? []).sort((a, b) =>
        (b.date || b.createdAt || "").localeCompare(a.date || a.createdAt || ""),
      ),
    [jobs.data, id],
  );

  const balance = useMemo(() => customerBalance(id, cj, cp), [id, cj, cp]);

  // Feature 5: Most recent 3 jobs for repeat-order quick duplicate actions
  const recent3Jobs = useMemo(() => cj.slice(0, 3), [cj]);

  if (queries.some((q) => q.isLoading)) {
    return (
      <AppShell title="Customer">
        <p className="py-8 text-sm text-muted-foreground text-center">Loading customer history…</p>
      </AppShell>
    );
  }

  if (queries.some((q) => q.error)) {
    return (
      <AppShell title="Customer">
        <p role="alert" className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          Unable to load customer history. Please check connection.
        </p>
      </AppShell>
    );
  }

  if (!c) {
    return (
      <AppShell title="Customer">
        <div className="py-12 text-center text-muted-foreground">
          <p className="font-semibold text-foreground">Customer not found.</p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link to="/customers">Back to Customers</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const handleDownloadStatement = () => {
    try {
      setDownloadingPdf(true);
      downloadCustomerStatementPdf(c, cj, ci, cp, shopProfile);
      toast.success(`Account statement for ${c.name} downloaded as PDF`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF statement");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const hasLinkedRecords = Boolean(ci.length || cp.length || cj.length);

  return (
    <AppShell
      title={c.name}
      actions={
        <div className="flex items-center gap-2">
          {/* Feature 4: Download Statement PDF */}
          <Button
            size="sm"
            className="gap-1.5 font-semibold bg-amber-700 hover:bg-amber-800 text-white"
            onClick={handleDownloadStatement}
            disabled={downloadingPdf}
          >
            <FileDown className="h-4 w-4" />
            <span className="hidden sm:inline">Download Statement</span>
            <span className="sm:hidden">Statement</span>
          </Button>

          <CustomerDialog
            initial={c}
            trigger={
              <Button size="sm" variant="outline">
                Edit Details
              </Button>
            }
            onSave={(data) =>
              update.mutate(
                { id, data },
                {
                  onSuccess: () => toast.success("Customer profile updated"),
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          />
        </div>
      }
    >
      <div className="space-y-6 max-w-5xl">
        {/* Customer Header & Contact Card */}
        <div className="rounded-xl border bg-card p-5 shadow-xs flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <Building className="h-4 w-4" />
              </span>
              <h2 className="font-display text-xl font-bold text-foreground">{c.name}</h2>
              {c.monthlyGstBilling && (
                <span className="rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 text-[10px] font-bold px-2 py-0.5">
                  Monthly GST Billing
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
              <span>{c.address || "Address not specified"}</span>
              <span>·</span>
              <span className="font-medium text-foreground">{c.state}</span>
              {c.gstin && (
                <>
                  <span>·</span>
                  <span className="font-mono text-foreground font-semibold">GSTIN: {c.gstin}</span>
                </>
              )}
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-muted-foreground">
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-1 text-foreground hover:text-primary transition-colors font-mono"
                >
                  <Phone className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{c.phone}</span>
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="flex items-center gap-1 text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 text-blue-600" />
                  <span>{c.email}</span>
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PaymentDialog
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" /> Record Payment
                </Button>
              }
              initial={{ customerId: id }}
              onSave={async (p) => {
                await createPayment.mutateAsync(p);
                toast.success("Payment recorded");
              }}
            />
          </div>
        </div>

        {/* Financial Summary Strip */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4 shadow-2xs">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Total Job Value
            </p>
            <p className="mt-1 font-display font-black text-2xl font-mono text-foreground">
              ₹{formatINR(balance.jobTotal)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {cj.length} fabrication job order{cj.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-2xs">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Payments Received
            </p>
            <p className="mt-1 font-display font-black text-2xl font-mono text-emerald-600 dark:text-emerald-400">
              ₹{formatINR(balance.received)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Across {cp.length} payment transaction{cp.length === 1 ? "" : "s"}
            </p>
          </div>

          <div
            className={`rounded-xl border-2 p-4 shadow-2xs ${
              balance.balance > 0
                ? "border-amber-600/40 bg-amber-50/40 dark:bg-amber-950/20"
                : "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
            }`}
          >
            <div className="flex items-center justify-between">
              <p
                className={`text-xs font-bold uppercase tracking-wider ${
                  balance.balance > 0
                    ? "text-amber-900 dark:text-amber-200"
                    : "text-emerald-900 dark:text-emerald-200"
                }`}
              >
                Net Balance Due
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[11px] text-amber-900 dark:text-amber-200"
                onClick={handleDownloadStatement}
                title="Print or export customer statement"
              >
                <Download className="h-3 w-3 mr-1" /> PDF
              </Button>
            </div>
            <p
              className={`mt-1 font-display font-black text-2xl font-mono ${
                balance.balance > 0
                  ? "text-amber-900 dark:text-amber-300"
                  : "text-emerald-700 dark:text-emerald-400"
              }`}
            >
              ₹{formatINR(balance.balance)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {balance.balance > 0 ? "Pending collection" : "Account fully clear / settled"}
            </p>
          </div>
        </div>

        {/* Feature 5: Repeat-Customer Quick Actions (Most recent 3 jobs) */}
        <section className="rounded-xl border border-amber-300/40 bg-card p-5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <Copy className="h-3.5 w-3.5" />
              </span>
              <div>
                <h3 className="font-display font-bold text-sm text-foreground">
                  Repeat-Customer Quick Actions (Duplicate Job)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Speed up repeat orders by duplicating previous job specifications (wood type,
                  material, sizes)
                </p>
              </div>
            </div>

            <JobFormDialog
              trigger={
                <Button
                  size="sm"
                  className="gap-1 text-xs bg-amber-700 hover:bg-amber-800 text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> New Job Order
                </Button>
              }
            />
          </div>

          {recent3Jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 italic">
              No previous jobs found for this customer. Create the first job above.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recent3Jobs.map((j) => {
                const itemsCount = j.items?.length || 1;
                const firstItemDesc = j.items?.[0]?.description || j.description || "CNC Work";
                const firstItemSize = j.items?.[0]?.size;

                return (
                  <div
                    key={j.id}
                    className="rounded-lg border bg-muted/20 p-3.5 flex flex-col justify-between space-y-3 transition-colors hover:border-amber-600/40"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono font-bold text-xs text-foreground">
                          {j.jobNo || "JW-order"}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {formatDate(j.date || j.dateCreated)}
                        </span>
                      </div>

                      <p className="text-xs font-medium text-foreground mt-1 line-clamp-1">
                        {firstItemDesc}
                        {firstItemSize ? ` (${firstItemSize})` : ""}
                        {itemsCount > 1 && ` +${itemsCount - 1} more`}
                      </p>

                      <div className="flex flex-wrap gap-1 mt-2">
                        {(j.woodTypes || []).map((w) => (
                          <span
                            key={w}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground"
                          >
                            {w}
                          </span>
                        ))}
                        {j.materialSuppliedBy && (
                          <span className="rounded bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-medium border border-amber-200 dark:border-amber-900">
                            Mat: {j.materialSuppliedBy}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-2.5">
                      <JobFormDialog
                        initial={j}
                        isDuplicate={true}
                        trigger={
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full gap-1.5 text-xs font-semibold text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/40 hover:bg-amber-100"
                          >
                            <Copy className="h-3.5 w-3.5 text-amber-700" />
                            <span>Duplicate this job</span>
                          </Button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Job Orders History */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Hammer className="h-4 w-4 text-amber-700" />
              <span>All Job Work Orders ({cj.length})</span>
            </h3>
            <Link to="/jobs" className="text-xs text-primary font-semibold hover:underline">
              View on Jobs Page →
            </Link>
          </div>

          {cj.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 italic">No jobs recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {cj.map((j) => {
                const adv = jobAdvance(j.id, payments.data ?? []);
                const bal = jobBalance(j, payments.data ?? []);
                return (
                  <div
                    key={j.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 text-sm"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">
                          {j.jobNo || "JW-order"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {formatDate(j.date || j.dateCreated)}
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                          {j.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {j.items?.length
                          ? j.items.map((it) => it.description).join(", ")
                          : j.description || "CNC Job Work"}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="font-mono font-bold text-foreground block">
                          ₹{formatINR(j.total)}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground block">
                          Adv: ₹{formatINR(adv)} · Bal: ₹{formatINR(bal)}
                        </span>
                      </div>
                      <JobFormDialog
                        initial={j}
                        isDuplicate={true}
                        trigger={
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 text-xs"
                            title="Duplicate this job"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Section: Invoices */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span>Tax Invoices ({ci.length})</span>
            </h3>
            <Link
              to="/invoices/new"
              search={{ jobId: undefined }}
              className="text-xs text-primary font-semibold hover:underline"
            >
              + Create Invoice
            </Link>
          </div>

          {ci.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 italic">No invoices issued yet.</p>
          ) : (
            <div className="space-y-2">
              {ci.map((i) => (
                <Link
                  to="/invoices/$id"
                  params={{ id: i.id }}
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 text-sm transition-colors hover:border-amber-600/30"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{i.invoiceNo}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {formatDate(i.invoiceDate)}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
                        {i.status}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-foreground">
                    ₹{formatINR(i.totalAmount)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Section: Payments */}
        <section className="space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-600" />
              <span>Payment Records ({cp.length})</span>
            </h3>
            <Link to="/payments" className="text-xs text-primary font-semibold hover:underline">
              View on Payments Page →
            </Link>
          </div>

          {cp.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 italic">No payments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {cp.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3.5 text-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDate(p.date)}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-semibold">
                        {p.mode || "Cash"}
                      </span>
                      <span className="rounded bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                        {p.type}
                      </span>
                    </div>
                    {(p.reference || p.notes) && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        {p.reference || p.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{formatINR(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Delete Customer Section */}
        <div className="pt-6 border-t">
          <Button
            variant="destructive"
            size="sm"
            disabled={hasLinkedRecords || remove.isPending}
            onClick={() => setDeleteConfirmOpen(true)}
            className="gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete Customer
          </Button>

          {hasLinkedRecords && (
            <p className="mt-2 text-xs text-muted-foreground">
              Customers with existing job orders, invoices, or payment transactions cannot be
              deleted.
            </p>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Customer Deletion */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Customer Record?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{c.name}</strong>? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                try {
                  await remove.mutateAsync(id);
                  toast.success("Customer deleted");
                  navigate({ to: "/customers" });
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to delete customer");
                }
              }}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Banknote, Smartphone, Landmark } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { PaymentDialog } from "@/components/payment-dialog";
import { Button } from "@/components/ui/button";
import { customersApi, invoicesApi, jobsApi, paymentsApi } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import { pageMeta } from "@/lib/page-meta";
import type { PaymentMode } from "@/lib/types";

export const Route = createFileRoute("/payments")({
  head: () => pageMeta("Payments", "Record advances, balance and full payments from customers."),
  component: Payments,
});

const MODE_ICONS: Record<PaymentMode, React.ReactNode> = {
  Cash: <Banknote className="h-3.5 w-3.5 text-emerald-600" />,
  GPay: <Smartphone className="h-3.5 w-3.5 text-blue-600" />,
  Bank: <Landmark className="h-3.5 w-3.5 text-purple-600" />,
};

function Payments() {
  const payments = paymentsApi.useList();
  const customers = customersApi.useList();
  const invoices = invoicesApi.useList();
  const jobs = jobsApi.useList();

  const create = paymentsApi.useCreate();
  const update = paymentsApi.useUpdate();
  const remove = paymentsApi.useRemove();

  const name = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? "Customer";
  const invNo = (id?: string | null) =>
    id ? (invoices.data?.find((i) => i.id === id)?.invoiceNo ?? "Invoice") : null;
  const jobNo = (id?: string | null) =>
    id ? (jobs.data?.find((j) => j.id === id)?.jobNo ?? "Job Order") : null;

  const list = [...(payments.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <AppShell
      title="Payments"
      actions={
        <PaymentDialog
          trigger={
            <Button size="sm" className="gap-1.5 font-semibold">
              <Plus className="h-4 w-4" /> Record Payment
            </Button>
          }
          onSave={(p) => create.mutateAsync(p).then(() => toast.success("Payment recorded"))}
        />
      }
    >
      {payments.error && <p role="alert">Unable to load payments.</p>}
      {payments.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : list.length === 0 ? (
        <p className="py-8 text-muted-foreground text-center rounded-lg border border-dashed">
          No payments recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {list.map((p) => {
            const mode = p.mode || "Cash";
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to="/customers/$id"
                      params={{ id: p.customerId }}
                      className="font-semibold text-foreground hover:underline"
                    >
                      {name(p.customerId)}
                    </Link>
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                      {MODE_ICONS[mode]}
                      <span>{mode}</span>
                    </span>
                    <span className="rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                      {p.type}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-1.5">
                    <span>{formatDate(p.date)}</span>
                    {p.jobId && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-primary font-semibold">
                        Job: {jobNo(p.jobId)}
                      </span>
                    )}
                    {invNo(p.linkedInvoiceId) && (
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                        Inv: {invNo(p.linkedInvoiceId)}
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
                    onSave={(d) =>
                      update
                        .mutateAsync({ id: p.id, data: d })
                        .then(() => toast.success("Payment updated"))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("Delete this payment?"))
                        remove.mutate(p.id, { onError: (e) => toast.error(e.message) });
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

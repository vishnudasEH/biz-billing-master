import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { InvoiceForm } from "@/components/invoice-form";
import { customersApi, invoicesApi, jobsApi, paymentsApi, useShopProfile } from "@/lib/db";
import { amountInWords, formatINR, todayISO } from "@/lib/invoice-calc";
import { downloadInvoicePdf, openInvoicePdf } from "@/lib/invoice-pdf";
import { pageMeta } from "@/lib/page-meta";
const AUTO_NOTE = "Recorded when invoice was marked paid";
export const Route = createFileRoute("/invoices/$id")({
  head: () => pageMeta("Invoice details", "Review, edit and download a GST tax invoice."),
  component: InvoiceDetail,
});
function InvoiceDetail() {
  const { id } = Route.useParams();
  const invoice = invoicesApi.useOne(id);
  const customers = customersApi.useList();
  const shop = useShopProfile();
  const jobs = jobsApi.useList();
  const update = invoicesApi.useUpdate();
  const remove = invoicesApi.useRemove();
  const updateJob = jobsApi.useUpdate();
  const payments = paymentsApi.useList();
  const createPay = paymentsApi.useCreate();
  const removePay = paymentsApi.useRemove();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const inv = invoice.data;
  const invoiceJobs = (jobs.data ?? []).filter((j) => j.invoiceId === id || j.id === inv?.jobId);
  const invoiceJobIds = new Set(invoiceJobs.map((j) => j.id));
  const jobPaymentsList = (payments.data ?? []).filter(
    (p) => (p.jobId && invoiceJobIds.has(p.jobId)) || p.linkedInvoiceId === id,
  );
  const uniquePayments = Array.from(new Map(jobPaymentsList.map((p) => [p.id, p])).values());
  const totalReceived = uniquePayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const linked = (payments.data ?? []).filter((p) => p.linkedInvoiceId === id);
  const amountDue = Math.max(0, Math.round(((inv?.totalAmount || 0) - totalReceived) * 100) / 100);
  const fail = (e: unknown) => toast.error(e instanceof Error ? e.message : "Operation failed");
  if (invoice.isLoading || customers.isLoading || shop.isLoading)
    return (
      <AppShell title="Invoice">
        <p>Loading…</p>
      </AppShell>
    );
  if (invoice.error || customers.error || shop.error)
    return (
      <AppShell title="Invoice">
        <p role="alert">Unable to load invoice.</p>
      </AppShell>
    );
  if (!inv)
    return (
      <AppShell title="Invoice">
        <p>Invoice not found.</p>
      </AppShell>
    );
  const customer = customers.data?.find((c) => c.id === inv.customerId) ?? null;
  return (
    <AppShell
      title={inv.invoiceNo}
      actions={
        <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit"}
        </Button>
      }
    >
      {editing ? (
        <InvoiceForm initial={inv} />
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
            {inv.status === "Draft" && (
              <Button
                variant="outline"
                disabled={update.isPending}
                onClick={() => update.mutate({ id, data: { status: "Sent" } }, { onError: fail })}
              >
                Mark sent
              </Button>
            )}
            {inv.status === "Sent" && (
              <Button
                variant="outline"
                disabled={update.isPending || createPay.isPending}
                onClick={async () => {
                  const due = amountDue;
                  if (
                    !confirm(
                      due > 0
                        ? `Mark paid and record a payment of ₹${formatINR(due)}?`
                        : "Mark this invoice paid?",
                    )
                  )
                    return;
                  try {
                    if (due > 0)
                      await createPay.mutateAsync({
                        customerId: inv.customerId,
                        amount: due,
                        date: todayISO(),
                        mode: "Cash",
                        type: totalReceived > 0 ? "Balance" : "Full",
                        linkedInvoiceId: id,
                        notes: AUTO_NOTE,
                        createdAt: new Date().toISOString(),
                      });
                    await update.mutateAsync({ id, data: { status: "Paid" } });
                    toast.success("Invoice marked paid");
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Mark paid
              </Button>
            )}
            {inv.status === "Paid" && (
              <Button
                variant="outline"
                disabled={update.isPending || removePay.isPending}
                onClick={async () => {
                  const auto = linked.filter((p) => p.notes === AUTO_NOTE);
                  try {
                    if (
                      auto.length &&
                      confirm(
                        `Also delete the ${auto.length} payment(s) recorded automatically when this was marked paid?`,
                      )
                    ) {
                      for (const p of auto) await removePay.mutateAsync(p.id);
                    }
                    await update.mutateAsync({ id, data: { status: "Sent" } });
                    toast.success("Invoice marked unpaid");
                  } catch (e) {
                    fail(e);
                  }
                }}
              >
                Mark unpaid
              </Button>
            )}
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={async () => {
                if (!confirm("Permanently delete this invoice?")) return;
                try {
                  for (const j of jobs.data ?? []) {
                    if (j.invoiceId === id)
                      await updateJob.mutateAsync({ id: j.id, data: { invoiceId: null } });
                  }
                  await remove.mutateAsync(id);
                  await navigate({ to: "/invoices" });
                } catch (e) {
                  fail(e);
                }
              }}
            >
              Delete
            </Button>
          </div>
          <section className="max-w-4xl">
            <div className="flex flex-wrap justify-between gap-4 border-y py-6">
              <div>
                <h2 className="font-display text-xl">{shop.data?.businessName || "Tax invoice"}</h2>
                <p className="text-sm text-muted-foreground">{shop.data?.gstin}</p>
                <h3 className="mt-5 font-semibold">{customer?.name ?? "Customer unavailable"}</h3>
                <p className="text-sm">{customer?.address}</p>
                <p className="text-sm">{customer?.gstin}</p>
              </div>
              <div>
                <p>{inv.invoiceDate}</p>
                <p className="mt-2 font-semibold text-primary">{inv.status}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-4">Description</th>
                    <th>HSN/SAC</th>
                    <th>Qty</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lineItems.map((it, n) => (
                    <tr key={n} className="border-b">
                      <td className="min-w-40 py-4">{it.description}</td>
                      <td>{it.hsnSacCode}</td>
                      <td>
                        {it.quantity} {it.unit}
                      </td>
                      <td className="text-right tnum">{formatINR(it.ratePerUnit)}</td>
                      <td className="text-right tnum">{formatINR(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-5 max-w-xs space-y-2">
              {[
                ["Taxable value", inv.taxableValue],
                ["CGST", inv.cgstAmount],
                ["SGST", inv.sgstAmount],
                ["IGST", inv.igstAmount],
                ["Round off", inv.roundOff],
                ["Total", inv.totalAmount],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt>{k}</dt>
                  <dd className="tnum">₹{formatINR(Number(v))}</dd>
                </div>
              ))}
              {totalReceived > 0 && (
                <>
                  <div className="flex justify-between text-emerald-600 font-medium border-t pt-1">
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
                <div className="rounded-lg border overflow-hidden">
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
                          <td className="p-2">{j.customerName}</td>
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
          </section>
        </>
      )}
    </AppShell>
  );
}

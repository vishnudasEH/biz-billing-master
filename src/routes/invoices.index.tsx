import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, NewButton } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthlyInvoiceDialog } from "@/components/monthly-invoice-dialog";
import { DeleteInvoiceDialog } from "@/components/delete-invoice-dialog";
import { customersApi, invoicesApi, isInvoiceActive, jobsApi, paymentsApi } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/invoice-calc";
import { pageMeta } from "@/lib/page-meta";
import type { Invoice } from "@/lib/types";

export const Route = createFileRoute("/invoices/")({
  head: () => pageMeta("Invoices", "GST invoice register, drafts and paid invoices."),
  component: Invoices,
});

function Invoices() {
  const qc = useQueryClient();
  const invoices = invoicesApi.useList();
  const allInvoices = invoicesApi.useAllList();
  const customers = customersApi.useList();
  const jobs = jobsApi.useList();
  const payments = paymentsApi.useList();
  const updateInvoice = invoicesApi.useUpdate();

  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const customerMap = useMemo(
    () => new Map((customers.data ?? []).map((c) => [c.id, c.name])),
    [customers.data],
  );

  const archivedInvoices = useMemo(
    () => (allInvoices.data ?? []).filter((i) => !isInvoiceActive(i)),
    [allInvoices.data],
  );

  const displayedInvoices = useMemo(() => {
    const source = showArchived ? archivedInvoices : (invoices.data ?? []);
    const term = q.trim().toLowerCase();
    return source
      .filter((i) => {
        if (!term) return true;
        const custName = customerMap.get(i.customerId) ?? "";
        return `${i.invoiceNo} ${custName} ${i.status} ${i.invoiceDate}`
          .toLowerCase()
          .includes(term);
      })
      .sort((a, b) => (b.invoiceDate || "").localeCompare(a.invoiceDate || ""));
  }, [showArchived, archivedInvoices, invoices.data, q, customerMap]);

  const handleRestore = async (inv: Invoice) => {
    try {
      await updateInvoice.mutateAsync({
        id: inv.id,
        data: { isDeleted: false, deletedAt: null },
      });
      await qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(`Invoice ${inv.invoiceNo} restored`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore invoice");
    }
  };

  return (
    <AppShell
      title="Invoices"
      actions={
        <div className="flex items-center gap-2">
          <MonthlyInvoiceDialog />
          <NewButton to="/invoices/new" label="New invoice" />
        </div>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Input
          placeholder="Search invoices"
          aria-label="Search invoices"
          className="max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {(archivedInvoices.length > 0 || showArchived) && (
          <Button
            type="button"
            variant={showArchived ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground"
            onClick={() => setShowArchived((prev) => !prev)}
          >
            <Archive className="h-3.5 w-3.5" />
            <span>
              {showArchived
                ? `Viewing Archived (${archivedInvoices.length})`
                : `Archived (${archivedInvoices.length})`}
            </span>
          </Button>
        )}
      </div>

      {invoices.error && <p role="alert">Unable to load invoices.</p>}
      {invoices.isLoading ? (
        <p>Loading…</p>
      ) : displayedInvoices.length === 0 ? (
        <p className="py-8 text-muted-foreground">
          {showArchived
            ? "No archived invoices."
            : q.trim()
              ? "No matching invoices found."
              : "No invoices yet."}
        </p>
      ) : (
        displayedInvoices.map((i) => {
          const custName = customerMap.get(i.customerId) ?? "";
          return (
            <div
              key={i.id}
              className="flex items-center justify-between gap-3 border-b py-4 transition-colors hover:bg-muted/20 px-1"
            >
              <Link
                to="/invoices/$id"
                params={{ id: i.id }}
                className="flex min-w-0 flex-1 items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {i.invoiceNo}
                    {custName ? ` · ${custName}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(i.invoiceDate)} · {i.status}
                    {!isInvoiceActive(i) && i.deletedAt
                      ? ` · Archived ${formatDate(i.deletedAt.slice(0, 10))}`
                      : ""}
                  </p>
                </div>
                <span className="tnum whitespace-nowrap font-mono font-medium">
                  ₹{formatINR(i.totalAmount)}
                </span>
              </Link>

              {showArchived ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1 text-xs shrink-0"
                  disabled={updateInvoice.isPending}
                  onClick={() => void handleRestore(i)}
                  title="Restore invoice"
                >
                  <ArchiveRestore className="h-3.5 w-3.5" />
                  <span>Restore</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  aria-label={`Delete invoice ${i.invoiceNo}`}
                  title={`Delete invoice ${i.invoiceNo}`}
                  onClick={() => setInvoiceToDelete(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        })
      )}

      <DeleteInvoiceDialog
        invoice={invoiceToDelete}
        open={Boolean(invoiceToDelete)}
        onOpenChange={(open) => {
          if (!open) setInvoiceToDelete(null);
        }}
        customerName={invoiceToDelete ? customerMap.get(invoiceToDelete.customerId) : undefined}
        jobs={jobs.data ?? []}
        payments={payments.data ?? []}
        onDeleted={() => setInvoiceToDelete(null)}
      />
    </AppShell>
  );
}

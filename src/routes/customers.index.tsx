import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search, Building2, Phone } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerDialog } from "@/components/customer-dialog";
import { customerBalance, customersApi, jobsApi, paymentsApi } from "@/lib/db";
import { formatINR, todayISO } from "@/lib/invoice-calc";

export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — ShopLedger" },
      {
        name: "description",
        content: "Customer list with GSTIN, contact details and running balances.",
      },
      { property: "og:title", content: "Customers — ShopLedger" },
      {
        property: "og:description",
        content: "Customer list with GSTIN, contact details and running balances.",
      },
    ],
  }),
  component: CustomersPage,
});

function CustomersPage() {
  const { data: customers = [], isLoading } = customersApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: payments = [] } = paymentsApi.useList();
  const create = customersApi.useCreate();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          (c.phone ?? "").includes(term) ||
          (c.gstin ?? "").toLowerCase().includes(term),
      )
      .map((c) => ({ ...c, ...customerBalance(c.id, jobs, payments) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, jobs, payments, q]);

  return (
    <AppShell
      title="Customers"
      actions={
        <CustomerDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> New Customer
            </Button>
          }
          onSave={(data) =>
            create.mutate(
              { ...data, createdAt: todayISO() },
              { onSuccess: () => toast.success("Customer added") },
            )
          }
        />
      }
    >
      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name, phone or GSTIN…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No customers found. Add your first customer.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              to="/customers/$id"
              params={{ id: c.id }}
              className="rounded-xl border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-base text-foreground leading-snug">{c.name}</p>
                  {c.monthlyGstBilling && (
                    <span className="shrink-0 inline-flex items-center gap-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-1.5 py-0.5 text-[10px] font-bold">
                      <Building2 className="h-3 w-3" /> GST Monthly
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {c.phone && (
                    <p className="flex items-center gap-1 text-foreground/80 font-mono">
                      <Phone className="h-3 w-3 text-muted-foreground" /> {c.phone}
                    </p>
                  )}
                  <p className="line-clamp-1">
                    {c.state} {c.gstin ? `· GSTIN: ${c.gstin}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t pt-2.5 flex items-end justify-between">
                <div>
                  <span className="text-[11px] text-muted-foreground block">
                    Customer Balance Due
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Jobs: ₹{formatINR(c.jobTotal || 0)} · Recd: ₹{formatINR(c.received || 0)}
                  </span>
                </div>
                <span
                  className={`tnum font-display text-lg font-bold ${
                    c.balance > 0 ? "text-destructive" : "text-emerald-600"
                  }`}
                >
                  {c.balance > 0 ? `₹${formatINR(c.balance)}` : "₹0 (Clear)"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
export { CustomerDialog };

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
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
import { customerBalance, customersApi, invoicesApi, paymentsApi } from "@/lib/db";
import { formatINR, todayISO } from "@/lib/invoice-calc";
import { INDIAN_STATES, type Customer } from "@/lib/types";

export const Route = createFileRoute("/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — ShopLedger" },
      { name: "description", content: "Customer list with GSTIN, contact details and running balances." },
      { property: "og:title", content: "Customers — ShopLedger" },
      { property: "og:description", content: "Customer list with GSTIN, contact details and running balances." },
    ],
  }),
  component: CustomersPage,
});

export function CustomerDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  initial?: Customer;
  onSave: (data: Omit<Customer, "id">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Omit<Customer, "id">>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    gstin: initial?.gstin ?? "",
    state: initial?.state ?? "Tamil Nadu",
    stateCode: initial?.stateCode ?? "33",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    createdAt: initial?.createdAt ?? new Date().toISOString(),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN (optional)</Label>
            <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <select
              className="field-select"
              value={f.state}
              onChange={(e) => {
                const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                setF({ ...f, state: e.target.value, stateCode: st?.code ?? f.stateCode });
              }}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!f.name.trim()) return toast.error("Customer name is required");
              onSave(f);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CustomersPage() {
  const { data: customers = [], isLoading } = customersApi.useList();
  const { data: invoices = [] } = invoicesApi.useList();
  const { data: payments = [] } = paymentsApi.useList();
  const create = customersApi.useCreate();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return customers
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.phone ?? "").includes(term))
      .map((c) => ({ ...c, ...customerBalance(c.id, invoices, payments) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, invoices, payments, q]);

  return (
    <AppShell
      title="Customers"
      actions={
        <CustomerDialog
          trigger={
            <Button size="sm">
              <Plus /> New
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
          placeholder="Search customers"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No customers yet. Add your first one.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              to="/customers/$id"
              params={{ id: c.id }}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <p className="font-medium">{c.name}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {c.state} {c.gstin ? `· ${c.gstin}` : ""}
              </p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-xs text-muted-foreground">Balance due</span>
                <span
                  className={`tnum font-display text-lg font-semibold ${c.balance > 0 ? "text-destructive" : "text-foreground"}`}
                >
                  ₹{formatINR(c.balance)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

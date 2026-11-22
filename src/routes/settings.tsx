import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, HardDriveDownload, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_PROFILE,
  customersApi,
  invoicesApi,
  jobsApi,
  paymentsApi,
  useSaveShopProfile,
  useShopProfile,
} from "@/lib/db";
import {
  exportCustomersCsv,
  exportInvoicesCsv,
  exportJobsCsv,
  exportPaymentsCsv,
} from "@/lib/csv-export";
import { INDIAN_STATES, type ShopProfile } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Shop details & Data Export — ShopLedger" },
      {
        name: "description",
        content: "Business name, GSTIN, address, bank details, and bulk CSV backup exports.",
      },
      { property: "og:title", content: "Shop details & Data Export — ShopLedger" },
      {
        property: "og:description",
        content: "Business name, GSTIN, address, bank details, and bulk CSV backup exports.",
      },
    ],
  }),
  component: SettingsPage,
});

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | number | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SettingsPage() {
  const { data, isLoading } = useShopProfile();
  const save = useSaveShopProfile();
  const [form, setForm] = useState<ShopProfile>(EMPTY_PROFILE);

  // Queries for CSV export
  const { data: customers = [] } = customersApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: invoices = [] } = invoicesApi.useList();
  const { data: allInvoices = [] } = invoicesApi.useAllList();
  const { data: payments = [] } = paymentsApi.useList();

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (k: keyof ShopProfile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleExportAll = () => {
    exportCustomersCsv(customers);
    exportJobsCsv(jobs, customers);
    exportInvoicesCsv(invoices, customers);
    exportPaymentsCsv(payments, customers, jobs, allInvoices);
    toast.success("All 4 CSV files exported successfully!");
  };

  return (
    <AppShell title="Shop Details & Data Export">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="max-w-3xl space-y-8">
          {/* Section 1: Backup & Bulk CSV Export (Feature 1) */}
          <section className="rounded-xl border border-amber-300/40 bg-card p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <FileSpreadsheet className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-foreground">
                    Bulk CSV Data Export (Backup & Safety)
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Export all collections in human-readable CSV format with resolved customer names
                    and dates
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100"
                onClick={handleExportAll}
              >
                <HardDriveDownload className="h-3.5 w-3.5" />
                <span>Export All (4 Files)</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Customers CSV */}
              <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-foreground block">Customers</span>
                  <span className="text-xs text-muted-foreground">
                    {customers.length} customer records
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    exportCustomersCsv(customers);
                    toast.success("Customers CSV exported");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>

              {/* Jobs CSV */}
              <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-foreground block">Job Work Orders</span>
                  <span className="text-xs text-muted-foreground">
                    {jobs.length} fabrication job orders
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    exportJobsCsv(jobs, customers);
                    toast.success("Jobs CSV exported");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>

              {/* Invoices CSV */}
              <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-foreground block">Invoices</span>
                  <span className="text-xs text-muted-foreground">
                    {invoices.length} GST tax invoices
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    exportInvoicesCsv(invoices, customers);
                    toast.success("Invoices CSV exported");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>

              {/* Payments CSV */}
              <div className="rounded-lg border bg-muted/20 p-3.5 flex items-center justify-between gap-2">
                <div>
                  <span className="font-bold text-sm text-foreground block">Payments</span>
                  <span className="text-xs text-muted-foreground">
                    {payments.length} payment receipts
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    exportPaymentsCsv(payments, customers, jobs, allInvoices);
                    toast.success("Payments CSV exported");
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> CSV
                </Button>
              </div>
            </div>
          </section>

          {/* Section 2: Shop Profile Form */}
          <form
            className="space-y-8"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(
                { ...form, defaultGstRate: Number(form.defaultGstRate) || 18 },
                {
                  onSuccess: () => toast.success("Shop details saved"),
                  onError: (err) => toast.error(err instanceof Error ? err.message : "Save failed"),
                },
              );
            }}
          >
            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 font-display text-base font-semibold">Business</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Business name"
                  value={form.businessName}
                  onChange={set("businessName")}
                />
                <Field label="GSTIN / UIN" value={form.gstin} onChange={set("gstin")} />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Address</Label>
                  <textarea
                    className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.address}
                    onChange={(e) => set("address")(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>State</Label>
                  <select
                    className="field-select"
                    value={form.state}
                    onChange={(e) => {
                      const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                      setForm((f) => ({
                        ...f,
                        state: e.target.value,
                        stateCode: st?.code ?? f.stateCode,
                      }));
                    }}
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Field label="State code" value={form.stateCode} onChange={set("stateCode")} />
                <Field label="Phone" value={form.phone} onChange={set("phone")} />
                <Field label="Email" value={form.email} onChange={set("email")} />
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 font-display text-base font-semibold">Bank details</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Bank name" value={form.bankName} onChange={set("bankName")} />
                <Field
                  label="Account number"
                  value={form.accountNumber}
                  onChange={set("accountNumber")}
                />
                <Field label="Branch" value={form.branch} onChange={set("branch")} />
                <Field label="IFSC" value={form.ifsc} onChange={set("ifsc")} />
                <Field
                  label="Authorised signatory"
                  value={form.authorisedSignatoryName}
                  onChange={set("authorisedSignatoryName")}
                />
              </div>
            </section>

            <section className="rounded-xl border bg-card p-5">
              <h2 className="mb-4 font-display text-base font-semibold">Invoice defaults</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Invoice number prefix"
                  value={form.invoicePrefix}
                  placeholder="e.g. INV/25-26/"
                  onChange={set("invoicePrefix")}
                />
                <Field
                  label="Default GST rate (%)"
                  value={form.defaultGstRate}
                  onChange={set("defaultGstRate" as keyof ShopProfile)}
                />
              </div>
            </section>

            <Button type="submit" disabled={save.isPending}>
              Save shop details
            </Button>
          </form>
        </div>
      )}
    </AppShell>
  );
}

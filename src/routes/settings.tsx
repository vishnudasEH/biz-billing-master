import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EMPTY_PROFILE, useSaveShopProfile, useShopProfile } from "@/lib/db";
import { INDIAN_STATES, type ShopProfile } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Shop details — ShopLedger" },
      { name: "description", content: "Business name, GSTIN, address and bank details used on invoices." },
      { property: "og:title", content: "Shop details — ShopLedger" },
      { property: "og:description", content: "Business name, GSTIN, address and bank details used on invoices." },
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
      <Input value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SettingsPage() {
  const { data, isLoading } = useShopProfile();
  const save = useSaveShopProfile();
  const [form, setForm] = useState<ShopProfile>(EMPTY_PROFILE);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const set = (k: keyof ShopProfile) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <AppShell title="Shop details">
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form
          className="max-w-3xl space-y-8"
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
              <Field label="Business name" value={form.businessName} onChange={set("businessName")} />
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
                    setForm((f) => ({ ...f, state: e.target.value, stateCode: st?.code ?? f.stateCode }));
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
              <Field label="Account number" value={form.accountNumber} onChange={set("accountNumber")} />
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
      )}
    </AppShell>
  );
}

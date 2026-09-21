import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { customersApi, invoicesApi, jobsApi, useShopProfile } from "@/lib/db";
import {
  amountInWords,
  computeTotals,
  determineTaxType,
  formatINR,
  gstRateOf,
  nextInvoiceNo,
  round2,
  todayISO,
} from "@/lib/invoice-calc";
import { UNITS, type Invoice, type LineItem } from "@/lib/types";

const emptyItem = (slNo: number): LineItem => ({
  slNo,
  description: "",
  hsnSacCode: "",
  quantity: 1,
  unit: "Nos",
  ratePerUnit: 0,
  amount: 0,
});

export function InvoiceForm({ initial, jobId }: { initial?: Invoice; jobId?: string }) {
  const navigate = useNavigate();
  const { data: customers = [] } = customersApi.useList();
  const { data: invoices = [] } = invoicesApi.useList();
  const { data: jobs = [] } = jobsApi.useList();
  const { data: profile } = useShopProfile();
  const create = invoicesApi.useCreate();
  const update = invoicesApi.useUpdate();
  const updateJob = jobsApi.useUpdate();

  const job = jobs.find((j) => j.id === (initial?.jobId ?? jobId));

  const [invoiceNo, setInvoiceNo] = useState(initial?.invoiceNo ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? todayISO());
  const [customerId, setCustomerId] = useState(initial?.customerId ?? job?.customerId ?? "");
  const [gstRate, setGstRate] = useState<number>(
    initial ? gstRateOf(initial) : (profile?.defaultGstRate ?? 18),
  );
  const [items, setItems] = useState<LineItem[]>(
    initial?.lineItems?.length
      ? initial.lineItems
      : [{ ...emptyItem(1), description: job?.description ?? "" }],
  );
  const [meta, setMeta] = useState({
    deliveryNote: initial?.deliveryNote ?? "",
    paymentTerms: initial?.paymentTerms ?? "",
    supplierRef: initial?.supplierRef ?? "",
    otherRef: initial?.otherRef ?? "",
    buyerOrderNo: initial?.buyerOrderNo ?? "",
    buyerOrderDate: initial?.buyerOrderDate ?? "",
    despatchDocNo: initial?.despatchDocNo ?? "",
    despatchThrough: initial?.despatchThrough ?? "",
    destination: initial?.destination ?? "",
    deliveryTerms: initial?.deliveryTerms ?? "",
    notes: initial?.notes ?? "",
  });

  const suggestedNo = useMemo(
    () => nextInvoiceNo(invoices.map((i) => i.invoiceNo), profile?.invoicePrefix ?? ""),
    [invoices, profile?.invoicePrefix],
  );
  const effectiveNo = invoiceNo || (initial ? initial.invoiceNo : suggestedNo);

  const customer = customers.find((c) => c.id === customerId);
  const taxType = determineTaxType(profile?.stateCode ?? "", customer?.stateCode ?? "");
  const totals = computeTotals(items, taxType, Number(gstRate) || 0);

  const setItem = (i: number, patch: Partial<LineItem>) =>
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const next = { ...it, ...patch };
        next.amount = round2((Number(next.quantity) || 0) * (Number(next.ratePerUnit) || 0));
        return next;
      }),
    );

  const save = (status: Invoice["status"]) => {
    if (!customerId) {
      toast.error("Choose a customer");
      return;
    }
    if (!items.some((i) => i.description.trim())) {
      toast.error("Add at least one line item");
      return;
    }
    if (!invoiceDate || !effectiveNo.trim() || items.some(i => !i.description.trim() || !Number.isFinite(i.quantity) || i.quantity <= 0 || !Number.isFinite(i.ratePerUnit) || i.ratePerUnit < 0) || !Number.isFinite(gstRate) || gstRate < 0 || gstRate > 100) {
      toast.error("Check the date, descriptions, quantities, rates and GST rate"); return;
    }
    if (invoices.some(i => i.id !== initial?.id && i.invoiceNo === effectiveNo.trim())) {
      toast.error("Invoice number already exists"); return;
    }
    const half = (Number(gstRate) || 0) / 2;
    const payload: Omit<Invoice, "id"> = {
      invoiceNo: effectiveNo,
      invoiceDate,
      customerId,
      ...meta,
      lineItems: items.map((it, idx) => ({ ...it, slNo: idx + 1 })),
      taxableValue: totals.taxableValue,
      taxType,
      cgstRate: taxType === "IGST" ? 0 : half,
      cgstAmount: totals.cgstAmount,
      sgstRate: taxType === "IGST" ? 0 : half,
      sgstAmount: totals.sgstAmount,
      igstRate: taxType === "IGST" ? Number(gstRate) || 0 : 0,
      igstAmount: totals.igstAmount,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      status,
      jobId: initial?.jobId ?? jobId ?? null,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    };

    if (initial) {
      update.mutate(
        { id: initial.id, data: payload },
        {
          onSuccess: () => {
            toast.success("Invoice updated");
            navigate({ to: "/invoices/$id", params: { id: initial.id } });
          },
          onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
        },
      );
    } else {
      create.mutate(payload, {
        onSuccess: (id) => {
          if (jobId) updateJob.mutate({ id: jobId, data: { invoiceId: id } });
          toast.success("Invoice created");
          navigate({ to: "/invoices/$id", params: { id } });
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
      });
    }
  };

  return (
    <div className="max-w-5xl space-y-6 pb-8">
      <section className="rounded-lg border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Invoice no.</Label>
            <Input
              value={effectiveNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              placeholder={suggestedNo}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Invoice date</Label>
            <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <select
              className="field-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        {customer && (
          <p className="mt-3 text-xs text-muted-foreground">
            {customer.address} · {customer.state} ({customer.stateCode}) ·{" "}
            {taxType === "IGST" ? "Inter-state → IGST" : "Intra-state → CGST + SGST"}
          </p>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">Items</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setItems((p) => [...p, emptyItem(p.length + 1)])}
          >
            <Plus /> Add row
          </Button>
        </div>
        <div className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="space-y-1.5 sm:col-span-4">
                  <Label className="text-xs">Description</Label>
                  <Input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">HSN/SAC</Label>
                  <Input value={it.hsnSacCode} onChange={(e) => setItem(i, { hsnSacCode: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    value={it.quantity}
                    onChange={(e) => setItem(i, { quantity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs">Unit</Label>
                  <select
                    className="field-select"
                    value={it.unit}
                    onChange={(e) => setItem(i, { unit: e.target.value })}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Rate</Label>
                  <Input
                    type="number"
                    value={it.ratePerUnit}
                    onChange={(e) => setItem(i, { ratePerUnit: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-2">
                  <span className="tnum text-sm font-medium">{formatINR(it.amount)}</span>
                  <button
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setItems((p) => p.filter((_, idx) => idx !== i))}
                    aria-label="Remove row"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-semibold">Despatch & references</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["Delivery note", "deliveryNote"],
                ["Payment terms", "paymentTerms"],
                ["Supplier ref", "supplierRef"],
                ["Other ref", "otherRef"],
                ["Buyer order no.", "buyerOrderNo"],
                ["Buyer order date", "buyerOrderDate"],
                ["Despatch doc no.", "despatchDocNo"],
                ["Despatched through", "despatchThrough"],
                ["Destination", "destination"],
                ["Terms of delivery", "deliveryTerms"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label}</Label>
                <Input
                  value={meta[key]}
                  onChange={(e) => setMeta((m) => ({ ...m, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 font-display text-base font-semibold">Tax & totals</h2>
          <div className="mb-4 max-w-40 space-y-1.5">
            <Label className="text-xs">GST rate (%)</Label>
            <Input type="number" value={gstRate} onChange={(e) => setGstRate(Number(e.target.value))} />
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Taxable value" value={totals.taxableValue} />
            {taxType === "IGST" ? (
              <Row label={`IGST @ ${gstRate}%`} value={totals.igstAmount} />
            ) : (
              <>
                <Row label={`CGST @ ${(Number(gstRate) || 0) / 2}%`} value={totals.cgstAmount} />
                <Row label={`SGST @ ${(Number(gstRate) || 0) / 2}%`} value={totals.sgstAmount} />
              </>
            )}
            <Row label="Round off" value={totals.roundOff} />
            <div className="flex justify-between border-t pt-2 font-display text-lg font-semibold">
              <dt>Total</dt>
              <dd className="tnum">₹{formatINR(totals.totalAmount)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs italic text-muted-foreground">{amountInWords(totals.totalAmount)}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => save(initial?.status ?? "Draft")} disabled={create.isPending || update.isPending}>
          {initial ? "Save changes" : "Save as draft"}
        </Button>
        {!initial && (
          <Button variant="outline" onClick={() => save("Sent")}>
            Save &amp; mark sent
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tnum">{formatINR(value)}</dd>
    </div>
  );
}

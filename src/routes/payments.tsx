import { createFileRoute, Link } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { PaymentDialog } from '@/components/payment-dialog';
import { Button } from '@/components/ui/button';
import { customersApi, invoicesApi, paymentsApi } from '@/lib/db';
import { formatINR } from '@/lib/invoice-calc';
import { pageMeta } from '@/lib/page-meta';

export const Route = createFileRoute('/payments')({ head: () => pageMeta('Payments', 'Record advances, balance and full payments from customers.'), component: Payments });

function Payments() {
  const payments = paymentsApi.useList();
  const customers = customersApi.useList();
  const invoices = invoicesApi.useList();
  const create = paymentsApi.useCreate();
  const update = paymentsApi.useUpdate();
  const remove = paymentsApi.useRemove();
  const name = (id: string) => customers.data?.find((c) => c.id === id)?.name ?? 'Unknown customer';
  const invNo = (id?: string | null) => (id ? invoices.data?.find((i) => i.id === id)?.invoiceNo ?? 'Deleted invoice' : null);
  const list = [...(payments.data ?? [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <AppShell title="Payments" actions={<PaymentDialog trigger={<Button size="sm"><Plus /> Record</Button>} onSave={(p) => create.mutateAsync(p).then(() => toast.success('Payment recorded'))} />}>
      {payments.error && <p role="alert">Unable to load payments.</p>}
      {payments.isLoading ? <p>Loading…</p> : list.length === 0 ? <p className="py-8 text-muted-foreground">No payments recorded yet.</p> : list.map((p) => (
        <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
          <div>
            <Link to="/customers/$id" params={{ id: p.customerId }} className="font-semibold hover:underline">{name(p.customerId)}</Link>
            <p className="text-sm text-muted-foreground">{p.date} · {p.type}{invNo(p.linkedInvoiceId) ? ` · ${invNo(p.linkedInvoiceId)}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="tnum mr-2">₹{formatINR(p.amount)}</span>
            <PaymentDialog initial={p} trigger={<Button size="sm" variant="outline">Edit</Button>} onSave={(d) => update.mutateAsync({ id: p.id, data: d }).then(() => toast.success('Payment updated'))} />
            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this payment?')) remove.mutate(p.id, { onError: (e) => toast.error(e.message) }); }}>Delete</Button>
          </div>
        </div>
      ))}
    </AppShell>
  );
}

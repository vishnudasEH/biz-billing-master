import { createFileRoute, Link } from '@tanstack/react-router';
import { AppShell, NewButton } from '@/components/app-shell';
import { customersApi, invoicesApi, jobsApi, pendingInvoicingJobs } from '@/lib/db';
import { formatINR } from '@/lib/invoice-calc';
import { pageMeta } from '@/lib/page-meta';
export const Route = createFileRoute('/')({ head: () => pageMeta('Dashboard', 'Shop overview and completed jobs awaiting invoices.'), component: Dashboard });
function Dashboard() {
 const jobs = jobsApi.useList(); const invoices = invoicesApi.useList(); const customers = customersApi.useList();
 const pending = pendingInvoicingJobs(jobs.data ?? []);
 return <AppShell title="Dashboard" actions={<NewButton to="/invoices/new" label="New invoice" />}>
 <p className="mb-6 text-sm text-muted-foreground">Shop overview</p>
 {[jobs.error, invoices.error, customers.error].some(Boolean) && <p role="alert" className="mb-4 text-destructive">Could not load shop data. Check your connection and access permissions.</p>}
 <div className="grid gap-4 sm:grid-cols-3">{[['Jobs in progress', (jobs.data ?? []).filter(j=>j.status==='In Progress').length], ['Awaiting invoice', pending.length], ['Sent invoices', `₹${formatINR((invoices.data ?? []).filter(i=>i.status==='Sent').reduce((s,i)=>s+i.totalAmount,0))}`]].map(([label,value])=><div key={label} className="rounded-lg border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 font-display text-3xl tnum">{value}</p></div>)}</div>
 <section className="mt-8"><div className="mb-4 flex justify-between"><h2 className="text-lg font-semibold">Completed · awaiting invoice</h2><Link to="/jobs" className="text-sm text-primary">All jobs →</Link></div>
 {jobs.isLoading ? <p>Loading jobs…</p> : !pending.length ? <p className="border-y py-8 text-muted-foreground">No completed jobs awaiting an invoice.</p> : pending.map(j=><div key={j.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4"><div><p className="font-medium">{j.description}</p><p className="text-sm text-muted-foreground">{customers.data?.find(c=>c.id===j.customerId)?.name}</p></div><Link to="/invoices/new" search={{jobId:j.id}} className="text-sm text-primary">Create invoice →</Link></div>)}</section>
 </AppShell>;
}

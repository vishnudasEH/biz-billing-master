import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AppShell, NewButton } from '@/components/app-shell';
import { Input } from '@/components/ui/input';
import { invoicesApi, customersApi } from '@/lib/db';
import { formatINR } from '@/lib/invoice-calc';
import { pageMeta } from '@/lib/page-meta';
export const Route=createFileRoute('/invoices/')({head:()=>pageMeta('Invoices','GST invoice register, drafts and paid invoices.'),component:Invoices});
function Invoices(){const invoices=invoicesApi.useList();const customers=customersApi.useList();const [q,setQ]=useState('');return <AppShell title="Invoices" actions={<NewButton to="/invoices/new" label="New invoice"/>}><Input placeholder="Search invoices" aria-label="Search invoices" className="mb-5 max-w-sm" value={q} onChange={e=>setQ(e.target.value)}/>{invoices.error&&<p role="alert">Unable to load invoices.</p>}{invoices.isLoading?<p>Loading…</p>:invoices.data?.length===0?<p className="py-8 text-muted-foreground">No invoices yet.</p>:invoices.data?.filter(i=>(i.invoiceNo+' '+customers.data?.find(c=>c.id===i.customerId)?.name).toLowerCase().includes(q.toLowerCase())).sort((a,b)=>b.invoiceDate.localeCompare(a.invoiceDate)).map(i=><Link key={i.id} to="/invoices/$id" params={{id:i.id}} className="flex items-center justify-between gap-4 border-b py-5"><div><p className="font-semibold">{i.invoiceNo} · {customers.data?.find(c=>c.id===i.customerId)?.name}</p><p className="text-sm text-muted-foreground">{i.invoiceDate} · {i.status}</p></div><span className="tnum whitespace-nowrap">₹{formatINR(i.totalAmount)}</span></Link>)}</AppShell>}

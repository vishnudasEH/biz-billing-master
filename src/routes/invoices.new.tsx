import { createFileRoute } from '@tanstack/react-router';
import { AppShell } from '@/components/app-shell';
import { InvoiceForm } from '@/components/invoice-form';
import { customersApi, invoicesApi, jobsApi, useShopProfile } from '@/lib/db';
import { pageMeta } from '@/lib/page-meta';
export const Route=createFileRoute('/invoices/new')({validateSearch:(s:Record<string,unknown>)=>({jobId:typeof s.jobId==='string'?s.jobId:undefined}),head:()=>pageMeta('New invoice','Prepare a GST tax invoice for your customer.'),component:NewInvoice});
function NewInvoice(){const {jobId}=Route.useSearch();const jobs=jobsApi.useList();const customers=customersApi.useList();const invoices=invoicesApi.useList();const profile=useShopProfile();const queries=[jobs,customers,invoices,profile];const job=jobs.data?.find(j=>j.id===jobId);return <AppShell title="New invoice">{queries.some(q=>q.isLoading)?<p>Loading…</p>:queries.some(q=>q.error)?<p role="alert">Unable to load invoice details.</p>:jobId&&(!job||job.invoiceId||job.status!=='Completed')?<p>This job is unavailable for invoicing.</p>:<InvoiceForm jobId={jobId}/>}</AppShell>}

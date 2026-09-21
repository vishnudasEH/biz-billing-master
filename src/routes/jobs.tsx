import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { customersApi, jobsApi } from '@/lib/db';
import { todayISO } from '@/lib/invoice-calc';
import { pageMeta } from '@/lib/page-meta';
import type { Job } from '@/lib/types';
export const Route = createFileRoute('/jobs')({head:()=>pageMeta('Jobs','Track fabrication work and invoice completed jobs.'),component:Jobs});
function Jobs(){
 const jobs=jobsApi.useList(); const customers=customersApi.useList(); const create=jobsApi.useCreate(); const update=jobsApi.useUpdate(); const remove=jobsApi.useRemove();
 const [editing,setEditing]=useState<Job|null>(null); const [open,setOpen]=useState(false); const [description,setDescription]=useState(''); const [customerId,setCustomerId]=useState(''); const [filter,setFilter]=useState('All');
 const error=(e:Error)=>toast.error(e.message); const close=()=>{setOpen(false);setEditing(null);setDescription('');setCustomerId('');};
 return <AppShell title="Jobs" actions={<Button size="sm" onClick={()=>{close();setOpen(true);}}>New job</Button>}>
 {open && <form className="mb-6 grid gap-3 border-b pb-6 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();try{if(editing)await update.mutateAsync({id:editing.id,data:{description,customerId}});else await create.mutateAsync({description,customerId,status:'In Progress',dateCreated:todayISO(),invoiceId:null});close();toast.success('Job saved');}catch(e){toast.error(e instanceof Error?e.message:'Save failed');}}}>
 <label className="space-y-2">Description<Input required value={description} onChange={e=>setDescription(e.target.value)}/></label><label className="space-y-2">Customer<select required className="field-select" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Select customer</option>{customers.data?.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="flex gap-2"><Button disabled={create.isPending||update.isPending}>Save job</Button><Button type="button" variant="outline" onClick={close}>Cancel</Button></div></form>}
 <select aria-label="Filter jobs" className="field-select mb-5 max-w-xs" value={filter} onChange={e=>setFilter(e.target.value)}>{['All','In Progress','Completed','Awaiting invoice'].map(s=><option key={s}>{s}</option>)}</select>
 {jobs.error && <p role="alert" className="text-destructive">Unable to load jobs.</p>}{jobs.isLoading && <p>Loading…</p>}
 {jobs.data?.filter(j=>filter==='All'||(filter==='Awaiting invoice'?j.status==='Completed'&&!j.invoiceId:j.status===filter)).map(j=><div key={j.id} className="flex flex-wrap items-center justify-between gap-4 border-b py-5"><div><h2 className="font-semibold">{j.description}</h2><p className="text-sm text-muted-foreground">{customers.data?.find(c=>c.id===j.customerId)?.name} · {j.status} · {j.dateCreated}</p></div><div className="flex flex-wrap gap-2">{!j.invoiceId && <><Button variant="outline" size="sm" onClick={()=>{setEditing(j);setDescription(j.description);setCustomerId(j.customerId);setOpen(true);}}>Edit</Button><Button variant="outline" size="sm" onClick={()=>update.mutate({id:j.id,data:{status:j.status==='Completed'?'In Progress':'Completed',dateCompleted:j.status==='Completed'?null:todayISO()}},{onError:error})}>{j.status==='Completed'?'Reopen':'Complete'}</Button></>}{j.invoiceId?<Button asChild size="sm"><Link to="/invoices/$id" params={{id:j.invoiceId}}>Invoice</Link></Button>:j.status==='Completed'&&<Button asChild size="sm"><Link to="/invoices/new" search={{jobId:j.id}}>Create invoice</Link></Button>}{!j.invoiceId&&<Button variant="ghost" size="sm" onClick={()=>{if(confirm('Delete this job?'))remove.mutate(j.id,{onError:error});}}>Delete</Button>}</div></div>)}
 {jobs.data?.length===0&&<p className="py-8 text-muted-foreground">No jobs yet.</p>}
 </AppShell>;
}

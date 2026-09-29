import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  Landmark,
  Plus,
  Smartphone,
  Wallet,
  Wrench,
  AlertCircle,
  Phone,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { JobFormDialog } from "@/components/job-form-dialog";
import { CollectBalanceDialog } from "@/components/collect-balance-dialog";
import { MonthlyInvoiceDialog } from "@/components/monthly-invoice-dialog";
import {
  customersApi,
  invoicesApi,
  jobAdvance,
  jobBalance,
  jobsApi,
  paymentsApi,
  pendingInvoicingJobs,
  useShopProfile,
} from "@/lib/db";
import { formatDate, formatINR, todayISO } from "@/lib/invoice-calc";
import { openJobPdf } from "@/lib/job-pdf";
import { pageMeta } from "@/lib/page-meta";
import type { Job } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () =>
    pageMeta(
      "Dashboard",
      "Balaji Wood Kraft - Daily job work orders, cash collection, and customer balances.",
    ),
  component: Dashboard,
});

function Dashboard() {
  const { data: jobs = [], isLoading: jobsLoading } = jobsApi.useList();
  const { data: payments = [], isLoading: paymentsLoading } = paymentsApi.useList();
  const { data: customers = [] } = customersApi.useList();
  const { data: invoices = [] } = invoicesApi.useList();
  const { data: shopProfile } = useShopProfile();

  const [newJobOpen, setNewJobOpen] = useState(false);

  const today = todayISO();

  // Metrics Calculations:
  // 1. Today's Jobs
  const todayJobs = useMemo(() => {
    return jobs.filter((j) => (j.date || j.dateCreated) === today);
  }, [jobs, today]);

  const todayJobsCount = todayJobs.length;
  const todayJobsValue = useMemo(() => {
    return todayJobs.reduce((s, j) => s + (Number(j.total) || 0), 0);
  }, [todayJobs]);

  // 2. Today's Collections split by Cash, GPay, Bank
  const todayPayments = useMemo(() => {
    return payments.filter((p) => p.date === today);
  }, [payments, today]);

  const todayCashCollected = useMemo(() => {
    return todayPayments
      .filter((p) => (p.mode || "Cash") === "Cash")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [todayPayments]);

  const todayGPayCollected = useMemo(() => {
    return todayPayments
      .filter((p) => p.mode === "GPay")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [todayPayments]);

  const todayBankCollected = useMemo(() => {
    return todayPayments
      .filter((p) => p.mode === "Bank")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [todayPayments]);

  const totalCollectedToday = todayCashCollected + todayGPayCollected + todayBankCollected;

  // 3. Total Balance Pending across all jobs
  const totalBalancePending = useMemo(() => {
    return jobs.reduce((s, j) => s + Math.max(0, jobBalance(j, payments)), 0);
  }, [jobs, payments]);

  // 4. Jobs Completed but balance unpaid
  const completedUnpaidJobs = useMemo(() => {
    return jobs.filter((j) => j.status === "Completed" && jobBalance(j, payments) > 0);
  }, [jobs, payments]);

  const completedUnpaidAmount = useMemo(() => {
    return completedUnpaidJobs.reduce((s, j) => s + jobBalance(j, payments), 0);
  }, [completedUnpaidJobs, payments]);

  // 5. Jobs Completed but not yet invoiced
  const completedAwaitingInvoice = useMemo(() => {
    return pendingInvoicingJobs(jobs);
  }, [jobs]);

  return (
    <AppShell
      title="Dashboard"
      actions={
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNewJobOpen(true)}
            className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Job Order</span>
          </Button>
        </div>
      }
    >
      {/* Shop Welcome Banner on mobile */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-amber-900 to-stone-900 p-4 sm:p-5 text-white shadow-sm">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            Balaji Wood Kraft · CNC Job Work
          </span>
          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white mt-0.5">
            Daily Job Orders & Ledger
          </h2>
          <p className="text-xs text-amber-100/80 mt-1">
            Today: {formatDate(today)} · {todayJobsCount} order{todayJobsCount === 1 ? "" : "s"}{" "}
            today
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setNewJobOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold gap-1.5 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create Slip</span>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <Link to="/jobs">All Orders →</Link>
          </Button>
        </div>
      </div>

      {/* Primary KPI Grid (Section 3.5) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: Today's Jobs */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Jobs</span>
            <Wrench className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-display text-3xl font-bold tnum">{todayJobsCount}</span>
            <span className="text-sm font-semibold font-mono text-muted-foreground">
              ₹{formatINR(todayJobsValue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {todayJobsCount > 0 ? "Daily fabrication work orders" : "No orders created today yet"}
          </p>
        </div>

        {/* Card 2: Today's Collections & Split */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Today's Collected
            </span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              ₹{formatINR(totalCollectedToday)}
            </span>
          </div>
          {/* Split by Cash, GPay, Bank */}
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] font-mono border-t pt-2">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 font-medium">
              <Banknote className="h-3 w-3" /> Cash: ₹
              {formatINR(todayCashCollected, { decimals: 0 })}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 font-medium">
              <Smartphone className="h-3 w-3" /> GPay: ₹
              {formatINR(todayGPayCollected, { decimals: 0 })}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 font-medium">
              <Landmark className="h-3 w-3" /> Bank: ₹
              {formatINR(todayBankCollected, { decimals: 0 })}
            </span>
          </div>
        </div>

        {/* Card 3: Total Balance Pending */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Balance Due
            </span>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2">
            <span
              className={`font-display text-2xl font-bold font-mono ${
                totalBalancePending > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"
              }`}
            >
              ₹{formatINR(totalBalancePending)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Customer balance across all active job orders
          </p>
        </div>

        {/* Card 4: Completed but Unpaid */}
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Completed · Unpaid
            </span>
            <Clock className="h-4 w-4 text-rose-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-display text-2xl font-bold tnum text-foreground">
              {completedUnpaidJobs.length}
            </span>
            <span className="text-sm font-semibold font-mono text-rose-600 dark:text-rose-400">
              ₹{formatINR(completedUnpaidAmount)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Jobs finished ready for delivery with balance pending
          </p>
        </div>

        {/* Card 5: Completed · Awaiting Invoice */}
        <div className="rounded-xl border bg-card p-4 shadow-xs sm:col-span-2 lg:col-span-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Completed · Awaiting Monthly GST Invoice
            </span>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-display text-2xl font-bold tnum">
                {completedAwaitingInvoice.length}
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                completed orders ready to bill
              </span>
            </div>
            {completedAwaitingInvoice.length > 0 && (
              <MonthlyInvoiceDialog
                trigger={
                  <Button size="sm" variant="outline" className="h-8 text-xs font-medium gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Create Monthly Invoice</span>
                  </Button>
                }
              />
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Tax invoices are built monthly from these completed fabrication orders
          </p>
        </div>
      </div>

      {/* Today's Job Work Orders Section */}
      <section className="mt-8 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold font-display text-foreground">
              Today's Job Work Orders ({todayJobs.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Orders created today. Collect balance or update progress.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-xs text-primary">
            <Link to="/jobs">View All Orders →</Link>
          </Button>
        </div>

        {todayJobs.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center bg-card space-y-2">
            <p className="text-sm font-semibold text-foreground">No job orders created today yet</p>
            <p className="text-xs text-muted-foreground">
              Create a Job Work Order slip for walk-in customers or CNC fabrication.
            </p>
            <Button
              size="sm"
              onClick={() => setNewJobOpen(true)}
              className="mt-2 bg-amber-700 hover:bg-amber-800 text-white gap-1.5"
            >
              <Plus className="h-4 w-4" /> Create New Order
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {todayJobs.map((job) => {
              const advance = jobAdvance(job.id, payments);
              const total = Number(job.total) || 0;
              const balance = jobBalance(job, payments);
              const hasBalance = balance > 0;

              return (
                <div
                  key={job.id}
                  className="rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-amber-600/40 hover:shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {job.jobNo || "JW-order"}
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                        {job.status}
                      </span>
                    </div>

                    <div className="pt-2">
                      <p className="font-bold text-sm text-foreground">{job.customerName}</p>
                      {job.mobile && (
                        <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {job.mobile}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                        {job.items?.[0]?.description || job.description || "CNC Job Work"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground">
                        Total:{" "}
                        <strong className="font-mono text-foreground">₹{formatINR(total)}</strong>
                      </span>
                      <span
                        className={`font-mono font-bold ${
                          hasBalance ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"
                        }`}
                      >
                        {hasBalance ? `Bal: ₹${formatINR(balance)}` : "PAID"}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {hasBalance && (
                        <CollectBalanceDialog
                          job={job}
                          payments={payments}
                          trigger={
                            <Button size="sm" className="h-8 text-xs font-semibold flex-1">
                              Collect ₹{formatINR(balance)}
                            </Button>
                          }
                        />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openJobPdf(job, payments, shopProfile)}
                      >
                        Slip PDF
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Completed Jobs Awaiting Invoice Section */}
      {completedAwaitingInvoice.length > 0 && (
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold font-display text-foreground">
                Completed Orders Awaiting Monthly Invoice ({completedAwaitingInvoice.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Completed work orders not yet assigned to any monthly GST tax invoice.
              </p>
            </div>
            <MonthlyInvoiceDialog />
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="divide-y text-xs">
              {completedAwaitingInvoice.slice(0, 5).map((job) => (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted/30"
                >
                  <div>
                    <p className="font-semibold text-foreground font-mono">
                      {job.jobNo || "JW"} · {job.customerName}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {job.description || job.items?.[0]?.description || "Job work"} · Date:{" "}
                      {formatDate(job.date || job.dateCreated)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm">
                      ₹{formatINR(job.total || 0)}
                    </span>
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                      <Link to="/invoices/new" search={{ jobId: job.id }}>
                        Invoice Now
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* New Job Order Dialog */}
      <JobFormDialog open={newJobOpen} onOpenChange={setNewJobOpen} />
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  ChevronRight,
  Edit,
  Eye,
  Phone,
  Plus,
  Printer,
  Search,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobFormDialog } from "@/components/job-form-dialog";
import { CollectBalanceDialog } from "@/components/collect-balance-dialog";
import { JobBillPreviewDialog } from "@/components/job-bill-preview-dialog";
import { DeleteJobDialog } from "@/components/delete-job-dialog";
import {
  customersApi,
  jobAdvance,
  jobBalance,
  jobsApi,
  paymentsApi,
  useShopProfile,
} from "@/lib/db";
import { formatDate, formatINR, todayISO } from "@/lib/invoice-calc";
import { printJobBill } from "@/lib/job-print";
import { pageMeta } from "@/lib/page-meta";
import type { Job, JobStatus } from "@/lib/types";

export const Route = createFileRoute("/jobs")({
  head: () =>
    pageMeta(
      "Job Work Orders",
      "Balaji Wood Kraft - Daily job work orders, bill preview, printing, and CNC billing.",
    ),
  component: JobsPage,
});

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; color: string; next?: JobStatus; nextAction?: string }
> = {
  Received: {
    label: "Received",
    color: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200",
    next: "In Progress",
    nextAction: "Start Work",
  },
  "In Progress": {
    label: "In Progress",
    color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
    next: "Completed",
    nextAction: "Complete",
  },
  Completed: {
    label: "Completed",
    color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
    next: "Delivered",
    nextAction: "Deliver",
  },
  Delivered: {
    label: "Delivered",
    color:
      "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
};

function JobsPage() {
  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = jobsApi.useList();
  const { data: customers = [] } = customersApi.useList();
  const { data: payments = [] } = paymentsApi.useList();
  const { data: shopProfile } = useShopProfile();

  const updateJob = jobsApi.useUpdate();

  // Search & Filter State (Default filter is "Today")
  const [filterTab, setFilterTab] = useState<string>("Today");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Modals state
  const [newJobOpen, setNewJobOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const [deletingJob, setDeletingJob] = useState<Job | null>(null);

  const today = todayISO();

  // Filter Logic
  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => {
        const jobDate = j.date || j.dateCreated || "";
        const remBalance = jobBalance(j, payments);

        // Tab filters
        if (filterTab === "Today") {
          if (jobDate !== today) return false;
        } else if (filterTab === "Received") {
          if (j.status !== "Received") return false;
        } else if (filterTab === "In Progress") {
          if (j.status !== "In Progress") return false;
        } else if (filterTab === "Completed") {
          if (j.status !== "Completed") return false;
        } else if (filterTab === "Delivered") {
          if (j.status !== "Delivered") return false;
        } else if (filterTab === "Balance Pending") {
          if (remBalance <= 0) return false;
        } else if (filterTab === "Completed & Not Delivered") {
          if (j.status !== "Completed") return false;
        }

        // Customer filter
        if (selectedCustomerId && j.customerId !== selectedCustomerId) return false;

        // Date Range
        if (dateFrom && jobDate < dateFrom) return false;
        if (dateTo && jobDate > dateTo) return false;

        // Search query: jobNo, customerName, mobile, designFileId, description
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchNo = (j.jobNo || "").toLowerCase().includes(q);
          const matchCust = (j.customerName || "").toLowerCase().includes(q);
          const matchMobile = (j.mobile || "").toLowerCase().includes(q);
          const matchDesign = (j.designFileId || "").toLowerCase().includes(q);
          const matchDesc = (j.description || "").toLowerCase().includes(q);
          if (!matchNo && !matchCust && !matchMobile && !matchDesign && !matchDesc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = a.date || a.dateCreated || "";
        const dateB = b.date || b.dateCreated || "";
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return (b.jobNo || "").localeCompare(a.jobNo || "");
      });
  }, [jobs, payments, filterTab, selectedCustomerId, dateFrom, dateTo, searchQuery, today]);

  // Quick Status Transition
  const advanceStatus = async (job: Job) => {
    const cfg = STATUS_CONFIG[job.status];
    if (!cfg.next) return;

    try {
      await updateJob.mutateAsync({
        id: job.id,
        data: {
          status: cfg.next,
          ...(cfg.next === "Completed" ? { dateCompleted: todayISO() } : {}),
        },
      });
      toast.success(`Job ${job.jobNo || "order"} status updated to "${cfg.next}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  };

  // Direct Print handler for the card Print button
  const handleDirectPrint = async (job: Job) => {
    try {
      toast.info(`Preparing print for ${job.jobNo || "order"}…`);
      await printJobBill(job, payments, shopProfile, "header");
    } catch {
      setPreviewJob(job);
    }
  };

  return (
    <AppShell
      title="Job Work Orders"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditingJob(null);
            setNewJobOpen(true);
          }}
          className="gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-semibold shadow-xs"
        >
          <Plus className="h-4 w-4" />
          <span>New Job Order</span>
        </Button>
      }
    >
      {/* Top Filter and Search Controls */}
      <div className="space-y-3 pb-4">
        {/* Search & Customer Dropdown */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-center">
          <div className="sm:col-span-2 relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10 text-sm bg-card border-border shadow-2xs"
              placeholder="Search by Job # (e.g. JW-0001), Customer, Phone, Design ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Filter by customer"
              className="field-select h-10 text-xs sm:text-sm flex-1 bg-card rounded-md border border-input px-3"
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
            >
              <option value="">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {(selectedCustomerId || dateFrom || dateTo || searchQuery) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-10 text-xs text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => {
                  setSelectedCustomerId("");
                  setDateFrom("");
                  setDateTo("");
                  setSearchQuery("");
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Filter Pills / Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 text-xs scrollbar-none">
          {[
            { id: "Today", label: "Today's Orders" },
            { id: "All", label: "All Orders" },
            { id: "Received", label: "Received" },
            { id: "In Progress", label: "In Progress" },
            { id: "Completed", label: "Completed" },
            { id: "Delivered", label: "Delivered" },
            { id: "Balance Pending", label: "Balance Pending" },
            { id: "Completed & Not Delivered", label: "Completed · Undelivered" },
          ].map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterTab(tab.id)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all select-none shrink-0 ${
                  active
                    ? "bg-amber-700 text-white border-amber-800 shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-muted border-border"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content List */}
      {jobsError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Unable to load Job Work Orders. Please check connection.
        </div>
      )}

      {jobsLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
          <p>Loading Job Work Orders…</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3 bg-muted/10">
          <Wrench className="h-10 w-10 text-muted-foreground/60 mx-auto" />
          <div>
            <p className="font-semibold text-foreground text-base">No Job Work Orders found</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {filterTab === "Today"
                ? 'No orders created for today yet. Tap "New Job Order" to create a new slip.'
                : "No job work orders match the current filters or search term."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setNewJobOpen(true)}
            className="bg-amber-700 hover:bg-amber-800 text-white gap-1.5"
          >
            <Plus className="h-4 w-4" /> Create First Order
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Showing <strong>{filteredJobs.length}</strong> job order
              {filteredJobs.length === 1 ? "" : "s"}
            </span>
            <span className="font-mono">
              Total Value: ₹
              {formatINR(filteredJobs.reduce((s, j) => s + (Number(j.total) || 0), 0))}
            </span>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredJobs.map((job) => {
              const advance = jobAdvance(job.id, payments);
              const total = Number(job.total) || 0;
              const balance = jobBalance(job, payments);
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.Received;
              const hasBalance = balance > 0;

              return (
                <div
                  key={job.id}
                  className="rounded-xl border bg-card p-4 shadow-xs transition-all hover:border-amber-600/40 hover:shadow-sm flex flex-col justify-between"
                >
                  {/* Card Header: JobNo, Date, Status */}
                  <div>
                    <div className="flex items-center justify-between gap-2 border-b pb-2.5">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <span className="font-display font-bold text-base text-foreground font-mono truncate">
                          {job.jobNo || "JW-order"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono shrink-0">
                          {formatDate(job.date || job.dateCreated)}
                        </span>
                      </div>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${cfg.color}`}
                      >
                        {cfg.label}
                      </span>
                    </div>

                    {/* Customer & Details */}
                    <div className="pt-2.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-foreground text-sm truncate">
                            {job.customerName || "Customer"}
                          </p>
                          {job.mobile ? (
                            <a
                              href={`tel:${job.mobile}`}
                              className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 font-mono mt-0.5 truncate"
                            >
                              <Phone className="h-3 w-3 shrink-0 text-amber-700 dark:text-amber-400" />
                              <span className="truncate">{job.mobile}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/60 italic block mt-0.5">
                              No mobile
                            </span>
                          )}
                        </div>

                        {job.designFileId && (
                          <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground max-w-[120px] truncate">
                            {job.designFileId}
                          </span>
                        )}
                      </div>

                      {/* Wood Types & Material badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] pt-1">
                        {(job.woodTypes || []).map((wt) => (
                          <span
                            key={wt}
                            className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300 px-2 py-0.5 font-medium text-[11px] leading-tight"
                          >
                            {wt === "Others" && job.woodTypeOther ? job.woodTypeOther : wt}
                          </span>
                        ))}
                        {job.materialSuppliedBy && (
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-muted-foreground font-medium text-[10px] leading-tight">
                            Mat: {job.materialSuppliedBy}
                          </span>
                        )}
                      </div>

                      {/* Work items preview */}
                      <p className="text-xs text-muted-foreground line-clamp-1 italic pt-0.5">
                        {job.items?.[0]?.description || job.description || "CNC Job Work"}
                        {job.items &&
                          job.items.length > 1 &&
                          ` (+${job.items.length - 1} more items)`}
                      </p>
                    </div>
                  </div>

                  {/* Financial Strip: Grid alignment */}
                  <div className="mt-4 pt-3 border-t space-y-2.5">
                    <div className="grid grid-cols-3 divide-x divide-border/60 bg-muted/30 rounded-lg p-2.5 text-center text-xs">
                      <div className="px-1 flex flex-col justify-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Total
                        </span>
                        <span className="font-mono font-bold text-foreground text-sm mt-0.5">
                          ₹{formatINR(total)}
                        </span>
                      </div>
                      <div className="px-1 flex flex-col justify-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Advance
                        </span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">
                          ₹{formatINR(advance)}
                        </span>
                      </div>
                      <div className="px-1 flex flex-col justify-center">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Balance
                        </span>
                        <span
                          className={`font-mono font-bold text-sm mt-0.5 ${
                            hasBalance ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"
                          }`}
                        >
                          {hasBalance ? `₹${formatINR(balance)}` : "PAID"}
                        </span>
                      </div>
                    </div>

                    {/* Operational Action Row: Collect Balance & Status advance */}
                    {(hasBalance || cfg.next) && (
                      <div className="flex items-center gap-1.5">
                        {hasBalance && (
                          <CollectBalanceDialog
                            job={job}
                            payments={payments}
                            trigger={
                              <Button
                                size="sm"
                                className="h-8.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white flex-1"
                              >
                                <Wallet className="h-3.5 w-3.5 mr-1" />
                                <span>Collect ₹{formatINR(balance)}</span>
                              </Button>
                            }
                          />
                        )}

                        {cfg.next && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8.5 text-xs font-medium shrink-0"
                            onClick={() => advanceStatus(job)}
                          >
                            <span>{cfg.nextAction}</span>
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Core Document Action Bar: Preview, Print, Edit, Delete */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-border/60">
                      {/* 1. Preview Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8.5 text-xs font-semibold px-2 flex items-center justify-center gap-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-700 dark:hover:text-blue-300 hover:border-blue-300 transition-colors"
                        onClick={() => setPreviewJob(job)}
                        title="Preview Job Order Bill"
                      >
                        <Eye className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>Preview</span>
                      </Button>

                      {/* 2. Print Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8.5 text-xs font-semibold px-2 flex items-center justify-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:text-emerald-700 dark:hover:text-emerald-300 hover:border-emerald-300 transition-colors"
                        onClick={() => handleDirectPrint(job)}
                        title="Print Job Order Bill"
                      >
                        <Printer className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>Print</span>
                      </Button>

                      {/* 3. Edit Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8.5 text-xs font-semibold px-2 flex items-center justify-center gap-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 hover:text-amber-800 dark:hover:text-amber-300 hover:border-amber-300 transition-colors"
                        onClick={() => setEditingJob(job)}
                        title="Edit Job Order"
                      >
                        <Edit className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Edit</span>
                      </Button>

                      {/* 4. Delete Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8.5 text-xs font-semibold px-2 flex items-center justify-center gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                        onClick={() => setDeletingJob(job)}
                        title="Delete Job Order"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. New Job Order Dialog */}
      <JobFormDialog
        open={newJobOpen}
        onOpenChange={setNewJobOpen}
        onSaved={() => {
          setNewJobOpen(false);
        }}
      />

      {/* 2. Edit Job Order Dialog */}
      {editingJob && (
        <JobFormDialog
          open={Boolean(editingJob)}
          onOpenChange={(o) => !o && setEditingJob(null)}
          initial={editingJob}
          onSaved={() => {
            setEditingJob(null);
          }}
        />
      )}

      {/* 3. Preview & Print Bill Dialog */}
      {previewJob && (
        <JobBillPreviewDialog
          open={Boolean(previewJob)}
          onOpenChange={(o) => !o && setPreviewJob(null)}
          job={previewJob}
          payments={payments}
          onEditRequested={(j) => {
            setPreviewJob(null);
            setEditingJob(j);
          }}
        />
      )}

      {/* 4. Delete Confirmation Dialog */}
      {deletingJob && (
        <DeleteJobDialog
          open={Boolean(deletingJob)}
          onOpenChange={(o) => !o && setDeletingJob(null)}
          job={deletingJob}
          onDeleted={() => {
            setDeletingJob(null);
          }}
        />
      )}
    </AppShell>
  );
}

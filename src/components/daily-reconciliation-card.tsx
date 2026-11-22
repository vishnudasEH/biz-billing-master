import { useMemo, useState } from "react";
import {
  Banknote,
  Calendar,
  CheckCircle2,
  DollarSign,
  Landmark,
  Layers,
  Smartphone,
  Sparkles,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatINR, todayISO } from "@/lib/invoice-calc";
import type { Job, Payment } from "@/lib/types";

export function DailyReconciliationCard({
  jobs = [],
  payments = [],
  defaultDate,
}: {
  jobs: Job[];
  payments: Payment[];
  defaultDate?: string;
}) {
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate || todayISO());
  const today = todayISO();

  // 1. Jobs created on selected date
  const dayJobs = useMemo(() => {
    return jobs.filter((j) => (j.date || j.dateCreated || "") === selectedDate);
  }, [jobs, selectedDate]);

  const jobsCount = dayJobs.length;
  const jobsTotalValue = useMemo(() => {
    return dayJobs.reduce((s, j) => s + (Number(j.total) || 0), 0);
  }, [dayJobs]);

  // 2. Payments collected on selected date
  const dayPayments = useMemo(() => {
    return payments.filter((p) => p.date === selectedDate);
  }, [payments, selectedDate]);

  const cashAmount = useMemo(() => {
    return dayPayments
      .filter((p) => (p.mode || "Cash") === "Cash")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [dayPayments]);

  const gpayAmount = useMemo(() => {
    return dayPayments
      .filter((p) => p.mode === "GPay")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [dayPayments]);

  const bankAmount = useMemo(() => {
    return dayPayments
      .filter((p) => p.mode === "Bank")
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [dayPayments]);

  const totalCollected = cashAmount + gpayAmount + bankAmount;

  const isToday = selectedDate === today;

  const setYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header and Date Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <Wallet className="h-4 w-4" />
            </span>
            <h3 className="font-display font-bold text-base text-foreground">
              Daily Cash Reconciliation
            </h3>
            {isToday && (
              <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                Today
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            End-of-day register summary to match against physical cash drawer
          </p>
        </div>

        {/* Date Controls */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant={isToday ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs font-semibold px-2.5"
            onClick={() => setSelectedDate(today)}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-medium px-2"
            onClick={setYesterday}
          >
            Yesterday
          </Button>
          <div className="relative">
            <Input
              type="date"
              aria-label="Select reconciliation date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="h-8 text-xs font-mono w-36 px-2 bg-background"
            />
          </div>
        </div>
      </div>

      {/* Primary KPI Grid: Single Screen, No scrolling required */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Box 1: Jobs Created */}
        <div className="rounded-lg border bg-muted/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Jobs Created
            </span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="font-display text-2xl font-black text-foreground font-mono">
              {jobsCount}
            </span>
            <span className="font-mono font-bold text-sm text-foreground">
              ₹{formatINR(jobsTotalValue)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Total job orders booked on {formatDate(selectedDate)}
          </p>
        </div>

        {/* Box 2: Physical Cash Collected (Highlight for Cash Drawer Check) */}
        <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Cash Drawer (Physical)
            </span>
            <Banknote className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
              ₹{formatINR(cashAmount)}
            </span>
          </div>
          <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium mt-1">
            ✓ Count physical cash drawer to match ₹{formatINR(cashAmount)}
          </p>
        </div>

        {/* Box 3: Digital Collections (GPay + Bank) */}
        <div className="rounded-lg border bg-muted/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">UPI & Bank Transfers</span>
            <Smartphone className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1">
                <Smartphone className="h-3 w-3 text-blue-600" /> GPay / UPI:
              </span>
              <span className="font-bold text-foreground">₹{formatINR(gpayAmount)}</span>
            </div>
            <div className="flex justify-between text-xs font-mono">
              <span className="text-muted-foreground flex items-center gap-1">
                <Landmark className="h-3 w-3 text-purple-600" /> Bank Transfer:
              </span>
              <span className="font-bold text-foreground">₹{formatINR(bankAmount)}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Digital receipts: ₹{formatINR(gpayAmount + bankAmount)}
          </p>
        </div>

        {/* Box 4: Grand Total Collections */}
        <div className="rounded-lg border-2 border-amber-600/30 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-200">
              Total Day Collection
            </span>
            <DollarSign className="h-4 w-4 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="mt-2">
            <span className="font-display text-2xl font-black font-mono text-amber-900 dark:text-amber-200">
              ₹{formatINR(totalCollected)}
            </span>
          </div>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium mt-1">
            {dayPayments.length} payment transaction{dayPayments.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>
    </div>
  );
}

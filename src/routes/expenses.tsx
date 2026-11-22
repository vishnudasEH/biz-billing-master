import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Edit,
  Plus,
  Receipt,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { ExpenseDialog, type ExpenseInput } from "@/components/expense-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { expensesApi, paymentsApi } from "@/lib/db";
import { formatDate, formatINR, todayISO } from "@/lib/invoice-calc";
import { pageMeta } from "@/lib/page-meta";
import type { Expense } from "@/lib/types";

export const Route = createFileRoute("/expenses")({
  head: () =>
    pageMeta(
      "Expenses & Monthly P&L",
      "Shop fabrication expenses, category breakdown, and monthly profit and loss reconciliation.",
    ),
  component: ExpensesPage,
});

function getMonthString(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

function formatMonthLabel(monthStr: string): string {
  try {
    const [year, month] = monthStr.split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  } catch {
    return monthStr;
  }
}

function getPrevMonthString(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return d.toISOString().slice(0, 7);
}

function getNextMonthString(monthStr: string): string {
  const [year, month] = monthStr.split("-").map(Number);
  const d = new Date(year, month, 1);
  return d.toISOString().slice(0, 7);
}

function ExpensesPage() {
  const qc = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthString());
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);

  const expensesQuery = expensesApi.useList();
  const paymentsQuery = paymentsApi.useList();

  const createExpense = expensesApi.useCreate();
  const updateExpense = expensesApi.useUpdate();
  const removeExpense = expensesApi.useRemove();

  const rawExpenses = expensesQuery.data;
  const rawPayments = paymentsQuery.data;
  const expenses = useMemo(() => rawExpenses ?? [], [rawExpenses]);
  const payments = useMemo(() => rawPayments ?? [], [rawPayments]);

  const prevMonth = getPrevMonthString(selectedMonth);

  // 1. Current Month Financials (P&L)
  const monthExpenses = useMemo(() => {
    return expenses.filter((e) => (e.date || "").startsWith(selectedMonth));
  }, [expenses, selectedMonth]);

  const totalExpenses = useMemo(() => {
    return monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [monthExpenses]);

  // Income for this month = payments collected in this month
  const monthPayments = useMemo(() => {
    return payments.filter((p) => (p.date || "").startsWith(selectedMonth));
  }, [payments, selectedMonth]);

  const totalIncome = useMemo(() => {
    return monthPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [monthPayments]);

  const netProfit = totalIncome - totalExpenses;
  const isProfit = netProfit >= 0;

  // 2. Previous Month Comparison
  const prevMonthExpenses = useMemo(() => {
    return expenses
      .filter((e) => (e.date || "").startsWith(prevMonth))
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [expenses, prevMonth]);

  const prevMonthIncome = useMemo(() => {
    return payments
      .filter((p) => (p.date || "").startsWith(prevMonth))
      .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [payments, prevMonth]);

  const prevNetProfit = prevMonthIncome - prevMonthExpenses;
  const profitDelta = netProfit - prevNetProfit;

  // Category breakdown for this month
  const categoryTotals = useMemo(() => {
    const map = new Map<string, number>();
    monthExpenses.forEach((e) => {
      const cat = e.category || "Other";
      map.set(cat, (map.get(cat) || 0) + (Number(e.amount) || 0));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [monthExpenses]);

  // Filtered expenses list
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => {
        if (selectedMonth && !(e.date || "").startsWith(selectedMonth)) return false;
        if (categoryFilter !== "All" && e.category !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const cat = (e.category || "").toLowerCase();
          const note = (e.notes || "").toLowerCase();
          if (!cat.includes(q) && !note.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [expenses, selectedMonth, categoryFilter, searchQuery]);

  // Handlers
  const handleCreate = async (data: ExpenseInput) => {
    await createExpense.mutateAsync(data);
    await qc.invalidateQueries({ queryKey: ["expenses"] });
    toast.success("Expense recorded successfully");
  };

  const handleUpdate = async (data: ExpenseInput) => {
    if (!editingExpense) return;
    await updateExpense.mutateAsync({ id: editingExpense.id, data });
    await qc.invalidateQueries({ queryKey: ["expenses"] });
    setEditingExpense(null);
    toast.success("Expense updated");
  };

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await removeExpense.mutateAsync(expenseToDelete.id);
      await qc.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted");
      setExpenseToDelete(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete expense");
    }
  };

  return (
    <AppShell
      title="Expenses & Monthly P&L"
      actions={
        <ExpenseDialog
          trigger={
            <Button
              size="sm"
              className="gap-1.5 font-semibold bg-amber-700 hover:bg-amber-800 text-white"
            >
              <Plus className="h-4 w-4" /> Record Expense
            </Button>
          }
          onSave={handleCreate}
        />
      }
    >
      <div className="space-y-6">
        {/* Monthly P&L Card (Feature 2) */}
        <div className="rounded-xl border bg-card p-4 sm:p-5 shadow-xs space-y-4">
          {/* Month Selector Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <TrendingUp className="h-4 w-4" />
                </span>
                <h3 className="font-display font-bold text-base text-foreground">
                  Monthly Profit & Loss Report
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Financial summary comparing income from client payments vs total operational
                expenses
              </p>
            </div>

            {/* Month Navigation Controls */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setSelectedMonth(prevMonth)}
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <span className="text-sm font-bold font-display px-2 text-foreground min-w-[130px] text-center">
                {formatMonthLabel(selectedMonth)}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2"
                onClick={() => setSelectedMonth(getNextMonthString(selectedMonth))}
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground ml-1"
                onClick={() => setSelectedMonth(getMonthString())}
              >
                Current Month
              </Button>
            </div>
          </div>

          {/* Key P&L Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Income */}
            <div className="rounded-lg border bg-emerald-50/30 dark:bg-emerald-950/20 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Total Income (Collected)
                </span>
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-black font-mono text-emerald-700 dark:text-emerald-400">
                  ₹{formatINR(totalIncome)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                From {monthPayments.length} payment receipts in {formatMonthLabel(selectedMonth)}
              </p>
            </div>

            {/* Total Expenses */}
            <div className="rounded-lg border bg-rose-50/30 dark:bg-rose-950/20 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                  Total Expenses
                </span>
                <Receipt className="h-4 w-4 text-rose-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
                  ₹{formatINR(totalExpenses)}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                From {monthExpenses.length} expense vouchers in {formatMonthLabel(selectedMonth)}
              </p>
            </div>

            {/* Net Profit / Loss */}
            <div
              className={`rounded-lg border-2 p-4 ${
                isProfit
                  ? "border-emerald-600/40 bg-emerald-50/50 dark:bg-emerald-950/30"
                  : "border-rose-600/40 bg-rose-50/50 dark:bg-rose-950/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-black uppercase tracking-wider ${
                    isProfit
                      ? "text-emerald-900 dark:text-emerald-200"
                      : "text-rose-900 dark:text-rose-200"
                  }`}
                >
                  {isProfit ? "Net Profit" : "Net Loss"}
                </span>
                {isProfit ? (
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span
                  className={`font-display text-2xl font-black font-mono ${
                    isProfit
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-rose-700 dark:text-rose-400"
                  }`}
                >
                  {isProfit ? `₹${formatINR(netProfit)}` : `-₹${formatINR(Math.abs(netProfit))}`}
                </span>
              </div>

              {/* Month-over-Month Comparison */}
              <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                {profitDelta >= 0 ? (
                  <span className="text-emerald-700 dark:text-emerald-400 flex items-center">
                    <ArrowUpRight className="h-3 w-3" /> +₹{formatINR(profitDelta)}
                  </span>
                ) : (
                  <span className="text-rose-700 dark:text-rose-400 flex items-center">
                    <ArrowDownRight className="h-3 w-3" /> -₹{formatINR(Math.abs(profitDelta))}
                  </span>
                )}
                <span>vs {formatMonthLabel(prevMonth)}</span>
              </div>
            </div>
          </div>

          {/* Expense Category Breakdown Bar */}
          {categoryTotals.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wide block">
                Expense Breakdown by Category ({formatMonthLabel(selectedMonth)})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {categoryTotals.map(([cat, amt]) => {
                  const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
                  return (
                    <div key={cat} className="rounded-md border bg-muted/20 p-2 space-y-1">
                      <div className="flex justify-between font-semibold">
                        <span className="text-foreground truncate">{cat}</span>
                        <span className="text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="font-mono font-bold text-sm text-foreground">
                        ₹{formatINR(amt)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Expenses List & Filter Area */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-bold text-base text-foreground">
              Expense Transactions ({filteredExpenses.length})
            </h2>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {["All", "Material", "Wages", "Rent", "Transport", "Other"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full font-semibold border transition-all ${
                    categoryFilter === cat
                      ? "bg-amber-700 text-white border-amber-800 shadow-xs"
                      : "bg-card text-muted-foreground hover:text-foreground border-border"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 h-10 text-sm bg-card"
              placeholder="Search expenses by category or notes description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* List of Expense Records */}
          {expensesQuery.error && (
            <p role="alert" className="p-4 rounded-lg bg-destructive/10 text-destructive text-sm">
              Unable to load expenses. Please check connection.
            </p>
          )}

          {expensesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading expenses…</p>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-12 text-muted-foreground text-center rounded-xl border border-dashed bg-muted/10 space-y-2">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground/60" />
              <p className="font-semibold text-foreground text-sm">
                No expenses recorded for this month
              </p>
              <p className="text-xs">
                Click "Record Expense" to add material purchases, wages, rent, or transport.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-amber-600/30 shadow-2xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{exp.category}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-mono font-medium text-muted-foreground">
                        {formatDate(exp.date)}
                      </span>
                    </div>
                    {exp.notes && (
                      <p className="mt-1 text-xs text-muted-foreground italic max-w-lg">
                        {exp.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-rose-700 dark:text-rose-400 mr-2">
                      ₹{formatINR(exp.amount)}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => setEditingExpense(exp)}
                    >
                      <Edit className="h-3 w-3 text-amber-600" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => setExpenseToDelete(exp)}
                      title="Delete Expense"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <ExpenseDialog
          open={Boolean(editingExpense)}
          initial={editingExpense}
          trigger={<span className="hidden" />}
          onSave={handleUpdate}
        />
      )}

      {/* Confirmation Dialog for Deleting Expense */}
      <AlertDialog
        open={Boolean(expenseToDelete)}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Delete Expense Record?</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense of{" "}
              <strong>₹{expenseToDelete ? formatINR(expenseToDelete.amount) : "0"}</strong> for{" "}
              <strong>{expenseToDelete ? expenseToDelete.category : ""}</strong>? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteExpense}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

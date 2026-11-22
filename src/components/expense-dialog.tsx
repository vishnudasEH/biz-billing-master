import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { todayISO } from "@/lib/invoice-calc";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";

export type ExpenseInput = Omit<Expense, "id">;

export function ExpenseDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: ReactNode;
  initial?: Expense;
  onSave: (data: ExpenseInput) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const blank = (): ExpenseInput => ({
    date: initial?.date || todayISO(),
    category: initial?.category || "Material",
    amount: initial?.amount || 0,
    notes: initial?.notes || "",
    createdAt: initial?.createdAt || new Date().toISOString(),
  });

  const [form, setForm] = useState<ExpenseInput>(blank);

  const handleSave = async () => {
    if (!form.category.trim()) {
      toast.error("Category is required");
      return;
    }
    if (!(Number(form.amount) > 0)) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (!form.date) {
      toast.error("Date is required");
      return;
    }

    setBusy(true);
    try {
      await onSave({
        ...form,
        amount: Number(form.amount),
        category: form.category.trim(),
        notes: form.notes?.trim() || undefined,
      });
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save expense");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(blank());
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Expense" : "Record Expense"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Date & Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="exp-date" className="text-xs font-semibold">
                Date
              </Label>
              <Input
                id="exp-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exp-amount" className="text-xs font-semibold">
                Amount (₹)
              </Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
                className="font-mono font-bold"
                required
              />
            </div>
          </div>

          {/* Category with Quick Suggestion Chips */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {EXPENSE_CATEGORIES.map((cat) => {
                const isSelected = form.category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? "bg-amber-700 text-white border-amber-800 shadow-2xs font-semibold"
                        : "bg-muted/50 text-foreground hover:bg-muted border-border"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <Input
              placeholder="Or type custom category name…"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="text-xs mt-1"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="exp-notes" className="text-xs font-semibold">
              Notes / Description (Optional)
            </Label>
            <Input
              id="exp-notes"
              placeholder="e.g. 5 sheets MDF 18mm from Sri Balaji Plywoods"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 border-t pt-3 mt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold"
          >
            {busy ? "Saving…" : initial ? "Update Expense" : "Record Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

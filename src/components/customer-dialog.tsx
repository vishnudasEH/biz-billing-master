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
import { INDIAN_STATES, type Customer } from "@/lib/types";

export function CustomerDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: ReactNode;
  initial?: Customer;
  onSave: (data: Omit<Customer, "id">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Omit<Customer, "id">>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    gstin: initial?.gstin ?? "",
    state: initial?.state ?? "Tamil Nadu",
    stateCode: initial?.stateCode ?? "33",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    createdAt: initial?.createdAt ?? new Date().toISOString().slice(0, 10),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit customer" : "New customer"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Address</Label>
            <textarea
              className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>GSTIN (optional)</Label>
            <Input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <select
              className="field-select"
              value={f.state}
              onChange={(e) => {
                const st = INDIAN_STATES.find((s) => s.name === e.target.value);
                setF({ ...f, state: e.target.value, stateCode: st?.code ?? f.stateCode });
              }}
            >
              {INDIAN_STATES.map((s) => (
                <option key={s.code} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              if (!f.name.trim()) {
                toast.error("Customer name is required");
                return;
              }
              onSave(f);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

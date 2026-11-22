import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "./firebase";
import { useAuth } from "./auth-context";
import type { Customer, Expense, Invoice, Job, Payment, ShopProfile } from "./types";

type WithId = { id: string };

const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

function getLocalFallback<T extends WithId>(name: string): T[] {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(`shopledger_${name}`) : null;
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalFallback<T extends WithId>(name: string, items: T[]) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(`shopledger_${name}`, JSON.stringify(items));
    }
  } catch (e) {
    console.warn("Local fallback storage write error:", e);
  }
}

async function listCollection<T extends WithId>(name: string): Promise<T[]> {
  try {
    const snap = await getDocs(collection(getDb(), name));
    const remoteItems = snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T);
    // Preserve any local-only fallback entries created while offline/restricted
    const localOnly = getLocalFallback<T>(name).filter((item) => item.id.startsWith(`${name}_`));
    const remoteIds = new Set(remoteItems.map((i) => i.id));
    const merged = [...localOnly.filter((i) => !remoteIds.has(i.id)), ...remoteItems];
    setLocalFallback(name, merged);
    return merged;
  } catch (err) {
    console.warn(`Firestore read failed for collection "${name}", using local storage:`, err);
    return getLocalFallback<T>(name);
  }
}

async function getOne<T extends WithId>(name: string, id: string): Promise<T | null> {
  if (id.startsWith(`${name}_`)) {
    const local = getLocalFallback<T>(name);
    const hit = local.find((i) => i.id === id);
    if (hit) return hit;
  }
  try {
    const snap = await getDoc(doc(getDb(), name, id));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as T;
    }
    const local = getLocalFallback<T>(name);
    return local.find((i) => i.id === id && i.id.startsWith(`${name}_`)) ?? null;
  } catch (err) {
    console.warn(`Firestore getOne failed for "${name}/${id}", checking local storage:`, err);
    const local = getLocalFallback<T>(name);
    return local.find((i) => i.id === id) ?? null;
  }
}

async function createOne<T extends WithId>(name: string, data: Omit<T, "id">): Promise<string> {
  const clean = stripUndefined(data as object);
  try {
    const ref = await addDoc(collection(getDb(), name), clean);
    const newItem = { id: ref.id, ...clean } as unknown as T;
    const current = getLocalFallback<T>(name);
    setLocalFallback(name, [newItem, ...current.filter((i) => i.id !== ref.id)]);
    return ref.id;
  } catch (err) {
    console.warn(`Firestore create failed for collection "${name}", saving to local storage:`, err);
    const newId = `${name}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newItem = { id: newId, ...clean } as unknown as T;
    const current = getLocalFallback<T>(name);
    setLocalFallback(name, [newItem, ...current]);
    return newId;
  }
}

async function updateOne<T extends WithId>(name: string, id: string, data: Partial<T>) {
  const { id: _omit, ...rest } = data as Partial<T> & { id?: string };
  void _omit;
  const clean = stripUndefined(rest);
  if (id.startsWith(`${name}_`)) {
    const current = getLocalFallback<T>(name);
    setLocalFallback(
      name,
      current.map((item) => (item.id === id ? ({ ...item, ...clean } as T) : item)),
    );
    return;
  }
  try {
    await updateDoc(doc(getDb(), name, id), clean as DocumentData);
    const current = getLocalFallback<T>(name);
    if (current.some((item) => item.id === id)) {
      setLocalFallback(
        name,
        current.map((item) => (item.id === id ? ({ ...item, ...clean } as T) : item)),
      );
    }
  } catch (err) {
    console.warn(`Firestore update failed for "${name}/${id}", updating in local storage:`, err);
    const current = getLocalFallback<T>(name);
    const updated = current.map((item) => (item.id === id ? ({ ...item, ...clean } as T) : item));
    setLocalFallback(name, updated);
  }
}

async function removeOne(name: string, id: string) {
  if (id.startsWith(`${name}_`)) {
    const current = getLocalFallback(name);
    setLocalFallback(
      name,
      current.filter((item) => item.id !== id),
    );
    return;
  }
  try {
    await deleteDoc(doc(getDb(), name, id));
    const current = getLocalFallback(name);
    setLocalFallback(
      name,
      current.filter((item) => item.id !== id),
    );
  } catch (err) {
    console.warn(`Firestore delete failed for "${name}/${id}", removing from local storage:`, err);
    const current = getLocalFallback(name);
    setLocalFallback(
      name,
      current.filter((item) => item.id !== id),
    );
  }
}

// ---------- Shop profile (single doc) ----------
export const EMPTY_PROFILE: ShopProfile = {
  businessName: "BALAJI WOOD KRAFT",
  address:
    "No: 439/238/1, GROUND FLOOR, Sydenhams Street, Raja Muthiah Salai, CHOOLAI, CHENNAI -600112",
  gstin: "",
  state: "Tamil Nadu",
  stateCode: "33",
  phone: "8668021629",
  email: "balajiwoodkrafts@gmail.com",
  bankName: "",
  accountNumber: "",
  branch: "",
  ifsc: "",
  authorisedSignatoryName: "Balaji Wood Kraft",
  invoicePrefix: "BWK-",
  defaultGstRate: 18,
};

export function useShopProfile() {
  const { user, configured } = useAuth();
  return useQuery({
    enabled: Boolean(user && configured),
    queryKey: ["shopProfile"],
    queryFn: async () => {
      try {
        const snap = await getDoc(doc(getDb(), "shopProfile", "main"));
        const profile = snap.exists()
          ? { ...EMPTY_PROFILE, ...(snap.data() as ShopProfile) }
          : EMPTY_PROFILE;
        if (typeof window !== "undefined") {
          localStorage.setItem("shopledger_shopProfile", JSON.stringify(profile));
        }
        return profile;
      } catch (err) {
        console.warn("Firestore read failed for shopProfile, using cached/default profile:", err);
        try {
          const cached =
            typeof window !== "undefined" ? localStorage.getItem("shopledger_shopProfile") : null;
          if (cached) return { ...EMPTY_PROFILE, ...(JSON.parse(cached) as ShopProfile) };
        } catch {
          // ignore cache parse errors
        }
        return EMPTY_PROFILE;
      }
    },
  });
}

export function useSaveShopProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: ShopProfile) => setDoc(doc(getDb(), "shopProfile", "main"), stripUndefined(p)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shopProfile"] }),
  });
}

// ---------- Generic hooks factory ----------
function makeHooks<T extends WithId>(name: string) {
  const useList = () => {
    const { user, configured } = useAuth();
    return useQuery({
      queryKey: [name],
      queryFn: () => listCollection<T>(name),
      enabled: Boolean(user && configured),
    });
  };
  const useOne = (id: string | undefined) => {
    const { user, configured } = useAuth();
    return useQuery({
      queryKey: [name, id],
      queryFn: () => {
        if (!id) throw new Error("Missing record ID");
        return getOne<T>(name, id);
      },
      enabled: Boolean(id && user && configured),
    });
  };
  const useCreate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (data: Omit<T, "id">) => createOne<T>(name, data),
      onSuccess: (newId, variables) => {
        qc.setQueryData([name, newId], { id: newId, ...variables } as T);
        return qc.invalidateQueries({ queryKey: [name] });
      },
    });
  };
  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => updateOne<T>(name, id, data),
      onSuccess: (_res, { id, data }) => {
        const existing = qc.getQueryData<T | null>([name, id]);
        if (existing) {
          qc.setQueryData([name, id], { ...existing, ...data });
        }
        return qc.invalidateQueries({ queryKey: [name] });
      },
    });
  };
  const useRemove = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => removeOne(name, id),
      onSuccess: (_res, id) => {
        qc.removeQueries({ queryKey: [name, id] });
        return qc.invalidateQueries({ queryKey: [name] });
      },
    });
  };
  return { useList, useOne, useCreate, useUpdate, useRemove };
}

export const customersApi = makeHooks<Customer>("customers");
export const jobsApi = makeHooks<Job>("jobs");

/** Returns true when an invoice is active (not soft-deleted). */
export function isInvoiceActive(inv: Invoice): boolean {
  return !inv.isDeleted && !inv.deletedAt;
}

const rawInvoicesApi = makeHooks<Invoice>("invoices");

export const invoicesApi = {
  ...rawInvoicesApi,
  /** Returns active (non-deleted) invoices for normal register views. */
  useList: () => {
    const { user, configured } = useAuth();
    return useQuery({
      queryKey: ["invoices"],
      queryFn: () => listCollection<Invoice>("invoices"),
      select: (items) => items.filter(isInvoiceActive),
      enabled: Boolean(user && configured),
    });
  },
  /** Returns ALL invoices including soft-deleted ones (for audit, invoice numbering, and payment lookups). */
  useAllList: () => rawInvoicesApi.useList(),
};

export const paymentsApi = makeHooks<Payment>("payments");
export const expensesApi = makeHooks<Expense>("expenses");

/** Resolves all Job Work Orders linked to a given invoice. */
export function getInvoiceLinkedJobs(invoice: Invoice, jobs: Job[]): Job[] {
  const idSet = new Set<string>(invoice.jobIds ?? []);
  if (invoice.jobId) idSet.add(invoice.jobId);
  return jobs.filter((j) => j.invoiceId === invoice.id || idSet.has(j.id));
}

/**
 * Finds payments associated with an invoice, separated into:
 * - directPayments: payments directly referencing this invoice (linkedInvoiceId === invoice.id)
 * - jobPayments: payments tied to Job Work Orders included in this invoice (not directly linked to the invoice)
 */
export function getInvoiceAssociatedPayments(invoice: Invoice, jobs: Job[], payments: Payment[]) {
  const linkedJobs = getInvoiceLinkedJobs(invoice, jobs);
  const linkedJobIds = new Set(linkedJobs.map((j) => j.id));

  const directPayments = payments.filter((p) => p.linkedInvoiceId === invoice.id);
  const jobOnlyPayments = payments.filter(
    (p) => Boolean(p.jobId && linkedJobIds.has(p.jobId)) && p.linkedInvoiceId !== invoice.id,
  );
  const allAssociated = Array.from(
    new Map([...directPayments, ...jobOnlyPayments].map((p) => [p.id, p])).values(),
  );

  const directTotal = directPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const jobOnlyTotal = jobOnlyPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalAssociated = allAssociated.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return {
    linkedJobs,
    directPayments,
    jobOnlyPayments,
    allAssociated,
    directTotal,
    jobOnlyTotal,
    totalAssociated,
  };
}

// ---------- Derived / computed ----------
/** Payments recorded for a specific job */
export function jobPayments(jobId: string, payments: Payment[]): Payment[] {
  return payments.filter((p) => p.jobId === jobId);
}

/** Total advance/payments received for a job */
export function jobAdvance(jobId: string, payments: Payment[]): number {
  return jobPayments(jobId, payments).reduce((s, p) => s + (Number(p.amount) || 0), 0);
}

/** Remaining balance on a job = job.total - all payments for this job */
export function jobBalance(job: Job, payments: Payment[]): number {
  const adv = jobAdvance(job.id, payments);
  const tot = Number(job.total) || 0;
  return Math.round((tot - adv) * 100) / 100;
}

/** Suggest next Job Work Order number e.g. JW-0001 */
export function nextJobNo(existing: (Job | string)[], prefix = "JW-"): string {
  let max = 0;
  for (const item of existing) {
    const str = typeof item === "string" ? item : item.jobNo || "";
    const m = str.match(/(\d+)\s*$/);
    if (m?.[1]) {
      const n = parseInt(m[1], 10);
      if (!isNaN(n)) max = Math.max(max, n);
    }
  }
  return `${prefix}${String(max + 1).padStart(4, "0")}`;
}

/**
 * Customer balance due = sum of totals of all their jobs - sum of all their payments.
 * Replaces invoice-status-based balance calculation.
 */
export function customerBalance(customerId: string, jobs: Job[], payments: Payment[]) {
  const jobTotal = jobs
    .filter((j) => j.customerId === customerId)
    .reduce((s, j) => s + (Number(j.total) || 0), 0);
  const received = payments
    .filter((p) => p.customerId === customerId)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const balance = Math.round((jobTotal - received) * 100) / 100;
  return { invoiced: jobTotal, jobTotal, received, balance };
}

export const pendingInvoicingJobs = (jobs: Job[]) =>
  jobs.filter((j) => j.status === "Completed" && !j.invoiceId);

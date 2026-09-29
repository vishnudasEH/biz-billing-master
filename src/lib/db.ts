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
import type { Customer, Invoice, Job, Payment, ShopProfile } from "./types";

type WithId = { id: string };

const stripUndefined = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

async function listCollection<T extends WithId>(name: string): Promise<T[]> {
  const snap = await getDocs(collection(getDb(), name));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as T);
}

async function getOne<T extends WithId>(name: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), name, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

async function createOne<T extends WithId>(name: string, data: Omit<T, "id">): Promise<string> {
  const ref = await addDoc(collection(getDb(), name), stripUndefined(data as object));
  return ref.id;
}

async function updateOne<T extends WithId>(name: string, id: string, data: Partial<T>) {
  const { id: _omit, ...rest } = data as Partial<T> & { id?: string };
  void _omit;
  await updateDoc(doc(getDb(), name, id), stripUndefined(rest) as DocumentData);
}

async function removeOne(name: string, id: string) {
  await deleteDoc(doc(getDb(), name, id));
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
      const snap = await getDoc(doc(getDb(), "shopProfile", "main"));
      return snap.exists() ? { ...EMPTY_PROFILE, ...(snap.data() as ShopProfile) } : EMPTY_PROFILE;
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
      onSuccess: () => qc.invalidateQueries({ queryKey: [name] }),
    });
  };
  const useUpdate = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: Partial<T> }) => updateOne<T>(name, id, data),
      onSuccess: () => qc.invalidateQueries({ queryKey: [name] }),
    });
  };
  const useRemove = () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id: string) => removeOne(name, id),
      onSuccess: () => qc.invalidateQueries({ queryKey: [name] }),
    });
  };
  return { useList, useOne, useCreate, useUpdate, useRemove };
}

export const customersApi = makeHooks<Customer>("customers");
export const jobsApi = makeHooks<Job>("jobs");
export const invoicesApi = makeHooks<Invoice>("invoices");
export const paymentsApi = makeHooks<Payment>("payments");

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

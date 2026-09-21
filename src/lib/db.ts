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
  businessName: "",
  address: "",
  gstin: "",
  state: "Tamil Nadu",
  stateCode: "33",
  phone: "",
  email: "",
  bankName: "",
  accountNumber: "",
  branch: "",
  ifsc: "",
  authorisedSignatoryName: "",
  invoicePrefix: "",
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
    return useQuery({ queryKey: [name], queryFn: () => listCollection<T>(name), enabled: Boolean(user && configured) });
  };
  const useOne = (id: string | undefined) => {
    const { user, configured } = useAuth();
    return useQuery({
      queryKey: [name, id],
      queryFn: () => { if (!id) throw new Error("Missing record ID"); return getOne<T>(name, id); },
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
/** Amount the customer owes = non-draft invoices − all payments received. */
export function customerBalance(customerId: string, invoices: Invoice[], payments: Payment[]) {
  const invoiced = invoices
    .filter((i) => i.customerId === customerId && i.status !== "Draft")
    .reduce((s, i) => s + (i.totalAmount || 0), 0);
  const received = payments
    .filter((p) => p.customerId === customerId)
    .reduce((s, p) => s + (p.amount || 0), 0);
  return { invoiced, received, balance: Math.round((invoiced - received) * 100) / 100 };
}

export const pendingInvoicingJobs = (jobs: Job[]) =>
  jobs.filter((j) => j.status === "Completed" && !j.invoiceId);

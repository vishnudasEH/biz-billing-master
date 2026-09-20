import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ShopLedger" },
      { name: "description", content: "Sign in to manage jobs, GST invoices and payments." },
      { property: "og:title", content: "Sign in — ShopLedger" },
      { property: "og:description", content: "Sign in to manage jobs, GST invoices and payments." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, loading, configured, signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/", replace: true });
  }, [loading, user, navigate]);

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm rounded-xl bg-card p-6 shadow-lg">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-primary font-display text-base font-bold text-primary-foreground">
            ₹
          </span>
          <div>
            <p className="font-display text-lg font-semibold leading-none">ShopLedger</p>
            <p className="text-xs text-muted-foreground">Jobs · GST invoices · Payments</p>
          </div>
        </div>

        {!configured && (
          <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            Firebase is not configured yet. Add your VITE_FIREBASE_* values to enable sign in.
          </p>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void wrap(() => signInWithEmail(email, password));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy || !configured}>
            Sign in
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={busy || !configured}
          onClick={() => void wrap(signInWithGoogle)}
        >
          Continue with Google
        </Button>
      </div>
    </div>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  Hammer,
  FileText,
  Settings,
  LogOut,
  Plus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/jobs", label: "Jobs", icon: Hammer },
  { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/settings", label: "Shop", icon: Settings },
] as const;

export function AppShell({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading, configured, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && (!user || !configured)) navigate({ to: "/login", replace: true });
  }, [loading, user, configured, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));

  return (
    <div className="min-h-screen bg-background md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex md:sticky md:top-0 md:h-screen">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary font-display text-sm font-bold text-sidebar-primary-foreground">
              ₹
            </span>
            <span className="font-display text-base font-semibold text-sidebar-accent-foreground">
              ShopLedger
            </span>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive(to) && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4", isActive(to) && "text-sidebar-primary")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate px-3 text-xs text-sidebar-foreground/70">{user.email}</p>
          <button
            onClick={() => signOut()}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur md:px-8">
          <h1 className="truncate text-lg font-semibold md:text-xl">{title}</h1>
          <div className="flex items-center gap-2">{actions}</div>
        </header>
        <main className="flex-1 px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-sidebar-border bg-sidebar text-sidebar-foreground md:hidden">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 py-2 text-[11px] font-medium",
              isActive(to) ? "text-sidebar-primary" : "text-sidebar-foreground/70",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function NewButton({ to, label }: { to: "/invoices/new"; label: string }) {
  return (
    <Button asChild size="sm">
      <Link to={to} search={{ jobId: undefined }}>
        <Plus /> {label}
      </Link>
    </Button>
  );
}

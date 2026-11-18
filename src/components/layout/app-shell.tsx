import {
  Briefcase,
  FolderInput,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Mic,
  ShieldCheck,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/inbox", label: "Deal Inbox", short: "Inbox", icon: Inbox },
  { to: "/cases", label: "Investment Cases", short: "Cases", icon: Briefcase },
  { to: "/investors", label: "Investor Network", short: "Investors", icon: Users },
  { to: "/matches", label: "Matches & Outreach", short: "Matches", icon: Waypoints },
  { to: "/imports", label: "Import & Organize", short: "Import", icon: FolderInput },
];

function Wordmark({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 rounded-md focus-visible:ring-offset-0">
      <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-brand text-brand-foreground shadow-sm">
        <span className="font-display text-[17px] leading-none">T</span>
      </span>
      <span className="leading-tight">
        <span
          className={cn(
            "block text-[15px] font-semibold tracking-tight",
            tone === "dark" ? "text-foreground" : "text-sidebar-accent-foreground",
          )}
        >
          DealFlow IQ
        </span>
        <span
          className={cn(
            "block text-[10px] font-medium uppercase tracking-[0.18em]",
            tone === "dark" ? "text-muted-foreground" : "text-sidebar-foreground/70",
          )}
        >
          Talok Capital
        </span>
      </span>
    </Link>
  );
}

function NavItems({ onNavigate, variant }: { onNavigate?: () => void; variant: "sidebar" | "drawer" }) {
  return (
    <nav aria-label="Primary" className="space-y-0.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
              variant === "sidebar" ? "text-sidebar-foreground" : "text-sidebar-foreground",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-[18px] w-[18px] items-center justify-center",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="truncate">{item.label}</span>
              {isActive ? (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" aria-hidden="true" />
              ) : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function MobileNav() {
  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-1">
        {NAV.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-brand-strong" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-brand")} aria-hidden="true" />
                  <span className="truncate">{item.short}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { user, signOut, membership } = useAuth();
  const { isError, error, refetch } = useWorkspace();
  const active = NAV.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)));
  const email = user?.email ?? "Signed in";

  return (
    <div className="min-h-full bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col bg-sidebar px-3 py-5 lg:flex">
        <div className="px-2">
          <Wordmark tone="light" />
        </div>

        <div className="mt-6 px-2">
          <Button
            asChild
            className="h-9 w-full justify-start gap-2 rounded-lg bg-sidebar-primary text-[13px] font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          >
            <Link to="/inbox/capture">
              <Mic className="h-4 w-4" aria-hidden="true" />
              Record update
            </Link>
          </Button>
        </div>

        <div className="mt-6 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
            Workspace
          </p>
          <NavItems variant="sidebar" />
        </div>

        <div className="mt-4 space-y-2.5 border-t border-sidebar-border px-3 pt-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-[10px] font-semibold text-sidebar-accent-foreground">
              {initials(email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-medium text-sidebar-accent-foreground">{email}</p>
              <p className="text-[9.5px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
                {membership?.role ?? "member"} · Talok Capital
              </p>
            </div>
          </div>
          <Link
            to="/workspace"
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
          >
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Team access
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11px] font-medium text-sidebar-foreground/70 transition-colors hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-3 w-3" aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <Wordmark />
            <div className="flex items-center gap-1">
              <Button asChild variant="ghost" size="icon" className="h-9 w-9">
                <Link to="/inbox/capture" aria-label="Record an update">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Open navigation menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(true)}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 pb-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {active?.label ?? "Workspace"}
            </p>
          </div>
        </header>

        <main id="main-content" className="mx-auto w-full max-w-[1280px] px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {isError ? (
            <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-danger-soft px-4 py-3">
              <div>
                <p className="text-[12.5px] font-semibold text-destructive">The workspace did not load</p>
                 <p className="mt-0.5 text-[11px] leading-relaxed text-destructive/80">
                   {error instanceof Error ? error.message : "Check the connection and try again."} Saved records are
                   still in the workspace; nothing is lost.
                 </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>

      <MobileNav />

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-[280px] border-none bg-sidebar p-0 text-sidebar-foreground">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-full flex-col px-3 py-5">
            <div className="flex items-center justify-between px-2">
              <Wordmark tone="light" />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-md p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6">
              <Button
                asChild
                className="h-10 w-full justify-start gap-2 rounded-lg bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
              >
                <Link to="/inbox/capture" onClick={() => setMenuOpen(false)}>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Record update
                </Link>
              </Button>
            </div>
            <div className="mt-6 flex-1">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
                Workspace
              </p>
              <NavItems variant="drawer" onNavigate={() => setMenuOpen(false)} />
            </div>
            <div className="space-y-2 border-t border-sidebar-border px-3 pt-4 text-[11px] leading-relaxed text-sidebar-foreground/60">
              <p className="truncate">{email}</p>
              <Link
                to="/workspace"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-foreground/80"
              >
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Team access
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="flex items-center gap-1.5 text-[11px] font-medium text-sidebar-foreground/80"
              >
                <LogOut className="h-3 w-3" aria-hidden="true" />
                Sign out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

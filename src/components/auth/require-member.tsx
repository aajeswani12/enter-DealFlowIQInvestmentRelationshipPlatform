import type { ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AccessPending } from "./access-pending";

/**
 * Access is granted by workspace membership, not by having a valid login.
 * A signed-in account without an active membership never reaches the app shell.
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const { loading, membership } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <span className="font-display text-lg leading-none">T</span>
          </span>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Checking workspace access
          </p>
        </div>
      </div>
    );
  }

  if (!membership || membership.status !== "active") {
    return <AccessPending />;
  }

  return <>{children}</>;
}

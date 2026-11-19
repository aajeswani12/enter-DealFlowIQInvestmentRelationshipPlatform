import { LogOut, ShieldAlert } from "lucide-react";
import { DealflowIQWordmark } from "@/components/branding/dealflowiq-wordmark";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function AccessPending() {
  const { user, membership, signOut } = useAuth();
  const revoked = membership?.status === "revoked";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-md">
        <div className="flex items-center">
          <DealflowIQWordmark size={24} />
        </div>

        <div className="panel mt-6 p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-soft text-warning">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl tracking-tight">
            {revoked ? "Your access was revoked" : "Your account is not authorized yet"}
          </h1>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
            {revoked
              ? "An owner removed this account from the workspace. Ask a partner if you should be reinstated."
              : "A partner or owner has to add your email to the workspace before you can read any investment data. Signing up alone does not grant access."}
          </p>

          <div className="mt-4 rounded-lg border border-border bg-secondary/50 px-3 py-2.5">
            <p className="label-caps">Signed in as</p>
            <p className="mt-1 truncate text-[12.5px] font-medium">{user?.email ?? "Unknown account"}</p>
          </div>

          <div className="mt-4 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
            <p>
              Ask a Talok Capital partner to open <span className="font-medium text-foreground">Team access</span> and
              invite this exact email address. Access is applied the next time you load the workspace.
            </p>
          </div>

          <div className="mt-5 flex gap-2">
            <Button variant="outline" className="w-full gap-1.5" onClick={() => window.location.reload()}>
              Check again
            </Button>
            <Button variant="ghost" className="w-full gap-1.5" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

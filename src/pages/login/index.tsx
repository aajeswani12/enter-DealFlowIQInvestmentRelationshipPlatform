import { ArrowRight, Briefcase, Mic, ShieldCheck, Waypoints } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const PILLARS = [
  { icon: Mic, title: "Voice-first capture", body: "Record the takeaway after a meeting; the audio stays with the record." },
  { icon: Briefcase, title: "Persistent case files", body: "Thesis, evidence and open questions in one place, not in a chat thread." },
  { icon: Waypoints, title: "Explainable matching", body: "Six deterministic rules over preferences your team entered by hand." },
];

const Login = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!loading && session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);

    const trimmed = email.trim();
    if (!trimmed || !password) {
      setError("Enter your email address and password.");
      return;
    }
    if (mode === "signup" && password.length < 8) {
      setError("Use at least 8 characters for the password.");
      return;
    }

    setPending(true);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: trimmed, password });
        if (signInError) throw signInError;
        navigate("/", { replace: true });
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmed,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          navigate("/", { replace: true });
        } else {
          setNotice("Account created. Check your inbox to confirm the address, then sign in.");
          setMode("signin");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(
        /invalid login credentials/i.test(message)
          ? "Those credentials do not match an account. Check the password or create an account."
          : message,
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-sidebar px-10 py-10 lg:flex">
        <div className="absolute inset-0 grain opacity-60" aria-hidden="true" />
        <div
          className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-sidebar-primary/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-sidebar-primary text-sidebar-primary-foreground">
              <span className="font-display text-lg leading-none">T</span>
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">DealFlow IQ</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/60">
                Talok Capital
              </p>
            </div>
          </div>
        </div>

        <div className="relative max-w-md space-y-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
            Deal intelligence system
          </p>
          <h1 className="font-display text-[42px] leading-[1.05] tracking-tight text-sidebar-accent-foreground">
            The conversation, the case file and the introduction in one place.
          </h1>
          <ul className="space-y-4">
            {PILLARS.map((pillar) => (
              <li key={pillar.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sidebar-accent text-sidebar-primary">
                  <pillar.icon className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-sidebar-accent-foreground">{pillar.title}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-sidebar-foreground/70">{pillar.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[10.5px] uppercase tracking-[0.14em] text-sidebar-foreground/50">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Internal workspace · authorised partners only
        </div>
      </aside>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-brand text-brand-foreground">
              <span className="font-display text-lg leading-none">T</span>
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight">DealFlow IQ</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Talok Capital</p>
            </div>
          </div>

          <p className="label-caps">{mode === "signin" ? "Welcome back" : "New workspace account"}</p>
          <h2 className="mt-1 font-display text-3xl tracking-tight">
            {mode === "signin" ? "Sign in to the deal desk" : "Create your partner account"}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {mode === "signin"
              ? "Use the email address your firm recorded for you."
              : "Accounts are for the Talok Capital investment team. You can add records straight away."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
            {[
              { value: "signin" as Mode, label: "Sign in" },
              { value: "signup" as Mode, label: "Create account" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => {
                  setMode(option.value);
                  setError(null);
                  setNotice(null);
                }}
                className={cn(
                  "rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors",
                  mode === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-[13px] font-medium">
                Work email
              </Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="partner@talokcapital.com"
                className="h-11 bg-card"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-password" className="text-[13px] font-medium">
                Password
              </Label>
              <Input
                id="login-password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                className="h-11 bg-card"
                required
              />
            </div>

            {error ? (
              <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11.5px] leading-relaxed text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p role="status" className="rounded-md border border-brand/20 bg-brand-soft px-3 py-2 text-[11.5px] leading-relaxed text-brand-strong">
                {notice}
              </p>
            ) : null}

            <Button type="submit" className="h-11 w-full gap-2" disabled={pending}>
              {pending ? "Working…" : mode === "signin" ? "Enter workspace" : "Create account"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>

          <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
            Records are visible to signed-in Talok Capital team members. Audio and documents are stored in the firm's
            private workspace, not on the public web.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Login;

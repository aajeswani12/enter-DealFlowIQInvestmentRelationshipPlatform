import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { api } from "@/lib/api";
import type { WorkspaceMember } from "@/lib/types";
import { AuthContext } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveAccess = useCallback(async () => {
    try {
      const member = await api.ensureMembership();
      setMembership(member);
    } catch {
      setMembership(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Register the listener before restoring the session so the initial
    // restore is never missed.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession) {
        queryClient.clear();
        setMembership(null);
        setLoading(false);
        return;
      }

      // Any client call inside this callback must be deferred.
      setTimeout(() => {
        if (active) void resolveAccess();
      }, 0);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session) {
          void resolveAccess();
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient, resolveAccess]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    queryClient.clear();
    setMembership(null);
  }, [queryClient]);

  const refreshMembership = useCallback(async () => {
    await resolveAccess();
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
  }, [queryClient, resolveAccess]);

  const value = useMemo(
    () => ({ user, session, membership, loading, signOut, refreshMembership }),
    [user, session, membership, loading, signOut, refreshMembership],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

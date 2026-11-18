import { createContext } from "react";
import type { Session, User } from "@supabase/supabase-js";
import type { WorkspaceMember } from "@/lib/types";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  membership: WorkspaceMember | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshMembership: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WorkspaceData } from "@/lib/workspace";

/** Shared workspace query. Every page reads from this single cached snapshot. */
export function useWorkspace() {
  return useQuery<WorkspaceData>({
    queryKey: ["workspace"],
    queryFn: api.listWorkspace,
    staleTime: 15_000,
  });
}

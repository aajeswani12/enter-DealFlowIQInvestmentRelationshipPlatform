import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WorkspaceData } from "@/lib/workspace";

/** Mutations invalidate the single workspace snapshot so every view stays honest. */
export function useWorkspaceActions() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  const updateCache = (updater: (data: WorkspaceData) => WorkspaceData) => {
    queryClient.setQueryData<WorkspaceData>(["workspace"], (current) => (current ? updater(current) : current));
  };

  return {
    createCapture: useMutation({ mutationFn: api.createCapture, onSuccess: invalidate }),
    updateCapture: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateCapture>[1] }) =>
        api.updateCapture(id, patch),
      onSuccess: invalidate,
    }),
    deleteCapture: useMutation({ mutationFn: api.deleteCapture, onSuccess: invalidate }),
    createCase: useMutation({ mutationFn: api.createCase, onSuccess: invalidate }),
    updateCase: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateCase>[1] }) =>
        api.updateCase(id, patch),
      onSuccess: invalidate,
    }),
    createEvidence: useMutation({ mutationFn: api.createEvidence, onSuccess: invalidate }),
    deleteEvidence: useMutation({
      mutationFn: ({ id, filePath }: { id: string; filePath: string | null }) => api.deleteEvidence(id, filePath),
      onSuccess: invalidate,
    }),
    createQuestion: useMutation({ mutationFn: api.createQuestion, onSuccess: invalidate }),
    updateQuestion: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateQuestion>[1] }) =>
        api.updateQuestion(id, patch),
      onSuccess: invalidate,
    }),
    createInvestor: useMutation({ mutationFn: api.createInvestor, onSuccess: invalidate }),
    updateInvestor: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateInvestor>[1] }) =>
        api.updateInvestor(id, patch),
      onSuccess: invalidate,
    }),
    createInteraction: useMutation({
      mutationFn: api.createInteraction,
      onSuccess: invalidate,
    }),
    createOutreach: useMutation({ mutationFn: api.createOutreach, onSuccess: invalidate }),
    updateOutreach: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateOutreach>[1] }) =>
        api.updateOutreach(id, patch),
      onSuccess: invalidate,
      onMutate: async ({ id, patch }) => {
        await queryClient.cancelQueries({ queryKey: ["workspace"] });
        updateCache((data) => ({
          ...data,
          outreach: data.outreach.map((item) =>
            item.id === id
              ? {
                  ...item,
                  ...patch,
                  approvedAt: patch.status === "approved" ? new Date().toISOString() : item.approvedAt,
                  sentAt: patch.status === "sent" ? new Date().toISOString() : item.sentAt,
                }
              : item,
          ),
        }));
      },
    }),
  };
}

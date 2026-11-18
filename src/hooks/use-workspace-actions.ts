import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WorkspaceData } from "@/lib/workspace";

/** Mutations invalidate the single workspace snapshot so every view stays honest. */
export function useWorkspaceActions() {
  const queryClient = useQueryClient();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["workspace"] });

  return {
    createCapture: useMutation({ mutationFn: api.createCapture, onSuccess: invalidate }),
    updateCapture: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateCapture>[1] }) =>
        api.updateCapture(id, patch),
      onSuccess: invalidate,
    }),
    createCase: useMutation({ mutationFn: api.createCase, onSuccess: invalidate }),
    updateCase: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateCase>[1] }) =>
        api.updateCase(id, patch),
      onSuccess: invalidate,
    }),
    createClaim: useMutation({ mutationFn: api.createClaim, onSuccess: invalidate }),
    deleteClaim: useMutation({
      mutationFn: ({ id, filePath }: { id: string; filePath: string | null }) => api.deleteClaim(id, filePath),
      onSuccess: invalidate,
    }),
    createGap: useMutation({ mutationFn: api.createGap, onSuccess: invalidate }),
    updateGap: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateGap>[1] }) => api.updateGap(id, patch),
      onSuccess: invalidate,
    }),
    createInvestor: useMutation({ mutationFn: api.createInvestor, onSuccess: invalidate }),
    updateInvestor: useMutation({
      mutationFn: ({
        id,
        patch,
        contact,
      }: {
        id: string;
        patch: Parameters<typeof api.updateInvestor>[1];
        contact?: Parameters<typeof api.updateInvestor>[2];
      }) => api.updateInvestor(id, patch, contact),
      onSuccess: invalidate,
    }),
    createContact: useMutation({
      mutationFn: ({ investorId, input }: { investorId: string; input: Parameters<typeof api.createContact>[1] }) =>
        api.createContact(investorId, input),
      onSuccess: invalidate,
    }),
    updateContact: useMutation({
      mutationFn: ({ investorId, input }: { investorId: string; input: Parameters<typeof api.updateContact>[1] }) =>
        api.updateContact(investorId, input),
      onSuccess: invalidate,
    }),
    deleteContact: useMutation({ mutationFn: api.deleteContact, onSuccess: invalidate }),
    createInteraction: useMutation({ mutationFn: api.createInteraction, onSuccess: invalidate }),
    createOutreach: useMutation({ mutationFn: api.createOutreach, onSuccess: invalidate }),
    updateOutreach: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateOutreach>[1] }) =>
        api.updateOutreach(id, patch),
      onSuccess: invalidate,
      onMutate: async ({ id, patch }) => {
        await queryClient.cancelQueries({ queryKey: ["workspace"] });
        queryClient.setQueryData<WorkspaceData>(["workspace"], (current) =>
          current
            ? {
                ...current,
                outreach: current.outreach.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        ...patch,
                        approvedAt: patch.status === "approved" ? new Date().toISOString() : item.approvedAt,
                        sentAt: patch.status === "sent" ? new Date().toISOString() : item.sentAt,
                      }
                    : item,
                ),
              }
            : current,
        );
      },
    }),
    saveMatch: useMutation({ mutationFn: api.saveMatch, onSuccess: invalidate }),
    inviteMember: useMutation({ mutationFn: api.inviteMember, onSuccess: invalidate }),
    updateMember: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateMember>[1] }) =>
        api.updateMember(id, patch),
      onSuccess: invalidate,
    }),
    removeMember: useMutation({ mutationFn: api.removeMember, onSuccess: invalidate }),
    importInvestors: useMutation({ mutationFn: api.importInvestors, onSuccess: invalidate }),
  };
}

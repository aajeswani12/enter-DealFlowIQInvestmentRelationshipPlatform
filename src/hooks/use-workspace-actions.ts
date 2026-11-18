import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
    updateOutreachContent: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof api.updateOutreachContent>[1] }) =>
        api.updateOutreachContent(id, patch),
      onSuccess: invalidate,
    }),
    approveOutreach: useMutation({ mutationFn: (id: string) => api.approveOutreach(id), onSuccess: invalidate }),
    rejectOutreach: useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => api.rejectOutreach(id, reason),
      onSuccess: invalidate,
    }),
    recordOutreachProgress: useMutation({
      mutationFn: ({
        id,
        input,
      }: {
        id: string;
        input: Parameters<typeof api.recordOutreachProgress>[1];
      }) => api.recordOutreachProgress(id, input),
      onSuccess: invalidate,
    }),
    assignOutreachOwner: useMutation({
      mutationFn: ({ id, ownerUserId }: { id: string; ownerUserId: string }) =>
        api.assignOutreachOwner(id, ownerUserId),
      onSuccess: invalidate,
    }),
    generateOutreachDraft: useMutation({ mutationFn: api.generateOutreachDraft }),
    saveMatch: useMutation({ mutationFn: api.saveMatch, onSuccess: invalidate }),
    runInvestorMatching: useMutation({
      mutationFn: (dealId: string) => api.runInvestorMatching(dealId),
      onSuccess: invalidate,
      onError: invalidate,
    }),
    updateMatchWeights: useMutation({
      mutationFn: ({ id, weights }: { id: string; weights: Parameters<typeof api.updateMatchWeights>[1] }) =>
        api.updateMatchWeights(id, weights),
      onSuccess: invalidate,
    }),
    decideMatch: useMutation({
      mutationFn: ({
        matchId,
        status,
      }: {
        matchId: string;
        status: "accepted" | "dismissed" | "deferred" | "suggested";
      }) => api.decideMatch(matchId, status),
      onSuccess: invalidate,
    }),
    analyzeDealSource: useMutation({
      mutationFn: ({ sourceId, dealId }: { sourceId: string; dealId: string }) =>
        api.analyzeDealSource(sourceId, dealId),
      onSuccess: invalidate,
      onError: invalidate,
    }),
    reviewClaim: useMutation({
      mutationFn: ({
        id,
        decision,
        proposedChangeTo,
      }: {
        id: string;
        decision: "approved" | "rejected";
        proposedChangeTo: string | null;
      }) => api.reviewClaim(id, decision, proposedChangeTo),
      onSuccess: invalidate,
    }),
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

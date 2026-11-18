import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import type {
  Capture,
  CaseDocument,
  CaseFactProposal,
  CaseFactReview,
  DealClaim,
  DealMemo,
  DealMemoVersion,
  DecisionGap,
  InvestmentCase,
  WorkspaceMember,
} from "@/lib/types";

const RELATION_LABEL: Record<CaseFactProposal["relation"], string> = {
  new: "New fact",
  changed: "Changed value",
  clarification: "Clarification",
  conflict: "Needs reconciliation",
};

const RELATION_TONE: Record<CaseFactProposal["relation"], "brand" | "warning" | "neutral" | "danger"> = {
  new: "brand",
  changed: "warning",
  clarification: "neutral",
  conflict: "danger",
};

const ORIGIN_LABEL: Record<DealMemoVersion["origin"], string> = {
  manual: "Manual",
  template: "Template-generated",
  ai_generated: "AI-generated",
  ai_delta: "AI delta-generated",
};

interface MemoDeltaProps {
  deal: InvestmentCase;
  claims: DealClaim[];
  sources: Capture[];
  documents: CaseDocument[];
  versions: DealMemoVersion[];
  proposals: CaseFactProposal[];
  reviews: CaseFactReview[];
  gaps: DecisionGap[];
  members: WorkspaceMember[];
  currentMemo: DealMemo | null;
  onMemoCreated: (memo: DealMemo) => void;
}

interface EditState {
  label: string;
  valueText: string;
  normalizedValue: string;
  currency: string;
  reportingPeriod: string;
  metricDefinition: string;
}

function editStateFor(proposal: CaseFactProposal): EditState {
  return {
    label: proposal.label,
    valueText: proposal.valueText,
    normalizedValue: proposal.normalizedValue === null ? "" : String(proposal.normalizedValue),
    currency: proposal.currency,
    reportingPeriod: proposal.reportingPeriod,
    metricDefinition: proposal.metricDefinition,
  };
}

export function MemoDelta({
  deal,
  claims,
  sources,
  documents,
  versions,
  proposals,
  reviews,
  gaps,
  members,
  currentMemo,
  onMemoCreated,
}: MemoDeltaProps) {
  const actions = useWorkspaceActions();
  const [sourceChoice, setSourceChoice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [analysisError, setAnalysisError] = useState("");
  const [editing, setEditing] = useState<CaseFactProposal | null>(null);
  const [editForm, setEditForm] = useState<EditState>(editStateFor(proposals[0] ?? ({} as CaseFactProposal)));
  const [editNote, setEditNote] = useState("");
  const [rejecting, setRejecting] = useState<CaseFactProposal | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [memoBusy, setMemoBusy] = useState(false);
  const [memoError, setMemoError] = useState("");
  const [memoRequestId, setMemoRequestId] = useState(() => crypto.randomUUID());
  const [selectedVersionId, setSelectedVersionId] = useState("");

  const sourceOptions = useMemo(
    () => [
      ...documents.map((document) => ({
        id: `document:${document.id}`,
        label: `Document · ${document.title} · ${formatShortDate(document.sourceDate)}`,
        kind: "document" as const,
        sourceId: document.id,
      })),
      ...sources.map((source) => ({
        id: `capture:${source.id}`,
        label: `${source.source === "voice" ? "Voice note" : "Source note"} · ${source.companyName || "Note"} · ${formatShortDate(source.sourceDate)}`,
        kind: "capture" as const,
        sourceId: source.id,
      })),
    ],
    [documents, sources],
  );

  const caseProposals = proposals.filter((proposal) => proposal.dealId === deal.id);
  const pending = caseProposals.filter((proposal) => proposal.status === "pending");
  const accepted = caseProposals.filter((proposal) => proposal.status === "accepted");
  const decided = caseProposals.filter((proposal) => proposal.status !== "pending");
  const orderedVersions = versions
    .filter((version) => version.dealId === deal.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const selectedVersion = orderedVersions.find((version) => version.id === selectedVersionId) ?? orderedVersions[0] ?? null;
  const activeClaims = claims.filter((claim) => claim.dealId === deal.id && claim.reviewStatus === "approved" && !claim.supersededBy);
  const unchangedClaims = activeClaims.filter(
    (claim) => !pending.some((proposal) => proposal.previousClaimId === claim.id || proposal.label.toLowerCase() === claim.label.toLowerCase()),
  );

  const sourceLabel = (proposal: CaseFactProposal) =>
    proposal.sourceKind === "document"
      ? documents.find((document) => document.id === proposal.sourceDocumentId)?.title ?? proposal.sourceTitle
      : sources.find((capture) => capture.id === proposal.sourceCaptureId)?.companyName ?? proposal.sourceTitle;

  const openSource = async (proposal: CaseFactProposal) => {
    if (proposal.sourceKind === "document") {
      const document = documents.find((item) => item.id === proposal.sourceDocumentId);
      if (!document) {
        toast.error("The original document is no longer available.");
        return;
      }
      const url = await api.getImportDocumentUrl(document.storagePath);
      if (!url) {
        toast.error("The original document is no longer available in private storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (proposal.sourceCaptureId) {
      window.location.assign(`/inbox#source-${proposal.sourceCaptureId}`);
    }
  };

  const openClaimSource = async (claim: DealClaim) => {
    if (claim.documentId) {
      const document = documents.find((item) => item.id === claim.documentId);
      if (!document) {
        toast.error("The earlier document is no longer available.");
        return;
      }
      const url = await api.getImportDocumentUrl(document.storagePath);
      if (!url) {
        toast.error("The earlier document is no longer available in private storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    if (claim.sourceId) window.location.assign(`/inbox#source-${claim.sourceId}`);
  };

  const openVersionSource = async (source: { id: string; kind: "Document" | "Source" }) => {
    if (source.kind === "Document") {
      const document = documents.find((item) => item.id === source.id);
      if (!document) {
        toast.error("This source is no longer available.");
        return;
      }
      const url = await api.getImportDocumentUrl(document.storagePath);
      if (!url) {
        toast.error("This source is no longer available in private storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    window.location.assign(`/inbox#source-${source.id}`);
  };

  const analyze = async () => {
    if (!sourceChoice) {
      toast.error("Choose an associated source.");
      return;
    }
    const option = sourceOptions.find((item) => item.id === sourceChoice);
    if (!option) return;
    setAnalysisError("");
    setWarnings([]);
    try {
      const result = await actions.extractCaseDelta.mutateAsync({
        dealId: deal.id,
        sourceKind: option.kind,
        sourceId: option.sourceId,
      });
      setWarnings(result.warnings ?? []);
      if (result.status === "no_proposals") {
        toast.warning("No new source-supported fact was proposed. Nothing was changed.");
      } else if (result.status === "failed") {
        setAnalysisError(result.error ?? "The source analysis failed. Nothing was changed.");
      } else {
        toast.success(
          result.existing
            ? "This source already has staged proposals."
            : `${result.proposals_count ?? 0} proposal${result.proposals_count === 1 ? "" : "s"} staged for human review.`,
        );
      }
    } catch (caught) {
      setAnalysisError(caught instanceof Error ? caught.message : "The source analysis failed. Nothing was changed.");
    }
  };

  const review = async (
    proposal: CaseFactProposal,
    action: "accept" | "edit" | "reject",
    patch: Record<string, unknown> = {},
    note = "",
  ) => {
    setBusyProposalId(proposal.id);
    try {
      const result = await actions.reviewCaseFactProposal.mutateAsync({
        proposalId: proposal.id,
        action,
        patch,
        expectedUpdatedAt: proposal.updatedAt,
        note,
      });
      if (result.status === "stale") {
        toast.error("This proposal changed in another session. Refresh and review the latest version.");
      } else if (result.status === "rejected") {
        toast.success("Proposal rejected. Canonical facts were not changed.");
      } else if (result.status === "accepted") {
        toast.success(action === "edit" ? "Edited fact approved and applied." : "Fact approved and applied.");
      } else if (result.status === "not_found") {
        toast.error("This proposal is no longer available.");
      }
      setEditing(null);
      setRejecting(null);
      setRejectNote("");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not review this proposal.");
    } finally {
      setBusyProposalId(null);
    }
  };

  const beginEdit = (proposal: CaseFactProposal) => {
    setEditing(proposal);
    setEditForm(editStateFor(proposal));
    setEditNote("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.label.trim() || !editForm.valueText.trim()) {
      toast.error("A reviewed fact needs a label and value.");
      return;
    }
    await review(
      editing,
      "edit",
      {
        label: editForm.label.trim(),
        value_text: editForm.valueText.trim(),
        normalized_value: editForm.normalizedValue ? Number(editForm.normalizedValue) : null,
        currency: editForm.currency.toUpperCase(),
        reporting_period: editForm.reportingPeriod.trim(),
        metric_definition: editForm.metricDefinition.trim(),
      },
      editNote,
    );
  };

  const generateMemo = async () => {
    if (accepted.length === 0) {
      toast.error("Approve at least one proposed fact before generating a new memo version.");
      return;
    }
    setMemoBusy(true);
    setMemoError("");
    try {
      const result = await actions.generateCaseMemo.mutateAsync({
        dealId: deal.id,
        requestId: memoRequestId,
        proposalIds: accepted.map((proposal) => proposal.id),
      });
      if (result.status !== "created" || !result.memo) {
        setMemoError(result.error ?? "The memo version was not created.");
        toast.error(result.error ?? "Approved facts are saved, but the memo version was not created.");
        return;
      }
      onMemoCreated(result.memo);
      setMemoRequestId(crypto.randomUUID());
      toast.success(`Memo version ${result.version?.versionNumber ?? "new"} saved.`);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Approved facts are saved, but the memo version was not created.";
      setMemoError(message);
      toast.error(message);
    } finally {
      setMemoBusy(false);
    }
  };

  const memoSourceRows = selectedVersion
    ? [
        ...documents
          .filter((document) => selectedVersion.sourceIds.includes(document.id))
          .map((document) => ({ id: document.id, label: document.title, kind: "Document" as const })),
        ...sources
          .filter((source) => selectedVersion.sourceIds.includes(source.id))
          .map((source) => ({ id: source.id, label: source.companyName || "Source", kind: "Source" as const })),
      ]
    : [];

  return (
    <div className="space-y-3">
      <section className="panel p-4" aria-labelledby="delta-heading">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="label-caps">Living memo</p>
            <h2 id="delta-heading" className="mt-0.5 text-[13.5px] font-semibold tracking-tight">
              Review new evidence
            </h2>
            <p className="mt-0.5 max-w-2xl text-[10.5px] leading-relaxed text-muted-foreground">
              AI proposes facts only from an associated source. Every proposal needs human approval; rejected or edited proposals never silently change canonical facts.
            </p>
          </div>
          <Pill tone={pending.length > 0 ? "warning" : "neutral"}>{pending.length} pending</Pill>
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Field label="Source to analyze" htmlFor="delta-source">
              <select
                id="delta-source"
                value={sourceChoice}
                onChange={(event) => setSourceChoice(event.target.value)}
                className="h-8 w-full rounded-md border border-input bg-card px-2 text-[11px]"
              >
                <option value="">Choose an associated source</option>
                {sourceOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </Field>
          </div>
          <Button
            size="sm"
            className="h-8 gap-1.5 text-[10.5px]"
            onClick={() => void analyze()}
            disabled={!sourceChoice || actions.extractCaseDelta.isPending}
          >
            {actions.extractCaseDelta.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />}
            {actions.extractCaseDelta.isPending ? "Analyzing…" : "Propose changes"}
          </Button>
        </div>
        <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
          Source text is read by the configured AI. No proposals are created when AI is unavailable; no success is simulated.
          Different reporting dates, definitions, currencies or units remain clarifications for review rather than automatic contradictions.
        </p>
        {analysisError ? (
          <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/20 bg-danger-soft px-2.5 py-1.5 text-[10.5px] leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {analysisError}
          </p>
        ) : null}
        {warnings.length > 0 ? (
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] font-medium text-warning">{warnings.length} extraction note{warnings.length === 1 ? "" : "s"}</summary>
            <ul className="mt-1 space-y-1">
              {warnings.map((warning, index) => (
                <li key={`${warning}-${index}`} className="text-[9.5px] leading-relaxed text-muted-foreground">{warning}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {pending.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="label-caps">Proposed changes</p>
            <ul className="space-y-2">
              {pending.map((proposal) => {
                const previous = proposal.previousClaimId
                  ? claims.find((claim) => claim.id === proposal.previousClaimId) ?? null
                  : null;
                const reviewHistory = reviews.filter((reviewItem) => reviewItem.proposalId === proposal.id);
                return (
                  <li key={proposal.id} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Pill tone={RELATION_TONE[proposal.relation]}>{RELATION_LABEL[proposal.relation]}</Pill>
                          <p className="text-[12px] font-semibold">{proposal.label}</p>
                          <span className="text-[9.5px] text-muted-foreground">{proposal.claimType.replace(/_/g, " ")}</span>
                        </div>
                        <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                          {sourceLabel(proposal)}
                          {" · "}source date {formatShortDate(proposal.sourceDate)}
                          {proposal.attribution !== "unknown" ? ` · ${proposal.attribution.replace(/_/g, " ")}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Button size="sm" className="h-7 gap-1 text-[10px]" onClick={() => void review(proposal, "accept", {}, "")} disabled={busyProposalId === proposal.id}>
                          <Check className="h-3 w-3" aria-hidden="true" />Accept
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => beginEdit(proposal)} disabled={busyProposalId === proposal.id}>
                          <Pencil className="h-3 w-3" aria-hidden="true" />Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={() => { setRejecting(proposal); setRejectNote(""); }} disabled={busyProposalId === proposal.id}>
                          <X className="h-3 w-3" aria-hidden="true" />Reject
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-border bg-secondary/20 px-2.5 py-2">
                        <p className="label-caps">Previously reviewed</p>
                        <p className="mt-1 text-[11.5px] font-medium">
                          {previous ? `${previous.label}: ${previous.valueText}` : "No matching reviewed fact"}
                        </p>
                        {previous ? (
                          <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                            {previous.reportingPeriod || "period not stated"} · {previous.currency} · {previous.metricDefinition || "definition not stated"}
                          </p>
                        ) : null}
                        {previous?.supportingExcerpt ? (
                          <p className="mt-1 line-clamp-3 text-[9.5px] leading-relaxed text-muted-foreground">“{previous.supportingExcerpt}”</p>
                        ) : null}
                        {previous?.documentId || previous?.sourceId ? (
                          <button type="button" onClick={() => void openClaimSource(previous)} className="mt-1 text-[9px] font-medium text-brand-strong hover:underline">
                            Open prior evidence
                          </button>
                        ) : null}
                      </div>
                      <div className="rounded-md border border-brand/25 bg-brand-soft/30 px-2.5 py-2">
                        <p className="label-caps">Proposed</p>
                        <p className="mt-1 text-[11.5px] font-medium">{proposal.label}: {proposal.valueText}</p>
                        <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                          {proposal.reportingPeriod || "period not stated"} · {proposal.currency} · {proposal.metricDefinition || "definition not stated"}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[9.5px] leading-relaxed text-muted-foreground">“{proposal.sourceExcerpt}”</p>
                        <button type="button" onClick={() => void openSource(proposal)} className="mt-1 inline-flex items-center gap-1 text-[9.5px] font-medium text-brand-strong hover:underline">
                          Open source <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    {proposal.reason ? <p className="mt-1.5 text-[9.5px] leading-relaxed text-muted-foreground">{proposal.reason}</p> : null}
                    {reviewHistory.length > 0 ? (
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[9px] text-muted-foreground">Review history · {reviewHistory.length}</summary>
                        <ul className="mt-1 space-y-0.5">
                          {reviewHistory.map((item) => (
                            <li key={item.id} className="text-[9px] text-muted-foreground">{item.action} · {formatShortDate(item.createdAt)} {item.note ? `· ${item.note}` : ""}</li>
                          ))}
                        </ul>
                      </details>
                    ) : null}
                    {rejecting?.id === proposal.id ? (
                      <div className="mt-2 space-y-1.5 rounded-md border border-destructive/20 bg-danger-soft/40 p-2">
                        <Textarea rows={2} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} placeholder="Why is this proposal rejected? This note is retained." className="bg-card text-[10.5px]" aria-label="Proposal rejection note" />
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="destructive" className="h-7 text-[10px]" disabled={!rejectNote.trim() || busyProposalId === proposal.id} onClick={() => void review(proposal, "reject", {}, rejectNote.trim())}>Confirm rejection</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setRejecting(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-dashed border-border px-3 py-4 text-center text-[10.5px] text-muted-foreground">
            No proposed changes are waiting. Choose an associated source above to run a review.
          </p>
        )}

        {gaps.filter((gap) => gap.dealId === deal.id && (gap.status === "open" || gap.status === "needs_review")).length > 0 ? (
          <details className="mt-3 border-t border-border pt-2">
            <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
              Missing or uncertain context · {gaps.filter((gap) => gap.dealId === deal.id && (gap.status === "open" || gap.status === "needs_review")).length}
            </summary>
            <ul className="mt-1.5 space-y-1">
              {gaps.filter((gap) => gap.dealId === deal.id && (gap.status === "open" || gap.status === "needs_review")).slice(0, 8).map((gap) => (
                <li key={gap.id} className="text-[9.5px] leading-relaxed text-muted-foreground">{gap.question}</li>
              ))}
            </ul>
          </details>
        ) : null}

        {unchangedClaims.length > 0 ? (
          <details className="mt-3 border-t border-border pt-2">
            <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
              Unchanged reviewed context · {unchangedClaims.length}
            </summary>
            <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
              {unchangedClaims.slice(0, 8).map((claim) => (
                <li key={claim.id} className="text-[9.5px] text-muted-foreground">
                  <span className="font-medium text-foreground/80">{claim.label}:</span> {claim.valueText} {claim.reportingPeriod ? `(${claim.reportingPeriod})` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div>
            <p className="label-caps">Memo version</p>
            <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">
              Generate from approved facts only. If AI or persistence fails, approved case changes remain and the prior memo version is retained.
            </p>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-[10.5px]" onClick={() => void generateMemo()} disabled={memoBusy || accepted.length === 0}>
            {memoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            {memoBusy ? "Generating…" : `Generate from ${accepted.length} approved`}
          </Button>
        </div>
        {memoError ? (
          <div role="alert" className="mt-2 rounded-md border border-warning/30 bg-warning-soft/40 px-2.5 py-2 text-[10px] leading-relaxed text-warning">
            <p className="font-medium">Approved case changes were saved. No new memo version was created.</p>
            <p className="mt-0.5">{memoError}</p>
            <Button size="sm" variant="outline" className="mt-1.5 h-6 text-[9.5px]" onClick={() => void generateMemo()} disabled={memoBusy}>Retry memo generation</Button>
          </div>
        ) : null}
      </section>

      <section className="panel p-4" aria-labelledby="memo-history-heading">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="label-caps">Immutable history</p>
            <h2 id="memo-history-heading" className="mt-0.5 text-[13.5px] font-semibold tracking-tight">Memo versions</h2>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">Previous versions are read-only. Editing the current draft creates a new snapshot.</p>
          </div>
          <span className="text-[9.5px] text-muted-foreground">{orderedVersions.length} version{orderedVersions.length === 1 ? "" : "s"}</span>
        </div>
        {currentMemo?.humanEdited ? (
          <p className="mt-2 rounded-md border border-warning/25 bg-warning-soft/30 px-2.5 py-1.5 text-[9.5px] leading-relaxed text-warning">
            The current draft is human-edited. Source attributions apply only to generated content; manually added assertions are not source-verified.
          </p>
        ) : null}
        {orderedVersions.length === 0 ? (
          <p className="mt-2 text-[10.5px] text-muted-foreground">No memo version has been saved.</p>
        ) : (
          <div className="mt-2 grid gap-2 md:grid-cols-[190px_minmax(0,1fr)]">
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {orderedVersions.map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedVersionId(version.id)}
                    className={selectedVersion?.id === version.id ? "w-full rounded-md border border-brand/30 bg-brand-soft/40 px-2 py-1.5 text-left" : "w-full rounded-md border border-border px-2 py-1.5 text-left hover:bg-secondary/40"}
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span className="text-[10.5px] font-semibold">v{version.versionNumber}</span>
                      <span className="text-[9px] text-muted-foreground">{formatShortDate(version.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[9px] text-muted-foreground">
                      {ORIGIN_LABEL[version.origin]}{version.humanEdited ? " · human-edited" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {selectedVersion ? (
              <div className="min-w-0 rounded-md border border-border bg-secondary/20 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold">v{selectedVersion.versionNumber} · {selectedVersion.title}</span>
                  {selectedVersion.humanEdited ? <Pill tone="warning">Human-edited</Pill> : <Pill tone="neutral">{ORIGIN_LABEL[selectedVersion.origin]}</Pill>}
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  Saved {formatShortDate(selectedVersion.createdAt)} · {selectedVersion.generationModel || "model not recorded"} · read-only
                </p>
                {memoSourceRows.length > 0 ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-muted-foreground">
                    Sources:
                    {memoSourceRows.map((source) => (
                      <button key={source.id} type="button" onClick={() => void openVersionSource(source)} className="font-medium text-brand-strong hover:underline">
                        {source.label}
                      </button>
                    ))}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-[260px] overflow-auto whitespace-pre-wrap rounded bg-card p-2 font-mono text-[9.5px] leading-relaxed">{selectedVersion.content}</pre>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {decided.length > 0 ? (
        <details className="panel p-4">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[11.5px] font-semibold">
            <History className="h-3.5 w-3.5" aria-hidden="true" /> Decided proposals · {decided.length}
          </summary>
          <ul className="mt-2 space-y-1">
            {decided.slice(0, 20).map((proposal) => (
              <li key={proposal.id} className="flex flex-wrap items-baseline justify-between gap-1 text-[10px]">
                <span><span className="font-medium">{proposal.label}</span> · {proposal.valueText}</span>
                <span className={proposal.status === "accepted" ? "text-success" : "text-muted-foreground"}>
                  {proposal.status}{proposal.edited ? " · edited" : ""} · {proposal.reviewedAt ? formatShortDate(proposal.reviewedAt) : ""}
                  {proposal.reviewedBy ? ` · ${members.find((member) => member.userId === proposal.reviewedBy)?.displayName ?? "reviewer"}` : ""}
                  {proposal.reviewNote ? ` · ${proposal.reviewNote}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Edit and approve proposed fact</DialogTitle>
            <DialogDescription>The original source excerpt stays unchanged. Your edits and reviewer identity are retained in the review audit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Label" htmlFor="delta-edit-label"><Input id="delta-edit-label" value={editForm.label} onChange={(event) => setEditForm({ ...editForm, label: event.target.value })} /></Field>
            <Field label="Value" htmlFor="delta-edit-value"><Input id="delta-edit-value" value={editForm.valueText} onChange={(event) => setEditForm({ ...editForm, valueText: event.target.value })} /></Field>
            <Field label="Normalized value" htmlFor="delta-edit-normalized" optional><Input id="delta-edit-normalized" inputMode="decimal" value={editForm.normalizedValue} onChange={(event) => setEditForm({ ...editForm, normalizedValue: event.target.value })} /></Field>
            <Field label="Currency" htmlFor="delta-edit-currency"><Input id="delta-edit-currency" maxLength={3} value={editForm.currency} onChange={(event) => setEditForm({ ...editForm, currency: event.target.value.toUpperCase() })} /></Field>
            <Field label="Reporting period" htmlFor="delta-edit-period"><Input id="delta-edit-period" value={editForm.reportingPeriod} onChange={(event) => setEditForm({ ...editForm, reportingPeriod: event.target.value })} /></Field>
            <Field label="Metric definition" htmlFor="delta-edit-definition"><Input id="delta-edit-definition" value={editForm.metricDefinition} onChange={(event) => setEditForm({ ...editForm, metricDefinition: event.target.value })} /></Field>
          </div>
          <Field label="Review note" htmlFor="delta-edit-note" optional><Textarea id="delta-edit-note" rows={2} value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Why did you edit this fact?" /></Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void saveEdit()} disabled={Boolean(busyProposalId)}>Save &amp; approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

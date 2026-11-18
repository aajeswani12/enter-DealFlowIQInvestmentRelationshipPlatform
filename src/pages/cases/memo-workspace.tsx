import { AlertTriangle, ArrowUpRight, Check, ChevronDown, Download, FileText, Loader2, Lock, Plus, RefreshCw, Sparkles, Upload, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import { formatShortDate } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type {
  Capture,
  CaseDocument,
  DealClaim,
  DealMemo,
  DealMemoVersion,
  InvestmentCase,
  MemoFocus,
  MemoTemplate,
  MemoTemplateKind,
} from "@/lib/types";
import { MemoDelta } from "./memo-delta";

const TEMPLATE_LABEL: Record<MemoTemplateKind, string> = {
  internal: "Internal Investment Memo",
  external: "External Opportunity Brief",
  custom: "Custom Precedent Template",
};

const FOCUS_OPTIONS: { id: MemoFocus; label: string }[] = [
  { id: "team", label: "Team" },
  { id: "market", label: "Market" },
  { id: "traction", label: "Traction" },
  { id: "investment_thesis", label: "Investment thesis" },
  { id: "risks", label: "Risks / open questions" },
];

const STATUS_TONE: Record<DealMemo["status"], "neutral" | "warning" | "success" | "brand"> = {
  draft: "neutral",
  needs_review: "warning",
  approved: "success",
};

function statusLabel(status: DealMemo["status"]): string {
  return status === "needs_review" ? "Needs Review" : status === "approved" ? "Approved" : "Draft";
}

function evidenceLabel(claim: DealClaim): string {
  if (claim.reviewStatus !== "approved") return "Needs Review";
  if (claim.verificationStatus === "internal_opinion") return "Internal observation";
  if (claim.verificationStatus === "disputed") return "Needs Review";
  if (claim.verificationStatus === "corroborated" && claim.reviewedAt) return "Verified";
  if (claim.verificationStatus === "founder_reported" || claim.attribution === "founder") return "Founder-reported";
  return claim.verificationStatus === "unverified" ? "Needs Review" : "Founder-reported";
}

function templateValue(kind: MemoTemplateKind, id: string | null): string {
  return kind === "custom" && id ? `custom:${id}` : kind;
}

function sanitizeExport(content: string): string {
  return content.replace(/https?:\/\/[^\s)>\]]+/gi, "[private link omitted]");
}

interface MemoWorkspaceProps {
  deal: InvestmentCase;
}

export function MemoWorkspace({ deal }: MemoWorkspaceProps) {
  const { data } = useWorkspace();
  const { membership } = useAuth();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";
  const canApprove = membership?.role === "owner" || membership?.role === "partner";

  const memos = useMemo(
    () => workspace.dealMemos.filter((memo) => memo.dealId === deal.id).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace.dealMemos, deal.id],
  );
  const currentMemo = memos[0] ?? null;
  const versions = useMemo(
    () => workspace.memoVersions.filter((version) => version.dealId === deal.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workspace.memoVersions, deal.id],
  );
  const latestVersion = currentMemo
    ? versions.filter((version) => version.memoId === currentMemo.id).sort((a, b) => b.versionNumber - a.versionNumber)[0] ?? null
    : null;
  const claims = useMemo(() => workspace.claims.filter((claim) => claim.dealId === deal.id), [workspace.claims, deal.id]);
  const documents = useMemo(() => workspace.caseDocuments.filter((document) => document.dealId === deal.id), [workspace.caseDocuments, deal.id]);
  const captures = useMemo(() => workspace.captures.filter((capture) => capture.dealId === deal.id), [workspace.captures, deal.id]);
  const gaps = useMemo(() => workspace.gaps.filter((gap) => gap.dealId === deal.id), [workspace.gaps, deal.id]);
  const proposals = workspace.factProposals;
  const reviews = workspace.factReviews;
  const approvals = workspace.memoApprovals;
  const templates = workspace.memoTemplates;
  const acceptedProposals = proposals.filter((proposal) => proposal.dealId === deal.id && proposal.status === "accepted");

  const [templateKind, setTemplateKind] = useState<MemoTemplateKind>("internal");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<MemoFocus[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loadedMemoId, setLoadedMemoId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [approvalOpen, setApprovalOpen] = useState<"approved" | "revision_requested" | null>(null);
  const [approvalNote, setApprovalNote] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"external_copy" | "external_markdown">("external_markdown");
  const [exportConfirmed, setExportConfirmed] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [proposedTemplate, setProposedTemplate] = useState<MemoTemplate | null>(null);
  const [templateHeadings, setTemplateHeadings] = useState("");
  const [templateStyle, setTemplateStyle] = useState("");
  const [templateLength, setTemplateLength] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [templateBusy, setTemplateBusy] = useState(false);

  useEffect(() => {
    if (!currentMemo || currentMemo.id === loadedMemoId) return;
    setTitle(currentMemo.title);
    setContent(currentMemo.content);
    setTemplateKind(currentMemo.templateKind);
    setTemplateId(currentMemo.templateId);
    setFocusAreas(currentMemo.focusAreas);
    setSelectedVersionId(latestVersion?.id ?? "");
    setLoadedMemoId(currentMemo.id);
    setError("");
    setNotice("");
  }, [currentMemo, loadedMemoId, latestVersion?.id]);

  const selectedVersion =
    versions.find((version) => version.id === selectedVersionId) ??
    latestVersion ??
    null;
  const viewingLatest = !selectedVersion || selectedVersion.id === latestVersion?.id;
  const selectedApproval = selectedVersion
    ? approvals
        .filter((approval) => approval.versionId === selectedVersion.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
    : null;
  const status: DealMemo["status"] = selectedApproval?.decision === "approved"
    ? "approved"
    : selectedApproval?.decision === "revision_requested"
      ? "needs_review"
      : currentMemo?.status === "needs_review"
        ? "needs_review"
        : currentMemo?.status === "draft"
          ? "draft"
          : selectedVersion?.id === latestVersion?.id
            ? "needs_review"
            : "draft";
  const templateValueState = templateValue(templateKind, templateId);
  const currentTemplateLabel =
    templateKind === "custom"
      ? templates.find((template) => template.id === templateId)?.name ?? "Custom precedent"
      : TEMPLATE_LABEL[templateKind];
  const dirty = Boolean(
    currentMemo &&
      (currentMemo.title !== title ||
        currentMemo.content !== content ||
        currentMemo.templateKind !== templateKind ||
        currentMemo.templateId !== templateId ||
        currentMemo.focusAreas.join("|") !== focusAreas.join("|")),
  );
  const effectiveTemplateKind = viewingLatest ? templateKind : selectedVersion?.templateKind ?? templateKind;
  const includedClaims = effectiveTemplateKind === "external"
    ? claims.filter(
        (claim) =>
          claim.reviewStatus === "approved" &&
          !claim.supersededBy &&
          claim.verificationStatus !== "internal_opinion" &&
          claim.verificationStatus !== "disputed" &&
          claim.attribution !== "unknown",
      )
    : claims.filter((claim) => claim.reviewStatus === "approved" && !claim.supersededBy);
  const selectedContent = viewingLatest ? content : selectedVersion?.content ?? "";
  const selectedTitle = viewingLatest ? title : selectedVersion?.title ?? "";
  const displayStatus: DealMemo["status"] = dirty && viewingLatest ? "draft" : status;
  const approvedForExport = Boolean(selectedVersion && status === "approved" && (!viewingLatest || !dirty));

  const toggleFocus = (focus: MemoFocus) => {
    setFocusAreas((current) => (current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus]));
  };

  const openSource = async (claim: DealClaim) => {
    if (claim.documentId) {
      const document = documents.find((item) => item.id === claim.documentId);
      if (!document) {
        toast.error("This source document is no longer available.");
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
    if (claim.sourceId) window.location.assign(`/inbox#source-${claim.sourceId}`);
  };

  const save = async (): Promise<boolean> => {
    if (!canWrite || !viewingLatest) return false;
    if (!title.trim() || !content.trim()) {
      setError("A memo needs a title and content.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      if (currentMemo) {
        await actions.updateDealMemo.mutateAsync({
          id: currentMemo.id,
          input: { title, content, templateKind, templateId, focusAreas },
        });
      } else {
        await actions.createDealMemo.mutateAsync({
          dealId: deal.id,
          title,
          content,
          origin: "manual",
          templateKind,
          templateId,
          focusAreas,
        });
      }
      setSelectedVersionId("");
      setNotice("Saved. A new immutable version was created; previous approvals remain with their versions.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save this memo.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!canWrite) return;
    if (templateKind === "custom" && !templateId) {
      setError("Choose a custom precedent template before generating.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await actions.generateCaseMemo.mutateAsync({
        dealId: deal.id,
        requestId: crypto.randomUUID(),
        proposalIds: acceptedProposals.map((proposal) => proposal.id),
        templateKind,
        templateId,
        focusAreas,
      });
      if (result.status !== "created" || !result.memo) {
        setError(result.error ?? "The memo was not generated. No version was created.");
        return;
      }
      setTitle(result.memo.title);
      setContent(result.memo.content);
      setTemplateKind(result.memo.templateKind);
      setTemplateId(result.memo.templateId);
      setFocusAreas(result.memo.focusAreas);
      setSelectedVersionId(result.version?.id ?? "");
      setNotice(`Generated as ${TEMPLATE_LABEL[result.memo.templateKind]}. It is a Draft and must be reviewed by an authorized human.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The memo was not generated. No version was created.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    if (!canApprove || !currentMemo || !latestVersion || dirty || !viewingLatest) return;
    setBusy(true);
    setError("");
    try {
      const result = await actions.approveDealMemo.mutateAsync({
        memoId: currentMemo.id,
        versionId: latestVersion.id,
        decision: approvalOpen ?? "approved",
        note: approvalNote,
      });
      if (result.status === "stale") {
        setError("A newer memo version exists. The approval was not recorded; review the latest version.");
        return;
      }
      if (result.status !== "approved" && result.status !== "revision_requested") {
        setError(`The decision was not recorded (${result.status}).`);
        return;
      }
      setApprovalOpen(null);
      setApprovalNote("");
      setNotice(result.status === "approved" ? "Memo version approved and recorded." : "Returned for revision; the previous approval records are preserved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The memo decision was not recorded.");
    } finally {
      setBusy(false);
    }
  };

  const copyApproved = async () => {
    if (!approvedForExport || !selectedVersion) return;
    try {
      await navigator.clipboard.writeText(`${selectedTitle}\n\n${sanitizeExport(selectedContent)}`);
      toast.success("Approved memo copied");
    } catch {
      toast.error("Could not copy. Select the text manually.");
    }
  };

  const downloadApproved = () => {
    if (!approvedForExport || !selectedVersion) return;
    const blob = new Blob([sanitizeExport(selectedContent)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${deal.companyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${templateKind}-memo-v${selectedVersion.versionNumber}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const authorizeExternal = async () => {
    if (!approvedForExport || !currentMemo || !selectedVersion || !exportConfirmed) return;
    setBusy(true);
    setError("");
    try {
      const result = await actions.authorizeExternalMemoExport.mutateAsync({
        memoId: currentMemo.id,
        versionId: selectedVersion.id,
        mode: exportMode,
        included: {
          template_kind: selectedVersion.templateKind,
          version_number: selectedVersion.versionNumber,
          claim_ids: includedClaims.map((claim) => claim.id),
          sections: selectedVersion.templateKind === "external" ? ["OVERVIEW", "PRODUCT / MARKET", "APPROVED TRACTION / FINANCING", "AUTHORIZED CONTACT / NEXT STEPS"] : [],
        },
        note: "Final explicit external-sharing confirmation by reviewer.",
      });
      if (result.status !== "authorized") {
        setError(
          result.status === "stale"
            ? "A newer version exists. External export was not authorized."
            : result.status === "not_approved"
              ? "Internal approval for this exact version is required before external authorization."
              : "External export was not authorized.",
        );
        return;
      }
      setExportOpen(false);
      setExportConfirmed(false);
      if (exportMode === "external_copy") await copyApproved();
      else downloadApproved();
      toast.success("External sharing authorized for this exact version; the approved export was prepared.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "External sharing was not authorized.");
    } finally {
      setBusy(false);
    }
  };

  const openTemplateDialog = () => {
    setTemplateDialogOpen(true);
    setTemplateName("");
    setTemplateFile(null);
    setProposedTemplate(null);
    setTemplateHeadings("");
    setTemplateStyle("");
    setTemplateLength("");
    setTemplateError("");
  };

  const extractTemplate = async () => {
    if (!templateFile) {
      setTemplateError("Choose a supported precedent memo.");
      return;
    }
    setTemplateBusy(true);
    setTemplateError("");
    try {
      const template = await actions.uploadMemoTemplate.mutateAsync({
        name: templateName || templateFile.name,
        file: templateFile,
      });
      setProposedTemplate(template);
      setTemplateHeadings(template.headings.join("\n"));
      setTemplateStyle(template.styleNotes);
      setTemplateLength(template.lengthGuidance);
    } catch (caught) {
      setTemplateError(caught instanceof Error ? caught.message : "Precedent extraction failed. Nothing was saved.");
    } finally {
      setTemplateBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!proposedTemplate) return;
    setTemplateBusy(true);
    setTemplateError("");
    try {
      await actions.updateMemoTemplate.mutateAsync({
        id: proposedTemplate.id,
        name: proposedTemplate.name,
        headings: templateHeadings.split("\n").map((item) => item.trim()).filter(Boolean),
        styleNotes: templateStyle,
        lengthGuidance: templateLength,
        status: "active",
      });
      setTemplateKind("custom");
      setTemplateId(proposedTemplate.id);
      setTemplateDialogOpen(false);
      setNotice("Precedent structure saved for reuse. Only headings/style/length are transferred; precedent facts are not stored.");
    } catch (caught) {
      setTemplateError(caught instanceof Error ? caught.message : "Could not save the precedent structure.");
    } finally {
      setTemplateBusy(false);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="memo-workspace-heading">
      <div className="panel p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="memo-workspace-heading" className="text-[14px] font-semibold tracking-tight">Memo</h2>
            <Pill tone={STATUS_TONE[displayStatus]}>{statusLabel(displayStatus)}</Pill>
            {currentMemo?.humanEdited ? <Pill tone="warning">Human-edited</Pill> : null}
            {dirty ? <Pill tone="warning">Unsaved edits</Pill> : null}
            {!canApprove ? <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" />Approval: owner or partner</span> : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void save()} disabled={!canWrite || busy || !viewingLatest}>Save</Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={() => void generate()} disabled={!canWrite || busy || !viewingLatest}>
              {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Sparkles className="h-3 w-3" aria-hidden="true" />}
              Generate
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void copyApproved()} disabled={!approvedForExport}>Copy</Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px]" onClick={downloadApproved} disabled={!approvedForExport}><Download className="h-3 w-3" aria-hidden="true" />.md</Button>
            {selectedVersion?.templateKind === "external" ? (
              <Button size="sm" className="h-7 text-[10px]" onClick={() => { setExportOpen(true); setExportConfirmed(false); }} disabled={!approvedForExport || !canApprove}>Export external</Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="memo-template" className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Template</label>
            <select
              id="memo-template"
              value={templateValueState}
              onChange={(event) => {
                const value = event.target.value;
                if (value.startsWith("custom:")) {
                  setTemplateKind("custom");
                  setTemplateId(value.slice(7));
                } else {
                  setTemplateKind(value as "internal" | "external");
                  setTemplateId(null);
                }
              }}
              disabled={!canWrite || busy || !viewingLatest}
              className="h-8 min-w-[220px] rounded-md border border-input bg-card px-2 text-[11px]"
            >
              <option value="internal">{TEMPLATE_LABEL.internal}</option>
              <option value="external">{TEMPLATE_LABEL.external}</option>
              {templates.map((template) => (
                <option key={template.id} value={`custom:${template.id}`}>{template.name}{template.status === "proposed" ? " (proposed)" : ""}</option>
              ))}
            </select>
            <Button size="sm" variant="ghost" className="h-7 gap-1 px-1.5 text-[9.5px]" onClick={openTemplateDialog} disabled={!canWrite || busy}><Plus className="h-3 w-3" aria-hidden="true" />Precedent</Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Generation focus">
            {FOCUS_OPTIONS.map((focus) => (
              <label key={focus.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[9.5px]">
                <input
                  type="checkbox"
                  checked={focusAreas.includes(focus.id)}
                  onChange={() => toggleFocus(focus.id)}
                  disabled={!canWrite || busy || !viewingLatest}
                  className="h-3 w-3 accent-primary"
                />
                {focus.label}
              </label>
            ))}
          </div>
        </div>
        {notice ? <p className="mt-1.5 text-[9.5px] text-success">{notice}</p> : null}
        {error ? (
          <p role="alert" className="mt-1.5 flex items-start gap-1.5 rounded-md border border-destructive/20 bg-danger-soft px-2.5 py-1.5 text-[10px] leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />{error}
          </p>
        ) : null}
        {!viewingLatest && selectedVersion ? (
          <div className="mt-2 rounded-md border border-warning/25 bg-warning-soft/30 px-2.5 py-1.5 text-[9.5px] text-warning">
            Viewing v{selectedVersion.versionNumber} read-only. <button type="button" className="font-semibold underline" onClick={() => { setSelectedVersionId(latestVersion?.id ?? ""); setTitle(currentMemo?.title ?? ""); setContent(currentMemo?.content ?? ""); }}>Return to current draft</button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="panel p-4">
          <Input
            value={selectedTitle}
            onChange={(event) => setTitle(event.target.value)}
            readOnly={!viewingLatest || !canWrite}
            className="h-9 border-0 bg-transparent px-0 text-[16px] font-semibold shadow-none focus-visible:ring-0"
            aria-label="Memo title"
          />
          <p className="mt-0.5 text-[9px] text-muted-foreground">
            {currentTemplateLabel} · {dirty ? "Unsaved edits" : "Saved version"} · AI output starts as Draft; human assessment is not generated.
            {currentMemo?.humanEdited ? " Human edits are not source-verified; review the evidence rail before approval." : ""}
          </p>
          {viewingLatest ? (
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              readOnly={!canWrite}
              rows={22}
              className="mt-2 min-h-[440px] resize-y border-0 bg-transparent px-0 font-mono text-[10.5px] leading-relaxed shadow-none focus-visible:ring-0"
              aria-label="Memo content"
              placeholder="No memo yet. Choose a template, set focus areas, and generate a source-grounded draft."
            />
          ) : (
            <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/20 p-3 font-mono text-[10px] leading-relaxed">{selectedContent}</pre>
          )}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2">
            <p className="text-[9px] text-muted-foreground">Approved only export. External sharing always requires a separate final confirmation.</p>
            <div className="flex gap-1.5">
              {canApprove ? (
                <>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setApprovalOpen("revision_requested"); setApprovalNote(""); }} disabled={!currentMemo || !latestVersion || dirty || !viewingLatest || busy}>Return for revision</Button>
                  <Button size="sm" className="h-7 gap-1 text-[10px]" onClick={() => { setApprovalOpen("approved"); setApprovalNote(""); }} disabled={!currentMemo || !latestVersion || dirty || !viewingLatest || status === "approved" || busy}><Check className="h-3 w-3" aria-hidden="true" />Approve</Button>
                </>
              ) : null}
            </div>
          </div>
        </div>

        <aside>
          <details open className="panel p-3">
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-[11.5px] font-semibold">
              <span>Evidence &amp; review</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </summary>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-1.5">
                <Pill tone={STATUS_TONE[displayStatus]}>{statusLabel(displayStatus)}</Pill>
                {dirty ? <Pill tone="warning">Save before approval</Pill> : null}
                <span className="text-[9px] text-muted-foreground">{includedClaims.length} evidence item{includedClaims.length === 1 ? "" : "s"}</span>
              </div>
              {sameApprovalAudit(selectedVersion?.id, approvals, workspace.members).length > 0 ? (
                <div className="rounded-md border border-border bg-secondary/20 p-2">
                  <p className="label-caps">Approval audit</p>
                  <ul className="mt-1 space-y-1">
                    {sameApprovalAudit(selectedVersion?.id, approvals, workspace.members).map((approval) => (
                      <li key={approval.id} className="text-[9px] leading-relaxed text-muted-foreground">
                        {approval.decision === "approved" ? "Approved" : "Returned for revision"} · {approval.reviewerName} · {formatShortDate(approval.createdAt)}{approval.note ? ` · ${approval.note}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[9px] text-muted-foreground">No human approval recorded for this version.</p>
              )}

              <details open>
                <summary className="cursor-pointer text-[10px] font-medium">Evidence · source links and labels</summary>
                <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">AI text is analysis until supported by a stored claim. Approval is not fact verification.</p>
                {includedClaims.length === 0 ? <p className="mt-1 text-[9.5px] text-warning">Not Available: no approved claim is available for this template.</p> : (
                  <ul className="mt-1 max-h-60 space-y-1.5 overflow-y-auto">
                    {includedClaims.map((claim) => (
                      <li key={claim.id} className="rounded-md border border-border bg-card p-2">
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] font-semibold">{claim.label}</span>
                          <Pill tone={evidenceLabel(claim) === "Verified" ? "success" : evidenceLabel(claim) === "Needs Review" ? "warning" : "neutral"}>{evidenceLabel(claim)}</Pill>
                        </div>
                        <p className="mt-0.5 text-[9.5px] text-muted-foreground">{claim.valueText} {claim.reportingPeriod ? `· ${claim.reportingPeriod}` : ""}</p>
                        {claim.supportingExcerpt ? <p className="mt-0.5 line-clamp-2 text-[9px] text-muted-foreground">“{claim.supportingExcerpt}”</p> : null}
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <span className="text-[8.5px] text-muted-foreground">
                            {claim.documentId ? documents.find((document) => document.id === claim.documentId)?.documentType?.toUpperCase() ?? "Source document" : claim.sourceId ? captures.find((capture) => capture.id === claim.sourceId)?.source === "voice" ? "Voice source" : "Text source" : "No source"}
                            {" · "}
                            {claim.documentId ? (documents.find((document) => document.id === claim.documentId)?.sourceDate ? formatShortDate(documents.find((document) => document.id === claim.documentId)!.sourceDate) : "Unknown source date") : claim.sourceId ? (captures.find((capture) => capture.id === claim.sourceId)?.sourceDate ? formatShortDate(captures.find((capture) => capture.id === claim.sourceId)!.sourceDate) : "Unknown source date") : "No source date"}
                            {" · "}{claim.reviewedAt ? `reviewed ${formatShortDate(claim.reviewedAt)}` : "no review date"}
                          </span>
                          {claim.documentId || claim.sourceId ? <button type="button" onClick={() => void openSource(claim)} className="inline-flex items-center gap-0.5 text-[8.5px] font-medium text-brand-strong hover:underline">Open evidence <ArrowUpRight className="h-2.5 w-2.5" aria-hidden="true" /></button> : <span className="text-[8.5px] text-warning">Not Available</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review").length > 0 ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-[9px] text-warning">Missing evidence · {gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review").length}</summary>
                    <ul className="mt-1 space-y-0.5">{gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review").slice(0, 6).map((gap) => <li key={gap.id} className="text-[9px] leading-relaxed text-muted-foreground">{gap.question}</li>)}</ul>
                  </details>
                ) : null}
              </details>

              <details>
                <summary className="cursor-pointer text-[10px] font-medium">Versions &amp; approval</summary>
                <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto">
                  {versions.filter((version) => version.dealId === deal.id).map((version) => {
                    const versionApproval = approvals.filter((approval) => approval.versionId === version.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                    const versionStatus = versionApproval?.decision === "approved" ? "approved" : versionApproval?.decision === "revision_requested" ? "needs_review" : version.id === latestVersion?.id && currentMemo?.status === "needs_review" ? "needs_review" : "draft";
                    return (
                      <li key={version.id}>
                        <button type="button" onClick={() => setSelectedVersionId(version.id)} className={`w-full rounded-md border px-2 py-1 text-left ${selectedVersion?.id === version.id ? "border-brand/30 bg-brand-soft/30" : "border-border"} `}>
                          <span className="flex items-center justify-between gap-1"><span className="text-[9.5px] font-semibold">v{version.versionNumber}</span><span className="text-[8.5px] text-muted-foreground">{statusLabel(versionStatus as DealMemo["status"])}</span></span>
                          <span className="block text-[8.5px] text-muted-foreground">{formatShortDate(version.createdAt)} · {version.templateKind} {version.humanEdited ? "· human-edited" : ""}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>

              <details>
                <summary className="cursor-pointer text-[10px] font-medium">Source updates</summary>
                <div className="mt-1">
                  <MemoDelta
                    deal={deal}
                    claims={claims}
                    sources={captures}
                    documents={documents}
                    versions={versions}
                    proposals={proposals}
                    reviews={reviews}
                    gaps={gaps}
                    members={workspace.members}
                    currentMemo={currentMemo}
                    onMemoCreated={() => undefined}
                    reviewOnly
                  />
                </div>
              </details>
            </div>
          </details>
        </aside>
      </div>

      <Dialog open={Boolean(approvalOpen)} onOpenChange={(open) => !open && setApprovalOpen(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{approvalOpen === "approved" ? "Approve this memo version" : "Return for revision"}</DialogTitle>
            <DialogDescription>
              This records your reviewer identity and timestamp against the latest saved version. It does not verify every fact; evidence review is separate.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reviewer note" htmlFor="memo-approval-note" optional>
            <Textarea id="memo-approval-note" rows={3} value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} />
          </Field>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApprovalOpen(null)}>Cancel</Button>
            <Button onClick={() => void approve()} disabled={busy || !canApprove || !latestVersion || dirty}>Record {approvalOpen === "approved" ? "approval" : "revision request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Confirm external sharing</DialogTitle>
            <DialogDescription>This is a separate authorization from internal memo approval. It applies only to version {selectedVersion?.versionNumber ?? "—"}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-[11px]">
            <p className="rounded-md border border-border bg-secondary/30 p-2.5">Included: short overview, product/market, approved traction/financing, and an authorized contact/next-step placeholder. Internal notes, opinions, Talok thesis, gaps and private document URLs are excluded from the external generation inputs and export.</p>
            {includedClaims.length > 0 ? (
              <ul className="max-h-32 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
                {includedClaims.map((claim) => (
                  <li key={claim.id} className="text-[9px] text-muted-foreground">{claim.label}: {claim.valueText} · {evidenceLabel(claim)}</li>
                ))}
              </ul>
            ) : <p className="text-[9px] text-warning">No approved external claim is available; the external brief will contain only non-factual placeholders.</p>}
            <label className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-soft/30 p-2.5 text-[10.5px]">
              <input type="checkbox" checked={exportConfirmed} onChange={(event) => setExportConfirmed(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-primary" />
              I confirm that every item included in this exact approved version is authorized for external sharing. This is not inferred from internal review.
            </label>
            <label className="flex items-center gap-2 text-[10.5px]">Format:
              <select value={exportMode} onChange={(event) => setExportMode(event.target.value as "external_copy" | "external_markdown")} className="h-7 rounded-md border border-input bg-card px-1.5 text-[10px]">
                <option value="external_markdown">Markdown download (.md)</option>
                <option value="external_copy">Copy text</option>
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
            <Button onClick={() => void authorizeExternal()} disabled={!exportConfirmed || busy || !canApprove}>Authorize &amp; export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Custom precedent template</DialogTitle>
            <DialogDescription>Upload a historical approved memo. Only headings, style and length are extracted and stored; precedent facts, identities, narrative and source text are not saved as reusable content.</DialogDescription>
          </DialogHeader>
          {!proposedTemplate ? (
            <div className="space-y-2">
              <Field label="Template name" htmlFor="template-name"><Input id="template-name" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="e.g. Growth stage internal memo" /></Field>
              <Field label="Precedent file" htmlFor="template-file" hint="PDF with text, DOCX, TXT, EML or CSV. Private storage.">
                <Input id="template-file" type="file" accept=".pdf,.docx,.txt,.eml,.csv" onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)} />
              </Field>
              <p className="text-[9px] text-muted-foreground">XLSX and scanned/image-only files are unsupported; no OCR or simulated extraction is used.</p>
              {templateError ? <p role="alert" className="text-[10px] text-destructive">{templateError}</p> : null}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="rounded-md border border-brand/20 bg-brand-soft/30 p-2 text-[10px] text-brand-strong">Proposed structure only. Review and edit before saving; no precedent facts are carried across.</p>
              <Field label="Headings (one per line)" htmlFor="template-headings"><Textarea id="template-headings" rows={7} value={templateHeadings} onChange={(event) => setTemplateHeadings(event.target.value)} /></Field>
              <Field label="Style notes" htmlFor="template-style"><Textarea id="template-style" rows={3} value={templateStyle} onChange={(event) => setTemplateStyle(event.target.value)} /></Field>
              <Field label="Length guidance" htmlFor="template-length"><Input id="template-length" value={templateLength} onChange={(event) => setTemplateLength(event.target.value)} /></Field>
              {templateError ? <p role="alert" className="text-[10px] text-destructive">{templateError}</p> : null}
            </div>
          )}
          <DialogFooter>
            {proposedTemplate ? (
              <>
                <Button variant="ghost" onClick={() => setProposedTemplate(null)}>Back</Button>
                <Button onClick={() => void saveTemplate()} disabled={templateBusy}>Save active template</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setTemplateDialogOpen(false)}>Cancel</Button>
                <Button onClick={() => void extractTemplate()} disabled={templateBusy || !templateFile}>{templateBusy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Upload className="h-3 w-3" aria-hidden="true" />}Propose structure</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function sameApprovalAudit(
  versionId: string | undefined,
  approvals: { id: string; versionId: string; decision: string; note: string; reviewer: string | null; createdAt: string }[],
  members: { userId: string | null; displayName: string; email: string }[],
) {
  if (!versionId) return [];
  return approvals
    .filter((approval) => approval.versionId === versionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((approval) => ({
      ...approval,
      reviewerName: members.find((member) => member.userId === approval.reviewer)?.displayName || "Reviewer",
    }));
}

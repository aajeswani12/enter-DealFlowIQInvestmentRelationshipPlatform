import { Check, ExternalLink, FileText, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import { CLAIM_TYPE_LABEL, CLAIM_TYPE_OPTIONS, VERIFICATION_LABEL, VERIFICATION_OPTIONS } from "@/lib/constants";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { formatShortDate } from "@/lib/format";
import type { ClaimType, DealClaim, VerificationStatus } from "@/lib/types";

const VERIFICATION_TONE = {
  unverified: "neutral",
  founder_reported: "brand",
  corroborated: "success",
  internal_opinion: "neutral",
  disputed: "danger",
} as const;

export function ClaimsSection({ dealId, items }: { dealId: string; items: DealClaim[] }) {
  const actions = useWorkspaceActions();
  const { data } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [adding, setAdding] = useState(false);
  const [claimType, setClaimType] = useState<ClaimType>("metric");
  const [label, setLabel] = useState("");
  const [valueText, setValueText] = useState("");
  const [normalizedValue, setNormalizedValue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [reportingPeriod, setReportingPeriod] = useState("");
  const [supportingExcerpt, setSupportingExcerpt] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("unverified");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const drafts = items.filter((item) => item.reviewStatus === "draft");
  const active = items.filter((item) => item.reviewStatus === "approved" && !item.supersededBy);
  const preserved = items.filter((item) => Boolean(item.supersededBy)).length;

  const handleReview = async (item: DealClaim, decision: "approved" | "rejected") => {
    try {
      await actions.reviewClaim.mutateAsync({
        id: item.id,
        decision,
        proposedChangeTo: item.proposedChangeTo,
      });
      toast.success(decision === "approved" ? "Fact approved" : "Draft rejected");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not review this fact.");
    }
  };

  const reset = () => {
    setClaimType("metric");
    setLabel("");
    setValueText("");
    setNormalizedValue("");
    setCurrency("USD");
    setReportingPeriod("");
    setSupportingExcerpt("");
    setVerificationStatus("unverified");
    setFile(null);
    setError("");
    setAdding(false);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError("Give the claim a short label.");
      return;
    }
    try {
      await actions.createClaim.mutateAsync({
        dealId,
        claimType,
        label: label.trim(),
        supportingExcerpt: supportingExcerpt.trim(),
        valueText: valueText.trim(),
        normalizedValue: normalizedValue && Number.isFinite(Number(normalizedValue.replace(/[^0-9.]/g, "")))
          ? Number(normalizedValue.replace(/[^0-9.]/g, ""))
          : null,
        currency: (currency || "USD").toUpperCase(),
        reportingPeriod: reportingPeriod.trim(),
        verificationStatus,
        sourceId: null,
        file,
      });
      toast.success("Claim added to the deal");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this claim.");
    }
  };

  const handleDelete = async (item: DealClaim) => {
    try {
      await actions.deleteClaim.mutateAsync({ id: item.id, filePath: item.filePath });
      toast.success("Claim removed");
    } catch {
      toast.error("Could not remove this claim.");
    }
  };

  const handleOpen = async (item: DealClaim) => {
    const importedDocument = item.documentId
      ? workspace.caseDocuments.find((document) => document.id === item.documentId)
      : null;
    const path = item.filePath ?? importedDocument?.storagePath ?? null;
    if (!path) return;
    setOpeningId(item.id);
    try {
      const url = importedDocument
        ? await api.getImportDocumentUrl(importedDocument.storagePath)
        : await api.getClaimUrl(path);
      if (!url) {
        toast.error("This document is no longer available in storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="claims-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="claims-heading" className="text-[15px] font-semibold tracking-tight">
            Claims &amp; evidence
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            {active.length === 0 && drafts.length === 0
              ? "Assertions, metrics and documents collected so far."
              : `${active.length} reviewed claim${active.length === 1 ? "" : "s"}${
                  drafts.length ? ` · ${drafts.length} awaiting review` : ""
                }`}
          </p>
        </div>
        {!adding ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add claim
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[150px_1fr]">
            <Field label="Type" htmlFor="claim-type">
              <SelectField
                id="claim-type"
                value={claimType}
                onChange={(value) => setClaimType(value as ClaimType)}
                options={CLAIM_TYPE_OPTIONS}
              />
            </Field>
            <Field label="Label" htmlFor="claim-label" hint={error}>
              <Input
                id="claim-label"
                value={label}
                onChange={(event) => {
                  setLabel(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Net revenue retention"
                className="bg-card"
                aria-invalid={Boolean(error)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_110px_100px_1fr]">
            <Field label="Value" htmlFor="claim-value" optional>
              <Input
                id="claim-value"
                value={valueText}
                onChange={(event) => setValueText(event.target.value)}
                placeholder="128% or $1.4M MRR"
                className="bg-card"
              />
            </Field>
            <Field label="Normalized" htmlFor="claim-normalized" optional>
              <Input
                id="claim-normalized"
                inputMode="decimal"
                value={normalizedValue}
                onChange={(event) => setNormalizedValue(event.target.value)}
                placeholder="128"
                className="bg-card"
              />
            </Field>
            <Field label="Currency" htmlFor="claim-currency" optional>
              <Input
                id="claim-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value.toUpperCase().slice(0, 3))}
                className="bg-card uppercase"
              />
            </Field>
            <Field label="Reporting period" htmlFor="claim-period" optional>
              <Input
                id="claim-period"
                value={reportingPeriod}
                onChange={(event) => setReportingPeriod(event.target.value)}
                placeholder="e.g. FY25 Q2"
                className="bg-card"
              />
            </Field>
          </div>

          <FormRow>
            <Field label="Supporting excerpt" htmlFor="claim-excerpt" optional>
              <Textarea
                id="claim-excerpt"
                rows={3}
                value={supportingExcerpt}
                onChange={(event) => setSupportingExcerpt(event.target.value)}
                placeholder="Quote or context that supports the claim."
                className="bg-card"
              />
            </Field>
            <Field label="Verification" htmlFor="claim-verification">
              <SelectField
                id="claim-verification"
                value={verificationStatus}
                onChange={(value) => setVerificationStatus(value as VerificationStatus)}
                options={VERIFICATION_OPTIONS}
              />
            </Field>
          </FormRow>

          <Field
            label="Attach a document"
            htmlFor="claim-file"
            optional
            hint={file ? `Selected: ${file.name}` : "PDF, deck or spreadsheet, up to 50 MB. Stored privately."}
          >
            <div className="flex items-center gap-2">
              <Input
                id="claim-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="bg-card file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-secondary-foreground"
              />
              {file ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Clear
                </Button>
              ) : (
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </Field>

          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={actions.createClaim.isPending}>
              {actions.createClaim.isPending ? "Saving…" : "Save claim"}
            </Button>
          </div>
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <div className="mt-4 rounded-lg border border-warning/25 bg-warning-soft/40 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label-caps">AI-extracted · awaiting human review</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-warning">
                Draft facts do not change the reviewed case until approved. Approving a proposal supersedes the prior
                reviewed claim, which remains in the audit history.
              </p>
            </div>
            <Pill tone="warning">{drafts.length}</Pill>
          </div>
          <ul className="mt-3 space-y-2">
            {drafts.map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[13px] font-medium">{item.label}</p>
                  <Pill tone="neutral">{CLAIM_TYPE_LABEL[item.claimType]}</Pill>
                  <Pill tone={VERIFICATION_TONE[item.verificationStatus]}>
                    {VERIFICATION_LABEL[item.verificationStatus]}
                  </Pill>
                  <Pill tone="warning">Draft fact</Pill>
                  {item.proposedChangeTo ? <Pill tone="danger">Proposed change</Pill> : null}
                </div>
                {item.valueText || item.reportingPeriod ? (
                  <p className="mt-1 text-[12px] font-medium text-foreground/90">
                    {item.valueText}
                    {item.reportingPeriod ? <span className="font-normal text-muted-foreground"> · {item.reportingPeriod}</span> : null}
                  </p>
                ) : null}
                {item.supportingExcerpt ? (
                  <blockquote className="mt-1 border-l-2 border-border pl-2 text-[11.5px] leading-relaxed text-muted-foreground">
                    “{item.supportingExcerpt}”
                  </blockquote>
                ) : null}
                {item.proposedChangeTo ? (
                  <p className="mt-1 text-[10.5px] text-destructive">
                    This differs from a reviewed fact. Approval will supersede the prior claim without deleting it.
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {item.sourceId ? (
                      <Link to={`/inbox#source-${item.sourceId}`} className="font-medium text-brand-strong hover:underline">
                        Source evidence
                      </Link>
                    ) : (
                      <span>No source link</span>
                    )}
                    <span>{formatShortDate(item.createdAt)}</span>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      className="h-7 gap-1 px-2 text-[11px]"
                      onClick={() => handleReview(item, "approved")}
                      disabled={actions.reviewClaim.isPending}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-[11px] text-muted-foreground"
                      onClick={() => handleReview(item, "rejected")}
                      disabled={actions.reviewClaim.isPending}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                      Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {active.length === 0 && drafts.length === 0 && !adding ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
          No claims recorded yet. Add a manual claim, or analyse a source to extract evidence drafts.
        </p>
      ) : active.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {active.map((item) => (
            <li key={item.id} className="rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[13px] font-medium">{item.label}</p>
                      <Pill tone="neutral">{CLAIM_TYPE_LABEL[item.claimType]}</Pill>
                      <Pill tone={VERIFICATION_TONE[item.verificationStatus]}>
                        {VERIFICATION_LABEL[item.verificationStatus]}
                      </Pill>
                      <Pill tone="success">Reviewed</Pill>
                    </div>
                    {item.valueText || item.reportingPeriod ? (
                      <p className="mt-1 text-[12px] font-medium text-foreground/90">
                        {item.valueText}
                        {item.reportingPeriod ? <span className="font-normal text-muted-foreground"> · {item.reportingPeriod}</span> : null}
                      </p>
                    ) : null}
                    {item.supportingExcerpt ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.supportingExcerpt}</p>
                    ) : null}
                    {item.verificationNote ? (
                      <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/80">{item.verificationNote}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground/80">
                      {item.sourceId ? (
                        <Link to={`/inbox#source-${item.sourceId}`} className="font-medium text-brand-strong hover:underline">
                          Source
                        </Link>
                      ) : null}
                      <span>{formatShortDate(item.createdAt)}</span>
                      {item.fileName || item.documentId ? (
                        item.filePath || item.documentId ? (
                          <button
                            type="button"
                            onClick={() => handleOpen(item)}
                            className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline"
                          >
                            {openingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            )}
                            {item.fileName ?? "Source document"}
                          </button>
                        ) : (
                          <span>{item.fileName ?? "Source document"}</span>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
                {!item.analysisRunId ? (
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`Remove claim: ${item.label}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-danger-soft hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {preserved > 0 ? (
        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
          {preserved} prior claim{preserved === 1 ? "" : "s"} preserved and superseded by a human-approved change.
        </p>
      ) : null}
    </section>
  );
}

function FormRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-[1fr_160px]">{children}</div>;
}

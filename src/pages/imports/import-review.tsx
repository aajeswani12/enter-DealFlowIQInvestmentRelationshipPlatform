import { Check, CircleAlert, ExternalLink, History, Pencil, Split, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import {
  CLAIM_TYPE_OPTIONS,
  INVESTOR_TYPE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  VERIFICATION_OPTIONS,
} from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type {
  ImportBatch,
  ImportCandidate,
  ImportFileRecord,
  ImportReview,
  InvestmentCase,
  Investor,
} from "@/lib/types";

const REVIEW_ACTION_LABEL: Record<string, string> = {
  approve: "Approved and linked",
  edit: "Edited before approval",
  reject: "Rejected",
  keep_separate: "Kept separate",
};

const CANDIDATE_STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting review",
  needs_review: "Uncertain match",
  applied: "Applied",
  rejected: "Rejected",
  kept_separate: "Kept separate",
};

function candidateName(candidate: ImportCandidate): string {
  const payload = candidate.payload;
  if (candidate.entityType === "claim") return String(payload.label ?? "Unlabelled claim");
  return String(payload.name ?? "Unnamed record");
}

function SourceLabel({ file }: { file?: ImportFileRecord }) {
  if (!file) return <span>Source file unavailable</span>;
  return (
    <span className="inline-flex items-center gap-1">
      <ExternalLink className="h-3 w-3" aria-hidden="true" />
      {file.fileName}
    </span>
  );
}

interface EditState {
  name: string;
  website: string;
  sector: string;
  stage: string;
  geography: string;
  summary: string;
  target_raise: string;
  cheque_sought: string;
  thesis: string;
  investor_type: string;
  stages: string;
  sectors: string;
  minimum_check: string;
  maximum_check: string;
  relationship: string;
  label: string;
  value_text: string;
  reporting_period: string;
  claim_type: string;
  verification_status: string;
}

const EMPTY_EDIT: EditState = {
  name: "",
  website: "",
  sector: "",
  stage: "",
  geography: "",
  summary: "",
  target_raise: "",
  cheque_sought: "",
  thesis: "",
  investor_type: "vc",
  stages: "",
  sectors: "",
  minimum_check: "",
  maximum_check: "",
  relationship: "new",
  label: "",
  value_text: "",
  reporting_period: "",
  claim_type: "metric",
  verification_status: "founder_reported",
};

function editStateFor(candidate: ImportCandidate): EditState {
  const p = candidate.payload;
  return {
    ...EMPTY_EDIT,
    name: String(p.name ?? ""),
    website: String(p.website ?? ""),
    sector: String(p.sector ?? ""),
    stage: String(p.stage ?? ""),
    geography: String(p.geography ?? ""),
    summary: String(p.summary ?? ""),
    target_raise: p.target_raise == null ? "" : String(p.target_raise),
    cheque_sought: p.cheque_sought == null ? "" : String(p.cheque_sought),
    thesis: String(p.thesis ?? ""),
    investor_type: String(p.investor_type ?? "vc"),
    stages: Array.isArray(p.stages) ? p.stages.join(", ") : String(p.stages ?? ""),
    sectors: Array.isArray(p.sectors) ? p.sectors.join(", ") : String(p.sectors ?? ""),
    minimum_check: p.minimum_check == null ? "" : String(p.minimum_check),
    maximum_check: p.maximum_check == null ? "" : String(p.maximum_check),
    relationship: String(p.relationship ?? "new"),
    label: String(p.label ?? ""),
    value_text: String(p.value_text ?? ""),
    reporting_period: String(p.reporting_period ?? ""),
    claim_type: String(p.claim_type ?? "metric"),
    verification_status: String(p.verification_status ?? "founder_reported"),
  };
}

interface ImportReviewProps {
  candidates: ImportCandidate[];
  reviews: ImportReview[];
  files: ImportFileRecord[];
  batches: ImportBatch[];
  cases: InvestmentCase[];
  investors: Investor[];
  batchId: string | null;
  canWrite: boolean;
  showAll: boolean;
  onShowAllChange: (value: boolean) => void;
}

export function ImportReview({
  candidates,
  reviews,
  files,
  batches,
  cases,
  investors,
  batchId,
  canWrite,
  showAll,
  onShowAllChange,
}: ImportReviewProps) {
  const actions = useWorkspaceActions();
  const [editing, setEditing] = useState<ImportCandidate | null>(null);
  const [form, setForm] = useState<EditState>(EMPTY_EDIT);
  const [editNote, setEditNote] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    setForm(editStateFor(editing));
    setEditNote("");
  }, [editing]);

  const pending = candidates.filter(
    (candidate) =>
      candidate.status === "needs_review" ||
      (candidate.entityType === "claim" && candidate.status === "pending"),
  );
  const processed = candidates.filter(
    (candidate) => !pending.includes(candidate) && candidate.status !== "applied",
  );
  const applied = candidates.filter((candidate) => candidate.status === "applied");
  const visiblePending = showAll ? pending : pending.slice(0, 40);
  const batchLabel = batches.find((batch) => batch.id === batchId)?.label;

  const fileFor = (candidate: ImportCandidate) => files.find((file) => file.id === candidate.fileId);
  const batchFor = (candidate: ImportCandidate) => batches.find((batch) => batch.id === candidate.batchId);
  const dealFor = (candidate: ImportCandidate) =>
    cases.find(
      (item) =>
        item.id === candidate.dealId ||
        item.id === candidate.proposedDealId ||
        item.id === String(candidate.payload.company_id ?? ""),
    );
  const investorFor = (candidate: ImportCandidate) =>
    investors.find((item) => item.id === candidate.investorId || item.id === candidate.proposedInvestorId);

  const act = async (
    candidate: ImportCandidate,
    action: "approve" | "reject" | "keep_separate",
    note = "",
  ) => {
    setBusyId(candidate.id);
    try {
      const result = await actions.reviewImportCandidate.mutateAsync({
        candidateId: candidate.id,
        reviewAction: action,
        note,
      });
      toast.success(
        result.status === "rejected"
          ? "Candidate rejected; nothing was merged."
          : action === "keep_separate"
            ? "Kept separate and applied as a new record."
            : "Approved and applied to the case file.",
      );
      setRejectingId(null);
      setRejectNote("");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not review this candidate.");
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const patch: Record<string, unknown> =
      editing.entityType === "deal"
        ? {
            name: form.name.trim(),
            website: form.website.trim(),
            sector: form.sector.trim(),
            stage: form.stage.trim(),
            geography: form.geography.trim(),
            summary: form.summary.trim(),
            target_raise: form.target_raise ? Number(form.target_raise) : null,
            cheque_sought: form.cheque_sought ? Number(form.cheque_sought) : null,
            thesis: form.thesis.trim(),
          }
        : editing.entityType === "investor"
          ? {
              name: form.name.trim(),
              website: form.website.trim(),
              investor_type: form.investor_type,
              stages: form.stages.split(",").map((item) => item.trim()).filter(Boolean),
              sectors: form.sectors.split(",").map((item) => item.trim()).filter(Boolean),
              geography: form.geography.split(",").map((item) => item.trim()).filter(Boolean),
              minimum_check: form.minimum_check ? Number(form.minimum_check) : null,
              maximum_check: form.maximum_check ? Number(form.maximum_check) : null,
              thesis: form.thesis.trim(),
              relationship: form.relationship,
            }
          : {
              label: form.label.trim(),
              value_text: form.value_text.trim(),
              reporting_period: form.reporting_period.trim(),
              claim_type: form.claim_type,
              verification_status: form.verification_status,
            };
    if (editing.entityType !== "claim" && !form.name.trim()) {
      toast.error("Give this record a name.");
      return;
    }
    if (editing.entityType === "claim" && (!form.label.trim() || !form.value_text.trim())) {
      toast.error("A claim needs a label and value.");
      return;
    }
    try {
      await actions.reviewImportCandidate.mutateAsync({
        candidateId: editing.id,
        reviewAction: "edit",
        patch,
        note: editNote,
      });
      toast.success("Edits saved. Review the record again before approving it.");
      setEditing(null);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save these edits.");
    }
  };

  const reviewsFor = (candidateId: string) =>
    reviews
      .filter((review) => review.candidateId === candidateId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const card = (candidate: ImportCandidate, isPending: boolean) => {
    const file = fileFor(candidate);
    const batch = batchFor(candidate);
    const proposedDeal = cases.find((item) => item.id === candidate.proposedDealId);
    const proposedInvestor = investors.find((item) => item.id === candidate.proposedInvestorId);
    const claimDeal = dealFor(candidate);
    const history = reviewsFor(candidate.id);

    return (
      <li key={candidate.id} className="panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill tone={candidate.entityType === "claim" ? "warning" : candidate.entityType === "deal" ? "brand" : "neutral"}>
                {candidate.entityType}
              </Pill>
              <h3 className="truncate text-[13.5px] font-semibold tracking-tight">{candidateName(candidate)}</h3>
              <Pill
                tone={
                  candidate.status === "applied"
                    ? "success"
                    : candidate.status === "rejected"
                      ? "danger"
                      : candidate.status === "kept_separate"
                        ? "brand"
                        : "warning"
                }
              >
                {CANDIDATE_STATUS_LABEL[candidate.status] ?? candidate.status}
              </Pill>
            </div>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              {batch?.label ?? "Import"} · <SourceLabel file={file} /> · {candidate.matchBasis || "no automatic match"}
            </p>
          </div>
          {isPending && canWrite ? (
            <div className="flex flex-wrap gap-1.5">
              <Button
                size="sm"
                className="h-7 gap-1 text-[11px]"
                disabled={busyId === candidate.id || (candidate.entityType !== "claim" && !candidate.proposedDealId && !candidate.proposedInvestorId)}
                onClick={() => void act(candidate, "approve", "")}
              >
                <Check className="h-3 w-3" aria-hidden="true" />
                {candidate.entityType === "claim" ? "Approve claim" : "Approve & link"}
              </Button>
              {candidate.entityType !== "claim" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  disabled={busyId === candidate.id}
                  onClick={() => void act(candidate, "keep_separate", "Kept separate by a human reviewer.")}
                >
                  <Split className="h-3 w-3" aria-hidden="true" />
                  Keep separate
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setEditing(candidate)}>
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px] text-muted-foreground"
                onClick={() => {
                  setRejectingId(candidate.id);
                  setRejectNote("");
                }}
              >
                <X className="h-3 w-3" aria-hidden="true" />
                Reject
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2 text-[11px] leading-relaxed sm:grid-cols-2">
          {candidate.entityType === "deal" ? (
            <>
              <div>
                <span className="text-muted-foreground">Proposed company: </span>
                <span className="font-medium">{proposedDeal?.companyName ?? "No existing match — keep separate to create a new case"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Stage / sector: </span>
                {String(candidate.payload.stage ?? "—")} · {String(candidate.payload.sector ?? "—")}
              </div>
              <div>
                <span className="text-muted-foreground">Geography: </span>
                {String(candidate.payload.geography ?? "—")}
              </div>
              <div>
                <span className="text-muted-foreground">Raise / cheque: </span>
                {candidate.payload.target_raise ? `$${Number(candidate.payload.target_raise).toLocaleString()}` : "—"} ·{" "}
                {candidate.payload.cheque_sought ? `$${Number(candidate.payload.cheque_sought).toLocaleString()}` : "—"}
              </div>
            </>
          ) : candidate.entityType === "investor" ? (
            <>
              <div>
                <span className="text-muted-foreground">Proposed investor: </span>
                <span className="font-medium">{proposedInvestor?.name ?? "No existing match — keep separate to create"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Type / relationship: </span>
                {String(candidate.payload.investor_type ?? "—")} · {String(candidate.payload.relationship ?? "—")}
              </div>
              <div className="sm:col-span-2">
                <span className="text-muted-foreground">Preferences: </span>
                {Array.isArray(candidate.payload.stages) ? candidate.payload.stages.join(", ") : "stages —"} ·{" "}
                {Array.isArray(candidate.payload.sectors) ? candidate.payload.sectors.join(", ") : "sectors —"} ·{" "}
                {Array.isArray(candidate.payload.geography) ? candidate.payload.geography.join(", ") : "geography —"}
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-muted-foreground">Company: </span>
                <span className="font-medium">{claimDeal?.companyName ?? "Unresolved company"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Value / period: </span>
                {String(candidate.payload.value_text ?? "—")} · {String(candidate.payload.reporting_period ?? "—")}
              </div>
              <div>
                <span className="text-muted-foreground">Verification: </span>
                {String(candidate.payload.verification_status ?? "founder_reported")}
              </div>
              <div>
                <span className="text-muted-foreground">Match: </span>
                {candidate.matchBasis || "claim from source excerpt"}
              </div>
            </>
          )}
        </div>

        {candidate.excerpt ? (
          <blockquote className="mt-3 border-l-2 border-brand/30 bg-secondary/20 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            “{candidate.excerpt}”
          </blockquote>
        ) : null}

        {candidate.conflictSummary ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-md border border-warning/25 bg-warning-soft px-2.5 py-1.5 text-[10.5px] leading-relaxed text-warning">
            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {candidate.conflictSummary}
          </p>
        ) : null}

        {rejectingId === candidate.id ? (
          <div className="mt-2 space-y-2 rounded-md border border-destructive/20 bg-danger-soft/50 p-2.5">
            <Textarea
              rows={2}
              value={rejectNote}
              onChange={(event) => setRejectNote(event.target.value)}
              placeholder="Why is this record rejected or kept out? This note is retained in the audit trail."
              className="bg-card text-[12px]"
              aria-label="Rejection note"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                className="h-7"
                disabled={!rejectNote.trim() || busyId === candidate.id}
                onClick={() => void act(candidate, "reject", rejectNote.trim())}
              >
                Confirm rejection
              </Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {history.length > 0 ? (
          <details className="mt-2 border-t border-border pt-2">
            <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
              Review audit · {history.length}
            </summary>
            <ul className="mt-1.5 space-y-1">
              {history.map((review) => (
                <li key={review.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[10px]">
                  <span className="text-muted-foreground">
                    {REVIEW_ACTION_LABEL[review.action] ?? review.action}
                    {review.note ? ` — ${review.note}` : ""}
                  </span>
                  <span className="text-muted-foreground/70">{formatShortDate(review.createdAt)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </li>
    );
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-[16px] font-semibold tracking-tight">Human review</h2>
          <p className="text-[11.5px] text-muted-foreground">
            Approve, edit, reject or keep separate. Ambiguous records are never merged automatically.
            {batchLabel ? ` Viewing ${batchLabel}.` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone={pending.length > 0 ? "warning" : "success"}>{pending.length} awaiting review</Pill>
          {pending.length > 40 ? (
            <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onShowAllChange(!showAll)}>
              {showAll ? "Show first 40" : "Show all"}
            </Button>
          ) : null}
        </div>
      </div>

      {visiblePending.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
          <p className="text-[13px] font-semibold">No records are waiting for review</p>
          <p className="mx-auto mt-1 max-w-lg text-[11.5px] leading-relaxed text-muted-foreground">
            Automatic exact/new links are applied immediately. Extracted claims and uncertain merges wait here for a
            human decision.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">{visiblePending.map((candidate) => card(candidate, true))}</ul>
      )}

      {processed.length > 0 || applied.length > 0 ? (
        <details className="panel p-4">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Processed records & audit trail · {processed.length + applied.length}
          </summary>
          <ul className="mt-3 space-y-2">
            {[...processed, ...applied].slice(0, 50).map((candidate) => (
              <li key={candidate.id} className="rounded-md border border-border bg-card px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="neutral">{candidate.entityType}</Pill>
                  <span className="text-[12px] font-medium">{candidateName(candidate)}</span>
                  <Pill tone={candidate.status === "applied" ? "success" : candidate.status === "rejected" ? "danger" : "brand"}>
                    {CANDIDATE_STATUS_LABEL[candidate.status] ?? candidate.status}
                  </Pill>
                  {candidate.appliedRecordId ? (
                    <span className="text-[9.5px] text-muted-foreground">applied record {candidate.appliedRecordId.slice(0, 8)}</span>
                  ) : null}
                </div>
                {candidate.reviewNote ? (
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{candidate.reviewNote}</p>
                ) : null}
                {reviewsFor(candidate.id).map((review) => (
                  <p key={review.id} className="mt-0.5 text-[9.5px] text-muted-foreground/80">
                    {REVIEW_ACTION_LABEL[review.action] ?? review.action} · {formatShortDate(review.createdAt)}
                  </p>
                ))}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit extracted {editing?.entityType ?? "record"}</DialogTitle>
            <DialogDescription>
              Changes are recorded in the audit trail. Editing does not approve the record; approve it separately.
            </DialogDescription>
          </DialogHeader>

          {editing?.entityType === "deal" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name" htmlFor="review-deal-name"><Input id="review-deal-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Website" htmlFor="review-deal-website"><Input id="review-deal-website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
              <Field label="Stage" htmlFor="review-deal-stage"><Input id="review-deal-stage" value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} /></Field>
              <Field label="Sector" htmlFor="review-deal-sector"><Input id="review-deal-sector" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} /></Field>
              <Field label="Geography" htmlFor="review-deal-geo"><Input id="review-deal-geo" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} /></Field>
              <Field label="Target raise (USD)" htmlFor="review-deal-raise"><Input id="review-deal-raise" inputMode="decimal" value={form.target_raise} onChange={(e) => setForm({ ...form, target_raise: e.target.value })} /></Field>
              <Field label="Cheque sought (USD)" htmlFor="review-deal-cheque"><Input id="review-deal-cheque" inputMode="decimal" value={form.cheque_sought} onChange={(e) => setForm({ ...form, cheque_sought: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Summary" htmlFor="review-deal-summary"><Textarea id="review-deal-summary" rows={2} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Thesis" htmlFor="review-deal-thesis" optional><Textarea id="review-deal-thesis" rows={2} value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} /></Field></div>
            </div>
          ) : editing?.entityType === "investor" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Investor name" htmlFor="review-inv-name"><Input id="review-inv-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
              <Field label="Website" htmlFor="review-inv-web"><Input id="review-inv-web" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
              <Field label="Type" htmlFor="review-inv-type"><SelectField id="review-inv-type" value={form.investor_type} onChange={(value) => setForm({ ...form, investor_type: value })} options={INVESTOR_TYPE_OPTIONS} /></Field>
              <Field label="Relationship" htmlFor="review-inv-rel"><SelectField id="review-inv-rel" value={form.relationship} onChange={(value) => setForm({ ...form, relationship: value })} options={RELATIONSHIP_OPTIONS} /></Field>
              <div className="sm:col-span-2"><Field label="Stages" htmlFor="review-inv-stages" hint="Comma separated"><Input id="review-inv-stages" value={form.stages} onChange={(e) => setForm({ ...form, stages: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Sectors" htmlFor="review-inv-sectors" hint="Comma separated"><Input id="review-inv-sectors" value={form.sectors} onChange={(e) => setForm({ ...form, sectors: e.target.value })} /></Field></div>
              <div className="sm:col-span-2"><Field label="Geography" htmlFor="review-inv-geo" hint="Comma separated"><Input id="review-inv-geo" value={form.geography} onChange={(e) => setForm({ ...form, geography: e.target.value })} /></Field></div>
              <Field label="Minimum cheque" htmlFor="review-inv-min"><Input id="review-inv-min" inputMode="decimal" value={form.minimum_check} onChange={(e) => setForm({ ...form, minimum_check: e.target.value })} /></Field>
              <Field label="Maximum cheque" htmlFor="review-inv-max"><Input id="review-inv-max" inputMode="decimal" value={form.maximum_check} onChange={(e) => setForm({ ...form, maximum_check: e.target.value })} /></Field>
              <div className="sm:col-span-2"><Field label="Thesis" htmlFor="review-inv-thesis"><Textarea id="review-inv-thesis" rows={3} value={form.thesis} onChange={(e) => setForm({ ...form, thesis: e.target.value })} /></Field></div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Claim label" htmlFor="review-claim-label"><Input id="review-claim-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field></div>
              <Field label="Value" htmlFor="review-claim-value"><Input id="review-claim-value" value={form.value_text} onChange={(e) => setForm({ ...form, value_text: e.target.value })} /></Field>
              <Field label="Reporting period" htmlFor="review-claim-period"><Input id="review-claim-period" value={form.reporting_period} onChange={(e) => setForm({ ...form, reporting_period: e.target.value })} /></Field>
              <Field label="Claim type" htmlFor="review-claim-type"><SelectField id="review-claim-type" value={form.claim_type} onChange={(value) => setForm({ ...form, claim_type: value })} options={CLAIM_TYPE_OPTIONS} /></Field>
              <Field label="Verification" htmlFor="review-claim-verification"><SelectField id="review-claim-verification" value={form.verification_status} onChange={(value) => setForm({ ...form, verification_status: value })} options={VERIFICATION_OPTIONS} /></Field>
            </div>
          )}

          <Field label="Review note" htmlFor="review-note" optional>
            <Textarea id="review-note" rows={2} value={editNote} onChange={(event) => setEditNote(event.target.value)} placeholder="Why did you change this value?" />
          </Field>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void saveEdit()}>Save edits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

import { ArrowRight, Briefcase, CalendarClock, Pencil, Waypoints } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaseStatusPill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { CASE_STATUS_LABEL, CASE_STATUS_OPTIONS } from "@/lib/constants";
import { dueLabel, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import type { CaseStatus } from "@/lib/types";
import { EvidenceSection } from "./evidence-section";
import { QuestionsSection } from "./questions-section";

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useWorkspace();
  const actions = useWorkspaceActions();
  const [editOpen, setEditOpen] = useState(false);

  const caseItem = data?.cases.find((item) => item.id === id);

  if (isLoading) {
    return (
      <div className="page-enter">
        <LoadingPanel rows={4} />
      </div>
    );
  }

  if (!caseItem) {
    return (
      <div className="page-enter">
        <PageHeader
          eyebrow="Investment cases"
          title="Case not found"
          description="This case is not in the workspace. It may have been opened from a stale link."
          actions={
            <Button asChild variant="outline">
              <Link to="/cases">Back to cases</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const evidence = (data?.evidence ?? []).filter((item) => item.caseId === caseItem.id);
  const questions = (data?.questions ?? []).filter((item) => item.caseId === caseItem.id);
  const capture = data?.captures.find((item) => item.id === caseItem.captureId);

  const handleStatus = async (status: string) => {
    try {
      await actions.updateCase.mutateAsync({ id: caseItem.id, patch: { status: status as CaseStatus } });
      toast.success(`Case moved to ${CASE_STATUS_LABEL[status as CaseStatus]}`);
    } catch {
      toast.error("Could not update the case status.");
    }
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow={`${caseItem.roundStage || "Round not set"} · ${caseItem.sector || "Sector not set"}`}
        title={caseItem.companyName}
        description={caseItem.oneLiner || "No one-liner recorded yet."}
        backTo={{ to: "/cases", label: "Investment Cases" }}
        actions={
          <>
            <div className="w-[168px]">
              <SelectField
                value={caseItem.status}
                onChange={handleStatus}
                options={CASE_STATUS_OPTIONS}
                ariaLabel="Case status"
              />
            </div>
            <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
            <Button asChild className="gap-1.5">
              <Link to={`/matches?case=${caseItem.id}`}>
                <Waypoints className="h-4 w-4" aria-hidden="true" />
                Find investors
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CaseStatusPill status={caseItem.status} label={CASE_STATUS_LABEL[caseItem.status]} />
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Briefcase className="h-3 w-3" aria-hidden="true" />
          {caseItem.geography || "Geography not set"}
        </span>
        {caseItem.nextStepDue ? (
          <span
            className={
              isOverdue(caseItem.nextStepDue)
                ? "inline-flex items-center gap-1.5 rounded-full border border-destructive/20 bg-danger-soft px-2.5 py-0.5 text-[11px] font-semibold text-destructive"
                : "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
            }
          >
            <CalendarClock className="h-3 w-3" aria-hidden="true" />
            {dueLabel(caseItem.nextStepDue)}
          </span>
        ) : null}
        {capture ? (
          <span className="text-[11px] text-muted-foreground">
            Opened from a {capture.source === "voice" ? "voice" : "typed"} capture on {formatDate(capture.createdAt)}
          </span>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="panel p-5" aria-labelledby="thesis-heading">
            <h2 id="thesis-heading" className="text-[15px] font-semibold tracking-tight">
              Investment thesis
            </h2>
            <p className="text-[11.5px] text-muted-foreground">Your own working view, written by the deal lead.</p>
            {caseItem.thesis ? (
              <p className="mt-3 whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/90">{caseItem.thesis}</p>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border px-3 py-5 text-center">
                <p className="text-[12px] text-muted-foreground">
                  No thesis recorded. Add it from Edit so the case file stands on its own.
                </p>
                <Button size="sm" variant="ghost" className="mt-1 text-brand-strong" onClick={() => setEditOpen(true)}>
                  Add thesis
                </Button>
              </div>
            )}
          </section>

          <EvidenceSection caseId={caseItem.id} items={evidence} />
          <QuestionsSection caseId={caseItem.id} items={questions} />
        </div>

        <aside className="space-y-4">
          <section className="panel p-5" aria-labelledby="round-heading">
            <h2 id="round-heading" className="text-[15px] font-semibold tracking-tight">
              Round mechanics
            </h2>
            <dl className="mt-3 space-y-2.5">
              {[
                { label: "Round", value: caseItem.roundStage || "Not set" },
                { label: "Round size", value: formatCurrency(caseItem.raiseAmount, { compact: false }) },
                { label: "Cheque sought", value: formatCurrency(caseItem.chequeSought, { compact: false }) },
                { label: "Pre-money", value: formatCurrency(caseItem.preMoneyValuation, { compact: false }) },
                { label: "Ownership target", value: caseItem.ownershipTarget ? `${caseItem.ownershipTarget}%` : "—" },
                { label: "Lead required", value: caseItem.leadRequired ? "Yes" : "No" },
                { label: "Lead partner", value: caseItem.leadPartner || "Unassigned" },
                { label: "Referred by", value: caseItem.referredBy || "—" },
              ].map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2 last:border-0 last:pb-0">
                  <dt className="text-[11.5px] text-muted-foreground">{row.label}</dt>
                  <dd className="text-right text-[12.5px] font-medium tabular-nums">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
              Cheque sought and round stage feed the deterministic matching rules.
            </p>
          </section>

          <section className="panel p-5" aria-labelledby="nextstep-heading">
            <div className="flex items-start justify-between gap-2">
              <h2 id="nextstep-heading" className="text-[15px] font-semibold tracking-tight">
                Next step
              </h2>
              <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11.5px]" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Edit
              </Button>
            </div>
            {caseItem.nextStep ? (
              <>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{caseItem.nextStep}</p>
                <p
                  className={
                    isOverdue(caseItem.nextStepDue)
                      ? "mt-1.5 text-[11px] font-semibold text-destructive"
                      : "mt-1.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {caseItem.nextStepDue ? dueLabel(caseItem.nextStepDue) : "No due date"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-muted-foreground">
                No next step recorded. Cases move faster when the next action is explicit.
              </p>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="record-heading">
            <h2 id="record-heading" className="text-[15px] font-semibold tracking-tight">
              Case record
            </h2>
            <dl className="mt-3 space-y-2 text-[11.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Opened</dt>
                <dd className="font-medium">{formatDate(caseItem.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd className="font-medium">{formatDate(caseItem.updatedAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Evidence</dt>
                <dd className="font-medium">{evidence.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Open questions</dt>
                <dd className="font-medium">{questions.filter((item) => item.status === "open").length}</dd>
              </div>
            </dl>
            <Link
              to={`/matches?case=${caseItem.id}`}
              className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
            >
              See ranked investor matches
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>

      <CaseForm open={editOpen} onOpenChange={setEditOpen} initial={caseItem} />
    </div>
  );
};

export default CaseDetail;

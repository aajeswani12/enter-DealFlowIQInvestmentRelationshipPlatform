import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleHelp,
  ClipboardCheck,
  FileSearch,
  ListChecks,
  Search,
  Send,
  Sparkles,
  Waypoints,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { StatCard } from "@/components/common/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { dueLabel, formatShortDate, isOverdue } from "@/lib/format";
import type { GapSeverity, InvestmentCase } from "@/lib/types";

const SEVERITY_TONE: Record<GapSeverity, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};

interface ReadinessItem {
  label: string;
  passed: boolean;
  detail: string;
}

function readinessFor(
  item: InvestmentCase,
  approvedClaims: number,
  draftClaims: number,
  openGaps: number,
  openTasks: number,
  matchCount: number,
): ReadinessItem[] {
  return [
    {
      label: "Company profile",
      passed: Boolean(item.companyName && item.summary && item.sector && item.roundStage),
      detail: "Name, description, sector and stage",
    },
    {
      label: "Funding case",
      passed: Boolean(item.raiseAmount || item.chequeSought),
      detail: "Round size or cheque sought",
    },
    {
      label: "Reviewed evidence",
      passed: approvedClaims > 0,
      detail: `${approvedClaims} approved claim${approvedClaims === 1 ? "" : "s"}`,
    },
    {
      label: "Diligence gaps",
      passed: openGaps === 0,
      detail: openGaps === 0 ? "No open gaps" : `${openGaps} unresolved`,
    },
    {
      label: "Next action",
      passed: Boolean(item.nextStep || openTasks > 0),
      detail: openTasks > 0 ? `${openTasks} open task${openTasks === 1 ? "" : "s"}` : item.nextStep || "Not recorded",
    },
    {
      label: "Investor view",
      passed: matchCount > 0,
      detail: matchCount > 0 ? `${matchCount} saved match${matchCount === 1 ? "" : "es"}` : "No saved matches",
    },
    {
      label: "Human review",
      passed: draftClaims === 0,
      detail: draftClaims === 0 ? "No draft claims" : `${draftClaims} draft claim${draftClaims === 1 ? "" : "s"}`,
    },
  ];
}

export default function DecisionCenter() {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [query, setQuery] = useState("");

  const pendingClaims = workspace.claims.filter((claim) => claim.reviewStatus === "draft");
  const pendingImports = workspace.importCandidates.filter(
    (candidate) =>
      candidate.status === "needs_review" ||
      (candidate.entityType === "claim" && candidate.status === "pending"),
  );
  const openGaps = workspace.gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review");
  const openTasks = workspace.followUpTasks.filter((task) => task.status === "open");
  const draftOutreach = workspace.outreach.filter((outreach) => outreach.status === "draft");
  const approvedOutreach = workspace.outreach.filter((outreach) => outreach.status === "approved");
  const dueTasks = openTasks.filter((task) => task.dueDate && isOverdue(task.dueDate));
  const openCaseCount = workspace.cases.filter((item) => !["passed", "invested"].includes(item.status)).length;

  const cases = useMemo(() => {
    const search = query.trim().toLowerCase();
    return workspace.cases
      .filter((item) => !search || item.companyName.toLowerCase().includes(search))
      .map((item) => {
        const approvedClaims = workspace.claims.filter(
          (claim) => claim.dealId === item.id && claim.reviewStatus === "approved",
        ).length;
        const draftClaims = workspace.claims.filter(
          (claim) => claim.dealId === item.id && claim.reviewStatus === "draft",
        ).length;
        const caseGaps = openGaps.filter((gap) => gap.dealId === item.id).length;
        const caseTasks = openTasks.filter((task) => task.dealId === item.id).length;
        const matchCount = workspace.matches.filter((match) => match.dealId === item.id).length;
        const checklist = readinessFor(item, approvedClaims, draftClaims, caseGaps, caseTasks, matchCount);
        return {
          item,
          approvedClaims,
          draftClaims,
          caseGaps,
          caseTasks,
          matchCount,
          checklist,
          passed: checklist.filter((row) => row.passed).length,
        };
      })
      .sort((a, b) => a.passed - b.passed || new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime());
  }, [workspace, query, openGaps, openTasks]);

  const caseName = (dealId: string | null) =>
    workspace.cases.find((item) => item.id === dealId)?.companyName ?? "Unknown case";
  const batchName = (batchId: string) =>
    workspace.importBatches.find((batch) => batch.id === batchId)?.label ?? "Import batch";
  const investorName = (investorId: string | null) =>
    workspace.investors.find((investor) => investor.id === investorId)?.name ?? "Investor";
  const memberName = (userId: string | null) => {
    const member = workspace.members.find((item) => item.userId === userId);
    return member?.displayName || member?.email || "Unassigned";
  };
  const nextCaseSteps = workspace.cases
    .filter((item) => item.nextStep)
    .map((item) => ({
      id: `case-${item.id}`,
      caseId: item.id,
      company: item.companyName,
      title: item.nextStep,
      due: item.nextStepDue,
      source: "Case next step",
    }))
    .filter((item) => !openTasks.some((task) => task.dealId === item.caseId && task.title === item.title));

  return (
    <div className="page-enter space-y-6">
      <PageHeader
        title="Tasks & Outreach"
        actions={
          <>
            <Link
              to="/imports"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[12px] font-medium hover:bg-secondary"
            >
              <FileSearch className="h-4 w-4" aria-hidden="true" />
              Import evidence
            </Link>
            <Link
              to="/inbox/capture"
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Record Voice Note
            </Link>
          </>
        }
      />

      {isLoading ? <LoadingPanel rows={3} /> : null}
      <div className={isLoading ? "hidden" : "grid gap-4 xl:grid-cols-2"}>
        <section className="panel p-4 sm:p-5" aria-labelledby="review-heading">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="review-heading" className="text-[21px] font-semibold tracking-tight">Human review queue</h2>
            </div>
            <Pill tone={pendingClaims.length + pendingImports.length + draftOutreach.length > 0 ? "warning" : "success"}>
              {pendingClaims.length + pendingImports.length + draftOutreach.length} pending
            </Pill>
          </div>

          <ul className="mt-3 space-y-2">
            {pendingClaims.slice(0, 4).map((claim) => (
              <li key={claim.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="warning">Draft claim</Pill>
                  <span className="text-[12px] font-medium">{claim.label}</span>
                  <span className="text-[11px] text-muted-foreground">{claim.valueText}{claim.reportingPeriod ? ` · ${claim.reportingPeriod}` : ""}</span>
                  <Link to={`/cases/${claim.dealId}#claims-heading`} className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                    Review
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {caseName(claim.dealId)} · {claim.supportingExcerpt || "No excerpt recorded"}
                </p>
              </li>
            ))}
            {pendingImports.slice(0, 3).map((candidate) => (
              <li key={candidate.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="warning">{candidate.entityType === "claim" ? "Imported claim" : "Ambiguous match"}</Pill>
                  <span className="text-[12px] font-medium">
                    {String(candidate.payload.name ?? candidate.payload.label ?? "Imported record")}
                  </span>
                  <Link to="/imports" className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                    Review
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{batchName(candidate.batchId)} · {candidate.matchBasis || "needs confirmation"}</p>
              </li>
            ))}
            {draftOutreach.slice(0, 2).map((outreach) => (
              <li key={outreach.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="neutral">Outreach draft</Pill>
                  <span className="text-[12px] font-medium">{outreach.subject || "Untitled introduction"}</span>
                  <Link to="/matches?tab=outreach" className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                    Review
                  </Link>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  {caseName(outreach.dealId)} · {investorName(outreach.investorId)} · never sent automatically
                </p>
              </li>
            ))}
            {pendingClaims.length === 0 && pendingImports.length === 0 && draftOutreach.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                No pending human reviews. Reviewed facts and saved decisions remain in the case history.
              </li>
            ) : null}
          </ul>
        </section>

        <section className="panel p-4 sm:p-5" aria-labelledby="actions-heading">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="actions-heading" className="text-[21px] font-semibold tracking-tight">Unknowns & next actions</h2>
            </div>
            <Pill tone={openGaps.length + openTasks.length > 0 ? "warning" : "success"}>
              {openGaps.length + openTasks.length} open
            </Pill>
          </div>

          <ul className="mt-3 space-y-2">
            {[...openGaps]
              .sort((a, b) => (b.severity === "critical" ? 3 : b.severity === "high" ? 2 : b.severity === "medium" ? 1 : 0) - (a.severity === "critical" ? 3 : a.severity === "high" ? 2 : a.severity === "medium" ? 1 : 0))
              .slice(0, 4)
              .map((gap) => (
                <li key={gap.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone={SEVERITY_TONE[gap.severity]}>{gap.severity}</Pill>
                    <span className="text-[11.5px] font-medium">{caseName(gap.dealId)}</span>
                    <Link to={`/cases/${gap.dealId}#gaps-heading`} className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                      Open gap
                    </Link>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{gap.question}</p>
                  {gap.suggestedAction ? <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground/80">Next: {gap.suggestedAction}</p> : null}
                </li>
              ))}
            {openTasks.slice(0, 3).map((task) => (
              <li key={task.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={task.dueDate && isOverdue(task.dueDate) ? "danger" : "warning"}>Task</Pill>
                  <span className="text-[11.5px] font-medium">{task.title}</span>
                  <span className="text-[10px] text-muted-foreground">{task.dueDate ? dueLabel(task.dueDate) : formatShortDate(task.createdAt)}</span>
                  <Link to={`/cases/${task.dealId}`} className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                    {caseName(task.dealId)}
                  </Link>
                </div>
                {task.detail ? <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{task.detail}</p> : null}
              </li>
            ))}
            {nextCaseSteps.slice(0, 2).map((step) => (
              <li key={step.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone="neutral">Case next step</Pill>
                  <span className="text-[11.5px] font-medium">{step.company}</span>
                  <span className="text-[10px] text-muted-foreground">{step.due ? dueLabel(step.due) : "No due date"}</span>
                  <Link to={`/cases/${step.caseId}`} className="ml-auto text-[10px] font-medium text-brand-strong hover:underline">
                    Open
                  </Link>
                </div>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">{step.title}</p>
              </li>
            ))}
            {openGaps.length === 0 && openTasks.length === 0 && nextCaseSteps.length === 0 ? (
              <li className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                No open unknowns or actions are recorded. Absence of gaps is not an investment decision.
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </div>
  );
}

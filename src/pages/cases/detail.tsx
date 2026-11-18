import { ArrowRight, Briefcase, CalendarClock, ExternalLink, Pencil, Waypoints } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaseStatusPill, Pill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { CASE_STATUS_LABEL, CASE_STATUS_OPTIONS } from "@/lib/constants";
import { dueLabel, formatCurrency, formatDate, isOverdue } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { CaseStatus } from "@/lib/types";
import { AnalysisSection } from "./analysis-section";
import { ClaimsSection } from "./claims-section";
import { DecisionGapsSection } from "./gaps-section";
import { EvidenceTimeline } from "./evidence-timeline";
import { FollowUpTasks } from "./follow-up-tasks";

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const [editOpen, setEditOpen] = useState(false);
  const [personOpen, setPersonOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personTitle, setPersonTitle] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState<"founder" | "contact" | "other">("founder");

  const caseItem = workspace.cases.find((item) => item.id === id);

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
          title="Deal not found"
          description="This deal is not in the workspace. It may have been opened from a stale link."
          actions={
            <Button asChild variant="outline">
              <Link to="/cases">Back to cases</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const claims = workspace.claims.filter((item) => item.dealId === caseItem.id);
  const gaps = workspace.gaps.filter((item) => item.dealId === caseItem.id);
  const sources = workspace.captures.filter((item) => item.dealId === caseItem.id);
  const source = sources[0];
  const analysisRuns = workspace.analysisRuns.filter((item) => item.dealId === caseItem.id);
  const briefs = workspace.briefs.filter((item) => item.dealId === caseItem.id);
  const caseDocuments = workspace.caseDocuments.filter((item) => item.dealId === caseItem.id);
  const followUpTasks = workspace.followUpTasks.filter((item) => item.dealId === caseItem.id);
  const caseOwner = workspace.members.find((member) => member.userId === caseItem.ownerUserId);
  const people = workspace.dealPeople.filter((person) => person.dealId === caseItem.id);
  const founderNames = [
    ...people.map((person) => person.name).filter(Boolean),
    ...sources.map((capture) => capture.founderName || capture.founderEmail).filter(Boolean),
    ...claims
      .filter((claim) => claim.claimType === "founder")
      .map((claim) => claim.valueText || claim.label)
      .filter(Boolean),
  ].filter((value, index, all) => all.indexOf(value) === index);
  const knownInvestors = [
    ...new Set(
      workspace.matches
        .filter((match) => match.dealId === caseItem.id)
        .map((match) => workspace.investors.find((investor) => investor.id === match.investorId)?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const draftClaimCount = claims.filter((claim) => claim.reviewStatus === "draft").length;
  const pendingImportCount = workspace.importCandidates.filter(
    (candidate) =>
      (candidate.dealId === caseItem.id || candidate.proposedDealId === caseItem.id) &&
      (candidate.status === "needs_review" ||
        (candidate.entityType === "claim" && candidate.status === "pending")),
  ).length;
  const openTaskCount = followUpTasks.filter((task) => task.status === "open").length;
  const openGaps = gaps.filter((item) => item.status === "open" || item.status === "needs_review");

  const handleAddPerson = async () => {
    if (!personName.trim()) {
      toast.error("A person needs a name.");
      return;
    }
    try {
      await actions.createDealPerson.mutateAsync({
        dealId: caseItem.id,
        input: { name: personName, title: personTitle, email: personEmail, role: personRole },
      });
      toast.success("Person added to the case memory");
      setPersonName("");
      setPersonTitle("");
      setPersonEmail("");
      setPersonRole("founder");
      setPersonOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add this person.");
    }
  };

  const handleStatus = async (status: string) => {
    try {
      await actions.updateCase.mutateAsync({ id: caseItem.id, patch: { status: status as CaseStatus } });
      toast.success(`Deal moved to ${CASE_STATUS_LABEL[status as CaseStatus]}`);
    } catch {
      toast.error("Could not update the deal status.");
    }
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow={`${caseItem.roundStage || "Round not set"} · ${caseItem.sector || "Sector not set"}`}
        title={caseItem.companyName}
        description={caseItem.summary || "No summary recorded yet."}
        backTo={{ to: "/cases", label: "Investment Cases" }}
        actions={
          <>
            <div className="w-[168px]">
              <SelectField
                value={caseItem.status}
                onChange={handleStatus}
                options={CASE_STATUS_OPTIONS}
                ariaLabel="Deal status"
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
        {caseItem.isSynthetic ? <Pill tone="warning">Synthetic sample — not a live deal</Pill> : null}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Briefcase className="h-3 w-3" aria-hidden="true" />
          {caseItem.geography || "Geography not set"}
        </span>
        {caseItem.website ? (
          <a
            href={caseItem.website.startsWith("http") ? caseItem.website : `https://${caseItem.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-brand-strong hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            Website
          </a>
        ) : null}
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
        {source ? (
          <span className="text-[11px] text-muted-foreground">
            Sourced from a {source.source === "voice" ? "voice" : "typed"} note on {formatDate(source.sourceDate)}
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
                  No thesis recorded. Add it from Edit so the deal file stands on its own.
                </p>
                <Button size="sm" variant="ghost" className="mt-1 text-brand-strong" onClick={() => setEditOpen(true)}>
                  Add thesis
                </Button>
              </div>
            )}
          </section>

          <EvidenceTimeline
            documents={caseDocuments}
            captures={sources}
            batches={workspace.importBatches}
            interactions={workspace.interactions.filter((interaction) => interaction.dealId === caseItem.id)}
            investors={workspace.investors}
          />
          <FollowUpTasks tasks={followUpTasks} />
          <AnalysisSection deal={caseItem} sources={sources} runs={analysisRuns} briefs={briefs} />
          <ClaimsSection dealId={caseItem.id} items={claims} />
          <DecisionGapsSection dealId={caseItem.id} items={gaps} />
        </div>

        <aside className="space-y-4">
          <section className="panel p-5" aria-labelledby="round-heading">
            <h2 id="round-heading" className="text-[15px] font-semibold tracking-tight">
              Round mechanics
            </h2>
            <dl className="mt-3 space-y-2.5">
              {[
                { label: "Stage", value: caseItem.roundStage || "Not set" },
                { label: "Target raise", value: formatCurrency(caseItem.raiseAmount, { compact: false }) },
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
              Cheque sought and stage feed the deterministic matching rules.
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
                No next step recorded. Deals move faster when the next action is explicit.
              </p>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="memory-heading">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 id="memory-heading" className="text-[15px] font-semibold tracking-tight">
                  Case memory
                </h2>
                <p className="text-[11.5px] text-muted-foreground">
                  Persistent people, relationships, reviews and actions around this company.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setPersonOpen((open) => !open)}>
                  Add person
                </Button>
                <Link to="/decision" className="text-[10px] font-medium text-brand-strong hover:underline">
                  Decision Center
                </Link>
              </div>
            </div>
            <dl className="mt-3 space-y-2 text-[11.5px]">
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Case owner</dt>
                <dd className="text-right font-medium">{caseOwner?.displayName || caseOwner?.email || "Unassigned"}</dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Founders / contacts</dt>
                <dd className="max-w-[210px] text-right font-medium">
                  {founderNames.length > 0 ? founderNames.join(", ") : "Not recorded"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Known investors</dt>
                <dd className="max-w-[210px] text-right font-medium">
                  {knownInvestors.length > 0 ? knownInvestors.slice(0, 3).join(", ") : "No saved matches"}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-b border-border/60 pb-2">
                <dt className="text-muted-foreground">Pending approvals</dt>
                <dd className="text-right font-medium">
                  <a href="#claims-heading" className="text-brand-strong hover:underline">
                    {draftClaimCount} claims
                  </a>
                  {" · "}
                  <Link to="/imports" className="text-brand-strong hover:underline">
                    {pendingImportCount} imports
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Open tasks</dt>
                <dd className="text-right font-medium">{openTaskCount}</dd>
              </div>
            </dl>
            {personOpen ? (
              <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/30 p-2.5">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Name" className="h-9 bg-card text-[12px]" aria-label="Person name" />
                  <Input value={personTitle} onChange={(event) => setPersonTitle(event.target.value)} placeholder="Title" className="h-9 bg-card text-[12px]" aria-label="Person title" />
                  <Input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email (optional)" className="h-9 bg-card text-[12px]" aria-label="Person email" />
                  <SelectField
                    value={personRole}
                    onChange={(value) => setPersonRole(value as "founder" | "contact" | "other")}
                    options={[
                      { value: "founder", label: "Founder" },
                      { value: "contact", label: "Contact" },
                      { value: "other", label: "Other" },
                    ]}
                    ariaLabel="Person role"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10.5px]" onClick={() => void handleAddPerson()} disabled={actions.createDealPerson.isPending}>
                    Save person
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10.5px]" onClick={() => setPersonOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
            {people.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {people.map((person) => (
                  <li key={person.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[10.5px]">
                    <span className="font-medium">{person.name}{person.title ? ` · ${person.title}` : ""}</span>
                    <span className="text-muted-foreground">{person.email || person.role}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              Last case update {formatDate(caseItem.updatedAt)}. Reviewed facts remain distinct from drafts and source
              excerpts.
            </p>
          </section>

          <section className="panel p-5" aria-labelledby="record-heading">
            <h2 id="record-heading" className="text-[15px] font-semibold tracking-tight">
              Deal record
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
                <dt className="text-muted-foreground">Claims</dt>
                <dd className="font-medium">{claims.length}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Open gaps</dt>
                <dd className="font-medium">{openGaps.length}</dd>
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

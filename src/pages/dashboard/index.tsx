import {
  ArrowRight,
  Briefcase,
  CircleAlert,
  CircleHelp,
  Clock3,
  Inbox,
  Mic,
  PenLine,
  Plus,
  Send,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel, StatGridSkeleton } from "@/components/common/loading-panel";
import { StatCard } from "@/components/common/stat-card";
import { CaptureStatusPill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { ACTIVE_CASE_STATUSES, CASE_STATUS_LABEL, CASE_STATUS_OPTIONS } from "@/lib/constants";
import { dueLabel, isOverdue, pluralize, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [caseFormOpen, setCaseFormOpen] = useState(false);

  const activeCases = workspace.cases.filter((item) => ACTIVE_CASE_STATUSES.includes(item.status));
  const openGaps = workspace.gaps.filter((item) => item.status === "open");
  const pendingOutreach = workspace.outreach.filter((item) => item.status === "draft");

  const nextSteps = useMemo(() => {
    const caseSteps = workspace.cases
      .filter((item) => item.nextStep && item.nextStepDue)
      .map((item) => ({
        id: `case-${item.id}`,
        name: item.companyName,
        step: item.nextStep,
        due: item.nextStepDue as string,
        to: `/cases/${item.id}`,
        kind: "Deal",
      }));
    const investorSteps = workspace.investors
      .filter((item) => item.nextStep && item.nextStepDue)
      .map((item) => ({
        id: `inv-${item.id}`,
        name: item.name,
        step: item.nextStep,
        due: item.nextStepDue as string,
        to: `/investors/${item.id}`,
        kind: "Investor",
      }));
    return [...caseSteps, ...investorSteps]
      .sort((a, b) => new Date(a.due).getTime() - new Date(b.due).getTime())
      .slice(0, 5);
  }, [workspace.cases, workspace.investors]);

  const overdueCount = [...workspace.cases, ...workspace.investors].filter((item) =>
    isOverdue(item.nextStepDue),
  ).length;

  const pipeline = CASE_STATUS_OPTIONS.map((option) => ({
    ...option,
    count: workspace.cases.filter((item) => item.status === option.value).length,
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((item) => item.count));

  const recentCaptures = [...workspace.captures]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const gapsWithCase = openGaps
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3)
    .map((gap) => ({
      ...gap,
      company: workspace.cases.find((item) => item.id === gap.dealId)?.companyName ?? "Unlinked deal",
    }));

  const emptyWorkspace =
    workspace.cases.length === 0 && workspace.captures.length === 0 && workspace.investors.length === 0;

  const today = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <div className="page-enter space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Deal desk overview"
        description={`${today} · Every figure below is counted from records your team entered.`}
        actions={
          <>
            <Button asChild className="gap-1.5">
              <Link to="/inbox/capture">
                <Mic className="h-4 w-4" aria-hidden="true" />
                Record update
              </Link>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setCaseFormOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Open a case
            </Button>
          </>
        }
      />

      {isLoading ? (
        <StatGridSkeleton />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Active cases"
            value={activeCases.length}
            hint="Sourcing, diligence, IC review and term sheet."
            icon={Briefcase}
            to="/cases"
          />
          <StatCard
            label="Open decision gaps"
            value={openGaps.length}
            hint="Unresolved gaps recorded across every deal file."
            icon={CircleHelp}
            to="/cases"
          />
          <StatCard
            label="Investor records"
            value={workspace.investors.length}
            hint="Manually maintained network with recorded preferences."
            icon={Users}
            to="/investors"
          />
          <StatCard
            label="Awaiting approval"
            value={pendingOutreach.length}
            hint="Outreach drafts a human still has to approve."
            icon={Send}
            to="/matches?tab=outreach"
          />
        </div>
      )}

      {isLoading ? (
        <LoadingPanel rows={2} className="grid gap-4 lg:grid-cols-3" />
      ) : emptyWorkspace ? (
        <section className="panel grain p-6 sm:p-8">
          <div className="max-w-xl space-y-2">
            <p className="label-caps">Start here</p>
            <h2 className="font-display text-2xl tracking-tight">The desk is empty, and that is accurate.</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              DealFlow IQ only shows what your team records. Capture a first update, then promote it into a case and add
              the investors you would want around the table.
            </p>
          </div>
          <ol className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              { step: "01", title: "Capture", body: "Record a voice note after a meeting, or type the update.", to: "/inbox", icon: Mic },
              { step: "02", title: "Open a case", body: "Promote the update into a persistent case file.", to: "/cases", icon: Briefcase },
              { step: "03", title: "Match and reach out", body: "Add investor preferences, then draft outreach by hand.", to: "/investors", icon: Users },
            ].map((item) => (
              <li key={item.step}>
                <Link
                  to={item.to}
                  className="flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand/40"
                >
                  <div className="flex items-center justify-between">
                    <item.icon className="h-4 w-4 text-brand" aria-hidden="true" />
                    <span className="font-display text-lg text-muted-foreground/60">{item.step}</span>
                  </div>
                  <p className="text-[13px] font-semibold">{item.title}</p>
                  <p className="text-[11.5px] leading-relaxed text-muted-foreground">{item.body}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="panel p-5 lg:col-span-2" aria-labelledby="pipeline-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="pipeline-heading" className="text-[15px] font-semibold tracking-tight">
                  Case pipeline
                </h2>
                <p className="text-[11.5px] text-muted-foreground">
                  {workspace.cases.length === 0
                    ? "No investment cases yet."
                    : `${pluralize(workspace.cases.length, "case")} on file · ${activeCases.length} active`}
                </p>
              </div>
              <Link
                to="/cases"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
              >
                All cases
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-4 space-y-2.5">
              {pipeline.map((item) => (
                <li key={item.value} className="grid grid-cols-[92px_1fr_28px] items-center gap-3">
                  <span className="text-[12px] font-medium text-muted-foreground">{item.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-secondary">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        item.value === "passed" ? "bg-muted-foreground/40" : "bg-brand",
                      )}
                      style={{ width: `${(item.count / pipelineMax) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-[12px] font-semibold tabular-nums">{item.count}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <p className="label-caps">Case next steps</p>
                {overdueCount > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                    <CircleAlert className="h-3 w-3" aria-hidden="true" />
                    {pluralize(overdueCount, "item")} overdue
                  </span>
                ) : null}
              </div>
              {workspace.cases.filter((item) => item.nextStep).length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  No next steps recorded on cases yet. Open a case to add one.
                </p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {workspace.cases
                    .filter((item) => item.nextStep)
                    .slice(0, 4)
                    .map((item) => (
                      <li key={item.id}>
                        <Link
                          to={`/cases/${item.id}`}
                          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-[12.5px] hover:text-brand-strong"
                        >
                          <span className="font-medium">{item.companyName}</span>
                          <span className="text-muted-foreground">{item.nextStep}</span>
                          <span
                            className={cn(
                              "text-[11px] font-medium",
                              isOverdue(item.nextStepDue) ? "text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {item.nextStepDue ? dueLabel(item.nextStepDue) : "No due date"}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>

          <section className="panel p-5" aria-labelledby="attention-heading">
            <div className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 text-brand" aria-hidden="true" />
              <div>
                <h2 id="attention-heading" className="text-[15px] font-semibold tracking-tight">
                  Needs attention
                </h2>
                <p className="text-[11.5px] text-muted-foreground">Dated next steps across cases and investors.</p>
              </div>
            </div>

            {nextSteps.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center">
                <p className="text-[12.5px] font-medium">Nothing scheduled</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
                  Add a next step and due date on a case or investor record to see it here.
                </p>
              </div>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {nextSteps.map((item) => (
                  <li key={item.id}>
                    <Link
                      to={item.to}
                      className="block rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-brand/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {item.kind}
                        </span>
                        <span
                          className={cn(
                            "text-[10.5px] font-semibold",
                            isOverdue(item.due) ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {dueLabel(item.due)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium">{item.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                        {item.step}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 border-t border-border pt-3">
              <p className="label-caps">Outstanding decision gaps</p>
              {gapsWithCase.length === 0 ? (
                <p className="mt-2 text-[12px] text-muted-foreground">No open decision gaps on any deal.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {gapsWithCase.map((gap) => (
                    <li key={gap.id}>
                      <Link to={`/cases/${gap.dealId}`} className="group block">
                        <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground group-hover:text-brand-strong">
                          {gap.question}
                        </p>
                        <p className="mt-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                          {gap.company}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {!isLoading && !emptyWorkspace ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="panel p-5" aria-labelledby="captures-heading">
            <div className="flex items-center justify-between">
              <h2 id="captures-heading" className="text-[15px] font-semibold tracking-tight">
                Latest captures
              </h2>
              <Link
                to="/inbox"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
              >
                Deal Inbox
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            {recentCaptures.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No captures yet"
                description="Voice and typed updates land here for triage."
                compact
                className="mt-4"
                action={
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to="/inbox/capture">
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                      Record one
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {recentCaptures.map((capture) => (
                  <li key={capture.id} className="py-3 first:pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {capture.source === "voice" ? (
                          <Mic className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                        ) : (
                          <PenLine className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <p className="truncate text-[13px] font-medium">{capture.companyName}</p>
                      </div>
                      <CaptureStatusPill
                        status={capture.status}
                        label={capture.status === "new" ? "New" : capture.status === "reviewing" ? "Reviewing" : capture.status === "promoted" ? "Promoted" : "Archived"}
                      />
                    </div>
                    {capture.notes ? (
                      <p className="mt-1 line-clamp-2 pl-5 text-[11.5px] leading-relaxed text-muted-foreground">
                        {capture.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 pl-5 text-[10.5px] text-muted-foreground/80">
                      {relativeDays(capture.createdAt)}
                      {capture.founderName ? ` · ${capture.founderName}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="case-list-heading">
            <div className="flex items-center justify-between">
              <h2 id="case-list-heading" className="text-[15px] font-semibold tracking-tight">
                Recently updated cases
              </h2>
              <Link
                to="/cases"
                className="inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
              >
                All cases
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            </div>
            {workspace.cases.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No investment cases"
                description="Promote a capture, or open a case directly."
                compact
                className="mt-4"
                action={
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCaseFormOpen(true)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Open a case
                  </Button>
                }
              />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {[...workspace.cases]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice(0, 4)
                  .map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/cases/${item.id}`}
                        className="group flex items-baseline justify-between gap-3 py-2.5 first:pt-1"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium group-hover:text-brand-strong">
                            {item.companyName}
                          </p>
                          <p className="truncate text-[11.5px] text-muted-foreground">
                            {item.roundStage || "Round not set"} · {item.sector || "Sector not set"}
                            {item.isSynthetic ? " · Synthetic sample" : ""}
                          </p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                          {CASE_STATUS_LABEL[item.status]}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      <CaseForm open={caseFormOpen} onOpenChange={setCaseFormOpen} />
    </div>
  );
};

export default Dashboard;

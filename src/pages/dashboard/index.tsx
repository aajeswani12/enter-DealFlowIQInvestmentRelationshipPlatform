import {
  ArrowRight,
  Briefcase,
  CalendarClock,
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
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel, StatGridSkeleton } from "@/components/common/loading-panel";
import { StatCard } from "@/components/common/stat-card";
import { CaptureStatusPill, Pill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { ACTIVE_CASE_STATUSES, CASE_STATUS_LABEL } from "@/lib/constants";
import { buildFollowUpBuckets, buildStageCounts } from "@/lib/insights";
import { dueLabel, formatShortDate, isOverdue, pluralize, relativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

const Dashboard = () => {
  const { data, isLoading, isError } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [caseFormOpen, setCaseFormOpen] = useState(false);

  const activeCases = workspace.cases.filter((item) => ACTIVE_CASE_STATUSES.includes(item.status));
  const openGaps = workspace.gaps.filter((item) => item.status === "open" || item.status === "needs_review");
  const pendingOutreach = workspace.outreach.filter((item) => item.status === "draft");
  const followUpBuckets = buildFollowUpBuckets(workspace.followUpTasks, new Date(), 7);
  const followUpChart = [
    { name: "Overdue", count: followUpBuckets.overdue, color: "hsl(var(--destructive))" },
    { name: "Due soon", count: followUpBuckets.dueSoon, color: "hsl(var(--warning))" },
    { name: "Completed", count: followUpBuckets.completed, color: "hsl(var(--success))" },
  ];
  const followUpChartTotal = followUpBuckets.overdue + followUpBuckets.dueSoon + followUpBuckets.completed;
  const followUpSummary = `Overdue ${followUpBuckets.overdue}, due soon ${followUpBuckets.dueSoon}, completed ${followUpBuckets.completed}`;

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

  const pipeline = buildStageCounts(workspace.cases);
  const pipelineMax = Math.max(1, ...pipeline.map((item) => item.count));

  const sourceTimeline = [
    ...workspace.captures.map((capture) => ({
      id: `capture-${capture.id}`,
      date: capture.sourceDate,
      title: capture.companyName || (capture.source === "voice" ? "Voice note" : "Note"),
      detail: capture.source === "voice" ? "Voice note" : "Typed note",
      caseId: capture.dealId,
      to: capture.dealId ? `/cases/${capture.dealId}#timeline` : `/inbox#source-${capture.id}`,
    })),
    ...workspace.caseDocuments.map((document) => ({
      id: `document-${document.id}`,
      date: document.sourceDate,
      title: document.title,
      detail: `${document.documentType.toUpperCase()} document`,
      caseId: document.dealId,
      to: `/cases/${document.dealId}#timeline`,
    })),
    ...workspace.interactions
      .filter((interaction) => interaction.dealId)
      .map((interaction) => ({
        id: `interaction-${interaction.id}`,
        date: interaction.occurredAt,
        title: workspace.investors.find((investor) => investor.id === interaction.investorId)?.name || "Investor interaction",
        detail: `${interaction.kind} interaction`,
        caseId: interaction.dealId,
        to: `/cases/${interaction.dealId}#timeline`,
      })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const readinessRows = workspace.cases
    .map((item) => {
      const approvedClaims = workspace.claims.filter(
        (claim) => claim.dealId === item.id && claim.reviewStatus === "approved" && !claim.supersededBy,
      ).length;
      const draftClaims = workspace.claims.filter(
        (claim) => claim.dealId === item.id && claim.reviewStatus === "draft",
      ).length;
      const caseGaps = workspace.gaps.filter(
        (gap) => gap.dealId === item.id && (gap.status === "open" || gap.status === "needs_review"),
      ).length;
      const sourceCount =
        workspace.captures.filter((capture) => capture.dealId === item.id).length +
        workspace.caseDocuments.filter((document) => document.dealId === item.id).length;
      const profileCount = [item.summary, item.website, item.sector, item.roundStage].filter(Boolean).length;
      const status =
        draftClaims > 0 || caseGaps > 0
          ? "Needs Review"
          : profileCount < 4 || approvedClaims === 0 || sourceCount === 0
            ? "Missing"
            : "Available";
      return {
        item,
        approvedClaims,
        draftClaims,
        caseGaps,
        sourceCount,
        status: status as "Available" | "Needs Review" | "Missing",
      };
    })
    .sort((a, b) => {
      const rank = { "Needs Review": 0, Missing: 1, Available: 2 };
      return rank[a.status] - rank[b.status] || new Date(b.item.updatedAt).getTime() - new Date(a.item.updatedAt).getTime();
    })
    .slice(0, 4);

  const criterionMap = new Map<string, { label: string; points: number; maxPoints: number; count: number }>();
  for (const match of workspace.matches) {
    for (const rule of match.scoreBreakdown ?? []) {
      if (!rule?.label || !Number.isFinite(rule.points) || !Number.isFinite(rule.maxPoints) || rule.maxPoints <= 0) continue;
      const current = criterionMap.get(rule.key) ?? {
        label: rule.label,
        points: 0,
        maxPoints: 0,
        count: 0,
      };
      current.points += rule.points;
      current.maxPoints += rule.maxPoints;
      current.count += 1;
      criterionMap.set(rule.key, current);
    }
  }
  const criteria = [...criterionMap.values()].sort((a, b) => b.maxPoints - a.maxPoints);

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
                Record Voice Note
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          <StatCard
            label="Follow-ups due"
            value={followUpBuckets.overdue + followUpBuckets.dueSoon}
            hint="Saved follow-up tasks overdue or due in the next 7 days."
            icon={CalendarClock}
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
                  Cases by funding stage
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

            {isLoading ? (
              <p className="mt-4 text-[11.5px] text-muted-foreground">Loading pipeline.</p>
            ) : isError ? (
              <p className="mt-4 text-[11.5px] text-destructive">Pipeline unavailable.</p>
            ) : workspace.cases.length === 0 ? (
              <p className="mt-4 text-[11.5px] text-muted-foreground">No deals.</p>
            ) : (
            <ul className="mt-4 space-y-2.5">
              {pipeline.map((item) => (
                <li key={item.key}>
                  <Link
                    to={`/cases?stage=${encodeURIComponent(item.key)}`}
                    aria-label={`${item.label}: ${item.count} case${item.count === 1 ? "" : "s"}. Open Deals filtered by this stage.`}
                    className="grid grid-cols-[92px_1fr_28px] items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-[12px] font-medium text-muted-foreground">{item.label}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-secondary">
                      <span className="block h-full rounded-full bg-brand" style={{ width: `${(item.count / pipelineMax) * 100}%` }} />
                    </span>
                    <span className="text-right text-[12px] font-semibold tabular-nums">{item.count}</span>
                  </Link>
                </li>
              ))}
            </ul>
            )}

          </section>

          <section className="panel p-5" aria-labelledby="attention-heading">
            <div className="flex items-start gap-2">
              <Clock3 className="mt-0.5 h-4 w-4 text-brand" aria-hidden="true" />
              <div>
                <h2 id="attention-heading" className="text-[15px] font-semibold tracking-tight">
                  Needs attention
                </h2>
                <p className="text-[11.5px] text-muted-foreground">Saved follow-up tasks and dated next steps.</p>
              </div>
            </div>

            <div className="mt-3 border-b border-border pb-3">
              <div className="flex items-center justify-between gap-2">
                <p className="label-caps">Follow-up tasks</p>
                <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                  {followUpBuckets.overdue + followUpBuckets.dueSoon} due
                </span>
              </div>
              {isLoading ? (
                <p className="mt-2 text-[10.5px] text-muted-foreground">Loading follow-ups.</p>
              ) : isError ? (
                <p className="mt-2 text-[10.5px] text-destructive">Follow-ups unavailable.</p>
              ) : workspace.followUpTasks.length === 0 ? (
                <p className="mt-2 text-[10.5px] text-muted-foreground">No saved follow-up tasks.</p>
              ) : followUpChartTotal === 0 ? (
                <p className="mt-2 text-[10.5px] text-muted-foreground">No overdue, due-soon or completed tasks.</p>
              ) : (
                <>
                  <div className="mt-2 h-[124px] w-full" role="img" aria-label={`Follow-up task chart. ${followUpSummary}.`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={followUpChart} layout="vertical" margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                        <XAxis type="number" hide allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={64}
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--secondary))" }}
                          contentStyle={{
                            borderRadius: 8,
                            border: "1px solid hsl(var(--border))",
                            background: "hsl(var(--card))",
                            color: "hsl(var(--foreground))",
                            fontSize: 11,
                          }}
                          formatter={(value: number | string) => [`${value} task${Number(value) === 1 ? "" : "s"}`, "Count"]}
                        />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={14}>
                          {followUpChart.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-1 text-[9.5px] text-muted-foreground">{followUpSummary}.</p>
                </>
              )}
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                Overdue: open before now. Due soon: open now through 7 days. Completed: done regardless of due date. Device local time.
                {followUpBuckets.undated > 0 ? ` ${followUpBuckets.undated} undated open excluded.` : ""}
                {followUpBuckets.later > 0 ? ` ${followUpBuckets.later} later-dated excluded.` : ""}
                {followUpBuckets.dismissed > 0 ? ` ${followUpBuckets.dismissed} dismissed excluded.` : ""}
                {" "}Saved follow-up tasks only; outreach stage dates excluded.
              </p>
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
        <div className="grid gap-4 xl:grid-cols-3">
          <section className="panel p-4" aria-labelledby="readiness-summary-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 id="readiness-summary-heading" className="text-[14px] font-semibold tracking-tight">Case readiness</h2>
                <p className="text-[10.5px] text-muted-foreground">Completeness, not an investment prediction.</p>
              </div>
              <Link to="/cases" className="text-[10.5px] font-medium text-brand-strong hover:underline">All deals</Link>
            </div>
            {readinessRows.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {readinessRows.map(({ item, approvedClaims, draftClaims, caseGaps, sourceCount, status }) => (
                  <li key={item.id}>
                    <Link to={`/cases/${item.id}`} className="block rounded-md border border-border bg-card px-3 py-2 hover:border-brand/40">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <span className="text-[11.5px] font-medium">{item.companyName}</span>
                        <Pill tone={status === "Available" ? "success" : status === "Needs Review" ? "warning" : "neutral"}>{status}</Pill>
                      </div>
                      <p className="mt-0.5 text-[9.5px] text-muted-foreground">
                        {approvedClaims} reviewed claims · {caseGaps} open gaps · {draftClaims} drafts · {sourceCount} sources
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-3 py-5 text-center text-[10.5px] text-muted-foreground">No cases to assess.</p>
            )}
          </section>

          <section className="panel p-4" aria-labelledby="compatibility-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 id="compatibility-heading" className="text-[14px] font-semibold tracking-tight">Investor compatibility</h2>
                <p className="text-[10.5px] text-muted-foreground">Weighted criteria from {workspace.matches.length} saved match{workspace.matches.length === 1 ? "" : "es"}. Scores are unchanged.</p>
              </div>
              <Link to="/matches" className="text-[10.5px] font-medium text-brand-strong hover:underline">Suggested investors</Link>
            </div>
            {criteria.length > 0 ? (
              <ul className="mt-3 space-y-2" aria-label="Investor compatibility criteria from saved matches">
                {criteria.map((criterion) => {
                  const percent = criterion.maxPoints > 0 ? Math.round((criterion.points / criterion.maxPoints) * 100) : 0;
                  return (
                    <li key={criterion.label} aria-label={`${criterion.label}: ${criterion.points} of ${criterion.maxPoints} recorded weighted points across ${criterion.count} matches`}>
                      <div className="flex items-baseline justify-between gap-2 text-[10px]">
                        <span className="font-medium">{criterion.label}</span>
                        <span className="text-muted-foreground">{criterion.points}/{criterion.maxPoints} pts</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${criterion.label} ${percent}% of recorded points`}>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-3 py-5 text-center text-[10.5px] text-muted-foreground">No saved matching data yet. Nothing is inferred.</p>
            )}
          </section>

          <section className="panel p-4" aria-labelledby="sources-summary-heading">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 id="sources-summary-heading" className="text-[14px] font-semibold tracking-tight">Recent sources</h2>
                <p className="text-[10.5px] text-muted-foreground">Documents, notes and interactions already recorded.</p>
              </div>
              <Link to="/inbox" className="text-[10.5px] font-medium text-brand-strong hover:underline">Deal Inbox</Link>
            </div>
            {sourceTimeline.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {sourceTimeline.map((entry) => (
                  <li key={entry.id}>
                    <Link to={entry.to} className="block border-b border-border/60 pb-2 last:border-0 last:pb-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="line-clamp-1 text-[11px] font-medium">{entry.title}</span>
                        <span className="shrink-0 text-[9.5px] text-muted-foreground">{formatShortDate(entry.date)}</span>
                      </div>
                      <p className="mt-0.5 text-[9.5px] text-muted-foreground">{entry.detail}{entry.caseId ? "" : " · no linked case"}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-3 py-5 text-center text-[10.5px] text-muted-foreground">No source activity recorded.</p>
            )}
          </section>
        </div>
      ) : null}

      <CaseForm open={caseFormOpen} onOpenChange={setCaseFormOpen} />
    </div>
  );
};

export default Dashboard;

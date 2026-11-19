import { ArrowRight, Info, Loader2, Settings2, ShieldCheck, Sparkles, Users, Waypoints } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { OutreachComposer } from "@/components/outreach/outreach-composer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { ACTIVE_CASE_STATUSES, INVESTOR_STATUS_LABEL } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { DealInvestorMatch, Investor, MatchWeights, Outreach } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MATCH_STATUS_META } from "@/lib/match-status";
import { MatchResultCard } from "./match-result-card";
import { OutreachQueue } from "./outreach-queue";

const DEFAULT_WEIGHTS: MatchWeights = {
  sectorThesis: 30,
  stage: 25,
  checkSize: 20,
  geography: 10,
  relationship: 10,
  recentInterest: 5,
};

const WEIGHT_FIELDS: { key: keyof MatchWeights; label: string; hint: string }[] = [
  { key: "sectorThesis", label: "Sector & thesis", hint: "Exact sector, or thematic overlap" },
  { key: "stage", label: "Stage", hint: "Exact stage, adjacent partial" },
  { key: "checkSize", label: "Cheque size", hint: "Range compatibility" },
  { key: "geography", label: "Geography", hint: "Exact or global" },
  { key: "relationship", label: "Relationship strength", hint: "Rollup or named contact" },
  { key: "recentInterest", label: "Recent interest", hint: "Interaction in last 180 days" },
];

const DECISION_FILTERS = [
  { value: "all", label: "All decisions" },
  { value: "suggested", label: "Suggested" },
  { value: "accepted", label: "Accepted" },
  { value: "deferred", label: "Deferred" },
  { value: "dismissed", label: "Dismissed" },
];

type MatchRun = Awaited<ReturnType<ReturnType<typeof useWorkspaceActions>["runInvestorMatching"]["mutateAsync"]>>;

function exclusionReasons(investor: Investor): string[] {
  const reasons: string[] = [];
  const status = investor.status.toLowerCase();
  if (status === "restricted") reasons.push("Marked restricted by the firm");
  if (status === "inactive" || status === "watchlist" || status === "archived") reasons.push("Investor is inactive");
  const contact = primaryContact(investor);
  if (contact?.outreachPermissionStatus === "do_not_contact") {
    reasons.push("Primary contact is marked do not contact");
  }
  return reasons;
}

const Matches = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInvestor, setComposerInvestor] = useState<Investor | null>(null);
  const [composerMatch, setComposerMatch] = useState<DealInvestorMatch | null>(null);
  const [composerOutreach, setComposerOutreach] = useState<Outreach | null>(null);
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [weights, setWeights] = useState<MatchWeights>(DEFAULT_WEIGHTS);
  const [runResult, setRunResult] = useState<MatchRun | null>(null);
  const [runError, setRunError] = useState("");

  const tab = searchParams.get("tab") === "outreach" ? "outreach" : "matches";
  const caseParam = searchParams.get("case");
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";

  const activeCases = workspace.cases.filter((item) => ACTIVE_CASE_STATUSES.includes(item.status));
  const selectable = activeCases.length > 0 ? activeCases : workspace.cases;
  const selectedCase = workspace.cases.find((item) => item.id === caseParam) ?? selectable[0] ?? null;

  const drafts = workspace.outreach.filter((item) => item.status === "draft");
  const openOutreach = workspace.outreach.filter((item) =>
    ["draft", "approved", "follow_up_needed"].includes(item.status),
  );

  const config = workspace.matchWeights;

  useEffect(() => {
    if (!config) return;
    setWeights({
      sectorThesis: config.sectorThesis,
      stage: config.stage,
      checkSize: config.checkSize,
      geography: config.geography,
      relationship: config.relationship,
      recentInterest: config.recentInterest,
    });
    // Reset only when the saved config changes, not on every object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.id, config?.updatedAt]);

  useEffect(() => {
    setRunResult(null);
    setRunError("");
  }, [selectedCase?.id]);

  const investorById = useMemo(
    () => new Map(workspace.investors.map((investor) => [investor.id, investor])),
    [workspace.investors],
  );

  const savedMatches = useMemo(
    () =>
      workspace.matches
        .filter((match) => match.dealId === selectedCase?.id)
        .sort((a, b) => b.fitScore - a.fitScore),
    [workspace.matches, selectedCase?.id],
  );

  const exclusions = useMemo(
    () =>
      workspace.investors
        .map((investor) => ({ investor, reasons: exclusionReasons(investor) }))
        .filter((item) => item.reasons.length > 0),
    [workspace.investors],
  );

  const excludedIds = useMemo(() => new Set(exclusions.map((item) => item.investor.id)), [exclusions]);

  const eligibleMatches = savedMatches.filter((match) => !excludedIds.has(match.investorId));
  const visibleMatches = eligibleMatches.filter((match) =>
    decisionFilter === "all"
      ? true
      : match.matchStatus === decisionFilter ||
        (decisionFilter === "accepted" && match.matchStatus === "approved") ||
        (decisionFilter === "dismissed" && match.matchStatus === "declined"),
  );

  const totalWeight = Object.values(weights).reduce((total, value) => total + value, 0);
  const weightsValid =
    totalWeight === 100 && Object.values(weights).every((value) => value >= 0 && Number.isInteger(value));
  const weightsChanged = config
    ? config.sectorThesis !== weights.sectorThesis ||
      config.stage !== weights.stage ||
      config.checkSize !== weights.checkSize ||
      config.geography !== weights.geography ||
      config.relationship !== weights.relationship ||
      config.recentInterest !== weights.recentInterest
    : true;

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const runMatching = async () => {
    if (!selectedCase) return;
    setRunError("");
    try {
      const result = await actions.runInvestorMatching.mutateAsync(selectedCase.id);
      setRunResult(result);
      if (result.error) {
        setRunError(result.error);
      } else {
        toast.success(
          `Matching saved for ${result.matchesSaved ?? 0} investor${result.matchesSaved === 1 ? "" : "s"}. ${
            result.needsResearch ? `${result.needsResearch} marked Needs Research.` : ""
          }`,
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Matching failed.";
      setRunError(message);
      toast.error(message);
    }
  };

  const saveWeights = async () => {
    if (!config || !weightsValid) return;
    try {
      await actions.updateMatchWeights.mutateAsync({ id: config.id, weights });
      toast.success("Matching weights saved. Run matching to apply them.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save matching weights.");
    }
  };

  const decide = async (
    match: DealInvestorMatch,
    status: "accepted" | "dismissed" | "deferred" | "suggested",
  ) => {
    try {
      await actions.decideMatch.mutateAsync({ matchId: match.id, status });
      toast.success(`Match marked ${MATCH_STATUS_META[status].label.toLowerCase()}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not record this decision.");
    }
  };

  const openComposer = (investor: Investor, match?: DealInvestorMatch) => {
    setComposerInvestor(investor);
    setComposerMatch(match ?? null);
    setComposerOutreach(null);
    setComposerOpen(true);
  };

  const editOutreach = (item: Outreach) => {
    setComposerOutreach(item);
    setComposerInvestor(investorById.get(item.investorId) ?? null);
    setComposerMatch(workspace.matches.find((match) => match.id === item.matchId) ?? null);
    setComposerOpen(true);
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader title="Investor Matching" />

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : workspace.cases.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No deals to match yet"
          description="Open a deal and add its stage, sector and cheque size first."
          action={
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/cases">
                Go to Investment Cases
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </Button>
          }
        />
      ) : workspace.investors.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No investor preferences recorded"
          description="Add investor preferences first."
          action={
            <Button asChild size="sm" className="gap-1.5">
              <Link to="/investors">Open Investor Network</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-secondary/50 p-1">
              {[
                { value: "matches", label: "Matches", count: savedMatches.length },
                { value: "outreach", label: "Outreach queue", count: openOutreach.length },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={tab === option.value}
                  onClick={() => setParam("tab", option.value === "outreach" ? "outreach" : null)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors",
                    tab === option.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {option.label}
                  <span className="ml-1.5 tabular-nums text-muted-foreground">{option.count}</span>
                </button>
              ))}
            </div>
          </div>

          {tab === "matches" ? (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
              <div className="space-y-4">
                <section className="panel p-4 sm:p-5" aria-labelledby="deal-context-heading">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="label-caps">Matching against</p>
                      <h2 id="deal-context-heading" className="mt-1 font-display text-xl tracking-tight">
                        {selectedCase?.companyName ?? "No deal"}
                      </h2>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                        {selectedCase
                          ? `${selectedCase.roundStage || "Stage not set"} · ${selectedCase.sector || "Sector not set"} · ${
                              selectedCase.geography || "Geography not set"
                            } · cheque sought ${formatCurrency(selectedCase.chequeSought, { compact: false })}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:w-[260px]">
                      <SelectField
                        value={selectedCase?.id ?? ""}
                        onChange={(value) => setParam("case", value)}
                        options={selectable.map((item) => ({ value: item.id, label: item.companyName }))}
                        ariaLabel="Select the deal to match"
                      />
                      {selectedCase ? (
                        <Link
                          to={`/cases/${selectedCase.id}`}
                          className="inline-flex items-center justify-end gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
                        >
                          Open deal file
                          <ArrowRight className="h-3 w-3" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <Button
                      onClick={() => void runMatching()}
                      disabled={!selectedCase || !canWrite || actions.runInvestorMatching.isPending}
                      className="h-9 gap-2"
                    >
                      {actions.runInvestorMatching.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      )}
                      {actions.runInvestorMatching.isPending ? "Running matching…" : "Run matching"}
                    </Button>
                  </div>

                  {runError ? (
                    <p role="alert" className="mt-3 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-destructive">
                      {runError}
                    </p>
                  ) : null}

                  {runResult ? (
                    <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/30 px-3 py-2.5 text-[10.5px] leading-relaxed text-muted-foreground">
                      <p>
                        Saved {runResult.matchesSaved ?? 0} matches ·{" "}
                        {runResult.needsResearch ?? 0} need research · {runResult.excluded?.length ?? 0} excluded.
                        {" "}Weights used:{" "}
                        {runResult.weights
                          ? Object.entries(runResult.weights)
                              .map(([key, value]) => `${key} ${value}`)
                              .join(" · ")
                          : "defaults"}
                        .
                      </p>
                      {runResult.missingDealInputs && runResult.missingDealInputs.length > 0 ? (
                        <p className="text-warning">
                          Missing deal inputs: {runResult.missingDealInputs.join(" ")} Edit the deal to improve coverage.
                        </p>
                      ) : null}
                      {runResult.warnings && runResult.warnings.length > 0 ? (
                        <p className="text-warning">{runResult.warnings.join(" ")}</p>
                      ) : null}
                    </div>
                  ) : null}

                </section>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label-caps">
                    Ranked investors · {eligibleMatches.length}
                    {exclusions.length > 0 ? ` · ${exclusions.length} excluded` : ""}
                  </p>
                  <div className="w-[170px]">
                    <SelectField
                      value={decisionFilter}
                      onChange={setDecisionFilter}
                      options={DECISION_FILTERS}
                      ariaLabel="Filter by match decision"
                    />
                  </div>
                </div>

                {eligibleMatches.length === 0 ? (
                  <EmptyState
                    icon={Waypoints}
                    title="No saved matches for this deal"
                    description="No matches saved yet."
                    action={
                      canWrite ? (
                        <Button size="sm" onClick={() => void runMatching()} disabled={actions.runInvestorMatching.isPending}>
                          Run matching
                        </Button>
                      ) : undefined
                    }
                  />
                ) : visibleMatches.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-[12px] text-muted-foreground">
                    No matches with this decision. Change the filter to see the ranked list.
                  </p>
                ) : (
                  <div className="grid gap-3 2xl:grid-cols-2">
                    {visibleMatches.map((match) => {
                      const investor = investorById.get(match.investorId);
                      if (!investor) return null;
                      return (
                        <MatchResultCard
                          key={match.id}
                          match={match}
                          investor={investor}
                          canWrite={canWrite}
                          deciding={actions.decideMatch.isPending}
                          hasOutreach={workspace.outreach.some(
                            (item) =>
                              item.dealId === match.dealId &&
                              item.investorId === match.investorId &&
                              !["rejected", "not_interested"].includes(item.status),
                          )}
                          onDecision={(status) => void decide(match, status)}
                          onDraft={() => openComposer(investor, match)}
                        />
                      );
                    })}
                  </div>
                )}

                {exclusions.length > 0 ? (
                  <section className="panel p-4 sm:p-5" aria-labelledby="excluded-heading">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      <div>
                        <h2 id="excluded-heading" className="text-[13px] font-semibold tracking-tight">
                          Excluded by restriction
                        </h2>
                        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                          These investors are not ranked. Their existing records and owner decisions are preserved.
                        </p>
                      </div>
                    </div>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {exclusions.map(({ investor, reasons }) => {
                        const prior = savedMatches.find((match) => match.investorId === investor.id);
                        return (
                          <li key={investor.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Link
                                to={`/investors/${investor.id}`}
                                className="text-[12px] font-medium hover:text-brand-strong"
                              >
                                {investor.name}
                              </Link>
                              {investor.isSynthetic ? <Pill tone="neutral">Sample</Pill> : null}
                              <Pill tone="neutral">{INVESTOR_STATUS_LABEL[investor.status]}</Pill>
                              {prior ? (
                                <Pill tone={MATCH_STATUS_META[prior.matchStatus].tone}>
                                  Previous: {MATCH_STATUS_META[prior.matchStatus].label}
                                </Pill>
                              ) : null}
                            </div>
                            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                              {reasons.join(" · ")}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}
              </div>

              <aside className="space-y-4">
                <section className="panel p-5" aria-labelledby="weights-heading">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-brand" aria-hidden="true" />
                    <h2 id="weights-heading" className="text-[14px] font-semibold tracking-tight">
                      Match settings
                    </h2>
                  </div>
                  <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                    Workspace weights. They must total 100 and are applied to the next matching run.
                  </p>
                  <div className="mt-3 space-y-2.5">
                    {WEIGHT_FIELDS.map((field) => (
                      <div key={field.key} className="grid grid-cols-[1fr_70px] items-center gap-2">
                        <div>
                          <p className="text-[11.5px] font-medium">{field.label}</p>
                          <p className="text-[9.5px] leading-tight text-muted-foreground">{field.hint}</p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={weights[field.key]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            setWeights((current) => ({
                              ...current,
                              [field.key]: Number.isFinite(value) ? value : 0,
                            }));
                          }}
                          className="h-8 bg-card text-right text-[12px]"
                          aria-label={`${field.label} weight`}
                          disabled={!canWrite}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                    <span className={cn("text-[11px] font-semibold", weightsValid ? "text-success" : "text-destructive")}>
                      Total {totalWeight} / 100
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-[11px]"
                      onClick={() => void saveWeights()}
                      disabled={!canWrite || !weightsValid || !weightsChanged || !config || actions.updateMatchWeights.isPending}
                    >
                      {actions.updateMatchWeights.isPending ? "Saving…" : "Save weights"}
                    </Button>
                  </div>
                  {!weightsValid ? (
                    <p className="mt-1.5 text-[10px] text-destructive">Weights must total exactly 100.</p>
                  ) : null}
                  {!config ? (
                    <p className="mt-1.5 text-[10px] text-warning">Matching settings have not been initialised.</p>
                  ) : null}
                </section>

              </aside>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-brand-strong">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p>
                  A draft only moves forward with a human decision: approve it, copy it, send it from your own inbox, then
                  record the contact and responses. {drafts.length > 0
                    ? `${drafts.length} draft${drafts.length === 1 ? "" : "s"} still need approval.`
                    : ""} Follow-ups are manual tasks with persisted dates.
                </p>
              </div>
              <OutreachQueue
                outreach={workspace.outreach}
                cases={workspace.cases}
                investors={workspace.investors}
                onEdit={editOutreach}
              />
            </>
          )}
        </>
      )}

      <OutreachComposer
        open={composerOpen}
        onOpenChange={(open) => {
          setComposerOpen(open);
          if (!open) {
            setComposerOutreach(null);
            setComposerMatch(null);
          }
        }}
        caseItem={
          composerOutreach
            ? workspace.cases.find((item) => item.id === composerOutreach.dealId) ?? selectedCase
            : selectedCase
        }
        investor={composerInvestor}
        match={composerMatch}
        initial={composerOutreach}
      />
    </div>
  );
};

export default Matches;

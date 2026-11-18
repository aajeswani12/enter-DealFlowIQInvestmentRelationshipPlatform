import { ArrowRight, Info, ShieldCheck, Users, Waypoints } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { MatchCard } from "@/components/matches/match-card";
import { OutreachComposer } from "@/components/outreach/outreach-composer";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { ACTIVE_CASE_STATUSES } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import { rankMatches, scoreMatch } from "@/lib/matching";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { Investor, MatchStatus, Outreach } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OutreachQueue } from "./outreach-queue";

const Matches = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInvestor, setComposerInvestor] = useState<Investor | null>(null);

  const tab = searchParams.get("tab") === "outreach" ? "outreach" : "matches";
  const caseParam = searchParams.get("case");
  const investorParam = searchParams.get("investor");

  const activeCases = workspace.cases.filter((item) => ACTIVE_CASE_STATUSES.includes(item.status));
  const selectable = activeCases.length > 0 ? activeCases : workspace.cases;
  const paramCase = workspace.cases.find((item) => item.id === caseParam);
  const selectedCase = paramCase ?? selectable[0] ?? null;

  const matches = selectedCase ? rankMatches(selectedCase, workspace.investors) : [];
  const filtered = matches.filter((match) => match.score >= 50);
  const visibleMatches = showAll ? matches : filtered;

  const drafts = workspace.outreach.filter((item) => item.status === "draft");
  const awaitingApproval = workspace.outreach.filter((item) => item.status === "approved");

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const savedMatch = (dealId: string, investorId: string) =>
    workspace.matches.find((item) => item.dealId === dealId && item.investorId === investorId);

  const persistMatch = async (dealId: string, investorId: string, status: MatchStatus) => {
    const deal = workspace.cases.find((item) => item.id === dealId);
    const investor = workspace.investors.find((item) => item.id === investorId);
    if (!deal || !investor) return;
    const result = scoreMatch(deal, investor);
    try {
      await actions.saveMatch.mutateAsync({
        dealId,
        investorId,
        score: result.score,
        rules: result.rules,
        explanation: `${result.score}/100 — ${result.rules.filter((rule) => rule.outcome === "pass").length} of ${result.rules.length} rules met.`,
        gaps: result.gaps,
        status,
      });
    } catch {
      toast.error("The match decision was not saved.");
    }
  };

  const openComposer = (investor: Investor) => {
    setComposerInvestor(investor);
    setComposerOpen(true);
  };

  const handleApprove = async (item: Outreach) => {
    try {
      await actions.updateOutreach.mutateAsync({ id: item.id, patch: { status: "approved" } });
      await persistMatch(item.dealId, item.investorId, "approved");
      toast.success("Approved. Send it from your inbox, then record it as sent.");
    } catch {
      toast.error("Could not approve this draft.");
    }
  };

  const handleRecordSent = async (item: Outreach) => {
    try {
      await actions.updateOutreach.mutateAsync({ id: item.id, patch: { status: "sent" } });
      await persistMatch(item.dealId, item.investorId, "contacted");
      toast.success("Recorded as sent");
    } catch {
      toast.error("Could not record this as sent.");
    }
  };

  const handleShortlist = async (investorId: string) => {
    if (!selectedCase) return;
    await persistMatch(selectedCase.id, investorId, "shortlisted");
    toast.success("Added to the shortlist");
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Matching"
        title="Matches & Outreach"
        description="Ranked against the preferences your team recorded. Every point is traceable, and every message is drafted by hand."
      />

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : workspace.cases.length === 0 ? (
        <EmptyState
          icon={Waypoints}
          title="No deals to match yet"
          description="Matching starts from a deal. Open one, record the round mechanics, then compare it against the investor network."
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
          description="Add the funds and angels you know, with stages, sectors, geographies and cheque ranges. Matching has nothing to compare until then."
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
                { value: "matches", label: "Matches", count: matches.length },
                { value: "outreach", label: "Outreach queue", count: drafts.length + awaitingApproval.length },
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
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              No automatic sending
            </span>
          </div>

          {tab === "matches" ? (
            <>
              <section className="panel p-4 sm:p-5" aria-labelledby="case-context-heading">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="label-caps">Matching against</p>
                    <h2 id="case-context-heading" className="mt-1 font-display text-xl tracking-tight">
                      {selectedCase?.companyName ?? "No deal"}
                    </h2>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {selectedCase
                        ? `${selectedCase.roundStage || "Stage not set"} · ${selectedCase.sector || "Sector not set"} · ${
                            selectedCase.geography || "Geography not set"
                          } · cheque sought ${formatCurrency(selectedCase.chequeSought, { compact: false })}${
                            selectedCase.leadRequired ? " · lead required" : ""
                          }`
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
                <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Six rules: stage 28, sector 24, geography 14, cheque size 18, lead capacity 8, relationship signal 8.
                  Nothing outside the recorded fields is used. Shortlisting and drafting store the score and breakdown.
                </p>
              </section>

              {investorParam && !workspace.investors.some((item) => item.id === investorParam) ? (
                <p className="text-[11.5px] text-muted-foreground">The investor linked in the URL no longer exists.</p>
              ) : null}

              {visibleMatches.length === 0 ? (
                <EmptyState
                  icon={Waypoints}
                  title="No investor clears the bar on this deal"
                  description={`Every recorded investor scores below 50 against ${selectedCase?.companyName ?? "this deal"}. Review the breakdown to see which preference blocks the fit.`}
                  action={
                    <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>
                      Show all {matches.length} rankings
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="grid gap-3 xl:grid-cols-2">
                    {visibleMatches.map((match) => {
                      const saved = selectedCase ? savedMatch(selectedCase.id, match.investor.id) : undefined;
                      return (
                        <MatchCard
                          key={match.investor.id}
                          match={match}
                          rank={matches.indexOf(match) + 1}
                          matchStatus={saved?.matchStatus}
                          hasOutreach={workspace.outreach.some(
                            (item) =>
                              item.dealId === selectedCase?.id &&
                              item.investorId === match.investor.id &&
                              item.status !== "sent",
                          )}
                          onDraft={() => openComposer(match.investor)}
                          onShortlist={() => handleShortlist(match.investor.id)}
                        />
                      );
                    })}
                  </div>

                  {!showAll && matches.length > visibleMatches.length ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border px-4 py-3">
                      <p className="text-[11.5px] text-muted-foreground">
                        {matches.length - visibleMatches.length} lower-fit investor
                        {matches.length - visibleMatches.length === 1 ? "" : "s"} hidden (score below 50).
                      </p>
                      <Button size="sm" variant="ghost" className="h-7 text-[11.5px]" onClick={() => setShowAll(true)}>
                        Show all rankings
                      </Button>
                    </div>
                  ) : null}

                  {showAll ? (
                    <button
                      type="button"
                      onClick={() => setShowAll(false)}
                      className="text-[11.5px] font-medium text-brand-strong hover:underline"
                    >
                      Hide lower-fit investors
                    </button>
                  ) : null}
                </>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/50 px-3.5 py-2.5 text-[11px] leading-relaxed text-brand-strong">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <p>
                  A draft only moves forward with a human decision: approve it, send it yourself, then record it as sent.
                  {drafts.length > 0 ? ` ${drafts.length} draft${drafts.length === 1 ? "" : "s"} still need approval.` : ""}
                </p>
              </div>
              <OutreachQueue
                outreach={workspace.outreach}
                cases={workspace.cases}
                investors={workspace.investors}
                pending={actions.updateOutreach.isPending}
                onApprove={handleApprove}
                onRecordSent={handleRecordSent}
              />
            </>
          )}
        </>
      )}

      <OutreachComposer
        open={composerOpen}
        onOpenChange={setComposerOpen}
        caseItem={selectedCase}
        investor={composerInvestor}
        onDrafted={async () => {
          if (selectedCase && composerInvestor) {
            await persistMatch(selectedCase.id, composerInvestor.id, "outreach_drafted");
          }
        }}
      />
    </div>
  );
};

export default Matches;

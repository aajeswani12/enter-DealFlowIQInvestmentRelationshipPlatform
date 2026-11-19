import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { INVESTOR_TYPE_LABEL, RELATIONSHIP_LABEL } from "@/lib/constants";
import { formatCurrencyRange } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { DealInvestorMatch, Investor } from "@/lib/types";

function exclusionReason(investor: Investor): string {
  const status = investor.status.toLowerCase();
  if (status === "restricted") return "Restricted by the firm";
  if (status === "inactive" || status === "watchlist" || status === "archived") return "Inactive record";
  if (primaryContact(investor)?.outreachPermissionStatus === "do_not_contact") return "Do not contact";
  return "";
}

function firstSentence(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const match = normalized.match(/^.*?[.!?](?:\s|$)/);
  return (match?.[0] ?? normalized).trim();
}

function fitReason(match: DealInvestorMatch | undefined): string {
  if (!match) return "";
  const passed = match.scoreBreakdown.filter((rule) => rule.outcome === "pass").map((rule) => rule.label);
  if (passed.length > 0) return `Recorded fit on ${passed.slice(0, 3).join(", ")}.`;
  const explanation = firstSentence(match.fitExplanation);
  return explanation || "Stored suggestion from recorded preferences.";
}

const FindInvestors = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const { membership } = useAuth();
  const actions = useWorkspaceActions();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";

  const deals = useMemo(
    () => [...workspace.cases].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace.cases],
  );
  const selectedDeal = deals.find((deal) => deal.id === searchParams.get("case")) ?? deals[0] ?? null;
  const linked = selectedDeal
    ? workspace.dealInvestors.filter((association) => association.dealId === selectedDeal.id)
    : [];
  const linkedIds = new Set(linked.map((association) => association.investorId));
  const associated = linked
    .map((association) => ({ association, investor: workspace.investors.find((investor) => investor.id === association.investorId) }))
    .filter((item): item is { association: (typeof linked)[number]; investor: Investor } => Boolean(item.investor));
  const storedMatches = selectedDeal
    ? workspace.matches.filter((match) => match.dealId === selectedDeal.id)
    : [];
  const matchByInvestor = new Map(storedMatches.map((match) => [match.investorId, match]));

  const search = query.trim().toLowerCase();
  const searchResults = search
    ? workspace.investors.filter((investor) =>
        [
          investor.name,
          investor.thesis,
          ...investor.sectors,
          ...investor.stages,
          ...investor.contacts.flatMap((contact) => [contact.contactName, contact.email ?? "", contact.relationshipOwner]),
        ].join(" ").toLowerCase().includes(search),
      )
    : [];

  const suggestions = workspace.investors.filter((investor) => {
    const match = matchByInvestor.get(investor.id);
    if (!match || linkedIds.has(investor.id) || exclusionReason(investor)) return false;
    return !search || [investor.name, investor.thesis, ...investor.sectors, ...investor.stages].join(" ").toLowerCase().includes(search);
  });

  const setDeal = (dealId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("case", dealId);
    setSearchParams(next, { replace: true });
  };

  const addToDeal = async (investor: Investor) => {
    if (!selectedDeal) return;
    try {
      await actions.addDealInvestor.mutateAsync({
        dealId: selectedDeal.id,
        investorId: investor.id,
        relationshipStatus: "new",
        notes: "",
      });
      toast.success(`${investor.name} added to ${selectedDeal.companyName}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add this investor to the deal.");
    }
  };

  const card = (investor: Investor, match?: DealInvestorMatch, searchResult = false) => {
    const associatedHere = linkedIds.has(investor.id);
    const reason = exclusionReason(investor);
    return (
      <li key={investor.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/investors/${investor.id}`} className="text-[21px] font-semibold tracking-tight hover:text-brand-strong">{investor.name}</Link>
              {associatedHere ? <Pill tone="brand" className="text-[14px]">Associated</Pill> : <Pill tone={searchResult ? "neutral" : "brand"} className="text-[14px]">{searchResult ? "Search result" : "Suggested"}</Pill>}
            </div>
            <p className="mt-1 text-[16px] text-muted-foreground">{INVESTOR_TYPE_LABEL[investor.investorType]} · {RELATIONSHIP_LABEL[investor.relationship]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-10 text-[16px]"><Link to={`/investors/${investor.id}`}>Open profile</Link></Button>
            {!associatedHere ? (
              <Button className="h-10 text-[16px]" onClick={() => void addToDeal(investor)} disabled={!canWrite || Boolean(reason) || actions.addDealInvestor.isPending}>
                Add to Deal
              </Button>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid gap-2 text-[16px] sm:grid-cols-3">
          <div><dt className="text-[14px] text-muted-foreground">Investment focus</dt><dd className="mt-0.5">{investor.sectors.slice(0, 3).join(", ") || "Unknown"}</dd></div>
          <div><dt className="text-[14px] text-muted-foreground">Typical stage</dt><dd className="mt-0.5">{investor.stages.join(", ") || "Unknown"}</dd></div>
          <div><dt className="text-[14px] text-muted-foreground">Typical check</dt><dd className="mt-0.5">{investor.checkMin === null && investor.checkMax === null ? "Unknown" : formatCurrencyRange(investor.checkMin, investor.checkMax, investor.currency)}</dd></div>
        </dl>
        {match ? <p className="mt-3 text-[17px] leading-[1.5] text-foreground/90">{fitReason(match)}</p> : null}
        {reason ? <p className="mt-2 text-[14px] text-warning">{reason}; not available for suggestions or adding.</p> : null}
      </li>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7">
      <PageHeader
        title="Find Investors"
        description="Select a deal, then review existing relationships and stored suggestions."
        actions={selectedDeal ? <Button asChild variant="outline" className="h-10 text-[16px]"><Link to={`/matches?case=${selectedDeal.id}`}>Advanced matching</Link></Button> : null}
      />

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : deals.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-[17px] text-muted-foreground">
          No deals yet. <Link to="/imports" className="font-medium text-brand-strong hover:underline">Import deal information</Link>.
        </p>
      ) : (
        <>
          <section className="panel p-5 sm:p-6" aria-label="Investor search controls">
            <div className="grid gap-4 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
              <div>
                <label htmlFor="find-investors-deal" className="text-[16px] font-medium text-muted-foreground">Deal</label>
                <select
                  id="find-investors-deal"
                  value={selectedDeal?.id ?? ""}
                  onChange={(event) => setDeal(event.target.value)}
                  className="mt-1 h-11 w-full rounded-md border border-input bg-card px-3 text-[16px]"
                >
                  {deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.companyName}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="find-investors-search" className="text-[16px] font-medium text-muted-foreground">Search existing investors and contacts</label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input id="find-investors-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, contact, sector or stage" className="h-11 bg-card pl-10 text-[16px]" />
                </div>
              </div>
            </div>
          </section>

          {search ? (
            <section className="space-y-3" aria-labelledby="investor-search-results">
              <h2 id="investor-search-results" className="text-[21px] font-semibold tracking-tight">Search Results</h2>
              {searchResults.length === 0 ? (
                <p className="text-[17px] text-muted-foreground">No recorded investor matches this search.</p>
              ) : (
                <ul className="space-y-4">{searchResults.slice(0, 30).map((investor) => card(investor, matchByInvestor.get(investor.id), true))}</ul>
              )}
            </section>
          ) : (
            <>
              <section className="space-y-3" aria-labelledby="suggested-investors">
                <div>
                  <h2 id="suggested-investors" className="text-[21px] font-semibold tracking-tight">Suggested Investors</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">Stored suggestions for {selectedDeal?.companyName}. Scores are not shown.</p>
                </div>
                {suggestions.length === 0 ? (
                  <p className="text-[17px] text-muted-foreground">No stored suggestions for this deal.</p>
                ) : (
                  <ul className="space-y-4">{suggestions.map((investor) => card(investor, matchByInvestor.get(investor.id)))}</ul>
                )}
              </section>

              <section className="space-y-3" aria-labelledby="associated-investors">
                <h2 id="associated-investors" className="text-[21px] font-semibold tracking-tight">Already Associated</h2>
                {associated.length === 0 ? (
                  <p className="text-[17px] text-muted-foreground">No investors are associated with this deal.</p>
                ) : (
                  <ul className="space-y-4">{associated.map(({ investor, association }) => (
                    <li key={association.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-card">
                      <div>
                        <Link to={`/investors/${investor.id}`} className="text-[21px] font-semibold tracking-tight hover:text-brand-strong">{investor.name}</Link>
                        <p className="mt-1 text-[16px] text-muted-foreground">{INVESTOR_TYPE_LABEL[investor.investorType]} · {RELATIONSHIP_LABEL[association.relationshipStatus]}</p>
                      </div>
                      <Pill tone="brand" className="text-[14px]">Associated</Pill>
                    </li>
                  ))}</ul>
                )}
              </section>
            </>
          )}

          {selectedDeal ? (
            <p className="text-[16px] text-muted-foreground">
              Need to refresh stored suggestions? <Link to={`/matches?case=${selectedDeal.id}`} className="font-medium text-brand-strong hover:underline">Open advanced matching</Link>.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};

export default FindInvestors;

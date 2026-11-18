import { Briefcase, ChevronRight, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaseStatusPill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/hooks/use-workspace";
import { CASE_STATUS_LABEL, CASE_STATUS_OPTIONS, ROUND_STAGES } from "@/lib/constants";
import { formatCurrency, formatShortDate, isOverdue } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const Cases = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const [formOpen, setFormOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const requestedStage = searchParams.get("stage") ?? "all";
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [stage, setStage] = useState(requestedStage);

  useEffect(() => {
    setStage(requestedStage);
  }, [requestedStage]);

  const rows = useMemo(() => {
    const search = query.trim().toLowerCase();
    const enriched = workspace.cases.map((item) => {
      const dealSources = workspace.captures.filter((capture) => capture.dealId === item.id);
      const dealPeople = workspace.dealPeople.filter((person) => person.dealId === item.id);
      const founderClaims = workspace.claims.filter(
        (claim) => claim.dealId === item.id && claim.claimType === "founder",
      );
      const founders = [
        ...dealPeople.map((person) => person.name || person.email).filter(Boolean),
        ...dealSources.map((capture) => capture.founderName || capture.founderEmail).filter(Boolean),
        ...founderClaims.map((claim) => claim.valueText || claim.label).filter(Boolean),
      ].filter((value, index, all) => all.indexOf(value) === index);
      const matchInvestors = workspace.matches
        .filter((match) => match.dealId === item.id)
        .map((match) => workspace.investors.find((investor) => investor.id === match.investorId)?.name)
        .filter((name): name is string => Boolean(name));
      const interactionInvestors = workspace.interactions
        .filter((interaction) => interaction.dealId === item.id)
        .map((interaction) => workspace.investors.find((investor) => investor.id === interaction.investorId)?.name)
        .filter((name): name is string => Boolean(name));
      const knownInvestors = [...new Set([...matchInvestors, ...interactionInvestors])];
      return {
        ...item,
        founders,
        knownInvestors,
        claimCount: workspace.claims.filter((claim) => claim.dealId === item.id).length,
        openGapCount: workspace.gaps.filter(
          (gap) => gap.dealId === item.id && gap.status === "open",
        ).length,
      };
    });
    return enriched
      .filter((item) => (status === "all" ? true : item.status === status))
      .filter((item) =>
        stage === "all"
          ? true
          : stage === "Unknown"
            ? !item.roundStage.trim() || !(ROUND_STAGES as readonly string[]).includes(item.roundStage.trim())
            : item.roundStage.trim() === stage,
      )
      .filter((item) =>
        search
          ? [
              item.companyName,
              item.sector,
              item.geography,
              item.leadPartner,
              item.referredBy,
              ...item.founders,
              ...item.knownInvestors,
            ]
              .join(" ")
              .toLowerCase()
              .includes(search)
          : true,
      )
      .sort((a, b) => {
        const aDue = a.nextStepDue ? new Date(a.nextStepDue).getTime() : Number.MAX_SAFE_INTEGER;
        const bDue = b.nextStepDue ? new Date(b.nextStepDue).getTime() : Number.MAX_SAFE_INTEGER;
        return aDue - bDue || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [workspace, query, status, stage]);

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Pipeline"
        title="Investment Cases"
        description="A persistent file for every company under review: thesis, claims, decision gaps and the next step."
        actions={
          <Button className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Open a case
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, founder, sector or known investor"
            aria-label="Search investment cases by company, founder, sector or known investor"
            className="bg-card pl-9"
          />
        </div>
        <div className="sm:w-[180px]">
          <SelectField
            value={stage}
            onChange={setStage}
            options={[
              { value: "all", label: "All stages" },
              ...ROUND_STAGES.map((value) => ({ value, label: value })),
              { value: "Unknown", label: "Unknown" },
            ]}
            ariaLabel="Filter by funding stage"
          />
        </div>
        <div className="sm:w-[180px]">
          <SelectField
            value={status}
            onChange={setStatus}
            options={[{ value: "all", label: "All statuses" }, ...CASE_STATUS_OPTIONS]}
            ariaLabel="Filter by case status"
          />
        </div>
      </div>

      {isLoading ? (
        <LoadingPanel rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={workspace.cases.length === 0 ? "No investment cases yet" : "No cases match this filter"}
          description={
            workspace.cases.length === 0
              ? "Open a case to start a persistent diligence file, or promote a capture from the Deal Inbox."
              : "Try a different search or status."
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" className="gap-1.5" onClick={() => setFormOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Open a case
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to="/inbox">Go to Deal Inbox</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="panel hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Investment cases with stage, status and next step</caption>
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {["Company", "Round", "Status", "Cheque sought", "Next step", "Updated", ""].map((heading) => (
                    <th
                      key={heading || "open"}
                      scope="col"
                      className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <Link to={`/cases/${item.id}`} className="group block">
                        <p className="text-[13.5px] font-semibold tracking-tight group-hover:text-brand-strong">
                          {item.companyName}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11.5px] text-muted-foreground">
                          {item.summary || `${item.sector || "Sector not set"} · ${item.geography || "Geography not set"}`}
                        </p>
                        <p className="mt-1 text-[10.5px] text-muted-foreground/80">
                          {item.claimCount} claims · {item.openGapCount} open gaps{item.isSynthetic ? " · Synthetic sample" : ""}
                        </p>
                        {item.founders.length > 0 || item.knownInvestors.length > 0 ? (
                          <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground/75">
                            {item.founders.length > 0 ? `Founder: ${item.founders.join(", ")}` : ""}
                            {item.founders.length > 0 && item.knownInvestors.length > 0 ? " · " : ""}
                            {item.knownInvestors.length > 0 ? `Known investors: ${item.knownInvestors.join(", ")}` : ""}
                          </p>
                        ) : null}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[12.5px] text-muted-foreground">
                      {item.roundStage || "—"}
                      {item.raiseAmount ? (
                        <span className="mt-0.5 block text-[10.5px] text-muted-foreground/80">
                          {formatCurrency(item.raiseAmount)} round
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <CaseStatusPill status={item.status} label={CASE_STATUS_LABEL[item.status]} />
                    </td>
                    <td className="px-4 py-3 text-[12.5px] tabular-nums text-foreground">
                      {formatCurrency(item.chequeSought)}
                    </td>
                    <td className="max-w-[240px] px-4 py-3">
                      <p className="line-clamp-2 text-[12px] leading-relaxed text-foreground/90">
                        {item.nextStep || "No next step recorded"}
                      </p>
                      {item.nextStepDue ? (
                        <p
                          className={cn(
                            "mt-0.5 text-[10.5px] font-medium",
                            isOverdue(item.nextStepDue) ? "text-destructive" : "text-muted-foreground",
                          )}
                        >
                          {formatShortDate(item.nextStepDue)}
                          {isOverdue(item.nextStepDue) ? " · overdue" : ""}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-[11.5px] text-muted-foreground">{formatShortDate(item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/cases/${item.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-medium text-brand-strong hover:bg-brand-soft"
                      >
                        Open
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((item) => (
              <li key={item.id}>
                <Link to={`/cases/${item.id}`} className="panel block p-4 transition-shadow hover:shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold tracking-tight">{item.companyName}</p>
                      <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-relaxed text-muted-foreground">
                        {item.summary || `${item.sector || "Sector not set"} · ${item.geography || "Geography not set"}`}
                      </p>
                      {item.founders.length > 0 || item.knownInvestors.length > 0 ? (
                        <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground/80">
                          {item.founders.length > 0 ? `Founder: ${item.founders.join(", ")}` : ""}
                          {item.founders.length > 0 && item.knownInvestors.length > 0 ? " · " : ""}
                          {item.knownInvestors.length > 0 ? `Known: ${item.knownInvestors.join(", ")}` : ""}
                        </p>
                      ) : null}
                    </div>
                    <CaseStatusPill status={item.status} label={CASE_STATUS_LABEL[item.status]} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[11.5px]">
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Round</dt>
                      <dd className="mt-0.5 font-medium">{item.roundStage || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Cheque sought</dt>
                      <dd className="mt-0.5 font-medium tabular-nums">{formatCurrency(item.chequeSought)}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 border-t border-border pt-2.5">
                    <p className="text-[11.5px] leading-relaxed text-foreground/90">
                      {item.nextStep || "No next step recorded"}
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-[10.5px] font-medium",
                        isOverdue(item.nextStepDue) ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {item.nextStepDue ? formatShortDate(item.nextStepDue) : "No due date"} · {item.openGapCount} open gaps
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <CaseForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
};

export default Cases;

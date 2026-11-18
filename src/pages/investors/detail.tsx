import { ArrowRight, Mail, Pencil, Plus, Send, Users } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoadingPanel } from "@/components/common/loading-panel";
import { OutreachStatusPill, Pill, RelationshipPill } from "@/components/common/status-pill";
import { InvestorForm } from "@/components/forms/investor-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  ACTIVE_CASE_STATUSES,
  INTERACTION_KIND_LABEL,
  INVESTOR_TYPE_LABEL,
  OUTREACH_STATUS_LABEL,
  RELATIONSHIP_LABEL,
} from "@/lib/constants";
import { dueLabel, formatCurrencyRange, formatShortDate, isOverdue, relativeDays } from "@/lib/format";
import { MATCH_TIER_LABEL, scoreMatch } from "@/lib/matching";
import { InteractionForm } from "./interaction-form";

const InvestorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useWorkspace();
  const [editOpen, setEditOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);

  const investor = data?.investors.find((item) => item.id === id);

  if (isLoading) {
    return (
      <div className="page-enter">
        <LoadingPanel rows={4} />
      </div>
    );
  }

  if (!investor) {
    return (
      <div className="page-enter">
        <PageHeader
          eyebrow="Investor network"
          title="Investor not found"
          description="This record is not in the workspace. It may have been opened from a stale link."
          actions={
            <Button asChild variant="outline">
              <Link to="/investors">Back to network</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const interactions = (data?.interactions ?? [])
    .filter((item) => item.investorId === investor.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const outreach = (data?.outreach ?? [])
    .filter((item) => item.investorId === investor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const cases = data?.cases ?? [];

  const matches = cases
    .filter((item) => ACTIVE_CASE_STATUSES.includes(item.status))
    .map((item) => scoreMatch(item, investor))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow={`${INVESTOR_TYPE_LABEL[investor.investorType]} · ${investor.contactName || "No contact recorded"}`}
        title={investor.firmName}
        description={investor.notes || "No relationship notes recorded yet."}
        backTo={{ to: "/investors", label: "Investor Network" }}
        actions={
          <>
            <Button variant="outline" className="gap-1.5" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setInteractionOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Log interaction
            </Button>
            <Button asChild className="gap-1.5">
              <Link to={matches[0] ? `/matches?case=${matches[0].caseId}&investor=${investor.id}` : "/matches"}>
                <Send className="h-4 w-4" aria-hidden="true" />
                Matches
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <RelationshipPill status={investor.relationship} label={RELATIONSHIP_LABEL[investor.relationship]} />
        {investor.email ? (
          <a
            href={`mailto:${investor.email}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <Mail className="h-3 w-3" aria-hidden="true" />
            {investor.email}
          </a>
        ) : (
          <span className="text-[11px] text-muted-foreground">No email recorded</span>
        )}
        <span className="text-[11px] text-muted-foreground">Last contact: {relativeDays(investor.lastContactAt)}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="panel p-5" aria-labelledby="preferences-heading">
            <h2 id="preferences-heading" className="text-[15px] font-semibold tracking-tight">
              Recorded preferences
            </h2>
            <p className="text-[11.5px] text-muted-foreground">The only inputs the matching rules use.</p>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="label-caps">Stages</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {investor.stages.length > 0 ? (
                    investor.stages.map((stage) => (
                      <Pill key={stage} tone="brand">
                        {stage}
                      </Pill>
                    ))
                  ) : (
                    <span className="text-[12px] text-muted-foreground">No stage preference recorded.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="label-caps">Sectors</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {investor.sectors.length > 0 ? (
                    investor.sectors.map((sector) => <Pill key={sector}>{sector}</Pill>)
                  ) : (
                    <span className="text-[12px] text-muted-foreground">No sector preference recorded.</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="label-caps">Geographies</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {investor.geographies.length > 0 ? (
                    investor.geographies.map((geo) => <Pill key={geo}>{geo}</Pill>)
                  ) : (
                    <span className="text-[12px] text-muted-foreground">No geography preference recorded.</span>
                  )}
                </dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <div>
                <p className="label-caps">Cheque range</p>
                <p className="mt-1 text-[13px] font-medium tabular-nums">
                  {formatCurrencyRange(investor.checkMin, investor.checkMax)}
                </p>
              </div>
              <div>
                <p className="label-caps">Leads rounds</p>
                <p className="mt-1 text-[13px] font-medium">{investor.leadsRounds ? "Yes" : "No"}</p>
              </div>
            </div>
          </section>

          <section className="panel p-5" aria-labelledby="interactions-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="interactions-heading" className="text-[15px] font-semibold tracking-tight">
                  Interaction history
                </h2>
                <p className="text-[11.5px] text-muted-foreground">
                  {interactions.length === 0 ? "No interactions logged yet." : `${interactions.length} logged`}
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInteractionOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Log
              </Button>
            </div>

            {interactions.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
                Log the first conversation so the relationship has a memory.
              </p>
            ) : (
              <ol className="mt-4 space-y-0">
                {interactions.map((interaction, index) => (
                  <li key={interaction.id} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < interactions.length - 1 ? (
                      <span className="absolute left-[5px] top-3 h-full w-px bg-border" aria-hidden="true" />
                    ) : null}
                    <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-brand bg-card" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          {INTERACTION_KIND_LABEL[interaction.kind]}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground">{formatShortDate(interaction.occurredAt)}</p>
                      </div>
                      <p className="mt-1 text-[13px] leading-relaxed text-foreground/90">{interaction.summary}</p>
                      {interaction.nextStep ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Next: {interaction.nextStep}
                          {interaction.nextStepDue ? ` · ${formatShortDate(interaction.nextStepDue)}` : ""}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="panel p-5" aria-labelledby="next-heading">
            <h2 id="next-heading" className="text-[15px] font-semibold tracking-tight">
              Next step
            </h2>
            {investor.nextStep ? (
              <>
                <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{investor.nextStep}</p>
                <p
                  className={
                    isOverdue(investor.nextStepDue)
                      ? "mt-1.5 text-[11px] font-semibold text-destructive"
                      : "mt-1.5 text-[11px] font-medium text-muted-foreground"
                  }
                >
                  {investor.nextStepDue ? dueLabel(investor.nextStepDue) : "No due date"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[12px] text-muted-foreground">No next step recorded for this relationship.</p>
            )}
            <p className="mt-3 border-t border-border pt-3 text-[10.5px] leading-relaxed text-muted-foreground">
              Added {formatShortDate(investor.createdAt)} · DealFlow IQ never contacts investors on your behalf.
            </p>
          </section>

          <section className="panel p-5" aria-labelledby="matched-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="matched-heading" className="text-[15px] font-semibold tracking-tight">
                Matched deals
              </h2>
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
            {matches.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                No active cases to test this investor against yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {matches.map((match) => (
                  <li key={match.caseId}>
                    <Link
                      to={`/matches?case=${match.caseId}`}
                      className="block rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-brand/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium">
                          {cases.find((item) => item.id === match.caseId)?.companyName ?? "Case"}
                        </p>
                        <span className="text-[12px] font-semibold tabular-nums text-brand-strong">{match.score}</span>
                      </div>
                      <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${match.score}%` }} />
                      </div>
                      <p className="mt-1 text-[10.5px] text-muted-foreground">{MATCH_TIER_LABEL[match.tier]}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="outreach-heading">
            <h2 id="outreach-heading" className="text-[15px] font-semibold tracking-tight">
              Outreach
            </h2>
            {outreach.length === 0 ? (
              <p className="mt-2 text-[12px] text-muted-foreground">
                No outreach drafted for this investor. Draft it from Matches &amp; Outreach.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {outreach.map((item) => (
                  <li key={item.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-[12px] font-medium leading-snug">{item.subject}</p>
                      <OutreachStatusPill status={item.status} label={OUTREACH_STATUS_LABEL[item.status]} />
                    </div>
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      {formatShortDate(item.sentAt ?? item.approvedAt ?? item.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to={`/matches?investor=${investor.id}`}
              className="mt-3 inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
            >
              Open matching
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </section>
        </aside>
      </div>

      <InvestorForm open={editOpen} onOpenChange={setEditOpen} initial={investor} />
      <InteractionForm
        open={interactionOpen}
        onOpenChange={setInteractionOpen}
        investorId={investor.id}
        cases={cases}
      />
    </div>
  );
};

export default InvestorDetail;

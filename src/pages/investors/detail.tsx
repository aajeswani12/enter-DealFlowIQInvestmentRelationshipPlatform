import { ArrowLeft, ArrowRight, ChevronRight, Mail, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { ContactForm } from "@/components/forms/contact-form";
import { InvestorForm } from "@/components/forms/investor-form";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import {
  CASE_STATUS_LABEL,
  INTERACTION_KIND_LABEL,
  INVESTOR_STATUS_LABEL,
  INVESTOR_TYPE_LABEL,
  OUTREACH_EVENT_LABEL,
  OUTREACH_PERMISSION_LABEL,
  OUTREACH_STATUS_LABEL,
  RELATIONSHIP_LABEL,
  RELATIONSHIP_STRENGTH_LABEL,
} from "@/lib/constants";
import { dueLabel, formatCurrencyRange, formatShortDate, isOverdue } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { InvestorContact, InvestmentCase } from "@/lib/types";
import { InteractionForm } from "./interaction-form";

type InvestorTab = "overview" | "contacts" | "deals" | "activity";

const TABS: { id: InvestorTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "deals", label: "Deals" },
  { id: "activity", label: "Activity" },
];

function firstSentences(value: string, count = 2): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return "No investor description recorded.";
  const parts = normalized.match(/[^.!?]+[.!?]+/g);
  return (parts ? parts.slice(0, count).join(" ") : normalized).trim();
}

function checkSize(investor: { checkMin: number | null; checkMax: number | null; currency: string }): string {
  if (investor.checkMin === null && investor.checkMax === null) return "Unknown";
  return formatCurrencyRange(investor.checkMin, investor.checkMax, investor.currency);
}

function AddDealControl({ investorId, availableDeals }: { investorId: string; availableDeals: InvestmentCase[] }) {
  const actions = useWorkspaceActions();
  const [dealId, setDealId] = useState("");

  const add = async () => {
    if (!dealId) return;
    try {
      await actions.addDealInvestor.mutateAsync({
        dealId,
        investorId,
        relationshipStatus: "new",
        notes: "",
      });
      toast.success("Investor added to the deal");
      setDealId("");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add this investor to the deal.");
    }
  };

  if (availableDeals.length === 0) {
    return <p className="text-[14px] text-muted-foreground">All current deals are linked.</p>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <label htmlFor="add-deal-select" className="sr-only">Select a deal to add</label>
      <select
        id="add-deal-select"
        value={dealId}
        onChange={(event) => setDealId(event.target.value)}
        className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-[16px] text-foreground"
      >
        <option value="">Choose a deal</option>
        {availableDeals.map((item) => (
          <option key={item.id} value={item.id}>{item.companyName}</option>
        ))}
      </select>
      <Button type="button" size="default" className="h-10 gap-2 text-[16px]" onClick={() => void add()} disabled={!dealId || actions.addDealInvestor.isPending}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {actions.addDealInvestor.isPending ? "Adding…" : "Add to Deal"}
      </Button>
    </div>
  );
}

const InvestorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const [tab, setTab] = useState<InvestorTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<InvestorContact | null>(null);

  const investor = workspace.investors.find((item) => item.id === id);

  if (isLoading) {
    return <div className="mx-auto w-full max-w-[1440px] px-1"><LoadingPanel rows={4} /></div>;
  }

  if (!investor) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <Link to="/investors" className="inline-flex items-center gap-2 text-[16px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Investors
        </Link>
        <div className="panel p-8">
          <h1 className="text-[32px] font-bold tracking-tight">Investor not found</h1>
          <p className="mt-2 text-[17px] leading-[1.5] text-muted-foreground">This record is not in the workspace.</p>
        </div>
      </div>
    );
  }

  const contacts = investor.contacts;
  const linkedDeals = workspace.dealInvestors
    .filter((association) => association.investorId === investor.id)
    .map((association) => ({
      association,
      deal: workspace.cases.find((item) => item.id === association.dealId) ?? null,
    }))
    .filter((item): item is { association: (typeof workspace.dealInvestors)[number]; deal: InvestmentCase } => Boolean(item.deal));
  const linkedIds = new Set(linkedDeals.map((item) => item.deal.id));
  const availableDeals = workspace.cases
    .filter((item) => !linkedIds.has(item.id))
    .sort((a, b) => a.companyName.localeCompare(b.companyName));
  const suggestions = workspace.matches
    .filter((match) => match.investorId === investor.id && !linkedIds.has(match.dealId))
    .map((match) => ({ match, deal: workspace.cases.find((item) => item.id === match.dealId) }))
    .filter((item): item is { match: (typeof workspace.matches)[number]; deal: InvestmentCase } => Boolean(item.deal));

  const interactions = workspace.interactions
    .filter((item) => item.investorId === investor.id)
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const outreach = workspace.outreach
    .filter((item) => item.investorId === investor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const outreachEvents = workspace.outreachEvents
    .filter((event) => event.investorId === investor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const investorAudit = workspace.audit
    .filter((event) => event.entityType === "investors" && event.entityId === investor.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const activity = [
    ...interactions.map((interaction) => ({
      id: `interaction-${interaction.id}`,
      date: interaction.occurredAt,
      title: INTERACTION_KIND_LABEL[interaction.kind],
      detail: interaction.summary,
      meta: interaction.dealId ? workspace.cases.find((item) => item.id === interaction.dealId)?.companyName ?? "Interaction" : "Interaction",
      href: interaction.dealId ? `/cases/${interaction.dealId}` : null,
    })),
    ...outreachEvents.map((event) => ({
      id: `outreach-${event.id}`,
      date: event.createdAt,
      title: OUTREACH_EVENT_LABEL[event.eventType] ?? "Outreach update",
      detail: event.note,
      meta: "Outreach",
      href: event.dealId ? `/cases/${event.dealId}` : null,
    })),
    ...investorAudit.map((event) => ({
      id: `audit-${event.id}`,
      date: event.createdAt,
      title: "Investor updated",
      detail: event.summary,
      meta: "Record update",
      href: null,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const location = investor.geographies.length > 0 ? investor.geographies.join(", ") : "Unknown";
  const description = firstSentences(investor.thesis, 2);

  const removeLink = async (associationId: string, companyName: string) => {
    if (!window.confirm(`Remove this investor from ${companyName}? The investor record will not be deleted.`)) return;
    try {
      await actions.removeDealInvestor.mutateAsync(associationId);
      toast.success("Deal link removed; investor record preserved");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove this deal link.");
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home" ? 0 :
      event.key === "End" ? TABS.length - 1 :
      event.key === "ArrowRight" ? (index + 1) % TABS.length :
      (index - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    setTab(next.id);
    requestAnimationFrame(() => document.getElementById(`investor-tab-${next.id}`)?.focus());
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7">
      <header className="space-y-5">
        <Link to="/investors" className="inline-flex items-center gap-2 text-[16px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to Investors
        </Link>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">{investor.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[16px] text-muted-foreground">
              <span>{INVESTOR_TYPE_LABEL[investor.investorType]}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" aria-hidden="true" />{location}</span>
              <Pill tone={investor.status === "active" ? "success" : "neutral"} className="text-[14px]">{INVESTOR_STATUS_LABEL[investor.status]}</Pill>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="default" className="h-10 gap-2 text-[16px]" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" aria-hidden="true" />Edit Investor
            </Button>
            <Button size="default" variant="outline" className="h-10 gap-2 text-[16px]" onClick={() => setInteractionOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />Add Note
            </Button>
          </div>
        </div>
      </header>

      <div role="tablist" aria-label="Investor details" className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            id={`investor-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`investor-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
            className={tab === item.id
              ? "border-b-2 border-brand px-4 py-3 text-[16px] font-semibold text-brand-strong"
              : "border-b-2 border-transparent px-4 py-3 text-[16px] font-medium text-muted-foreground hover:text-foreground"}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section role="tabpanel" id="investor-panel-overview" aria-labelledby="investor-tab-overview" className="grid gap-7 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
          <div className="space-y-7">
            <section className="panel p-6 sm:p-8" aria-labelledby="investor-summary-heading">
              <h2 id="investor-summary-heading" className="text-[21px] font-semibold tracking-tight">Summary</h2>
              <p className="mt-3 max-w-[70ch] text-[17px] leading-[1.5] text-foreground/90">{description}</p>
              <details className="mt-5 border-t border-border pt-4">
                <summary className="cursor-pointer text-[16px] font-medium text-brand-strong">More details</summary>
                <div className="mt-4 space-y-4 text-[16px] leading-[1.5]">
                  <div>
                    <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Complete thesis</p>
                    <p className="mt-1 whitespace-pre-line text-[17px] leading-[1.5]">{investor.thesis || "Unknown"}</p>
                  </div>
                  {investor.notes ? (
                    <div>
                      <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Notes</p>
                      <p className="mt-1 whitespace-pre-line text-[17px] leading-[1.5]">{investor.notes}</p>
                    </div>
                  ) : null}
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <div><dt className="text-[14px] text-muted-foreground">Website</dt><dd className="mt-1 text-[16px]">{investor.website || "Unknown"}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Currency</dt><dd className="mt-1 text-[16px]">{investor.currency}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Leads rounds</dt><dd className="mt-1 text-[16px]">{investor.leadsRounds ? "Yes" : "No"}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Relationship</dt><dd className="mt-1 text-[16px]">{RELATIONSHIP_LABEL[investor.relationship]}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Added</dt><dd className="mt-1 text-[16px]">{formatShortDate(investor.createdAt)}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Last contact</dt><dd className="mt-1 text-[16px]">{investor.lastContactAt ? formatShortDate(investor.lastContactAt) : "Unknown"}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Next step</dt><dd className="mt-1 text-[16px]">{investor.nextStep || "Unknown"}</dd></div>
                    <div><dt className="text-[14px] text-muted-foreground">Next step due</dt><dd className={investor.nextStepDue && isOverdue(investor.nextStepDue) ? "mt-1 text-[16px] font-medium text-destructive" : "mt-1 text-[16px]"}>{investor.nextStepDue ? dueLabel(investor.nextStepDue) : "Unknown"}</dd></div>
                  </dl>
                </div>
              </details>
            </section>

            <section className="panel p-6 sm:p-8" aria-labelledby="investor-preferences-heading">
              <h2 id="investor-preferences-heading" className="text-[21px] font-semibold tracking-tight">Investment Preferences</h2>
              <dl className="mt-5 space-y-5">
                <div>
                  <dt className="text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Preferred sectors</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {investor.sectors.length > 0 ? investor.sectors.map((sector) => <Pill key={sector} tone="brand" className="text-[14px]">{sector}</Pill>) : <span className="text-[17px] text-muted-foreground">Unknown</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Investment stages</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {investor.stages.length > 0 ? investor.stages.map((stage) => <Pill key={stage} className="text-[14px]">{stage}</Pill>) : <span className="text-[17px] text-muted-foreground">Unknown</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-[14px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Typical check size</dt>
                  <dd className="mt-2"><Pill tone="navy" className="text-[14px]">{checkSize(investor)}</Pill></dd>
                </div>
              </dl>
            </section>

            {suggestions.length > 0 ? (
              <details className="panel p-6 sm:p-8">
                <summary className="cursor-pointer text-[16px] font-medium text-muted-foreground">Suggested deals (not associated)</summary>
                <p className="mt-2 text-[14px] text-muted-foreground">Saved suggestions only. They are distinct from associated deals.</p>
                <ul className="mt-3 divide-y divide-border">
                  {suggestions.slice(0, 8).map(({ deal }) => (
                    <li key={deal.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <span className="text-[16px] font-medium">{deal.companyName}</span>
                      <Link to={`/cases/${deal.id}`} className="inline-flex items-center gap-1 text-[16px] text-brand-strong hover:underline">Open deal <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>

          <aside className="space-y-7">
            <section className="panel p-6 sm:p-8" aria-labelledby="related-deals-heading">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 id="related-deals-heading" className="text-[21px] font-semibold tracking-tight">Related Deals</h2>
                  <p className="mt-1 text-[14px] text-muted-foreground">{linkedDeals.length} associated</p>
                </div>
                <Link to="/cases" className="text-[16px] text-brand-strong hover:underline">All deals</Link>
              </div>
              {linkedDeals.length === 0 ? (
                <p className="mt-4 text-[17px] leading-[1.5] text-muted-foreground">No associated deals yet.</p>
              ) : (
                <ul className="mt-4 divide-y divide-border">
                  {linkedDeals.slice(0, 3).map(({ deal, association }) => (
                    <li key={association.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                      <div>
                        <p className="text-[16px] font-medium">{deal.companyName}</p>
                        <p className="mt-1 text-[14px] text-muted-foreground">{deal.roundStage || "Unknown"} · {CASE_STATUS_LABEL[deal.status]}</p>
                      </div>
                      <Link to={`/cases/${deal.id}`} className="inline-flex items-center gap-1 text-[16px] text-brand-strong hover:underline">Open deal <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-5 border-t border-border pt-4">
                <AddDealControl investorId={investor.id} availableDeals={availableDeals} />
              </div>
            </section>

          </aside>
        </section>
      ) : null}

      {tab === "contacts" ? (
        <section role="tabpanel" id="investor-panel-contacts" aria-labelledby="investor-tab-contacts" className="panel p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[21px] font-semibold tracking-tight">Contacts</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">{contacts.length} recorded</p>
            </div>
            <Button size="default" variant="outline" className="h-10 gap-2 text-[16px]" onClick={() => { setEditingContact(null); setContactOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden="true" />Add contact
            </Button>
          </div>
          {contacts.length === 0 ? (
            <p className="mt-6 text-[17px] leading-[1.5] text-muted-foreground">No contacts recorded.</p>
          ) : (
            <ul className="mt-6 grid gap-5 md:grid-cols-2">
              {contacts.map((item) => (
                <li key={item.id} className="border-t border-border pt-4 first:border-0 first:pt-0 md:[&:nth-child(2)]:border-t-0 md:[&:nth-child(2)]:pt-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[21px] font-semibold tracking-tight">{item.contactName || item.email || "Unnamed contact"}</h3>
                        {item.isPrimary ? <Pill tone="brand" className="text-[14px]">Primary</Pill> : null}
                      </div>
                      <p className="mt-1 text-[16px] text-muted-foreground">{item.title || "Title unknown"}</p>
                    </div>
                    <button type="button" onClick={() => { setEditingContact(item); setContactOpen(true); }} className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label={`Edit ${item.contactName || "contact"}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.email ? <a href={`mailto:${item.email}`} className="inline-flex items-center gap-2 text-[16px] text-brand-strong hover:underline"><Mail className="h-4 w-4" aria-hidden="true" />{item.email}</a> : <span className="text-[14px] text-muted-foreground">No email recorded</span>}
                    <Pill className="text-[14px]">{RELATIONSHIP_STRENGTH_LABEL[item.relationshipStrength]}</Pill>
                    <Pill className="text-[14px]">{OUTREACH_PERMISSION_LABEL[item.outreachPermissionStatus]}</Pill>
                    {item.relationshipOwner ? <span className="text-[14px] text-muted-foreground">Owner: {item.relationshipOwner}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {tab === "deals" ? (
        <section role="tabpanel" id="investor-panel-deals" aria-labelledby="investor-tab-deals" className="space-y-7">
          <div className="panel p-6 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-[21px] font-semibold tracking-tight">Related Deals</h2>
                <p className="mt-1 text-[14px] text-muted-foreground">{linkedDeals.length} currently associated</p>
              </div>
              <Link to="/cases" className="text-[16px] text-brand-strong hover:underline">All deals</Link>
            </div>
            <div className="mt-5"><AddDealControl investorId={investor.id} availableDeals={availableDeals} /></div>
            {linkedDeals.length === 0 ? (
              <p className="mt-6 text-[17px] leading-[1.5] text-muted-foreground">No associated deals.</p>
            ) : (
              <ul className="mt-6 divide-y divide-border">
                {linkedDeals.map(({ association, deal }) => (
                  <li key={association.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <Link to={`/cases/${deal.id}`} className="text-[17px] font-medium hover:text-brand-strong">{deal.companyName}</Link>
                      <p className="mt-1 text-[14px] text-muted-foreground">{deal.roundStage || "Unknown"} · {CASE_STATUS_LABEL[deal.status]} · {RELATIONSHIP_LABEL[association.relationshipStatus]}</p>
                      {association.notes ? <p className="mt-1 whitespace-pre-line text-[16px] leading-[1.5] text-muted-foreground">{association.notes}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link to={`/cases/${deal.id}`} className="inline-flex items-center gap-1 text-[16px] text-brand-strong hover:underline">Open deal <ChevronRight className="h-4 w-4" aria-hidden="true" /></Link>
                      <Button type="button" variant="ghost" size="sm" className="h-9 gap-1 text-[16px] text-muted-foreground hover:text-destructive" onClick={() => void removeLink(association.id, deal.companyName)}>
                        <Trash2 className="h-4 w-4" aria-hidden="true" />Remove link
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ) : null}

      {tab === "activity" ? (
        <section role="tabpanel" id="investor-panel-activity" aria-labelledby="investor-tab-activity" className="panel p-6 sm:p-8">
          <h2 className="text-[21px] font-semibold tracking-tight">Recent Activity</h2>
          {activity.length === 0 ? (
            <p className="mt-4 text-[17px] leading-[1.5] text-muted-foreground">No interactions, notes or updates recorded.</p>
          ) : (
            <ol className="mt-6 space-y-0">
              {activity.map((entry) => (
                <li key={entry.id} className="relative flex gap-4 border-b border-border pb-5 last:border-0 last:pb-0">
                  <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[17px] font-semibold">{entry.title}</h3>
                      <time className="text-[14px] text-muted-foreground" dateTime={entry.date}>{formatShortDate(entry.date)}</time>
                    </div>
                    {entry.detail ? <p className="mt-1 text-[17px] leading-[1.5] text-foreground/90">{entry.detail}</p> : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[14px] text-muted-foreground">
                      <span>{entry.meta}</span>
                      {entry.href ? <Link to={entry.href} className="text-brand-strong hover:underline">Open deal</Link> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {outreach.length > 0 ? (
            <details className="mt-6 border-t border-border pt-4">
              <summary className="cursor-pointer text-[16px] font-medium text-muted-foreground">Outreach records · {outreach.length}</summary>
              <ul className="mt-3 divide-y divide-border">
                {outreach.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <span className="text-[16px]">{item.subject}</span>
                    <span className="flex items-center gap-2">
                      {item.nextFollowupAt ? <span className="text-[14px] text-muted-foreground">Follow-up {formatShortDate(item.nextFollowupAt)}</span> : null}
                      <Pill tone="neutral" className="text-[14px]">{OUTREACH_STATUS_LABEL[item.status]}</Pill>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <InvestorForm open={editOpen} onOpenChange={setEditOpen} initial={investor} />
      <InteractionForm open={interactionOpen} onOpenChange={setInteractionOpen} investorId={investor.id} deals={workspace.cases} contacts={investor.contacts} initialKind="note" />
      <ContactForm open={contactOpen} onOpenChange={setContactOpen} investorId={investor.id} initial={editingContact} hasPrimary={investor.contacts.some((person) => person.isPrimary)} />
    </div>
  );
};

export default InvestorDetail;

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleAlert,
  FilePlus2,
  FileText,
  FolderInput,
  Loader2,
  Mic,
  Pencil,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRoundSearch,
} from "lucide-react";
import { useEffect, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaseStatusPill, Pill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import {
  CASE_STATUS_LABEL,
  RELATIONSHIP_LABEL,
  RELATIONSHIP_OPTIONS,
  VERIFICATION_LABEL,
} from "@/lib/constants";
import { dueLabel, formatCurrency, formatDate, formatShortDate, isOverdue } from "@/lib/format";
import { buildCaseActivityEvents, buildCaseChecklist } from "@/lib/insights";
import { primaryContact } from "@/lib/investors";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type {
  Capture,
  CaseDocument,
  DealInvestor,
  Investor,
  Interaction,
  RelationshipStatus,
} from "@/lib/types";
import { AnalysisSection } from "./analysis-section";
import { ClaimsSection } from "./claims-section";
import { DecisionGapsSection } from "./gaps-section";
import { EvidenceTimeline } from "./evidence-timeline";
import { FollowUpTasks } from "./follow-up-tasks";
import { MemoWorkspace } from "./memo-workspace";

type CaseTab = "documents" | "activity" | "memo" | "more";
type ReadinessStatus = "Available" | "Needs Review" | "Missing";

const TABS: { id: CaseTab; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Full Activity" },
  { id: "memo", label: "Memo" },
  { id: "more", label: "More" },
];

const READINESS_TONE: Record<ReadinessStatus, "success" | "warning" | "neutral"> = {
  Available: "success",
  "Needs Review": "warning",
  Missing: "neutral",
};

const CHECK_ICON = {
  Available: CheckCircle2,
  "Needs Review": CircleAlert,
  Missing: Circle,
} as const;

const MEMO_STATUS_LABEL = {
  draft: "Draft",
  needs_review: "Needs Review",
  approved: "Approved",
} as const;

function firstSentences(value: string, count = 3): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const parts = normalized.match(/[^.!?]+[.!?]+/g);
  return (parts ? parts.slice(0, count).join(" ") : normalized).replace(/\s+/g, " ").trim();
}

function ownerName(
  userId: string | null,
  members: { userId: string | null; displayName: string; email: string }[],
): string {
  const member = members.find((item) => item.userId === userId);
  return member?.displayName || member?.email || "Unknown";
}

function lastInvestorActivity(
  investor: Investor,
  interactions: Interaction[],
  dealId: string,
): string | null {
  const dates = [
    investor.lastContactAt,
    ...interactions
      .filter((item) => item.investorId === investor.id && (!item.dealId || item.dealId === dealId))
      .map((item) => item.occurredAt),
  ].filter((value): value is string => Boolean(value));
  return dates.length > 0
    ? dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;
}

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();

  const [activeTab, setActiveTab] = useState<CaseTab>("documents");
  const [memoMounted, setMemoMounted] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [personOpen, setPersonOpen] = useState(false);
  const [personName, setPersonName] = useState("");
  const [personTitle, setPersonTitle] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [personRole, setPersonRole] = useState<"founder" | "contact" | "other">("founder");
  const [investorSearch, setInvestorSearch] = useState("");
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [associationStatus, setAssociationStatus] = useState<RelationshipStatus>("new");

  useEffect(() => {
    setActiveTab("documents");
    setMemoMounted(false);
    setDocOpen(false);
    setPersonOpen(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (location.hash === "#claims-heading" || location.hash === "#gaps-heading" || location.hash === "#more") {
      setActiveTab("more");
    } else if (location.hash === "#timeline" || location.hash === "#activity") {
      setActiveTab("activity");
    } else if (location.hash === "#documents") {
      setActiveTab("documents");
    } else if (location.hash === "#memo") {
      setActiveTab("memo");
    }
  }, [id, location.hash]);

  useEffect(() => {
    if (activeTab === "memo") setMemoMounted(true);
  }, [activeTab]);

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
      <div className="page-enter panel p-5">
        <p className="text-[14px] font-semibold">Deal not found.</p>
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link to="/cases">Back to Deals</Link>
        </Button>
      </div>
    );
  }

  const claims = workspace.claims.filter((item) => item.dealId === caseItem.id);
  const approvedClaims = claims.filter((claim) => claim.reviewStatus === "approved" && !claim.supersededBy);
  const draftClaims = claims.filter((claim) => claim.reviewStatus === "draft");
  const gaps = workspace.gaps.filter((item) => item.dealId === caseItem.id);
  const openGaps = gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review");
  const sources = workspace.captures.filter((item) => item.dealId === caseItem.id);
  const caseDocuments = workspace.caseDocuments.filter((item) => item.dealId === caseItem.id);
  const caseMemos = workspace.dealMemos
    .filter((item) => item.dealId === caseItem.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const people = workspace.dealPeople.filter((person) => person.dealId === caseItem.id);
  const followUpTasks = workspace.followUpTasks.filter((item) => item.dealId === caseItem.id);
  const openTasks = followUpTasks.filter((task) => task.status === "open");
  const manualAssociations = workspace.dealInvestors.filter((item) => item.dealId === caseItem.id);
  const manualRows = manualAssociations
    .map((association) => {
      const investor = workspace.investors.find((item) => item.id === association.investorId);
      if (!investor) return null;
      return {
        association,
        investor,
        contact: primaryContact(investor),
        lastActivity: lastInvestorActivity(investor, workspace.interactions, caseItem.id),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const matches = workspace.matches
    .filter((match) => match.dealId === caseItem.id)
    .map((match) => ({
      match,
      investor: workspace.investors.find((investor) => investor.id === match.investorId),
    }))
    .filter((item): item is { match: (typeof workspace.matches)[number]; investor: Investor } => Boolean(item.investor))
    .sort((a, b) => b.match.fitScore - a.match.fitScore);
  const associatedIds = new Set(manualAssociations.map((item) => item.investorId));
  const suggestedMatches = matches.filter(({ investor }) => !associatedIds.has(investor.id));
  const availableInvestors = workspace.investors.filter((investor) => {
    if (associatedIds.has(investor.id)) return false;
    const search = investorSearch.trim().toLowerCase();
    return !search || [investor.name, investor.website, ...investor.sectors, ...investor.stages].join(" ").toLowerCase().includes(search);
  });
  const owner = ownerName(caseItem.ownerUserId, workspace.members);
  const summary = caseItem.summary ? firstSentences(caseItem.summary, 3) : "Unknown";
  const funding = caseItem.raiseAmount ?? caseItem.chequeSought;
  const founded = people.filter((person) => person.role === "founder");
  const analysisRuns = workspace.analysisRuns.filter((item) => item.dealId === caseItem.id);
  const briefs = workspace.briefs.filter((item) => item.dealId === caseItem.id);
  const nextAction =
    caseItem.nextStep ||
    openTasks.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0]?.title ||
    "Unknown";

  const checklist = buildCaseChecklist({
    caseItem,
    claims,
    people,
    gaps,
    documents: caseDocuments,
    captures: sources,
  });

  const activityEvents = buildCaseActivityEvents({
    caseId: caseItem.id,
    documents: caseDocuments,
    captures: sources,
    memos: caseMemos,
    associations: manualAssociations,
    investors: workspace.investors,
    audit: workspace.audit,
  });
  const recentActivity = activityEvents.slice(0, 3);

  const keyFacts = [
    { label: "Website", value: caseItem.website || "Unknown" },
    { label: "Geography", value: caseItem.geography || "Unknown" },
    { label: "Cheque sought", value: caseItem.chequeSought !== null ? formatCurrency(caseItem.chequeSought) : "Unknown" },
    { label: "Founders", value: founded.length > 0 ? founded.map((person) => person.name).join(", ") : "Unknown" },
    { label: "Reviewed facts", value: `${approvedClaims.length}`, action: () => setActiveTab("more") },
  ].slice(0, 5);

  const addDocument = async () => {
    if (!docFile) {
      toast.error("Choose a document.");
      return;
    }
    try {
      await actions.addCaseDocument.mutateAsync({
        dealId: caseItem.id,
        title: docTitle || docFile.name,
        file: docFile,
        sourceDate: new Date(`${docDate}T12:00:00`).toISOString(),
      });
      toast.success("Document added");
      setDocOpen(false);
      setDocFile(null);
      setDocTitle("");
      setActiveTab("documents");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the document.");
    }
  };

  const addPerson = async () => {
    if (!personName.trim()) {
      toast.error("Name required.");
      return;
    }
    try {
      await actions.createDealPerson.mutateAsync({
        dealId: caseItem.id,
        input: { name: personName, title: personTitle, email: personEmail, role: personRole },
      });
      setPersonName("");
      setPersonTitle("");
      setPersonEmail("");
      setPersonRole("founder");
      setPersonOpen(false);
      toast.success("Person added");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add the person.");
    }
  };

  const addInvestor = async () => {
    if (!selectedInvestorId) return;
    try {
      await actions.addDealInvestor.mutateAsync({
        dealId: caseItem.id,
        investorId: selectedInvestorId,
        relationshipStatus: associationStatus,
        notes: "",
      });
      setSelectedInvestorId("");
      setInvestorSearch("");
      setAssociationStatus("new");
      toast.success("Investor linked");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not link the investor.");
    }
  };

  const removeInvestor = async (association: DealInvestor, investor: Investor) => {
    try {
      await actions.removeDealInvestor.mutateAsync(association.id);
      toast.success(`${investor.name} removed from deal; profile unchanged.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove the association.");
    }
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? TABS.length - 1
          : event.key === "ArrowRight"
            ? (index + 1) % TABS.length
            : (index - 1 + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    setActiveTab(next.id);
    window.requestAnimationFrame(() => document.getElementById(`case-tab-${next.id}`)?.focus());
  };

  return (
    <div className="page-enter space-y-7">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Link to="/cases" className="text-[10.5px] font-medium text-muted-foreground hover:text-foreground">
            ← Deals
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight">{caseItem.companyName}</h1>
            <CaseStatusPill status={caseItem.status} label={CASE_STATUS_LABEL[caseItem.status]} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[16px] text-muted-foreground">
            <span>{caseItem.sector || "Unknown"}</span>
            <span>{caseItem.roundStage || "Unknown"}</span>
            <button type="button" onClick={() => setActiveTab("memo")} className="font-medium text-brand-strong hover:underline">
              Memo: {caseMemos[0] ? MEMO_STATUS_LABEL[caseMemos[0].status] : "None"}
            </button>
            {caseItem.isSynthetic ? <Pill tone="warning" className="text-[14px]">Synthetic</Pill> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-10 gap-2 text-[16px]">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add Information
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[220px]">
              <DropdownMenuItem asChild className="text-[16px]">
                <Link to={`/inbox/capture?deal=${caseItem.id}`} className="flex w-full items-center gap-2">
                  <Mic className="h-4 w-4" aria-hidden="true" />Add voice note
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="text-[16px]" onSelect={() => setDocOpen(true)}>
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />Add document
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[16px]">
                <Link to="/imports" className="flex w-full items-center gap-2">
                  <FolderInput className="h-4 w-4" aria-hidden="true" />Import files
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="outline" className="h-10 gap-2 text-[16px]">
            <Link to={`/create-memo?deal=${caseItem.id}`}><PenLine className="h-4 w-4" aria-hidden="true" />Create Memo</Link>
          </Button>
          <Button asChild variant="outline" className="h-10 gap-2 text-[16px]">
            <Link to={`/find-investors?case=${caseItem.id}`}><UserRoundSearch className="h-4 w-4" aria-hidden="true" />Find Investors</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-7 lg:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <div className="space-y-3">
          <section className="panel p-4" aria-labelledby="deal-summary-heading">
            <h2 id="deal-summary-heading" className="text-[21px] font-semibold tracking-tight">Overview</h2>
            <p className="mt-2 max-w-[70ch] text-[17px] leading-[1.5] text-foreground/90">{summary}</p>
          </section>

          <section className="panel p-4" aria-labelledby="key-facts-heading">
            <h2 id="key-facts-heading" className="text-[21px] font-semibold tracking-tight">Key Facts</h2>
            <dl className="mt-2 space-y-1.5">
              {keyFacts.map((fact) => (
                <div key={fact.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                  <dt className="text-[14px] text-muted-foreground">{fact.label}</dt>
                  {fact.action ? (
                    <button type="button" onClick={fact.action} className="text-right text-[16px] font-medium text-brand-strong hover:underline">
                      {fact.value} →
                    </button>
                  ) : (
                    <dd className="max-w-[70%] text-right text-[16px] font-medium">{fact.value}</dd>
                  )}
                </div>
              ))}
            </dl>
          </section>

          <section className="panel p-4" aria-labelledby="next-action-heading">
            <h2 id="next-action-heading" className="text-[21px] font-semibold tracking-tight">Next Action</h2>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[17px] leading-[1.5]">{nextAction}</p>
              {caseItem.nextStepDue ? (
                <span className={isOverdue(caseItem.nextStepDue) ? "text-[14px] font-semibold text-destructive" : "text-[14px] text-muted-foreground"}>
                  {dueLabel(caseItem.nextStepDue)}
                </span>
              ) : null}
            </div>
          </section>

          <section className="panel p-4" aria-labelledby="recent-heading">
            <div className="flex items-center justify-between">
              <h2 id="recent-heading" className="text-[21px] font-semibold tracking-tight">Recent Activity</h2>
              <button type="button" onClick={() => setActiveTab("activity")} className="text-[16px] font-medium text-brand-strong hover:underline">All activity</button>
            </div>
            {recentActivity.length > 0 ? (
              <ul className="mt-2 space-y-1.5">
                {recentActivity.map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => setActiveTab("activity")} className="flex w-full items-baseline justify-between gap-3 text-left">
                      <span className="min-w-0">
                        <span className="block truncate text-[16px] font-medium">{entry.title}</span>
                        <span className="text-[14px] text-muted-foreground">{entry.type}</span>
                      </span>
                      <span className="shrink-0 text-[14px] text-muted-foreground">{entry.date ? formatShortDate(entry.date) : "Unknown date"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[16px] text-muted-foreground">No activity.</p>
            )}
          </section>
        </div>

        <aside className="space-y-3">
          <section className="panel p-4" aria-labelledby="deal-investors-heading">
            <h2 id="deal-investors-heading" className="text-[21px] font-semibold tracking-tight">Investors on This Deal</h2>
            {manualRows.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {manualRows.map(({ association, investor, contact, lastActivity }) => (
                  <li key={association.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Link to={`/investors/${investor.id}`} className="text-[16px] font-medium hover:text-brand-strong">{investor.name}</Link>
                        <p className="truncate text-[14px] text-muted-foreground">
                          {contact?.contactName || "Unknown contact"}{contact?.email ? ` · ${contact.email}` : ""}
                        </p>
                        <p className="text-[14px] text-muted-foreground">{RELATIONSHIP_LABEL[association.relationshipStatus]} · {lastActivity ? formatShortDate(lastActivity) : "No activity"}</p>
                      </div>
                      <button type="button" onClick={() => void removeInvestor(association, investor)} aria-label={`Remove ${investor.name} from deal`} className="rounded p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[16px] text-muted-foreground">None associated.</p>
            )}

            <div className="mt-3 space-y-1.5 border-t border-border pt-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input value={investorSearch} onChange={(event) => setInvestorSearch(event.target.value)} placeholder="Search investors" className="h-10 bg-card pl-8 text-[16px]" />
              </div>
              <SelectField
                value={selectedInvestorId}
                onChange={setSelectedInvestorId}
                options={availableInvestors.map((investor) => ({ value: investor.id, label: investor.name }))}
                placeholder={availableInvestors.length ? "Select investor" : "No available investors"}
                ariaLabel="Select existing investor"
              />
              <div className="flex gap-1.5">
                <div className="min-w-0 flex-1">
                  <SelectField value={associationStatus} onChange={(value) => setAssociationStatus(value as RelationshipStatus)} options={RELATIONSHIP_OPTIONS} ariaLabel="Relationship status" />
                </div>
                <Button size="sm" className="h-10 text-[16px]" onClick={() => void addInvestor()} disabled={!selectedInvestorId || actions.addDealInvestor.isPending}>
                  Add
                </Button>
              </div>
            </div>
            {suggestedMatches.length > 0 ? (
              <button type="button" onClick={() => setActiveTab("more")} className="mt-2 text-left text-[14px] font-medium text-brand-strong hover:underline">
                Suggested investors ({suggestedMatches.length}) → distinct from associated
              </button>
            ) : null}
          </section>

          <section className="panel p-4" aria-labelledby="checklist-heading">
            <h2 id="checklist-heading" className="text-[21px] font-semibold tracking-tight">Evidence Status</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">Availability, not verification or investment quality.</p>
            <ul className="mt-2 space-y-1.5">
              {checklist.map((item) => {
                const Icon = CHECK_ICON[item.status];
                return (
                  <li key={item.key} title={item.detail} className="flex items-center justify-between gap-2 border-b border-border/60 pb-1.5 last:border-0 last:pb-0">
                    <span className="flex min-w-0 items-center gap-1.5 text-[16px] text-foreground/90">
                      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <Pill tone={READINESS_TONE[item.status]}>{item.status}</Pill>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <div className="border-t border-border pt-3">
        <div role="tablist" aria-label="Case details" className="flex min-w-max gap-1 overflow-x-auto">
          {TABS.map((tab, index) => (
            <button
              key={tab.id}
              id={`case-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`case-panel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              onClick={() => setActiveTab(tab.id)}
              className={activeTab === tab.id
                ? "border-b-2 border-brand px-4 py-3 text-[16px] font-semibold text-brand-strong"
                : "border-b-2 border-transparent px-4 py-3 text-[16px] font-medium text-muted-foreground hover:text-foreground"}
            >
              {tab.label}
              {tab.id === "documents" ? ` · ${caseDocuments.length + sources.length}` : null}
            </button>
          ))}
        </div>

        <div className="mt-3">
          {activeTab === "documents" ? (
            <section role="tabpanel" id="case-panel-documents" aria-labelledby="case-tab-documents" className="space-y-3">
              <EvidenceTimeline
                dealId={caseItem.id}
                documents={caseDocuments}
                captures={sources}
                batches={workspace.importBatches}
                interactions={[]}
                investors={workspace.investors}
              />
              <details className="panel p-0">
                <summary className="cursor-pointer px-4 py-2.5 text-[11.5px] font-semibold">Source analysis &amp; excerpts</summary>
                <div className="border-t border-border">
                  <AnalysisSection deal={caseItem} sources={sources} runs={analysisRuns} briefs={briefs} />
                </div>
              </details>
            </section>
          ) : null}

          {activeTab === "activity" ? (
            <section role="tabpanel" id="case-panel-activity" aria-labelledby="case-tab-activity">
              {activityEvents.length > 0 ? (
                <ol className="panel divide-y divide-border">
                  {activityEvents.map((event) => {
                    const document = event.documentId ? caseDocuments.find((item) => item.id === event.documentId) : null;
                    return (
                      <li key={event.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[10.5px]">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{event.title}</span>
                            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">{event.type}</span>
                          </div>
                          <p className="mt-0.5 text-[9.5px] text-muted-foreground">{event.detail}</p>
                        </div>
                        <span className="shrink-0 text-[9.5px] text-muted-foreground">{event.date ? formatShortDate(event.date) : "Unknown date"}</span>
                        {document ? (
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[9.5px]" onClick={() => void api.getImportDocumentUrl(document.storagePath).then((url) => {
                            if (!url) {
                              toast.error("Source unavailable.");
                              return;
                            }
                            window.open(url, "_blank", "noopener,noreferrer");
                          })}>Open source</Button>
                        ) : event.captureId ? (
                          <Link to={`/inbox#source-${event.captureId}`} className="text-[9.5px] font-medium text-brand-strong hover:underline">Source</Link>
                        ) : event.memoId ? (
                          <button type="button" onClick={() => setActiveTab("memo")} className="text-[9.5px] font-medium text-brand-strong hover:underline">Memo</button>
                        ) : event.investorId ? (
                          <Link to={`/investors/${event.investorId}`} className="text-[9.5px] font-medium text-brand-strong hover:underline">Profile</Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-[11px] text-muted-foreground">No activity.</p>
              )}
            </section>
          ) : null}

          {memoMounted ? (
            <div hidden={activeTab !== "memo"} aria-hidden={activeTab !== "memo"}>
              <section role="tabpanel" id="case-panel-memo" aria-labelledby="case-tab-memo">
                <MemoWorkspace deal={caseItem} />
              </section>
            </div>
          ) : null}

          {activeTab === "more" ? (
            <section role="tabpanel" id="case-panel-more" aria-labelledby="case-tab-more" className="space-y-3">
              <details className="panel p-0" open>
                <summary className="cursor-pointer px-4 py-2.5 text-[11.5px] font-semibold">Company Details</summary>
                <dl className="grid gap-x-5 gap-y-2 border-t border-border px-4 py-3 text-[10.5px] sm:grid-cols-2">
                  {[
                    ["Website", caseItem.website || "Unknown"],
                    ["Sector", caseItem.sector || "Unknown"],
                    ["Stage", caseItem.roundStage || "Unknown"],
                    ["Geography", caseItem.geography || "Unknown"],
                    ["Funding", funding !== null ? formatCurrency(funding) : "Unknown"],
                    ["Cheque sought", caseItem.chequeSought !== null ? formatCurrency(caseItem.chequeSought) : "Unknown"],
                    ["Pre-money", caseItem.preMoneyValuation !== null ? formatCurrency(caseItem.preMoneyValuation) : "Unknown"],
                    ["Ownership target", caseItem.ownershipTarget !== null ? `${caseItem.ownershipTarget}%` : "Unknown"],
                    ["Lead partner", caseItem.leadPartner || "Unknown"],
                    ["Referred by", caseItem.referredBy || "Unknown"],
                    ["Case owner", owner],
                    ["Next step", caseItem.nextStep || "Unknown"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2 border-b border-border/60 pb-1">
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-t border-border px-4 py-2">
                  <Button size="sm" variant="ghost" className="h-7 gap-1 px-1 text-[10px]" onClick={() => setEditOpen(true)}><Pencil className="h-3 w-3" aria-hidden="true" />Edit details</Button>
                </div>
              </details>

              <details className="panel p-0">
                <summary className="cursor-pointer px-4 py-2.5 text-[11.5px] font-semibold">People</summary>
                <div className="border-t border-border px-4 py-3">
                  {people.length > 0 ? (
                    <ul className="space-y-1.5">
                      {people.map((person) => (
                        <li key={person.id} className="flex justify-between gap-2 text-[10.5px]"><span className="font-medium">{person.name}{person.title ? ` · ${person.title}` : ""}</span><span className="text-muted-foreground">{person.email || person.role}</span></li>
                      ))}
                    </ul>
                  ) : <p className="text-[10.5px] text-muted-foreground">No people.</p>}
                  <Button size="sm" variant="ghost" className="mt-2 h-7 px-1 text-[10px]" onClick={() => setPersonOpen((open) => !open)}><Plus className="h-3 w-3" aria-hidden="true" />Add person</Button>
                  {personOpen ? (
                    <div className="mt-2 space-y-1.5 rounded-md border border-border p-2">
                      <div className="grid gap-1.5 sm:grid-cols-2">
                        <Input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Name" className="h-8 bg-card text-[11px]" aria-label="Person name" />
                        <Input value={personTitle} onChange={(event) => setPersonTitle(event.target.value)} placeholder="Title" className="h-8 bg-card text-[11px]" aria-label="Person title" />
                        <Input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email" className="h-8 bg-card text-[11px]" aria-label="Person email" />
                        <SelectField value={personRole} onChange={(value) => setPersonRole(value as "founder" | "contact" | "other")} options={[{ value: "founder", label: "Founder" }, { value: "contact", label: "Contact" }, { value: "other", label: "Other" }]} ariaLabel="Person role" />
                      </div>
                      <Button size="sm" className="h-7 text-[10px]" onClick={() => void addPerson()} disabled={actions.createDealPerson.isPending}>Save</Button>
                    </div>
                  ) : null}
                </div>
              </details>

              <ClaimsSection dealId={caseItem.id} items={claims} />
              <DecisionGapsSection dealId={caseItem.id} items={gaps} />
              <FollowUpTasks tasks={followUpTasks} />

              <section className="panel p-4" aria-labelledby="suggested-heading">
                <div className="flex items-center justify-between gap-2">
                  <h2 id="suggested-heading" className="text-[13.5px] font-semibold tracking-tight">Suggested Investors</h2>
                  <Button size="sm" variant="ghost" className="h-7 text-[10px]" asChild><Link to={`/matches?case=${caseItem.id}`}>Open matching <ArrowRight className="h-3 w-3" aria-hidden="true" /></Link></Button>
                </div>
                <p className="mt-0.5 text-[9.5px] text-muted-foreground">Not associated; suggestions from stored preferences.</p>
                {suggestedMatches.length > 0 ? (
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {suggestedMatches.map(({ match, investor }) => (
                      <li key={match.id} className="rounded-md border border-border bg-card px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <Link to={`/investors/${investor.id}`} className="text-[11px] font-medium hover:text-brand-strong">{investor.name}</Link>
                          {match.needsResearch ? <Pill tone="warning">Needs research</Pill> : null}
                        </div>
                        <p className="mt-0.5 text-[9px] text-muted-foreground">Suggested · not confirmed interest</p>
                      </li>
                    ))}
                  </ul>
                ) : <p className="mt-2 text-[10.5px] text-muted-foreground">No suggestions.</p>}
              </section>
            </section>
          ) : null}
        </div>
      </div>

      <Dialog
        open={docOpen}
        onOpenChange={(open) => {
          setDocOpen(open);
          if (!open) {
            setDocFile(null);
            setDocTitle("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>Private original attached to this case.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="File" htmlFor="case-doc-file">
              <Input id="case-doc-file" type="file" accept=".pdf,.docx,.csv,.txt,.eml" onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setDocFile(file);
                if (file && !docTitle) setDocTitle(file.name);
              }} className="bg-card" />
            </Field>
            <Field label="Title" htmlFor="case-doc-title"><Input id="case-doc-title" value={docTitle} onChange={(event) => setDocTitle(event.target.value)} className="bg-card" /></Field>
            <Field label="Source date" htmlFor="case-doc-date"><Input id="case-doc-date" type="date" value={docDate} onChange={(event) => setDocDate(event.target.value)} className="bg-card" /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocOpen(false)}>Cancel</Button>
            <Button onClick={() => void addDocument()} disabled={!docFile || actions.addCaseDocument.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CaseForm open={editOpen} onOpenChange={setEditOpen} initial={caseItem} />
    </div>
  );
};

export default CaseDetail;

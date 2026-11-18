import {
  ArrowRight,
  Briefcase,
  Download,
  FilePlus2,
  FileText,
  Link2,
  Loader2,
  Mic,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaseStatusPill, Pill } from "@/components/common/status-pill";
import { CaseForm } from "@/components/forms/case-form";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { primaryContact } from "@/lib/investors";
import { buildInvestmentMemo } from "@/lib/memo";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type {
  Capture,
  CaseDocument,
  DealInvestor,
  DealMemo,
  DealPerson,
  Interaction,
  Investor,
  RelationshipStatus,
} from "@/lib/types";
import { AnalysisSection } from "./analysis-section";
import { ClaimsSection } from "./claims-section";
import { DecisionGapsSection } from "./gaps-section";
import { EvidenceTimeline } from "./evidence-timeline";
import { FollowUpTasks } from "./follow-up-tasks";

type CaseTab = "overview" | "timeline" | "documents" | "investorMatches" | "actions";

const TABS: { id: CaseTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "documents", label: "Documents" },
  { id: "investorMatches", label: "Investor Matches" },
  { id: "actions", label: "Actions" },
];

type ReadinessStatus = "Available" | "Needs Review" | "Missing";

const READINESS_TONE: Record<ReadinessStatus, "success" | "warning" | "neutral"> = {
  Available: "success",
  "Needs Review": "warning",
  Missing: "neutral",
};

function firstSentences(value: string, count = 3): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  const parts = normalized.match(/[^.!?]+[.!?]+/g);
  return (parts ? parts.slice(0, count).join(" ") : normalized).replace(/\s+/g, " ").trim();
}

function activeMemberName(
  userId: string | null,
  members: { userId: string | null; displayName: string; email: string }[],
): string {
  const member = members.find((item) => item.userId === userId);
  return member?.displayName || member?.email || "Unassigned";
}

function investorLastActivity(
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
  if (dates.length === 0) return null;
  return dates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
}

const CaseDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();

  const [activeTab, setActiveTab] = useState<CaseTab>("overview");
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
  const [investorFormOpen, setInvestorFormOpen] = useState(false);
  const [investorSearch, setInvestorSearch] = useState("");
  const [selectedInvestorId, setSelectedInvestorId] = useState("");
  const [associationStatus, setAssociationStatus] = useState<RelationshipStatus>("new");
  const [associationNotes, setAssociationNotes] = useState("");
  const [memoId, setMemoId] = useState("");
  const [memoTitle, setMemoTitle] = useState("");
  const [memoContent, setMemoContent] = useState("");
  const [memoBusy, setMemoBusy] = useState(false);

  useEffect(() => {
    setActiveTab("overview");
    setMemoId("");
    setMemoTitle("");
    setMemoContent("");
    setDocOpen(false);
    setInvestorFormOpen(false);
    setPersonOpen(false);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (location.hash === "#claims-heading" || location.hash === "#gaps-heading") {
      setActiveTab("actions");
    } else if (location.hash === "#timeline") {
      setActiveTab("timeline");
    } else if (location.hash === "#documents") {
      setActiveTab("documents");
    } else if (location.hash === "#investor-matches") {
      setActiveTab("investorMatches");
    } else if (location.hash === "#actions") {
      setActiveTab("actions");
    }
  }, [id, location.hash]);

  useEffect(() => {
    if (!id || memoId) return;
    const latest = workspace.dealMemos
      .filter((memo) => memo.dealId === id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    if (latest) {
      setMemoId(latest.id);
      setMemoTitle(latest.title);
      setMemoContent(latest.content);
    }
  }, [id, memoId, workspace.dealMemos]);

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
  const caseDocuments = workspace.caseDocuments.filter((item) => item.dealId === caseItem.id);
  const caseMemos = workspace.dealMemos
    .filter((item) => item.dealId === caseItem.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const people = workspace.dealPeople.filter((person) => person.dealId === caseItem.id);
  const followUpTasks = workspace.followUpTasks.filter((item) => item.dealId === caseItem.id);
  const manualAssociations = workspace.dealInvestors.filter((item) => item.dealId === caseItem.id);
  const manualRows = manualAssociations
    .map((association) => {
      const investor = workspace.investors.find((item) => item.id === association.investorId);
      if (!investor) return null;
      const contact = primaryContact(investor);
      return {
        association,
        investor,
        contact,
        lastActivity: investorLastActivity(investor, workspace.interactions, caseItem.id),
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
  const owner = activeMemberName(caseItem.ownerUserId, workspace.members);
  const draftClaims = claims.filter((claim) => claim.reviewStatus === "draft");
  const pendingImports = workspace.importCandidates.filter(
    (candidate) =>
      (candidate.dealId === caseItem.id || candidate.proposedDealId === caseItem.id) &&
      (candidate.status === "needs_review" ||
        (candidate.entityType === "claim" && candidate.status === "pending")),
  );
  const openTasks = followUpTasks.filter((task) => task.status === "open");
  const analysisRuns = workspace.analysisRuns.filter((item) => item.dealId === caseItem.id);
  const briefs = workspace.briefs.filter((item) => item.dealId === caseItem.id);
  const summary = caseItem.summary ? firstSentences(caseItem.summary, 3) : "";
  const funding = caseItem.raiseAmount ?? caseItem.chequeSought;
  const approvedClaims = claims.filter(
    (claim) => claim.reviewStatus === "approved" && !claim.supersededBy,
  );
  const openGaps = gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review");
  const latestBrief = [...briefs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )[0];
  const executiveSummary = latestBrief?.summary ? firstSentences(latestBrief.summary, 3) : "";
  const missingFields = [
    !caseItem.website ? "Website" : "",
    !caseItem.summary ? "Company description" : "",
    !caseItem.roundStage ? "Funding stage" : "",
    !caseItem.sector ? "Sector" : "",
    funding === null ? "Funding request" : "",
    people.length === 0 ? "Founders or team" : "",
    approvedClaims.length === 0 ? "Reviewed facts" : "",
    manualAssociations.length === 0 ? "Manually associated investors" : "",
  ].filter(Boolean);
  const profileFields = [caseItem.summary, caseItem.website, caseItem.sector, caseItem.roundStage].filter(Boolean).length;
  const readiness: { label: string; status: ReadinessStatus; detail: string }[] = [
    {
      label: "Company profile",
      status: profileFields === 4 ? "Available" : profileFields > 0 ? "Needs Review" : "Missing",
      detail: "Name, description, website, sector and stage",
    },
    {
      label: "Funding details",
      status: funding !== null ? "Available" : "Missing",
      detail: funding !== null ? "A funding request is recorded" : "Round size or cheque sought",
    },
    {
      label: "Founder / team",
      status: people.length > 0 ? "Available" : "Missing",
      detail: people.length > 0 ? `${people.length} people recorded` : "No founder or contact recorded",
    },
    {
      label: "Source evidence",
      status: sources.length + caseDocuments.length > 0 ? "Available" : "Missing",
      detail: `${sources.length + caseDocuments.length} sources attached`,
    },
    {
      label: "Reviewed facts",
      status: approvedClaims.length > 0 ? "Available" : draftClaims.length > 0 ? "Needs Review" : "Missing",
      detail: approvedClaims.length > 0 ? `${approvedClaims.length} approved claims` : draftClaims.length > 0 ? `${draftClaims.length} claims waiting for review` : "No claims reviewed",
    },
    {
      label: "Diligence questions",
      status: openGaps.length > 0 ? "Needs Review" : gaps.length > 0 ? "Available" : "Missing",
      detail: openGaps.length > 0 ? `${openGaps.length} open questions` : gaps.length > 0 ? "Recorded questions are resolved" : "No questions recorded",
    },
    {
      label: "Investor view",
      status: manualAssociations.length > 0 ? "Available" : matches.length > 0 ? "Needs Review" : "Missing",
      detail: manualAssociations.length > 0 ? `${manualAssociations.length} manually associated` : matches.length > 0 ? "Suggestions only — not confirmed relationships" : "No investors linked or suggested",
    },
  ];
  const readinessAvailable = readiness.filter((item) => item.status === "Available").length;
  const founded = people.filter((person) => person.role === "founder");
  const associatedInvestorIds = new Set(manualAssociations.map((item) => item.investorId));
  const suggestedMatches = matches.filter(({ investor }) => !associatedInvestorIds.has(investor.id));
  const availableInvestors = workspace.investors.filter((investor) => {
    if (associatedInvestorIds.has(investor.id)) return false;
    const search = investorSearch.trim().toLowerCase();
    if (!search) return true;
    return [investor.name, investor.website, ...investor.sectors, ...investor.stages]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });

  const recentEntries = [
    ...caseDocuments.map((document) => ({
      id: `document-${document.id}`,
      date: document.sourceDate,
      title: document.title,
      detail: `Document · ${document.documentType.toUpperCase()}`,
      to: "#documents-panel",
    })),
    ...sources.map((source) => ({
      id: `source-${source.id}`,
      date: source.sourceDate,
      title: source.companyName || (source.source === "voice" ? "Voice note" : "Note"),
      detail: `${source.source === "voice" ? "Voice note" : "Note"} · ${source.status}`,
      to: "#activity-panel",
    })),
    ...workspace.interactions
      .filter((interaction) => interaction.dealId === caseItem.id)
      .map((interaction) => ({
        id: `interaction-${interaction.id}`,
        date: interaction.occurredAt,
        title: workspace.investors.find((investor) => investor.id === interaction.investorId)?.name || "Investor interaction",
        detail: `${interaction.kind} · ${interaction.summary}`,
        to: "#activity-panel",
      })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const nextAction =
    caseItem.nextStep ||
    openTasks.sort((a, b) => {
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })[0]?.title ||
    "No next action recorded.";

  const handleGenerateMemo = async () => {
    if (!caseItem) return;
    setMemoBusy(true);
    try {
      const generated = buildInvestmentMemo({
        caseItem,
        claims,
        gaps,
        people,
        documents: caseDocuments,
        captures: sources,
        dealInvestors: manualAssociations,
        investors: workspace.investors,
        matches: workspace.matches.filter((match) => match.dealId === caseItem.id),
        tasks: followUpTasks,
      });
      const created = await actions.createDealMemo.mutateAsync({
        dealId: caseItem.id,
        title: generated.title,
        content: generated.content,
      });
      setMemoId(created.id);
      setMemoTitle(created.title);
      setMemoContent(created.content);
      setActiveTab("actions");
      toast.success("Memo draft generated from stored case records");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not generate the memo.");
    } finally {
      setMemoBusy(false);
    }
  };

  const handleSaveMemo = async () => {
    if (!caseItem || !memoContent.trim()) {
      toast.error("The memo is empty.");
      return;
    }
    setMemoBusy(true);
    try {
      if (memoId) {
        await actions.updateDealMemo.mutateAsync({
          id: memoId,
          input: { title: memoTitle || `Investment memo — ${caseItem.companyName}`, content: memoContent },
        });
        toast.success("Memo saved");
      } else {
        const created = await actions.createDealMemo.mutateAsync({
          dealId: caseItem.id,
          title: memoTitle || `Investment memo — ${caseItem.companyName}`,
          content: memoContent,
        });
        setMemoId(created.id);
        toast.success("Memo saved");
      }
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save the memo.");
    } finally {
      setMemoBusy(false);
    }
  };

  const copyMemo = async () => {
    if (!memoContent.trim()) return;
    try {
      await navigator.clipboard.writeText(`${memoTitle}\n\n${memoContent}`);
      toast.success("Memo copied to the clipboard");
    } catch {
      toast.error("Could not copy the memo. Select the text and copy manually.");
    }
  };

  const printMemo = () => {
    if (!memoContent.trim()) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("The print window was blocked. Allow pop-ups or download the memo.");
      return;
    }
    const escape = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    printWindow.document.write(
      `<!doctype html><html><head><title>${escape(memoTitle || "Investment memo")}</title><style>body{font-family:Georgia,serif;max-width:760px;margin:40px auto;line-height:1.55;color:#17202a}h1{font-size:23px}pre{white-space:pre-wrap;font-family:Georgia,serif;font-size:12.5px}</style></head><body><h1>${escape(memoTitle || "Investment memo")}</h1><pre>${escape(memoContent)}</pre></body></html>`,
    );
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const downloadMemo = () => {
    if (!memoContent.trim()) return;
    const blob = new Blob([memoContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${caseItem.companyName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-memo.md`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Memo downloaded as Markdown");
  };

  const addDocument = async () => {
    if (!docFile) {
      toast.error("Choose a document first.");
      return;
    }
    try {
      await actions.addCaseDocument.mutateAsync({
        dealId: caseItem.id,
        title: docTitle || docFile.name,
        file: docFile,
        sourceDate: new Date(`${docDate}T12:00:00`).toISOString(),
      });
      toast.success("Document added to the private case file");
      setDocOpen(false);
      setDocFile(null);
      setDocTitle("");
      setDocDate(new Date().toISOString().slice(0, 10));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add this document.");
    }
  };

  const addPerson = async () => {
    if (!personName.trim()) {
      toast.error("A person needs a name.");
      return;
    }
    try {
      await actions.createDealPerson.mutateAsync({
        dealId: caseItem.id,
        input: { name: personName, title: personTitle, email: personEmail, role: personRole },
      });
      toast.success("Person added");
      setPersonName("");
      setPersonTitle("");
      setPersonEmail("");
      setPersonRole("founder");
      setPersonOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not add this person.");
    }
  };

  const addInvestor = async () => {
    if (!selectedInvestorId) {
      toast.error("Choose an investor to link.");
      return;
    }
    try {
      await actions.addDealInvestor.mutateAsync({
        dealId: caseItem.id,
        investorId: selectedInvestorId,
        relationshipStatus: associationStatus,
        notes: associationNotes,
      });
      toast.success("Investor linked to this deal");
      setSelectedInvestorId("");
      setAssociationStatus("new");
      setAssociationNotes("");
      setInvestorSearch("");
      setInvestorFormOpen(false);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not link this investor.");
    }
  };

  const removeInvestor = async (association: DealInvestor, investor: Investor) => {
    try {
      await actions.removeDealInvestor.mutateAsync(association.id);
      toast.success(`${investor.name} removed from this deal; the investor profile is unchanged.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not remove this association.");
    }
  };

  const selectMemo = (value: string) => {
    const memo = caseMemos.find((item) => item.id === value);
    if (!memo) return;
    setMemoId(memo.id);
    setMemoTitle(memo.title);
    setMemoContent(memo.content);
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow={`${caseItem.sector || "Sector not set"} · ${caseItem.roundStage || "Stage not set"}`}
        title={caseItem.companyName}
        backTo={{ to: "/cases", label: "Deals" }}
        actions={
          <>
            <Button className="gap-1.5" asChild>
              <Link to={`/inbox/capture?deal=${caseItem.id}`}>
                <Mic className="h-4 w-4" aria-hidden="true" />
                Add update
              </Link>
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => setActiveTab("timeline")}>
              <FileText className="h-4 w-4" aria-hidden="true" />
              View sources
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <CaseStatusPill status={caseItem.status} label={CASE_STATUS_LABEL[caseItem.status]} />
        <Pill tone="neutral">{caseItem.roundStage || "Stage not set"}</Pill>
        <Pill tone="neutral">{caseItem.sector || "Sector not set"}</Pill>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
          <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
          {funding !== null ? formatCurrency(funding) : "Funding not recorded"}
        </span>
        {caseItem.isSynthetic ? <Pill tone="warning">Synthetic sample</Pill> : null}
      </div>

      <div className="overflow-x-auto border-b border-border">
        <div role="tablist" aria-label="Case sections" className="flex min-w-max gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`case-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`case-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={
                activeTab === tab.id
                  ? "border-b-2 border-brand px-3 py-2.5 text-[12.5px] font-semibold text-brand-strong"
                  : "border-b-2 border-transparent px-3 py-2.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              }
            >
              {tab.label}
              {tab.id === "investorMatches" ? ` · ${manualAssociations.length}` : null}
              {tab.id === "documents" ? ` · ${caseDocuments.length}` : null}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "overview" ? (
        <section role="tabpanel" id="case-panel-overview" aria-labelledby="case-tab-overview" className="space-y-4">
          <section className="panel p-5" aria-labelledby="executive-overview-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="executive-overview-heading" className="text-[15px] font-semibold tracking-tight">
                  Executive overview
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  AI-generated from recorded source evidence, limited to three sentences.
                </p>
              </div>
              {executiveSummary ? <Pill tone="success">AI summary available</Pill> : <Pill tone="warning">AI summary unavailable</Pill>}
            </div>
            {executiveSummary ? (
              <>
                <p className="mt-3 max-w-4xl text-[14px] leading-relaxed text-foreground/90">{executiveSummary}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Generated {latestBrief ? formatShortDate(latestBrief.createdAt) : "from stored sources"}. This is a
                  working summary, not an investment recommendation.
                </p>
              </>
            ) : (
              <div className="mt-3 rounded-md border border-dashed border-border bg-secondary/20 px-3 py-3">
                <p className="text-[12.5px] font-medium">No AI overview is available for this case.</p>
                <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                  {sources.length + caseDocuments.length > 0
                    ? "Run source analysis in Documents to generate a grounded executive summary. Until then, this page shows only stored facts; no AI sentence is simulated."
                    : "Add a source document or voice note first. Until source evidence exists, no AI overview is shown."}
                </p>
                <Button size="sm" variant="outline" className="mt-2 h-7 text-[10.5px]" onClick={() => setActiveTab("documents")}>
                  Open source analysis <ArrowRight className="h-3 w-3" aria-hidden="true" />
                </Button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10.5px]" onClick={() => setActiveTab("actions")}>Investment memo</Button>
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10.5px]" onClick={() => setActiveTab("investorMatches")}>Manual investors</Button>
              <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10.5px]" onClick={() => setActiveTab("timeline")}>Source timeline</Button>
              <Button size="sm" variant="ghost" className="ml-auto h-7 px-1.5 text-[10.5px]" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3 w-3" aria-hidden="true" />
                Edit details
              </Button>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="panel p-4" aria-labelledby="known-heading">
              <h2 id="known-heading" className="text-[14px] font-semibold tracking-tight">What We Know</h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">Recorded facts and approved claims only.</p>
              {!executiveSummary && summary ? <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">{summary}</p> : null}
              <dl className="mt-3 space-y-2 text-[11px]">
                <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5"><dt className="text-muted-foreground">Stage / sector</dt><dd className="text-right font-medium">{caseItem.roundStage || "Not recorded"} · {caseItem.sector || "Not recorded"}</dd></div>
                <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5"><dt className="text-muted-foreground">Funding</dt><dd className="text-right font-medium">{funding !== null ? formatCurrency(funding) : "Not recorded"}</dd></div>
                <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5"><dt className="text-muted-foreground">Founders / team</dt><dd className="max-w-[170px] text-right font-medium">{founded.length > 0 ? founded.map((person) => person.name).join(", ") : "Not recorded"}</dd></div>
                <div className="flex justify-between gap-2 border-b border-border/60 pb-1.5"><dt className="text-muted-foreground">Manual investors</dt><dd className="max-w-[170px] text-right font-medium">{manualRows.length > 0 ? manualRows.map((row) => row.investor.name).join(", ") : "None linked"}</dd></div>
                <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Approved claims</dt><dd className="text-right font-medium">{approvedClaims.length}</dd></div>
              </dl>
              {approvedClaims.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {approvedClaims.slice(0, 3).map((claim) => {
                    const document = claim.documentId ? caseDocuments.find((item) => item.id === claim.documentId) : null;
                    const source = claim.sourceId ? sources.find((item) => item.id === claim.sourceId) : null;
                    const sourceName = document?.fileName || source?.companyName || claim.fileName || "source recorded";
                    return (
                      <li key={claim.id} className="border-t border-border/60 pt-2 text-[10.5px] leading-relaxed">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{claim.label}</span>
                          <span className="text-muted-foreground">{claim.valueText || claim.normalizedValue || "No value"}{claim.reportingPeriod ? ` · ${claim.reportingPeriod}` : ""}</span>
                          <Pill tone={claim.verificationStatus === "corroborated" ? "success" : claim.verificationStatus === "internal_opinion" ? "neutral" : "warning"}>{VERIFICATION_LABEL[claim.verificationStatus]}</Pill>
                        </div>
                        <p className="mt-0.5 text-muted-foreground">Source: {sourceName}</p>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-3 text-[10.5px] text-muted-foreground">No reviewed claims yet. Drafts wait in Actions for human review.</p>
              )}
              <Button size="sm" variant="ghost" className="mt-2 h-7 px-1 text-[10.5px]" onClick={() => setActiveTab("actions")}>Review evidence <ArrowRight className="h-3 w-3" aria-hidden="true" /></Button>
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
                <Button size="sm" variant="ghost" className="h-6 px-1 text-[10px]" onClick={() => setPersonOpen((open) => !open)}>
                  <Plus className="h-3 w-3" aria-hidden="true" /> Add founder / contact
                </Button>
              </div>
              {personOpen ? (
                <div className="mt-2 space-y-2 rounded-md border border-border bg-secondary/30 p-2">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <Input value={personName} onChange={(event) => setPersonName(event.target.value)} placeholder="Name" className="h-8 bg-card text-[11px]" aria-label="Person name" />
                    <Input value={personTitle} onChange={(event) => setPersonTitle(event.target.value)} placeholder="Title" className="h-8 bg-card text-[11px]" aria-label="Person title" />
                    <Input value={personEmail} onChange={(event) => setPersonEmail(event.target.value)} placeholder="Email" className="h-8 bg-card text-[11px]" aria-label="Person email" />
                    <SelectField value={personRole} onChange={(value) => setPersonRole(value as "founder" | "contact" | "other")} options={[{ value: "founder", label: "Founder" }, { value: "contact", label: "Contact" }, { value: "other", label: "Other" }]} ariaLabel="Person role" />
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => void addPerson()} disabled={actions.createDealPerson.isPending}>Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setPersonOpen(false)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
              {people.length > 0 ? <p className="mt-2 text-[10px] text-muted-foreground">{people.map((person) => `${person.name}${person.title ? ` (${person.title})` : ""}`).join(" · ")}</p> : null}
            </section>

            <section className="panel p-4" aria-labelledby="missing-heading">
              <h2 id="missing-heading" className="text-[14px] font-semibold tracking-tight">What Is Missing</h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">Open questions and unrecorded inputs.</p>
              <ul className="mt-3 space-y-1.5 text-[10.5px] leading-relaxed">
                {missingFields.slice(0, 5).map((field) => <li key={field} className="flex gap-1.5"><span className="text-warning">•</span><span>{field} is not recorded.</span></li>)}
                {openGaps.slice(0, 4).map((gap) => <li key={gap.id} className="flex gap-1.5"><span className="text-warning">•</span><span>{gap.question}{gap.severity === "high" || gap.severity === "critical" ? <span className="ml-1 font-medium text-destructive">({gap.severity})</span> : null}</span></li>)}
                {draftClaims.length > 0 ? <li className="flex gap-1.5"><span className="text-warning">•</span><span>{draftClaims.length} draft claims need human review.</span></li> : null}
                {pendingImports.length > 0 ? <li className="flex gap-1.5"><span className="text-warning">•</span><span>{pendingImports.length} imported records need review.</span></li> : null}
                {missingFields.length === 0 && openGaps.length === 0 && draftClaims.length === 0 && pendingImports.length === 0 ? <li className="text-muted-foreground">No missing fields or open questions are recorded. This does not imply the deal is ready to invest.</li> : null}
              </ul>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" className="h-7 px-1 text-[10.5px]" onClick={() => setActiveTab("actions")}>Review questions <ArrowRight className="h-3 w-3" aria-hidden="true" /></Button>
                {pendingImports.length > 0 ? <Link to="/imports" className="inline-flex h-7 items-center text-[10.5px] font-medium text-brand-strong hover:underline">Review imports</Link> : null}
              </div>
            </section>

            <section className="panel p-4" aria-labelledby="next-action-heading">
              <h2 id="next-action-heading" className="text-[14px] font-semibold tracking-tight">Recommended Next Action</h2>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">One clear human next step, based on stored records.</p>
              <p className="mt-3 text-[12px] leading-relaxed">{nextAction}</p>
              {caseItem.nextStepDue ? <p className={isOverdue(caseItem.nextStepDue) ? "mt-1 text-[10.5px] font-semibold text-destructive" : "mt-1 text-[10.5px] text-muted-foreground"}>{dueLabel(caseItem.nextStepDue)}</p> : null}
              {openTasks[0]?.dueDate ? <p className="mt-1 text-[10px] text-muted-foreground">Open task due {dueLabel(openTasks[0].dueDate)}</p> : null}
              <Button size="sm" className="mt-3 h-8 text-[10.5px]" onClick={() => setActiveTab("actions")}>
                Open actions <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Button>
              <p className="mt-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
                {approvedClaims.length} approved facts · {openGaps.length} open gaps · owner {owner}
              </p>
            </section>
          </div>

          <section className="panel p-4" aria-labelledby="readiness-heading">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 id="readiness-heading" className="text-[14px] font-semibold tracking-tight">Investment readiness</h2>
                <p className="mt-0.5 text-[10.5px] text-muted-foreground">Available, Needs Review or Missing. This is a completeness checklist, not an investment-success prediction.</p>
              </div>
              <Pill tone="neutral">{readinessAvailable} of {readiness.length} available</Pill>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {readiness.map((item) => (
                <li key={item.label} className="rounded-md border border-border bg-card px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-[11px] font-medium">{item.label}</span>
                    <Pill tone={READINESS_TONE[item.status]}>{item.status}</Pill>
                  </div>
                  <p className="mt-0.5 text-[9.5px] leading-relaxed text-muted-foreground">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>
        </section>
      ) : null}

      {activeTab === "documents" ? (
        <section role="tabpanel" id="case-panel-documents" aria-labelledby="case-tab-documents" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight">Documents</h2>
              <p className="text-[11px] text-muted-foreground">Private originals attached to this case. AI extraction is run from Import & Organize or source analysis.</p>
            </div>
            <Button size="sm" className="h-8 gap-1 text-[10.5px]" onClick={() => setDocOpen(true)}>
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              Add document
            </Button>
          </div>
          {caseDocuments.length > 0 ? (
            <ul className="panel divide-y divide-border">
              {caseDocuments.map((document) => (
                <li key={document.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium">{document.title}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {document.documentType.toUpperCase()} · {formatDate(document.sourceDate)} {document.batchId ? "· imported" : "· manually added"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10.5px]"
                    onClick={() => void api.getImportDocumentUrl(document.storagePath).then((url) => {
                      if (!url) {
                        toast.error("This original is not available in private storage.");
                        return;
                      }
                      window.open(url, "_blank", "noopener,noreferrer");
                    })}
                  >
                    Open original
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
              <p className="text-[12px] font-medium">No documents attached</p>
              <p className="mt-1 text-[10.5px] text-muted-foreground">Add a document, or import historical files from Import & Organize.</p>
            </div>
          )}
          <details className="panel p-0">
            <summary className="cursor-pointer px-4 py-3 text-[12px] font-semibold">AI source analysis &amp; excerpts</summary>
            <div className="border-t border-border">
              <AnalysisSection deal={caseItem} sources={sources} runs={analysisRuns} briefs={briefs} />
            </div>
          </details>
        </section>
      ) : null}

      {activeTab === "timeline" ? (
        <section role="tabpanel" id="case-panel-timeline" aria-labelledby="case-tab-timeline" className="space-y-4">
          <EvidenceTimeline
            documents={caseDocuments}
            captures={sources}
            batches={workspace.importBatches}
            interactions={workspace.interactions.filter((interaction) => interaction.dealId === caseItem.id)}
            investors={workspace.investors}
          />
        </section>
      ) : null}

      {activeTab === "actions" ? (
        <section role="tabpanel" id="case-panel-actions" aria-labelledby="case-tab-actions" className="space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Actions</h2>
            <p className="text-[11px] text-muted-foreground">Next actions, the persistent memo, evidence review and diligence questions.</p>
          </div>
          <FollowUpTasks tasks={followUpTasks} />
          <div className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight">Investment memo</h2>
                <p className="text-[11px] text-muted-foreground">Editable, persistent draft from stored case records. Reported and verified facts are kept distinct.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {caseMemos.length > 1 ? (
                  <div className="w-[190px]">
                    <SelectField value={memoId} onChange={selectMemo} options={caseMemos.map((memo) => ({ value: memo.id, label: `${memo.title} · ${formatShortDate(memo.updatedAt)}` }))} ariaLabel="Memo version" />
                  </div>
                ) : null}
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[10.5px]" onClick={() => void handleGenerateMemo()} disabled={memoBusy}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate new
                </Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[10.5px]" onClick={() => void copyMemo()} disabled={!memoContent}>Copy</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[10.5px]" onClick={printMemo} disabled={!memoContent}><Printer className="h-3.5 w-3.5" aria-hidden="true" />Print</Button>
                <Button size="sm" variant="outline" className="h-8 gap-1 text-[10.5px]" onClick={downloadMemo} disabled={!memoContent}><Download className="h-3.5 w-3.5" aria-hidden="true" />.md</Button>
              </div>
            </div>
            {memoContent ? (
              <div className="mt-4 space-y-3">
                <Field label="Memo title" htmlFor="case-memo-title"><Input id="case-memo-title" value={memoTitle} onChange={(event) => setMemoTitle(event.target.value)} className="bg-card" /></Field>
                <Textarea id="case-memo-content" value={memoContent} onChange={(event) => setMemoContent(event.target.value)} rows={18} className="min-h-[420px] bg-card font-mono text-[11.5px] leading-relaxed" aria-label="Investment memo content" />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">{memoId ? `Saved ${formatDate(caseMemos.find((memo) => memo.id === memoId)?.updatedAt ?? new Date().toISOString())}` : "Unsaved draft"}</p>
                  <Button size="sm" className="h-8 gap-1" onClick={() => void handleSaveMemo()} disabled={memoBusy}>
                    {memoBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                    Save memo
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <p className="text-[12px] font-medium">No memo draft yet</p>
                <p className="mx-auto mt-1 max-w-lg text-[10.5px] leading-relaxed text-muted-foreground">
                  Generate a memo from the stored case profile, approved claims, open questions, associated investors and next actions.
                </p>
                <Button size="sm" className="mt-3 gap-1" onClick={() => void handleGenerateMemo()} disabled={memoBusy}>
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate memo
                </Button>
              </div>
            )}
          </div>
          <ClaimsSection dealId={caseItem.id} items={claims} />
          <DecisionGapsSection dealId={caseItem.id} items={gaps} />
        </section>
      ) : null}

      {activeTab === "investorMatches" ? (
        <section role="tabpanel" id="case-panel-investorMatches" aria-labelledby="case-tab-investorMatches" className="space-y-4">
          <section className="panel p-5" aria-labelledby="manual-investors-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="manual-investors-heading" className="text-[15px] font-semibold tracking-tight">Investors on this deal</h2>
                <p className="text-[11px] text-muted-foreground">Manual associations. Removing one never deletes the investor profile.</p>
              </div>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-[10.5px]" onClick={() => setInvestorFormOpen((open) => !open)}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Link existing investor
              </Button>
            </div>

            {investorFormOpen ? (
              <div className="mt-3 space-y-2 rounded-md border border-border bg-secondary/30 p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Search network" htmlFor="deal-investor-search">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <Input id="deal-investor-search" value={investorSearch} onChange={(event) => setInvestorSearch(event.target.value)} placeholder="Name, sector, stage…" className="h-9 bg-card pl-8 text-[12px]" />
                    </div>
                  </Field>
                  <Field label="Investor" htmlFor="deal-investor">
                    <SelectField
                      id="deal-investor"
                      value={selectedInvestorId}
                      onChange={setSelectedInvestorId}
                      options={availableInvestors.map((investor) => ({ value: investor.id, label: `${investor.name}${investor.website ? ` · ${investor.website}` : ""}` }))}
                      placeholder={availableInvestors.length ? "Choose an investor" : "No more investors available"}
                    />
                  </Field>
                  <Field label="Relationship" htmlFor="deal-investor-relationship">
                    <SelectField id="deal-investor-relationship" value={associationStatus} onChange={(value) => setAssociationStatus(value as RelationshipStatus)} options={RELATIONSHIP_OPTIONS} />
                  </Field>
                  <Field label="Note" htmlFor="deal-investor-note" optional>
                    <Input id="deal-investor-note" value={associationNotes} onChange={(event) => setAssociationNotes(event.target.value)} placeholder="Why this investor belongs on the deal" className="h-9 bg-card text-[12px]" />
                  </Field>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-[10.5px]" onClick={() => void addInvestor()} disabled={!selectedInvestorId || actions.addDealInvestor.isPending}>Link investor</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-[10.5px]" onClick={() => setInvestorFormOpen(false)}>Cancel</Button>
                </div>
              </div>
            ) : null}

            {manualRows.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {manualRows.map(({ association, investor, contact, lastActivity }) => (
                  <li key={association.id} className="rounded-md border border-border bg-card px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link to={`/investors/${investor.id}`} className="text-[12.5px] font-semibold hover:text-brand-strong">{investor.name}</Link>
                          <Pill tone="brand">Manually associated</Pill>
                          <Pill tone="neutral">{RELATIONSHIP_LABEL[association.relationshipStatus]}</Pill>
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                          {contact?.contactName ? `Contact: ${contact.contactName}` : "No named contact"}
                          {contact?.email ? ` · ${contact.email}` : ""}
                          {contact?.title ? ` · ${contact.title}` : ""}
                        </p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">Last activity: {lastActivity ? formatDate(lastActivity) : "Not recorded"}{association.notes ? ` · ${association.notes}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-[10.5px]" asChild>
                          <Link to={`/investors/${investor.id}`}>Open profile</Link>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[10.5px] text-muted-foreground hover:text-destructive" onClick={() => void removeInvestor(association, investor)}>
                          <Trash2 className="h-3 w-3" aria-hidden="true" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-border px-3 py-6 text-center text-[11.5px] text-muted-foreground">
                No investors manually associated. Link an existing network record; AI matches remain separate.
              </p>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="suggested-investors-heading">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="suggested-investors-heading" className="text-[15px] font-semibold tracking-tight">Suggested investors</h2>
                <p className="text-[11px] text-muted-foreground">Deterministic suggestions from stored preferences. They are not manual associations or evidence of investor interest.</p>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10.5px]" asChild>
                <Link to={`/matches?case=${caseItem.id}`}>Open matching <ArrowRight className="h-3 w-3" aria-hidden="true" /></Link>
              </Button>
            </div>
            {suggestedMatches.length > 0 ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {suggestedMatches.map(({ match, investor }) => (
                  <li key={match.id} className="rounded-md border border-border bg-card px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/investors/${investor.id}`} className="text-[12px] font-medium hover:text-brand-strong">{investor.name}</Link>
                      <Pill tone="neutral">AI-suggested</Pill>
                      {match.needsResearch ? <Pill tone="warning">Needs research</Pill> : null}
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                      Suggested from recorded preferences · not confirmed interest
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-3 py-5 text-center text-[11px] text-muted-foreground">
                No saved matches. Run matching from the Matches screen; nothing is inferred.
              </p>
            )}
          </section>
        </section>
      ) : null}

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
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Add document</DialogTitle>
            <DialogDescription>Store a private original against {caseItem.companyName}. Use Import & Organize for AI extraction.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="File" htmlFor="case-doc-file" hint="PDF, DOCX, CSV, TXT or EML · max 20 MB">
              <Input
                id="case-doc-file"
                type="file"
                accept=".pdf,.docx,.csv,.txt,.eml"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setDocFile(file);
                  if (file && !docTitle) setDocTitle(file.name);
                }}
                className="bg-card"
              />
            </Field>
            <Field label="Title" htmlFor="case-doc-title"><Input id="case-doc-title" value={docTitle} onChange={(event) => setDocTitle(event.target.value)} className="bg-card" /></Field>
            <Field label="Source date" htmlFor="case-doc-date"><Input id="case-doc-date" type="date" value={docDate} onChange={(event) => setDocDate(event.target.value)} className="bg-card" /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDocOpen(false)}>Cancel</Button>
            <Button onClick={() => void addDocument()} disabled={!docFile || actions.addCaseDocument.isPending}>
              {actions.addCaseDocument.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Add document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CaseForm open={editOpen} onOpenChange={setEditOpen} initial={caseItem} />
    </div>
  );
};

export default CaseDetail;

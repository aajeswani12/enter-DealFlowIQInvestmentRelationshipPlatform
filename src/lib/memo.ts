import { VERIFICATION_LABEL } from "@/lib/constants";
import type {
  Capture,
  CaseDocument,
  DealClaim,
  DealInvestor,
  DealInvestorMatch,
  DealPerson,
  DecisionGap,
  FollowUpTask,
  InvestmentCase,
  Investor,
  RelationshipStatus,
} from "@/lib/types";

export interface MemoInput {
  caseItem: InvestmentCase;
  claims: DealClaim[];
  gaps: DecisionGap[];
  people: DealPerson[];
  documents: CaseDocument[];
  captures: Capture[];
  dealInvestors: DealInvestor[];
  investors: Investor[];
  matches: DealInvestorMatch[];
  tasks: FollowUpTask[];
}

function sentences(value: string, count: number): string {
  const parts = value
    .replace(/\s+/g, " ")
    .trim()
    .match(/[^.!?]+[.!?]+/g);
  if (!parts) return value.trim();
  return parts.slice(0, count).join(" ").trim();
}

function money(value: number | null): string {
  if (value === null) return "Not recorded";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function sourceLabel(
  claim: DealClaim,
  documents: CaseDocument[],
  captures: Capture[],
): string {
  if (claim.documentId) {
    const document = documents.find((item) => item.id === claim.documentId);
    if (document) return `${document.fileName} · ${document.sourceDate.slice(0, 10)}`;
  }
  if (claim.sourceId) {
    const capture = captures.find((item) => item.id === claim.sourceId);
    if (capture) return `${capture.companyName} · ${capture.sourceDate.slice(0, 10)}`;
  }
  return claim.fileName || "No linked source";
}

function evidence(claim: DealClaim, documents: CaseDocument[], captures: Capture[]): string {
  const source = sourceLabel(claim, documents, captures);
  return claim.supportingExcerpt
    ? ` Source: ${source}. Excerpt: “${claim.supportingExcerpt.slice(0, 420)}”`
    : ` Source: ${source}.`;
}

export function buildInvestmentMemo(input: MemoInput): { title: string; content: string } {
  const {
    caseItem,
    claims,
    gaps,
    people,
    documents,
    captures,
    dealInvestors,
    investors,
    matches,
    tasks,
  } = input;
  const approved = claims.filter((claim) => claim.reviewStatus === "approved" && !claim.supersededBy);
  const internal = approved.filter((claim) => claim.verificationStatus === "internal_opinion");
  const tractionTypes = new Set(["traction", "revenue", "financial", "metric", "product"]);
  const traction = approved.filter(
    (claim) => tractionTypes.has(claim.claimType) && claim.verificationStatus !== "internal_opinion",
  );
  const openGaps = gaps.filter((gap) => gap.status === "open" || gap.status === "needs_review");
  const openTasks = tasks.filter((task) => task.status === "open");
  const manualInvestors = dealInvestors
    .map((association) => ({
      association,
      investor: investors.find((investor) => investor.id === association.investorId),
    }))
    .filter((item): item is { association: DealInvestor; investor: Investor } => Boolean(item.investor));
  const suggested = matches
    .map((match) => ({
      match,
      investor: investors.find((investor) => investor.id === match.investorId),
    }))
    .filter((item): item is { match: DealInvestorMatch; investor: Investor } => Boolean(item.investor));

  const summary = caseItem.summary
    ? sentences(caseItem.summary, 3)
    : "No company description has been recorded.";
  const missing: string[] = [];
  if (!caseItem.website) missing.push("Website is not recorded.");
  if (!caseItem.sector) missing.push("Sector is not recorded.");
  if (!caseItem.roundStage) missing.push("Funding stage is not recorded.");
  if (!caseItem.summary) missing.push("Company description is not recorded.");
  if (caseItem.raiseAmount === null && caseItem.chequeSought === null) missing.push("Round size or cheque sought is not recorded.");
  if (people.length === 0) missing.push("No founder or team member is recorded.");
  if (approved.length === 0) missing.push("No claims have been reviewed and approved.");
  if (dealInvestors.length === 0) missing.push("No investor has been manually associated with the deal.");

  const tractionLines = traction.length
    ? traction.map((claim) =>
        [
          `- ${claim.label}: ${claim.valueText || (claim.normalizedValue !== null ? String(claim.normalizedValue) : "No value recorded")}${
            claim.reportingPeriod ? ` (${claim.reportingPeriod})` : ""
          } — ${VERIFICATION_LABEL[claim.verificationStatus]}.${evidence(claim, documents, captures)}`,
        ].join(""),
      )
    : ["- No approved traction, revenue or funding claims are recorded."];

  const considerationLines =
    internal.length > 0
      ? internal.map((claim) => `- ${claim.label}: ${claim.valueText || claim.supportingExcerpt || "Internal note"}.${evidence(claim, documents, captures)}`)
      : ["- No internal-opinion claim is recorded. Review the open questions before forming a view."];

  const questionLines =
    openGaps.length > 0
      ? openGaps.map(
          (gap) =>
            `- ${gap.question}${gap.whyItMatters ? ` ${gap.whyItMatters}` : ""}${
              gap.suggestedAction ? ` Suggested next step: ${gap.suggestedAction}` : ""
            }`,
        )
      : ["- No open decision gaps are recorded."];
  if (missing.length > 0) questionLines.push(...missing.map((item) => `- ${item}`));

  const investorLines =
    manualInvestors.length > 0
      ? manualInvestors.map(({ association, investor }) => {
          const contact = investor.contacts.find((item) => item.isPrimary) ?? investor.contacts[0];
          return `- ${investor.name}${contact?.contactName ? ` (${contact.contactName}${contact.title ? `, ${contact.title}` : ""})` : ""} — manually associated; relationship ${association.relationshipStatus}${
            association.notes ? `; note: ${association.notes}` : ""
          }.${contact?.email ? ` Contact: ${contact.email}.` : ""}`;
        })
      : ["- No investors are manually associated with this deal."];
  if (suggested.length > 0) {
    investorLines.push(
      "- AI-suggested matches (not confirmed relationships or interest): " +
        suggested
          .slice(0, 5)
          .map(({ investor, match }) => `${investor.name} (fit ${match.fitScore}/100; ${match.needsResearch ? "needs research" : "recorded fields only"})`)
          .join(", ") +
        ".",
    );
  }

  const nextLines = [
    caseItem.nextStep
      ? `- ${caseItem.nextStep}${caseItem.nextStepDue ? ` (due ${caseItem.nextStepDue.slice(0, 10)})` : ""}.`
      : "- No case next step is recorded.",
    ...openTasks.slice(0, 5).map(
      (task) => `- ${task.title}${task.dueDate ? ` (due ${task.dueDate.slice(0, 10)})` : ""}${task.detail ? `: ${task.detail}` : ""}.`,
    ),
  ];

  const sourceNames = [
    ...documents.map((doc) => `${doc.fileName} (${doc.sourceDate.slice(0, 10)})`),
    ...captures.map((capture) => `${capture.companyName} (${capture.sourceDate.slice(0, 10)})`),
  ].filter((value, index, all) => all.indexOf(value) === index);

  const content = [
    `INVESTMENT MEMO — ${caseItem.companyName}`,
    `Status: Draft · Generated from stored case records on ${new Date().toISOString().slice(0, 10)}`,
    "Confidential — internal use only. This is a working memo, not an investment recommendation.",
    "",
    "COMPANY OVERVIEW",
    summary,
    `${caseItem.roundStage || "Stage not recorded"} · ${caseItem.sector || "Sector not recorded"} · ${
      caseItem.geography || "Geography not recorded"
    }${caseItem.website ? ` · ${caseItem.website}` : ""}`,
    "",
    "PRODUCT / MARKET",
    caseItem.thesis
      ? `Internal thesis: ${caseItem.thesis}`
      : "No separate product or market description is recorded beyond the company overview.",
    "",
    "FOUNDER / TEAM",
    people.length > 0
      ? people
          .map((person) => {
            const document = person.sourceDocumentId
              ? documents.find((item) => item.id === person.sourceDocumentId)
              : null;
            return `- ${person.name}${person.title ? `, ${person.title}` : ""}${person.email ? ` (${person.email})` : ""}${
              document ? ` — source: ${document.fileName}` : person.sourceExcerpt ? " — recorded manually" : ""
            }`;
          })
          .join("\n")
      : "No founder or team member is recorded.",
    "",
    "FUNDING",
    "Deal fields are recorded by the team and are not independently verified.",
    `- Target raise: ${money(caseItem.raiseAmount)}`,
    `- Cheque sought: ${money(caseItem.chequeSought)}`,
    `- Pre-money valuation: ${money(caseItem.preMoneyValuation)}`,
    `- Ownership target: ${caseItem.ownershipTarget !== null ? `${caseItem.ownershipTarget}%` : "Not recorded"}`,
    ...approved
      .filter((claim) => claim.claimType === "funding")
      .map((claim) => `- ${claim.label}: ${claim.valueText || "No value"}.${evidence(claim, documents, captures)}`),
    "",
    "TRACTION / MILESTONES",
    ...tractionLines,
    "",
    "INVESTMENT CONSIDERATIONS",
    ...considerationLines,
    "",
    "OPEN QUESTIONS",
    ...questionLines,
    "",
    "RELEVANT INVESTORS",
    ...investorLines,
    "",
    "NEXT STEPS",
    ...nextLines,
    "",
    "SOURCES REVIEWED",
    sourceNames.length > 0 ? sourceNames.map((name) => `- ${name}`).join("\n") : "No source documents or notes are recorded.",
    "",
    "Prepared for human review. Reported facts are labelled; verified facts require the recorded evidence and human approval.",
  ].join("\n");

  return {
    title: `Investment memo — ${caseItem.companyName}`,
    content,
  };
}

export function associationLabel(status: RelationshipStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

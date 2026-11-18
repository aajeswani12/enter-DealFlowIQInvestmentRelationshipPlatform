import type {
  AuditEvent,
  Capture,
  CaseDocument,
  DealClaim,
  DealInvestor,
  DealMemo,
  DealPerson,
  DecisionGap,
  FollowUpTask,
  ImportBatch,
  InvestmentCase,
  Investor,
} from "@/lib/types";

export type ChecklistStatus = "Available" | "Needs Review" | "Missing";
export type StageBucket = { key: string; label: string; count: number };
export type FollowUpBuckets = {
  overdue: number;
  dueSoon: number;
  completed: number;
  undated: number;
  later: number;
  dismissed: number;
  total: number;
};
export type ImportJobBuckets = {
  completed: number;
  review: number;
  failed: number;
  processing: number;
  total: number;
};
export type ChecklistItem = {
  key: string;
  label: string;
  status: ChecklistStatus;
  detail: string;
};
export type ActivityEvent = {
  id: string;
  type: "Source imported" | "Voice note added" | "Source note added" | "Memo generated" | "Case created" | "Case updated" | "Investor associated";
  date: string | null;
  title: string;
  detail: string;
  documentId?: string;
  captureId?: string;
  memoId?: string;
  investorId?: string;
};

const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Growth"];
const TRACTION_TYPES = new Set(["traction", "revenue", "financial", "metric"]);

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildStageCounts(cases: InvestmentCase[]): StageBucket[] {
  const counts = new Map<string, number>();
  for (const stage of STAGES) counts.set(stage, 0);
  for (const item of cases) {
    const stage = item.roundStage.trim();
    const key = STAGES.includes(stage) ? stage : "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ key: label, label, count }));
}

export function buildFollowUpBuckets(tasks: FollowUpTask[], now: Date, windowDays = 7): FollowUpBuckets {
  const windowEnd = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000);
  const buckets: FollowUpBuckets = {
    overdue: 0,
    dueSoon: 0,
    completed: 0,
    undated: 0,
    later: 0,
    dismissed: 0,
    total: tasks.length,
  };
  for (const task of tasks) {
    if (task.status === "done") {
      buckets.completed += 1;
      continue;
    }
    if (task.status === "dismissed") {
      buckets.dismissed += 1;
      continue;
    }
    const due = validDate(task.dueDate);
    if (!due) {
      buckets.undated += 1;
      continue;
    }
    if (due.getTime() < now.getTime()) {
      buckets.overdue += 1;
    } else if (due.getTime() <= windowEnd.getTime()) {
      buckets.dueSoon += 1;
    } else {
      buckets.later += 1;
    }
  }
  return buckets;
}

export function buildImportJobBuckets(batches: ImportBatch[]): ImportJobBuckets {
  const buckets: ImportJobBuckets = { completed: 0, review: 0, failed: 0, processing: 0, total: batches.length };
  for (const batch of batches) {
    if (batch.status === "completed") buckets.completed += 1;
    else if (batch.status === "review") buckets.review += 1;
    else if (batch.status === "failed") buckets.failed += 1;
    else buckets.processing += 1;
  }
  return buckets;
}

export function buildCaseChecklist(input: {
  caseItem: InvestmentCase;
  claims: DealClaim[];
  people: DealPerson[];
  gaps: DecisionGap[];
  documents: CaseDocument[];
  captures: Capture[];
}): ChecklistItem[] {
  const { caseItem, claims, people, gaps, documents, captures } = input;
  const approved = claims.filter((claim) => claim.reviewStatus === "approved" && !claim.supersededBy);
  const draft = claims.filter((claim) => claim.reviewStatus === "draft");
  const founderApproved = approved.some((claim) => claim.claimType === "founder");
  const founderDraft = draft.some((claim) => claim.claimType === "founder");
  const tractionApproved = approved.filter((claim) => TRACTION_TYPES.has(claim.claimType));
  const tractionDraft = draft.filter((claim) => TRACTION_TYPES.has(claim.claimType));
  const conflict = gaps.some(
    (gap) =>
      (gap.status === "open" || gap.status === "needs_review") &&
      gap.gapKey.toLowerCase().includes("discrepancy"),
  );
  const profileFields = [caseItem.summary, caseItem.sector, caseItem.roundStage].filter(Boolean).length;

  return [
    {
      key: "company",
      label: "Company",
      status: profileFields === 3 ? "Available" : profileFields > 0 ? "Needs Review" : "Missing",
      detail: profileFields === 3 ? "Description, sector and stage recorded" : `${profileFields} of 3 profile fields recorded`,
    },
    {
      key: "funding",
      label: "Funding",
      status: caseItem.raiseAmount !== null || caseItem.chequeSought !== null ? "Available" : "Missing",
      detail: caseItem.raiseAmount !== null || caseItem.chequeSought !== null ? "Funding request recorded" : "No funding request recorded",
    },
    {
      key: "team",
      label: "Team",
      status: people.length > 0 || founderApproved ? "Available" : founderDraft ? "Needs Review" : "Missing",
      detail: people.length > 0 ? `${people.length} people recorded` : founderApproved ? "Founder information recorded" : founderDraft ? "Founder claim awaiting review" : "No team recorded",
    },
    {
      key: "traction",
      label: "Traction",
      status: conflict || tractionDraft.length > 0 ? "Needs Review" : tractionApproved.length > 0 ? "Available" : "Missing",
      detail:
        conflict || tractionDraft.length > 0
          ? "Pending or conflicting traction evidence"
          : tractionApproved.length > 0
            ? `${tractionApproved.length} approved traction facts`
            : "No traction evidence recorded",
    },
    {
      key: "documents",
      label: "Supporting documents",
      status: documents.length + captures.length > 0 ? "Available" : "Missing",
      detail: documents.length + captures.length > 0 ? `${documents.length + captures.length} source records attached` : "No supporting source records",
    },
  ];
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildCaseActivityEvents(input: {
  caseId: string;
  documents: CaseDocument[];
  captures: Capture[];
  memos: DealMemo[];
  associations: DealInvestor[];
  investors: Investor[];
  audit: AuditEvent[];
}): ActivityEvent[] {
  const { caseId, documents, captures, memos, associations, investors, audit } = input;
  const events: ActivityEvent[] = [];
  const nativeKeys = new Set<string>();

  for (const document of documents) {
    const detail = document.title;
    nativeKeys.add(`${document.sourceDate.slice(0, 10)}|${normalized(detail)}`);
    events.push({
      id: `document-${document.id}`,
      type: "Source imported",
      date: validDate(document.sourceDate) ? document.sourceDate : null,
      title: document.fileName || document.title,
      detail,
      documentId: document.id,
    });
  }

  for (const capture of captures) {
    const title = capture.companyName || (capture.source === "voice" ? "Voice note" : "Source note");
    nativeKeys.add(`${capture.sourceDate.slice(0, 10)}|${normalized(title)}`);
    events.push({
      id: `capture-${capture.id}`,
      type: capture.source === "voice" ? "Voice note added" : "Source note added",
      date: validDate(capture.sourceDate) ? capture.sourceDate : null,
      title,
      detail: capture.founderName ? `Founder: ${capture.founderName}` : "Recorded source note",
      captureId: capture.id,
    });
  }

  for (const memo of memos) {
    nativeKeys.add(`${memo.createdAt.slice(0, 10)}|${normalized(memo.title)}`);
    events.push({
      id: `memo-${memo.id}`,
      type: "Memo generated",
      date: validDate(memo.createdAt) ? memo.createdAt : null,
      title: memo.title,
      detail: "Investment memo generated",
      memoId: memo.id,
    });
  }

  for (const association of associations) {
    const investor = investors.find((item) => item.id === association.investorId);
    const title = investor?.name || "Investor";
    nativeKeys.add(`${association.createdAt.slice(0, 10)}|${normalized(title)}`);
    events.push({
      id: `association-${association.id}`,
      type: "Investor associated",
      date: validDate(association.createdAt) ? association.createdAt : null,
      title,
      detail: "Manual deal association",
      investorId: association.investorId,
    });
  }

  const seenAudit = new Set<string>();
  for (const event of audit) {
    if (event.entityType !== "deals" || event.entityId !== caseId) continue;
    const date = validDate(event.createdAt) ? event.createdAt : null;
    const key = `${date?.slice(0, 10) ?? "unknown"}|${normalized(event.summary)}`;
    if (nativeKeys.has(key) || seenAudit.has(key)) continue;
    seenAudit.add(key);
    events.push({
      id: `audit-${event.id}`,
      type: event.action === "created" ? "Case created" : "Case updated",
      date,
      title: event.action === "created" ? "Case created" : "Case updated",
      detail: event.summary || "Case record updated",
    });
  }

  return events.sort((a, b) => {
    const aTime = a.date ? new Date(a.date).getTime() : Number.NEGATIVE_INFINITY;
    const bTime = b.date ? new Date(b.date).getTime() : Number.NEGATIVE_INFINITY;
    return bTime - aTime || a.type.localeCompare(b.type) || a.title.localeCompare(b.title);
  });
}

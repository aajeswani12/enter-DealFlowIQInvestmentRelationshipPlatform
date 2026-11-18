import type {
  AuditEvent,
  Capture,
  DealAnalysisRun,
  DealBrief,
  CaseDocument,
  DealClaim,
  DealPerson,
  FollowUpTask,
  ImportBatch,
  ImportCandidate,
  ImportFileRecord,
  ImportReview,
  MatchWeightConfig,
  DealInvestorMatch,
  DecisionGap,
  Interaction,
  InvestmentCase,
  Investor,
  Outreach,
  OutreachEvent,
  WorkspaceMember,
} from "./types";

/** Complete firm workspace snapshot. Every screen reads from this shape. */
export interface WorkspaceData {
  captures: Capture[];
  cases: InvestmentCase[];
  claims: DealClaim[];
  gaps: DecisionGap[];
  investors: Investor[];
  interactions: Interaction[];
  outreach: Outreach[];
  outreachEvents: OutreachEvent[];
  matches: DealInvestorMatch[];
  analysisRuns: DealAnalysisRun[];
  briefs: DealBrief[];
  matchWeights: MatchWeightConfig | null;
  members: WorkspaceMember[];
  audit: AuditEvent[];
  caseDocuments: CaseDocument[];
  dealPeople: DealPerson[];
  followUpTasks: FollowUpTask[];
  importBatches: ImportBatch[];
  importFiles: ImportFileRecord[];
  importCandidates: ImportCandidate[];
  importReviews: ImportReview[];
}

export const EMPTY_WORKSPACE: WorkspaceData = {
  captures: [],
  cases: [],
  claims: [],
  gaps: [],
  investors: [],
  interactions: [],
  outreach: [],
  outreachEvents: [],
  matches: [],
  analysisRuns: [],
  briefs: [],
  matchWeights: null,
  members: [],
  audit: [],
  caseDocuments: [],
  dealPeople: [],
  followUpTasks: [],
  importBatches: [],
  importFiles: [],
  importCandidates: [],
  importReviews: [],
};

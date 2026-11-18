import type {
  AuditEvent,
  Capture,
  DealAnalysisRun,
  DealBrief,
  DealClaim,
  DealInvestorMatch,
  DecisionGap,
  Interaction,
  InvestmentCase,
  Investor,
  Outreach,
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
  matches: DealInvestorMatch[];
  analysisRuns: DealAnalysisRun[];
  briefs: DealBrief[];
  members: WorkspaceMember[];
  audit: AuditEvent[];
}

export const EMPTY_WORKSPACE: WorkspaceData = {
  captures: [],
  cases: [],
  claims: [],
  gaps: [],
  investors: [],
  interactions: [],
  outreach: [],
  matches: [],
  analysisRuns: [],
  briefs: [],
  members: [],
  audit: [],
};

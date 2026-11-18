import type {
  AuditEvent,
  Capture,
  DealAnalysisRun,
  DealBrief,
  DealClaim,
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
};

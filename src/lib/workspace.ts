import type {
  Capture,
  CaseQuestion,
  Evidence,
  Interaction,
  InvestmentCase,
  Investor,
  Outreach,
} from "./types";

/** Complete firm workspace snapshot. Every screen reads from this shape. */
export interface WorkspaceData {
  captures: Capture[];
  cases: InvestmentCase[];
  evidence: Evidence[];
  questions: CaseQuestion[];
  investors: Investor[];
  interactions: Interaction[];
  outreach: Outreach[];
}

export const EMPTY_WORKSPACE: WorkspaceData = {
  captures: [],
  cases: [],
  evidence: [],
  questions: [],
  investors: [],
  interactions: [],
  outreach: [],
};

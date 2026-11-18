// Domain model for DealFlow IQ.

export type CaptureSource = "voice" | "text";
export type CaptureStatus = "new" | "reviewing" | "promoted" | "archived";

export type CaseStatus =
  | "sourcing"
  | "diligence"
  | "ic_review"
  | "term_sheet"
  | "invested"
  | "passed";

export type EvidenceKind = "metric" | "document" | "call_note" | "reference";
export type QuestionStatus = "open" | "answered";

export type InvestorType = "vc" | "angel" | "family_office" | "corporate";
export type RelationshipStatus = "new" | "warm" | "active" | "dormant";

export type OutreachStatus = "draft" | "approved" | "sent";
export type OutreachChannel = "email" | "linkedin" | "intro";

export type InteractionKind = "intro" | "call" | "email" | "meeting" | "note";

export interface Capture {
  id: string;
  companyName: string;
  founderName: string;
  founderEmail: string;
  sector: string;
  roundStage: string;
  source: CaptureSource;
  notes: string;
  audioUrl: string | null;
  audioPath: string | null;
  durationSeconds: number | null;
  status: CaptureStatus;
  referredBy: string;
  caseId: string | null;
  createdAt: string;
}

export interface InvestmentCase {
  id: string;
  companyName: string;
  oneLiner: string;
  sector: string;
  geography: string;
  roundStage: string;
  status: CaseStatus;
  raiseAmount: number | null;
  chequeSought: number | null;
  preMoneyValuation: number | null;
  ownershipTarget: number | null;
  leadRequired: boolean;
  leadPartner: string;
  referredBy: string;
  thesis: string;
  nextStep: string;
  nextStepDue: string | null;
  captureId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  caseId: string;
  kind: EvidenceKind;
  title: string;
  detail: string;
  fileName: string | null;
  filePath: string | null;
  createdAt: string;
}

export interface CaseQuestion {
  id: string;
  caseId: string;
  question: string;
  owner: string;
  status: QuestionStatus;
  answer: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Investor {
  id: string;
  firmName: string;
  contactName: string;
  email: string;
  investorType: InvestorType;
  stages: string[];
  sectors: string[];
  geographies: string[];
  checkMin: number | null;
  checkMax: number | null;
  leadsRounds: boolean;
  relationship: RelationshipStatus;
  notes: string;
  lastContactAt: string | null;
  nextStep: string;
  nextStepDue: string | null;
  createdAt: string;
}

export interface Interaction {
  id: string;
  investorId: string;
  caseId: string | null;
  kind: InteractionKind;
  summary: string;
  occurredAt: string;
  nextStep: string;
  nextStepDue: string | null;
  createdAt: string;
}

export interface Outreach {
  id: string;
  caseId: string;
  investorId: string;
  subject: string;
  body: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
}

export type RuleOutcome = "pass" | "partial" | "fail";

export interface MatchRule {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  outcome: RuleOutcome;
  detail: string;
}

export interface MatchResult {
  investor: Investor;
  caseId: string;
  score: number;
  tier: "strong" | "considered" | "weak";
  rules: MatchRule[];
  gaps: string[];
}

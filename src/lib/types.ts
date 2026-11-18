// Domain model for DealFlow IQ, mapped 1:1 onto the Enter Cloud schema.

export type CaptureSource = "voice" | "text";
export type CaptureStatus = "new" | "reviewing" | "promoted" | "archived";

export type CaseStatus =
  | "sourcing"
  | "diligence"
  | "ic_review"
  | "term_sheet"
  | "invested"
  | "passed";

export type ClaimType = "metric" | "document" | "call_note" | "reference";
export type VerificationStatus = "unverified" | "corroborated" | "disputed";
export type GapSeverity = "low" | "medium" | "high" | "critical";
export type QuestionStatus = "open" | "answered";

export type InvestorType = "vc" | "angel" | "family_office" | "corporate";
export type InvestorStatus = "active" | "prospect" | "watchlist" | "archived";
export type RelationshipStatus = "new" | "warm" | "active" | "dormant";
export type RelationshipStrength = "unknown" | "weak" | "warm" | "strong";
export type OutreachPermission = "unknown" | "permitted" | "requires_intro" | "do_not_contact";

export type OutreachStatus = "draft" | "approved" | "sent";
export type OutreachChannel = "email" | "linkedin" | "intro";
export type MatchStatus =
  | "suggested"
  | "shortlisted"
  | "outreach_drafted"
  | "approved"
  | "contacted"
  | "declined";

export type InteractionKind = "intro" | "call" | "email" | "meeting" | "note";

export type MemberRole = "owner" | "partner" | "analyst" | "viewer";
export type MemberStatus = "invited" | "active" | "revoked";
export type AuditAction = "created" | "updated" | "deleted";

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
  dealId: string | null;
  investorId: string | null;
  sourceDate: string;
  createdAt: string;
}

export interface InvestmentCase {
  id: string;
  companyName: string;
  website: string;
  summary: string;
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
  ownerUserId: string | null;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DealClaim {
  id: string;
  dealId: string;
  claimType: ClaimType;
  label: string;
  supportingExcerpt: string;
  valueText: string;
  normalizedValue: number | null;
  currency: string;
  reportingPeriod: string;
  verificationStatus: VerificationStatus;
  sourceId: string | null;
  fileName: string | null;
  filePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DecisionGap {
  id: string;
  dealId: string;
  question: string;
  owner: string;
  status: QuestionStatus;
  answer: string;
  severity: GapSeverity;
  blockingDecision: boolean;
  dueDate: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface InvestorContact {
  id: string;
  investorId: string;
  contactName: string;
  title: string;
  email: string | null;
  relationshipOwner: string;
  relationshipStrength: RelationshipStrength;
  lastInteractionAt: string | null;
  outreachPermissionStatus: OutreachPermission;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Investor {
  id: string;
  name: string;
  investorType: InvestorType;
  thesis: string;
  stages: string[];
  sectors: string[];
  geographies: string[];
  checkMin: number | null;
  checkMax: number | null;
  currency: string;
  status: InvestorStatus;
  leadsRounds: boolean;
  relationship: RelationshipStatus;
  notes: string;
  lastContactAt: string | null;
  nextStep: string;
  nextStepDue: string | null;
  isSynthetic: boolean;
  contacts: InvestorContact[];
  createdAt: string;
}

export interface Interaction {
  id: string;
  investorId: string;
  dealId: string | null;
  kind: InteractionKind;
  summary: string;
  occurredAt: string;
  nextStep: string;
  nextStepDue: string | null;
  createdAt: string;
}

export interface Outreach {
  id: string;
  dealId: string;
  investorId: string;
  contactId: string | null;
  subject: string;
  body: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  ownerUserId: string | null;
  nextFollowupAt: string | null;
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
  dealId: string;
  score: number;
  tier: "strong" | "considered" | "weak";
  rules: MatchRule[];
  gaps: string[];
}

export interface DealInvestorMatch {
  id: string;
  dealId: string;
  investorId: string;
  fitScore: number;
  scoreBreakdown: MatchRule[];
  fitExplanation: string;
  missingInformation: string[];
  matchStatus: MatchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  userId: string | null;
  email: string;
  displayName: string;
  role: MemberRole;
  status: MemberStatus;
  invitedBy: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

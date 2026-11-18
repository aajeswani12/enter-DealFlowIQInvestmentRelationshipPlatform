// Domain model for DealFlow IQ, mapped 1:1 onto the Enter Cloud schema.

export type CaptureSource = "voice" | "text";
export type CaptureStatus = "new" | "reviewing" | "promoted" | "archived";
export type TranscriptionStatus =
  | "not_requested"
  | "processing"
  | "completed"
  | "failed"
  | "unavailable"
  | "manual";
export type ExtractionStatus = "not_requested" | "processing" | "completed" | "failed" | "unavailable";

/** Shape returned by the structured extraction backend function. */
export interface ExtractedDealFields {
  company_name: string;
  website: string;
  one_liner: string;
  sector: string;
  geography: string;
  stage: string;
  target_raise: number | null;
  cheque_sought: number | null;
  thesis: string;
  next_step: string;
  open_questions: string[];
  claims: { label: string; value_text: string }[];
  confidence: "low" | "medium" | "high" | "unknown";
}

export type CaseStatus =
  | "sourcing"
  | "diligence"
  | "ic_review"
  | "term_sheet"
  | "invested"
  | "passed";

export type ClaimType =
  | "metric"
  | "document"
  | "call_note"
  | "reference"
  | "traction"
  | "revenue"
  | "financial"
  | "founder"
  | "investor_mention"
  | "product"
  | "funding"
  | "ownership"
  | "next_action"
  | "company"
  | "sector"
  | "stage";
export type VerificationStatus = "unverified" | "founder_reported" | "corroborated" | "disputed" | "internal_opinion";
export type GapSeverity = "low" | "medium" | "high" | "critical";
export type QuestionStatus = "open" | "answered" | "needs_review" | "resolved";

export type InvestorType = "vc" | "angel" | "family_office" | "corporate";
export type InvestorStatus =
  | "active"
  | "inactive"
  | "restricted"
  | "unknown"
  | "prospect"
  | "watchlist"
  | "archived";
export type RelationshipStatus = "new" | "warm" | "active" | "dormant";
export type RelationshipStrength = "unknown" | "weak" | "warm" | "strong";
export type OutreachPermission = "unknown" | "permitted" | "requires_intro" | "do_not_contact";

export type OutreachStatus =
  | "draft"
  | "approved"
  | "contacted"
  | "replied"
  | "interested"
  | "not_interested"
  | "follow_up_needed"
  | "rejected"
  | "sent";

export type OutreachEventType =
  | "drafted"
  | "edited"
  | "approved"
  | "approval_revoked"
  | "rejected"
  | "contacted"
  | "replied"
  | "interested"
  | "not_interested"
  | "followup_needed"
  | "followup_scheduled"
  | "owner_assigned";
export type OutreachChannel = "email" | "linkedin" | "intro";
export type MatchStatus =
  | "suggested"
  | "shortlisted"
  | "outreach_drafted"
  | "approved"
  | "contacted"
  | "declined"
  | "accepted"
  | "dismissed"
  | "deferred";

export interface MatchWeights {
  sectorThesis: number;
  stage: number;
  checkSize: number;
  geography: number;
  relationship: number;
  recentInterest: number;
}

export interface MatchWeightConfig extends MatchWeights {
  id: string;
  updatedAt: string;
}

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
  clientCaptureId: string | null;
  originalTranscript: string;
  transcriptionStatus: TranscriptionStatus;
  transcriptionProvider: string;
  transcriptionModel: string;
  transcriptionError: string;
  extractionStatus: ExtractionStatus;
  extractionError: string;
  extractedFields: Partial<ExtractedDealFields> | null;
  audioMimeType: string;
  audioSizeBytes: number | null;
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
  documentId: string | null;
  fileName: string | null;
  filePath: string | null;
  reviewStatus: "draft" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  analysisRunId: string | null;
  supersededBy: string | null;
  proposedChangeTo: string | null;
  claimKey: string;
  verificationNote: string;
  attribution: "founder" | "third_party" | "unknown";
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
  whyItMatters: string;
  evidence: string;
  suggestedAction: string;
  sourceId: string | null;
  documentId: string | null;
  analysisRunId: string | null;
  gapKey: string;
  origin: "manual" | "analysis" | "import";
  createdAt: string;
  resolvedAt: string | null;
}

export interface BriefFact {
  label: string;
  value: string;
  period: string;
  verification: string;
  reviewStatus: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceDate: string;
  excerpt: string;
  proposedChangeTo: string | null;
}

export interface BriefRisk {
  title: string;
  detail: string;
  sourceId: string | null;
  excerpt: string;
}

export interface BriefUnknown {
  question: string;
  why: string;
  status: string;
  sourceId: string | null;
}

export interface BriefEvidence {
  sourceId: string | null;
  sourceTitle: string;
  sourceDate: string;
  excerpt: string;
}

export interface DealBrief {
  id: string;
  dealId: string;
  analysisRunId: string | null;
  summary: string;
  scopeNote: string;
  knownFacts: BriefFact[];
  unknowns: BriefUnknown[];
  risks: BriefRisk[];
  followUps: string[];
  evidence: BriefEvidence[];
  status: "draft" | "approved";
  createdAt: string;
}

export interface DealAnalysisRun {
  id: string;
  dealId: string;
  sourceId: string;
  model: string;
  status: "running" | "completed" | "failed" | "unavailable";
  error: string;
  warnings: string[];
  extracted: Record<string, unknown>;
  createdAt: string;
  completedAt: string | null;
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
  website: string;
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
  documentId: string | null;
  createdAt: string;
}

export interface Outreach {
  id: string;
  dealId: string;
  investorId: string;
  contactId: string | null;
  matchId: string | null;
  subject: string;
  body: string;
  channel: OutreachChannel;
  status: OutreachStatus;
  ownerUserId: string | null;
  nextFollowupAt: string | null;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  sentAt: string | null;
  repliedAt: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string;
  responseSummary: string;
  followupNote: string;
  generationStatus: "manual" | "generated" | "unavailable";
  grounding: string[];
  missingInformation: string[];
  generationModel: string;
  editedAt: string | null;
}

export interface OutreachEvent {
  id: string;
  outreachId: string;
  investorId: string;
  dealId: string | null;
  eventType: OutreachEventType;
  note: string;
  actorUserId: string | null;
  createdAt: string;
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
  restrictions: string[];
  introductionStrategy: string;
  needsResearch: boolean;
  weights: Partial<MatchWeights>;
  matchStatus: MatchStatus;
  decidedBy: string | null;
  decidedAt: string | null;
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


export type ImportBatchStatus = "uploading" | "processing" | "review" | "completed" | "failed";
export type ImportFileType = "csv" | "pdf" | "docx" | "txt" | "email";
export type ImportProcessingStatus =
  | "pending"
  | "extracting"
  | "needs_review"
  | "completed"
  | "failed"
  | "duplicate";
export type ImportCandidateType = "deal" | "investor" | "claim";
export type ImportCandidateStatus = "pending" | "needs_review" | "applied" | "rejected" | "kept_separate";

export interface ImportBatch {
  id: string;
  label: string;
  status: ImportBatchStatus;
  isSynthetic: boolean;
  totalFiles: number;
  filesProcessed: number;
  recordsProcessed: number;
  recordsNeedingReview: number;
  errorCount: number;
  notes: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportFileRecord {
  id: string;
  batchId: string;
  fileName: string;
  fileType: ImportFileType;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  checksum: string;
  processingStatus: ImportProcessingStatus;
  recordsProcessed: number;
  recordsNeedingReview: number;
  errorMessage: string;
  extractedCharCount: number;
  pageCount: number;
  duplicateOf: string | null;
  sourceDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportCandidate {
  id: string;
  batchId: string;
  fileId: string;
  entityType: ImportCandidateType;
  status: ImportCandidateStatus;
  dealId: string | null;
  investorId: string | null;
  proposedDealId: string | null;
  proposedInvestorId: string | null;
  parentCandidateId: string | null;
  matchConfidence: "exact" | "high" | "medium" | "low" | "none";
  matchBasis: string;
  payload: Record<string, unknown>;
  excerpt: string;
  sourceDate: string | null;
  fingerprint: string;
  conflictSummary: string;
  reviewNote: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  appliedRecordId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ImportReview {
  id: string;
  candidateId: string;
  batchId: string;
  action: "approve" | "edit" | "reject" | "keep_separate";
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  note: string;
  reviewer: string | null;
  createdAt: string;
}

export interface CaseDocument {
  id: string;
  dealId: string;
  importFileId: string;
  batchId: string;
  title: string;
  documentType: ImportFileType;
  sourceDate: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  extractedText: string;
  excerpt: string;
  createdBy: string | null;
  createdAt: string;
}

export interface FollowUpTask {
  id: string;
  dealId: string;
  investorId: string | null;
  title: string;
  detail: string;
  dueDate: string | null;
  status: "open" | "done" | "dismissed";
  sourceDocumentId: string | null;
  importCandidateId: string | null;
  ownerUserId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}


export interface DealPerson {
  id: string;
  dealId: string;
  name: string;
  title: string;
  email: string | null;
  role: "founder" | "contact" | "other";
  sourceDocumentId: string | null;
  sourceExcerpt: string;
  createdAt: string;
  updatedAt: string;
}

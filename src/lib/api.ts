import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type { WorkspaceData } from "./workspace";
import type {
  AuditEvent,
  BriefEvidence,
  BriefFact,
  BriefRisk,
  BriefUnknown,
  Capture,
  CaptureSource,
  CaptureStatus,
  CaseDocument,
  CaseStatus,
  DealPerson,
  DealInvestor,
  DealMemo,
  FollowUpTask,
  ImportBatch,
  ImportCandidate,
  ImportFileRecord,
  ImportFileType,
  ImportReview,
  ImportCandidateStatus,
  ImportCandidateType,
  ClaimType,
  DealAnalysisRun,
  DealBrief,
  DealClaim,
  DealInvestorMatch,
  DecisionGap,
  ExtractedDealFields,
  ExtractionStatus,
  GapSeverity,
  Interaction,
  InteractionKind,
  InvestmentCase,
  Investor,
  InvestorContact,
  InvestorStatus,
  InvestorType,
  MatchRule,
  MatchStatus,
  MatchWeightConfig,
  MatchWeights,
  Outreach,
  OutreachChannel,
  OutreachEvent,
  OutreachPermission,
  OutreachStatus,
  QuestionStatus,
  RelationshipStatus,
  RelationshipStrength,
  TranscriptionStatus,
  VerificationStatus,
  WorkspaceMember,
  MemberRole,
  MemberStatus,
} from "./types";

type Tables = Database["public"]["Tables"];
type DealRow = Tables["deals"]["Row"];
type SourceRow = Tables["sources"]["Row"];
type ClaimRow = Tables["deal_claims"]["Row"];
type GapRow = Tables["decision_gaps"]["Row"];
type InvestorRow = Tables["investors"]["Row"];
type ContactRow = Tables["investor_contacts"]["Row"];
type InteractionRow = Tables["investor_interactions"]["Row"];
type OutreachRow = Tables["outreach_actions"]["Row"];
type MatchRow = Tables["deal_investor_matches"]["Row"];
type MemberRow = Tables["workspace_members"]["Row"];
type AuditRow = Tables["audit_events"]["Row"];
type RunRow = Tables["deal_analysis_runs"]["Row"];
type BriefRow = Tables["deal_briefs"]["Row"];
type CaseDocumentRow = Tables["case_documents"]["Row"];
type DealPersonRow = Tables["deal_people"]["Row"];
type DealInvestorRow = Tables["deal_investors"]["Row"];
type DealMemoRow = Tables["deal_memos"]["Row"];
type FollowUpTaskRow = Tables["follow_up_tasks"]["Row"];
type ImportBatchRow = Tables["import_batches"]["Row"];
type ImportFileRow = Tables["import_files"]["Row"];
type ImportCandidateRow = Tables["import_candidates"]["Row"];
type ImportReviewRow = Tables["import_reviews"]["Row"];

const VOICE_BUCKET = "voice-notes";
const EVIDENCE_BUCKET = "case-evidence";
const SIGNED_URL_TTL = 60 * 60 * 4;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function normalizeCompanyName(value: string): string {
  let raw = value.toLowerCase();
  raw = raw.replace(/\(([^)]*(sample|synthetic)[^)]*)\)/gi, " ");
  raw = raw.replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
  const drop = new Set(["inc", "llc", "ltd", "corp", "corporation", "limited", "gmbh", "plc", "co", "company"]);
  return raw.split(" ").filter((token) => token && !drop.has(token)).join("");
}

function normalizedDomain(value: string): string {
  const raw = value.trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0].split(":")[0];
}

function companySimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a))) return 0.85;
  const as = new Set(a.split(" "));
  const bs = new Set(b.split(" "));
  const overlap = [...as].filter((token) => bs.has(token)).length;
  return overlap / new Set([...as, ...bs]).size;
}

function extensionFor(mimeType: string, fallback = "webm"): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return fallback;
}

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

function mapCapture(row: SourceRow, audioUrl: string | null): Capture {
  return {
    id: row.id,
    companyName: row.title,
    founderName: row.founder_name,
    founderEmail: row.founder_email,
    sector: row.sector_hint,
    roundStage: row.stage_hint,
    source: row.source_type as CaptureSource,
    notes: row.raw_text,
    audioUrl,
    audioPath: row.audio_storage_path,
    durationSeconds: row.duration_seconds,
    status: row.triage_status as CaptureStatus,
    referredBy: row.referred_by,
    dealId: row.deal_id,
    investorId: row.investor_id,
    sourceDate: row.source_date,
    clientCaptureId: row.client_capture_id,
    originalTranscript: row.original_transcript,
    transcriptionStatus: row.transcription_status as TranscriptionStatus,
    transcriptionProvider: row.transcription_provider,
    transcriptionModel: row.transcription_model,
    transcriptionError: row.transcription_error,
    extractionStatus: row.extraction_status as ExtractionStatus,
    extractionError: row.extraction_error,
    extractedFields: (row.extracted_fields as unknown as Partial<ExtractedDealFields>) ?? null,
    audioMimeType: row.audio_mime_type,
    audioSizeBytes: toNumber(row.audio_size_bytes),
    createdAt: row.created_at,
  };
}

function mapDeal(row: DealRow): InvestmentCase {
  return {
    id: row.id,
    companyName: row.company_name,
    website: row.website,
    summary: row.summary,
    sector: row.sector,
    geography: row.geography,
    roundStage: row.stage,
    status: row.status as CaseStatus,
    raiseAmount: toNumber(row.target_raise),
    chequeSought: toNumber(row.cheque_sought),
    preMoneyValuation: toNumber(row.pre_money_valuation),
    ownershipTarget: toNumber(row.ownership_target),
    leadRequired: row.lead_required,
    leadPartner: row.lead_partner,
    referredBy: row.referred_by,
    thesis: row.thesis,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    ownerUserId: row.owner_user_id,
    isSynthetic: row.is_synthetic,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapClaim(row: ClaimRow): DealClaim {
  return {
    id: row.id,
    dealId: row.deal_id,
    claimType: row.claim_type as ClaimType,
    label: row.label,
    supportingExcerpt: row.supporting_excerpt,
    valueText: row.value_text,
    normalizedValue: toNumber(row.normalized_value),
    currency: row.currency,
    reportingPeriod: row.reporting_period,
    verificationStatus: row.verification_status as VerificationStatus,
    sourceId: row.source_id,
    documentId: row.document_id,
    fileName: row.file_name,
    filePath: row.file_path,
    reviewStatus: row.review_status as DealClaim["reviewStatus"],
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    analysisRunId: row.analysis_run_id,
    supersededBy: row.superseded_by,
    proposedChangeTo: row.proposed_change_to,
    claimKey: row.claim_key,
    verificationNote: row.verification_note,
    attribution: row.attribution as DealClaim["attribution"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGap(row: GapRow): DecisionGap {
  return {
    id: row.id,
    dealId: row.deal_id,
    question: row.question,
    owner: row.owner,
    status: row.status as QuestionStatus,
    answer: row.answer,
    severity: row.severity as GapSeverity,
    blockingDecision: row.blocking_decision,
    dueDate: row.due_date,
    whyItMatters: row.why_it_matters,
    evidence: row.evidence,
    suggestedAction: row.suggested_action,
    sourceId: row.source_id,
    documentId: row.document_id,
    analysisRunId: row.analysis_run_id,
    gapKey: row.gap_key,
    origin: row.origin as DecisionGap["origin"],
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapContact(row: ContactRow): InvestorContact {
  return {
    id: row.id,
    investorId: row.investor_id,
    contactName: row.contact_name,
    title: row.title,
    email: row.email,
    relationshipOwner: row.relationship_owner,
    relationshipStrength: row.relationship_strength as RelationshipStrength,
    lastInteractionAt: row.last_interaction_at,
    outreachPermissionStatus: row.outreach_permission_status as OutreachPermission,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvestor(row: InvestorRow, contacts: InvestorContact[]): Investor {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    investorType: row.investor_type as InvestorType,
    thesis: row.thesis,
    stages: row.stages ?? [],
    sectors: row.sectors ?? [],
    geographies: row.geography ?? [],
    checkMin: toNumber(row.minimum_check),
    checkMax: toNumber(row.maximum_check),
    currency: row.currency,
    status: row.status as InvestorStatus,
    leadsRounds: row.leads_rounds,
    relationship: row.relationship as RelationshipStatus,
    notes: row.notes,
    lastContactAt: row.last_contact_at,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    isSynthetic: row.is_synthetic,
    contacts: contacts.filter((contact) => contact.investorId === row.id),
    createdAt: row.created_at,
  };
}

function mapInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    investorId: row.investor_id,
    dealId: row.deal_id,
    kind: row.kind as InteractionKind,
    summary: row.summary,
    occurredAt: row.occurred_at,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    documentId: row.document_id,
    createdAt: row.created_at,
  };
}

function mapCaseDocument(row: CaseDocumentRow): CaseDocument {
  return {
    id: row.id,
    dealId: row.deal_id,
    importFileId: row.import_file_id,
    batchId: row.batch_id,
    title: row.title,
    documentType: row.document_type as ImportFileType,
    sourceDate: row.source_date,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    extractedText: row.extracted_text,
    excerpt: row.excerpt,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function mapDealPerson(row: DealPersonRow): DealPerson {
  return {
    id: row.id,
    dealId: row.deal_id,
    name: row.name,
    title: row.title,
    email: row.email,
    role: row.role as DealPerson["role"],
    sourceDocumentId: row.source_document_id,
    sourceExcerpt: row.source_excerpt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDealInvestor(row: DealInvestorRow): DealInvestor {
  return {
    id: row.id,
    dealId: row.deal_id,
    investorId: row.investor_id,
    relationshipStatus: row.relationship_status as RelationshipStatus,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDealMemo(row: DealMemoRow): DealMemo {
  return {
    id: row.id,
    dealId: row.deal_id,
    title: row.title,
    content: row.content,
    status: row.status as DealMemo["status"],
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFollowUpTask(row: FollowUpTaskRow): FollowUpTask {
  return {
    id: row.id,
    dealId: row.deal_id,
    investorId: row.investor_id,
    title: row.title,
    detail: row.detail,
    dueDate: row.due_date,
    status: row.status as FollowUpTask["status"],
    sourceDocumentId: row.source_document_id,
    importCandidateId: row.import_candidate_id,
    ownerUserId: row.owner_user_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportBatch(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    label: row.label,
    status: row.status as ImportBatch["status"],
    isSynthetic: row.is_synthetic,
    totalFiles: row.total_files,
    filesProcessed: row.files_processed,
    recordsProcessed: row.records_processed,
    recordsNeedingReview: row.records_needing_review,
    errorCount: row.error_count,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportFile(row: ImportFileRow): ImportFileRecord {
  return {
    id: row.id,
    batchId: row.batch_id,
    fileName: row.file_name,
    fileType: row.file_type as ImportFileType,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    storagePath: row.storage_path,
    checksum: row.checksum,
    processingStatus: row.processing_status as ImportFileRecord["processingStatus"],
    recordsProcessed: row.records_processed,
    recordsNeedingReview: row.records_needing_review,
    errorMessage: row.error_message,
    extractedCharCount: row.extracted_char_count,
    pageCount: row.page_count,
    duplicateOf: row.duplicate_of,
    sourceDate: row.source_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportCandidate(row: ImportCandidateRow): ImportCandidate {
  return {
    id: row.id,
    batchId: row.batch_id,
    fileId: row.file_id,
    entityType: row.entity_type as ImportCandidateType,
    status: row.status as ImportCandidateStatus,
    dealId: row.deal_id,
    investorId: row.investor_id,
    proposedDealId: row.proposed_deal_id,
    proposedInvestorId: row.proposed_investor_id,
    parentCandidateId: row.parent_candidate_id,
    matchConfidence: row.match_confidence as ImportCandidate["matchConfidence"],
    matchBasis: row.match_basis,
    payload: (row.payload as Record<string, unknown>) ?? {},
    excerpt: row.excerpt,
    sourceDate: row.source_date,
    fingerprint: row.fingerprint,
    conflictSummary: row.conflict_summary,
    reviewNote: row.review_note,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    appliedRecordId: row.applied_record_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapImportReview(row: ImportReviewRow): ImportReview {
  return {
    id: row.id,
    candidateId: row.candidate_id,
    batchId: row.batch_id,
    action: row.action as ImportReview["action"],
    before: (row.before as Record<string, unknown>) ?? {},
    after: (row.after as Record<string, unknown>) ?? {},
    note: row.note,
    reviewer: row.reviewer,
    createdAt: row.created_at,
  };
}

function mapOutreach(row: OutreachRow): Outreach {
  return {
    id: row.id,
    dealId: row.deal_id,
    investorId: row.investor_id,
    contactId: row.contact_id,
    subject: row.draft_subject,
    body: row.draft_body,
    channel: row.channel as OutreachChannel,
    status: row.status as OutreachStatus,
    ownerUserId: row.owner_user_id,
    nextFollowupAt: row.next_followup_at,
    matchId: row.match_id,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    sentAt: row.sent_at,
    repliedAt: row.replied_at,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    responseSummary: row.response_summary,
    followupNote: row.followup_note,
    generationStatus: row.generation_status as Outreach["generationStatus"],
    grounding: (row.grounding as unknown as string[]) ?? [],
    missingInformation: (row.missing_information as unknown as string[]) ?? [],
    generationModel: row.generation_model,
    editedAt: row.edited_at,
  };
}

function mapOutreachEvent(row: Tables["outreach_events"]["Row"]): OutreachEvent {
  return {
    id: row.id,
    outreachId: row.outreach_id,
    investorId: row.investor_id,
    dealId: row.deal_id,
    eventType: row.event_type as OutreachEvent["eventType"],
    note: row.note,
    actorUserId: row.actor_user_id,
    createdAt: row.created_at,
  };
}

function mapMatch(row: MatchRow): DealInvestorMatch {
  return {
    id: row.id,
    dealId: row.deal_id,
    investorId: row.investor_id,
    fitScore: toNumber(row.fit_score) ?? 0,
    scoreBreakdown: (row.score_breakdown as unknown as MatchRule[]) ?? [],
    fitExplanation: row.fit_explanation,
    missingInformation: (row.missing_information as unknown as string[]) ?? [],
    restrictions: (row.restrictions as unknown as string[]) ?? [],
    introductionStrategy: row.introduction_strategy,
    needsResearch: row.needs_research,
    weights: (row.weights as unknown as Partial<MatchWeights>) ?? {},
    matchStatus: row.match_status as MatchStatus,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapWeightConfig(row: Tables["match_weight_configs"]["Row"]): MatchWeightConfig {
  return {
    id: row.id,
    sectorThesis: row.sector_thesis,
    stage: row.stage,
    checkSize: row.check_size,
    geography: row.geography,
    relationship: row.relationship,
    recentInterest: row.recent_interest,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: MemberRow): WorkspaceMember {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    role: row.role as MemberRole,
    status: row.status as MemberStatus,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
  };
}

function mapRun(row: RunRow): DealAnalysisRun {
  return {
    id: row.id,
    dealId: row.deal_id,
    sourceId: row.source_id,
    model: row.model,
    status: row.status as DealAnalysisRun["status"],
    error: row.error,
    warnings: (row.warnings as unknown as string[]) ?? [],
    extracted: (row.extracted as Record<string, unknown>) ?? {},
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function mapBrief(row: BriefRow): DealBrief {
  return {
    id: row.id,
    dealId: row.deal_id,
    analysisRunId: row.analysis_run_id,
    summary: row.summary,
    scopeNote: row.scope_note,
    knownFacts: (row.known_facts as unknown as BriefFact[]) ?? [],
    unknowns: (row.unknowns as unknown as BriefUnknown[]) ?? [],
    risks: (row.risks as unknown as BriefRisk[]) ?? [],
    followUps: (row.follow_ups as unknown as string[]) ?? [],
    evidence: (row.evidence as unknown as BriefEvidence[]) ?? [],
    status: row.status as DealBrief["status"],
    createdAt: row.created_at,
  };
}

function mapAudit(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    action: row.action as AuditEvent["action"],
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

async function readFunctionError(error: unknown): Promise<string> {
  const candidate = error as { message?: string; context?: unknown };
  const context = candidate.context;
  if (context && typeof context === "object" && "json" in context) {
    try {
      const body = (await (context as Response).json()) as Record<string, unknown>;
      const message = body.error ?? body.message ?? body.reason;
      if (typeof message === "string" && message.trim()) return message;
    } catch {
      // fall through to the generic message
    }
  }
  return candidate.message || "The backend service failed.";
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail("Not signed in", error);
  return data.user.id;
}

export interface VoiceSourceInput {
  clientCaptureId: string;
  title: string;
  sourceType: CaptureSource;
  transcript: string;
  originalTranscript: string;
  audioPath: string | null;
  audioMimeType: string;
  audioSizeBytes: number | null;
  durationSeconds: number | null;
  sourceDate: string;
  dealId: string | null;
  transcriptionStatus: TranscriptionStatus;
  transcriptionProvider: string;
  transcriptionModel: string;
  transcriptionError: string;
  extractionStatus: ExtractionStatus;
  extractionError: string;
  extractedFields: Partial<ExtractedDealFields> | null;
  processedAt: string | null;
}

export interface TranscriptionResponse {
  configured: boolean;
  transcript?: string;
  provider?: string;
  model?: string;
  reason?: string;
}

export interface ExtractionResponse {
  configured: boolean;
  fields?: Partial<ExtractedDealFields>;
  reason?: string;
}

export interface CaptureInput {
  companyName: string;
  founderName: string;
  founderEmail: string;
  sector: string;
  roundStage: string;
  source: CaptureSource;
  notes: string;
  durationSeconds: number | null;
  referredBy: string;
  audioBlob: Blob | null;
}

export interface CaseInput {
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
  captureId?: string | null;
}

export interface ContactInput {
  id?: string;
  contactName: string;
  title: string;
  email: string;
  relationshipOwner: string;
  relationshipStrength: RelationshipStrength;
  outreachPermissionStatus: OutreachPermission;
  isPrimary: boolean;
}

export interface InvestorInput {
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
  nextStep: string;
  nextStepDue: string | null;
  contact: ContactInput | null;
}

export interface OutreachInput {
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
  generationStatus: "manual" | "generated" | "unavailable";
  grounding: string[];
  missingInformation: string[];
  generationModel: string;
}

export interface ClaimInput {
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
  file: File | null;
}

export interface ImportSummary {
  inserted: number;
  skipped: number;
  contacts: number;
}

async function saveContact(investorId: string, input: ContactInput, userId: string): Promise<void> {
  if (input.isPrimary) {
    let query = supabase
      .from("investor_contacts")
      .update({ is_primary: false })
      .eq("investor_id", investorId)
      .eq("is_primary", true);
    if (input.id) query = query.neq("id", input.id);
    const { error } = await query;
    if (error) fail("Could not update the primary contact", error);
  }

  const payload = {
    investor_id: investorId,
    contact_name: input.contactName,
    title: input.title,
    email: input.email ? input.email : null,
    relationship_owner: input.relationshipOwner,
    relationship_strength: input.relationshipStrength,
    outreach_permission_status: input.outreachPermissionStatus,
    is_primary: input.isPrimary,
  };

  if (input.id) {
    const { error } = await supabase.from("investor_contacts").update(payload).eq("id", input.id);
    if (error) fail("Could not update this contact", error);
    return;
  }

  const { error } = await supabase.from("investor_contacts").insert({ ...payload, created_by: userId });
  if (error) fail("Could not save this contact", error);
}

export const api = {
  /**
   * Activates a pending invitation or claims the workspace for the very first
   * signed-in user, then returns the caller's own membership row.
   */
  async ensureMembership(): Promise<WorkspaceMember | null> {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return null;

    const { error: claimError } = await supabase.rpc("claim_workspace");

    const { data, error } = await supabase
      .from("workspace_members")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (error) throw new Error(`Could not read workspace access: ${error.message}`);
    if (!data && claimError) {
      throw new Error(`Could not check workspace access: ${claimError.message}`);
    }
    return data ? mapMember(data) : null;
  },

  async listWorkspace(): Promise<WorkspaceData> {
    const [deals, sources, claims, gaps, investors, contacts, interactions, outreach, matches, members, audit, runs, briefs, weightConfigs, outreachEvents, caseDocuments, dealPeople, dealInvestors, dealMemos, followUpTasks, importBatches, importFiles, importCandidates, importReviews] =
      await Promise.all([
        supabase.from("deals").select("*").order("updated_at", { ascending: false }),
        supabase.from("sources").select("*").order("created_at", { ascending: false }),
        supabase.from("deal_claims").select("*").order("created_at", { ascending: false }),
        supabase.from("decision_gaps").select("*").order("created_at", { ascending: false }),
        supabase.from("investors").select("*").order("created_at", { ascending: false }),
        supabase.from("investor_contacts").select("*").order("created_at", { ascending: false }),
        supabase.from("investor_interactions").select("*").order("occurred_at", { ascending: false }),
        supabase.from("outreach_actions").select("*").order("created_at", { ascending: false }),
        supabase.from("deal_investor_matches").select("*").order("updated_at", { ascending: false }),
        supabase.from("workspace_members").select("*").order("created_at", { ascending: true }),
        supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(40),
        supabase.from("deal_analysis_runs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("deal_briefs").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("match_weight_configs").select("*").order("updated_at", { ascending: false }).limit(1),
        supabase.from("outreach_events").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("case_documents").select("*").order("source_date", { ascending: true }).limit(1000),
        supabase.from("deal_people").select("*").order("name", { ascending: true }).limit(1000),
        supabase.from("deal_investors").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("deal_memos").select("*").order("updated_at", { ascending: false }).limit(500),
        supabase.from("follow_up_tasks").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("import_files").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("import_candidates").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("import_reviews").select("*").order("created_at", { ascending: false }).limit(1000),
      ]);

    if (deals.error) fail("Could not load deals", deals.error);
    if (sources.error) fail("Could not load the Deal Inbox", sources.error);
    if (claims.error) fail("Could not load deal claims", claims.error);
    if (gaps.error) fail("Could not load decision gaps", gaps.error);
    if (investors.error) fail("Could not load the investor network", investors.error);
    if (contacts.error) fail("Could not load investor contacts", contacts.error);
    if (interactions.error) fail("Could not load interactions", interactions.error);
    if (outreach.error) fail("Could not load outreach", outreach.error);
    if (matches.error) fail("Could not load saved matches", matches.error);
    if (members.error) fail("Could not load workspace members", members.error);
    if (audit.error) fail("Could not load the audit trail", audit.error);
    if (runs.error) fail("Could not load analysis runs", runs.error);
    if (briefs.error) fail("Could not load deal briefs", briefs.error);
    if (weightConfigs.error) fail("Could not load matching settings", weightConfigs.error);
    if (outreachEvents.error) fail("Could not load outreach activity", outreachEvents.error);
    if (caseDocuments.error) fail("Could not load case documents", caseDocuments.error);
    if (dealPeople.error) fail("Could not load deal people", dealPeople.error);
    if (dealInvestors.error) fail("Could not load deal investors", dealInvestors.error);
    if (dealMemos.error) fail("Could not load deal memos", dealMemos.error);
    if (followUpTasks.error) fail("Could not load follow-up tasks", followUpTasks.error);
    if (importBatches.error) fail("Could not load import batches", importBatches.error);
    if (importFiles.error) fail("Could not load import files", importFiles.error);
    if (importCandidates.error) fail("Could not load import candidates", importCandidates.error);
    if (importReviews.error) fail("Could not load import reviews", importReviews.error);

    const sourceRows = sources.data ?? [];
    const audioPaths = sourceRows
      .map((row) => row.audio_storage_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    const signed = new Map<string, string>();
    if (audioPaths.length > 0) {
      const { data } = await supabase.storage.from(VOICE_BUCKET).createSignedUrls(audioPaths, SIGNED_URL_TTL);
      data?.forEach((item) => {
        if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      });
    }

    const contactList = (contacts.data ?? []).map(mapContact);

    return {
      captures: sourceRows.map((row) =>
        mapCapture(row, row.audio_storage_path ? signed.get(row.audio_storage_path) ?? null : null),
      ),
      cases: (deals.data ?? []).map(mapDeal),
      claims: (claims.data ?? []).map(mapClaim),
      gaps: (gaps.data ?? []).map(mapGap),
      investors: (investors.data ?? []).map((row) => mapInvestor(row, contactList)),
      interactions: (interactions.data ?? []).map(mapInteraction),
      outreach: (outreach.data ?? []).map(mapOutreach),
      outreachEvents: (outreachEvents.data ?? []).map(mapOutreachEvent),
      caseDocuments: (caseDocuments.data ?? []).map(mapCaseDocument),
      dealPeople: (dealPeople.data ?? []).map(mapDealPerson),
      dealInvestors: (dealInvestors.data ?? []).map(mapDealInvestor),
      dealMemos: (dealMemos.data ?? []).map(mapDealMemo),
      followUpTasks: (followUpTasks.data ?? []).map(mapFollowUpTask),
      importBatches: (importBatches.data ?? []).map(mapImportBatch),
      importFiles: (importFiles.data ?? []).map(mapImportFile),
      importCandidates: (importCandidates.data ?? []).map(mapImportCandidate),
      importReviews: (importReviews.data ?? []).map(mapImportReview),
      matches: (matches.data ?? []).map(mapMatch),
      members: (members.data ?? []).map(mapMember),
      audit: (audit.data ?? []).map(mapAudit),
      analysisRuns: (runs.data ?? []).map(mapRun),
      briefs: (briefs.data ?? []).map(mapBrief),
      matchWeights: weightConfigs.data && weightConfigs.data[0] ? mapWeightConfig(weightConfigs.data[0]) : null,
    };
  },

  async createImportBatch(input: {
    label: string;
    isSynthetic: boolean;
    notes?: string;
  }): Promise<ImportBatch> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("import_batches")
      .insert({
        label: input.label.trim().slice(0, 160),
        is_synthetic: input.isSynthetic,
        notes: input.notes?.slice(0, 1000) ?? "",
        status: "uploading",
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not create the import batch", error);
    return mapImportBatch(data);
  },

  async uploadImportFile(input: {
    batchId: string;
    file: File;
    fileType: ImportFileType;
    sourceDate?: string;
  }): Promise<ImportFileRecord> {
    const userId = await currentUserId();
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const fileId = crypto.randomUUID();
    const path = `${userId}/${input.batchId}/${fileId}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("imports").upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) fail("Could not save the original file", uploadError);

    const { data, error } = await supabase
      .from("import_files")
      .insert({
        id: fileId,
        batch_id: input.batchId,
        file_name: input.file.name.slice(0, 240),
        file_type: input.fileType,
        mime_type: input.file.type || "application/octet-stream",
        size_bytes: input.file.size,
        storage_path: path,
        processing_status: "pending",
        source_date: input.sourceDate ?? new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not register the import file", error);
    return mapImportFile(data);
  },

  async processImportFile(fileId: string): Promise<{
    status: string;
    records_processed?: number;
    records_needing_review?: number;
    warnings?: string[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("importHub", {
      body: { action: "process", file_id: fileId },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { status: "failed", error: "The import service returned no response." }) as {
      status: string;
      records_processed?: number;
      records_needing_review?: number;
      warnings?: string[];
      error?: string;
    };
  },

  async createPastedImport(input: {
    batchId: string;
    title: string;
    content: string;
    fileType: "email" | "txt";
    sourceDate?: string;
  }): Promise<ImportFileRecord> {
    const safeTitle = input.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "pasted-record";
    const extension = input.fileType === "email" ? "eml" : "txt";
    const file = new File([input.content], `${safeTitle}.${extension}`, { type: "text/plain" });
    return api.uploadImportFile({
      batchId: input.batchId,
      file,
      fileType: input.fileType,
      sourceDate: input.sourceDate,
    });
  },

  async reviewImportCandidate(input: {
    candidateId: string;
    reviewAction: "approve" | "edit" | "reject" | "keep_separate";
    patch?: Record<string, unknown>;
    note?: string;
  }): Promise<{ status: string; [key: string]: unknown }> {
    const { data, error } = await supabase.functions.invoke("importHub", {
      body: {
        action: "review",
        candidate_id: input.candidateId,
        review_action: input.reviewAction,
        patch: input.patch ?? {},
        note: input.note ?? "",
      },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { status: "unknown" }) as { status: string; [key: string]: unknown };
  },

  async updateFollowUpTask(id: string, status: "open" | "done" | "dismissed"): Promise<void> {
    const { error } = await supabase.from("follow_up_tasks").update({ status }).eq("id", id);
    if (error) fail("Could not update this follow-up task", error);
  },

  async getImportDocumentUrl(path: string): Promise<string | null> {
    if (!path) return null;
    const { data, error } = await supabase.storage.from("imports").createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async uploadVoiceAudio(
    blob: Blob,
    clientCaptureId: string,
    mimeType: string,
    fileName?: string,
  ): Promise<string> {
    const userId = await currentUserId();
    const extension = mimeType
      ? extensionFor(mimeType, fileName?.split(".").pop() || "webm")
      : fileName?.split(".").pop()?.toLowerCase() || "webm";
    const path = `${userId}/${clientCaptureId}.${extension}`;
    const { error } = await supabase.storage.from(VOICE_BUCKET).upload(path, blob, {
      contentType: mimeType || "audio/webm",
      upsert: true,
    });
    if (error) fail("Could not upload the audio", error);
    return path;
  },

  async deleteVoiceAudio(path: string): Promise<void> {
    await supabase.storage.from(VOICE_BUCKET).remove([path]);
  },

  async transcribeVoiceNote(audioPath: string, mimeType: string): Promise<TranscriptionResponse> {
    const { data, error } = await supabase.functions.invoke("transcribeVoiceNote", {
      body: { audioPath, mimeType },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { configured: false, reason: "The transcription service returned no response." }) as TranscriptionResponse;
  },

  async extractDealFields(transcript: string): Promise<ExtractionResponse> {
    const { data, error } = await supabase.functions.invoke("extractDealFields", {
      body: { transcript },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { configured: false, reason: "The extraction service returned no response." }) as ExtractionResponse;
  },

  async upsertVoiceSource(input: VoiceSourceInput): Promise<{ id: string; dealId: string | null }> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("sources")
      .upsert(
        {
          client_capture_id: input.clientCaptureId,
          title: input.title.slice(0, 200),
          source_type: input.sourceType,
          raw_text: input.transcript,
          original_transcript: input.originalTranscript,
          audio_storage_path: input.audioPath,
          audio_mime_type: input.audioMimeType,
          audio_size_bytes: input.audioSizeBytes,
          duration_seconds: input.durationSeconds,
          source_date: input.sourceDate,
          triage_status: input.dealId ? "promoted" : "new",
          deal_id: input.dealId,
          uploaded_by: userId,
          transcription_status: input.transcriptionStatus,
          transcription_provider: input.transcriptionProvider,
          transcription_model: input.transcriptionModel,
          transcription_error: input.transcriptionError,
          extraction_status: input.extractionStatus,
          extraction_error: input.extractionError,
          extracted_fields: (input.extractedFields ?? {}) as unknown as Database["public"]["Tables"]["sources"]["Insert"]["extracted_fields"],
          processed_at: input.processedAt,
        },
        { onConflict: "client_capture_id" },
      )
      .select("id, deal_id")
      .single();
    if (error) fail("Could not save this capture", error);
    return { id: data.id, dealId: data.deal_id };
  },

  async createDealFromCapture(input: {
    clientCaptureId: string;
    companyName: string;
    fields: Partial<ExtractedDealFields>;
  }): Promise<{ dealId: string; created: boolean }> {
    const userId = await currentUserId();
    const normalizedName = normalizeCompanyName(input.companyName);
    const domain = normalizedDomain(input.fields.website ?? "");
    const { data: existingDeals, error: readError } = await supabase
      .from("deals")
      .select("id,company_name,website,summary,sector,geography,stage,target_raise,cheque_sought,thesis,next_step")
      .limit(500);
    if (readError) fail("Could not check for an existing deal", readError);

    const exact = (existingDeals ?? []).filter((deal) => {
      const dealName = normalizeCompanyName(deal.company_name);
      const dealDomain = normalizedDomain(deal.website);
      return (domain && dealDomain === domain) || (normalizedName && dealName === normalizedName);
    });

    if (exact.length === 1) {
      const match = exact[0];
      const patch: Tables["deals"]["Update"] = {};
      if (!match.website && input.fields.website) patch.website = input.fields.website;
      if (!match.summary && input.fields.one_liner) patch.summary = input.fields.one_liner;
      if (!match.sector && input.fields.sector) patch.sector = input.fields.sector;
      if (!match.geography && input.fields.geography) patch.geography = input.fields.geography;
      if (!match.stage && input.fields.stage) patch.stage = input.fields.stage;
      if (match.target_raise === null && input.fields.target_raise) patch.target_raise = input.fields.target_raise;
      if (match.cheque_sought === null && input.fields.cheque_sought) patch.cheque_sought = input.fields.cheque_sought;
      if (!match.thesis && input.fields.thesis) patch.thesis = input.fields.thesis;
      if (!match.next_step && input.fields.next_step) patch.next_step = input.fields.next_step;
      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("deals").update(patch).eq("id", match.id);
        if (error) fail("The existing deal could not be updated with the new blanks", error);
      }
      return { dealId: match.id, created: false };
    }

    if (exact.length > 1) {
      throw new Error(
        `More than one existing case matches “${input.companyName}”. Choose Existing deal and pick the correct case; nothing was merged automatically.`,
      );
    }

    const similar = (existingDeals ?? [])
      .map((deal) => ({ deal, score: companySimilarity(normalizedName, normalizeCompanyName(deal.company_name)) }))
      .filter((item) => item.score >= 0.7)
      .sort((a, b) => b.score - a.score);
    if (similar[0]) {
      throw new Error(
        `Possible existing case “${similar[0].deal.company_name}” (${Math.round(similar[0].score * 100)}% name similarity). Choose Existing deal to link the capture, or use a distinct company name. No duplicate was created.`,
      );
    }

    const { error } = await supabase.from("deals").insert({
      id: input.clientCaptureId,
      company_name: input.companyName,
      website: input.fields.website ?? "",
      summary: input.fields.one_liner ?? "",
      sector: input.fields.sector ?? "",
      geography: input.fields.geography ?? "",
      stage: input.fields.stage ?? "",
      status: "sourcing",
      target_raise: input.fields.target_raise ?? null,
      cheque_sought: input.fields.cheque_sought ?? null,
      thesis: input.fields.thesis ?? "",
      next_step: input.fields.next_step ?? "",
      owner_user_id: userId,
      created_by: userId,
    });
    if (error && error.code !== "23505") fail("Could not create the deal", error);
    return { dealId: input.clientCaptureId, created: !error };
  },

  async runInvestorMatching(dealId: string): Promise<{
    configured: boolean;
    weights?: MatchWeights;
    matchesSaved?: number;
    excluded?: { investorId: string; investorName: string; reasons: string[] }[];
    missingDealInputs?: string[];
    warnings?: string[];
    needsResearch?: number;
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("matchInvestorsToDeal", {
      body: { deal_id: dealId },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { configured: false, error: "The matching service returned no response." }) as {
      configured: boolean;
      weights?: MatchWeights;
      matchesSaved?: number;
      excluded?: { investorId: string; investorName: string; reasons: string[] }[];
      missingDealInputs?: string[];
      warnings?: string[];
      needsResearch?: number;
      error?: string;
    };
  },

  async updateMatchWeights(id: string, weights: MatchWeights): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("match_weight_configs")
      .update({
        sector_thesis: weights.sectorThesis,
        stage: weights.stage,
        check_size: weights.checkSize,
        geography: weights.geography,
        relationship: weights.relationship,
        recent_interest: weights.recentInterest,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) fail("Could not save matching settings", error);
  },

  async decideMatch(matchId: string, status: "accepted" | "dismissed" | "deferred" | "suggested"): Promise<void> {
    const { error } = await supabase.rpc("decide_deal_match", {
      p_match_id: matchId,
      p_status: status,
    });
    if (error) fail("Could not record this match decision", error);
  },

  async analyzeDealSource(sourceId: string, dealId: string): Promise<{
    configured: boolean;
    runId?: string;
    briefId?: string | null;
    claims?: number;
    gaps?: number;
    warnings?: string[];
    reason?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("analyzeDealSource", {
      body: { source_id: sourceId, deal_id: dealId },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { configured: false, reason: "The analysis service returned no response." }) as {
      configured: boolean;
      runId?: string;
      briefId?: string | null;
      claims?: number;
      gaps?: number;
      warnings?: string[];
      reason?: string;
    };
  },

  async reviewClaim(id: string, decision: "approved" | "rejected", proposedChangeTo: string | null): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("deal_claims")
      .update({
        review_status: decision,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) fail("Could not review this fact", error);

    if (decision === "approved" && proposedChangeTo) {
      const { error: supersedeError } = await supabase
        .from("deal_claims")
        .update({ superseded_by: id })
        .eq("id", proposedChangeTo)
        .is("superseded_by", null);
      if (supersedeError) fail("The new fact was approved but the prior fact was not superseded", supersedeError);
    }
  },

  async createCapture(input: CaptureInput): Promise<Capture> {
    const userId = await currentUserId();
    let audioPath: string | null = null;

    if (input.audioBlob && input.audioBlob.size > 0) {
      const path = `${userId}/${crypto.randomUUID()}.${extensionFor(input.audioBlob.type)}`;
      const { error: uploadError } = await supabase.storage.from(VOICE_BUCKET).upload(path, input.audioBlob, {
        contentType: input.audioBlob.type || "audio/webm",
        upsert: false,
      });
      if (uploadError) fail("Could not store the voice recording", uploadError);
      audioPath = path;
    }

    const { data, error } = await supabase
      .from("sources")
      .insert({
        title: input.companyName,
        founder_name: input.founderName,
        founder_email: input.founderEmail,
        sector_hint: input.sector,
        stage_hint: input.roundStage,
        source_type: input.source,
        raw_text: input.notes,
        duration_seconds: input.durationSeconds,
        referred_by: input.referredBy,
        audio_storage_path: audioPath,
        uploaded_by: userId,
      })
      .select()
      .single();

    if (error) {
      if (audioPath) await supabase.storage.from(VOICE_BUCKET).remove([audioPath]);
      fail("Could not save this capture", error);
    }

    let audioUrl: string | null = null;
    if (audioPath) {
      const { data: signed } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(audioPath, SIGNED_URL_TTL);
      audioUrl = signed?.signedUrl ?? null;
    }

    return mapCapture(data, audioUrl);
  },

  async updateCapture(id: string, patch: { status?: CaptureStatus; dealId?: string | null; notes?: string }): Promise<void> {
    const update: Tables["sources"]["Update"] = {};
    if (patch.status !== undefined) update.triage_status = patch.status;
    if (patch.dealId !== undefined) update.deal_id = patch.dealId;
    if (patch.notes !== undefined) update.raw_text = patch.notes;

    const { error } = await supabase.from("sources").update(update).eq("id", id);
    if (error) fail("Could not update this capture", error);
  },

  async createCase(input: CaseInput): Promise<InvestmentCase> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("deals")
      .insert({
        company_name: input.companyName,
        website: input.website,
        summary: input.summary,
        sector: input.sector,
        geography: input.geography,
        stage: input.roundStage,
        status: input.status,
        target_raise: input.raiseAmount,
        cheque_sought: input.chequeSought,
        pre_money_valuation: input.preMoneyValuation,
        ownership_target: input.ownershipTarget,
        lead_required: input.leadRequired,
        lead_partner: input.leadPartner,
        referred_by: input.referredBy,
        thesis: input.thesis,
        next_step: input.nextStep,
        next_step_due: input.nextStepDue,
        owner_user_id: userId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) fail("Could not open this deal", error);

    if (input.captureId) {
      const { error: sourceError } = await supabase
        .from("sources")
        .update({ deal_id: data.id, triage_status: "promoted" })
        .eq("id", input.captureId);
      if (sourceError) {
        throw new Error(`Deal opened, but the source record was not linked: ${sourceError.message}`);
      }
    }

    return mapDeal(data);
  },

  async createDealPerson(
    dealId: string,
    input: { name: string; title: string; email: string; role: "founder" | "contact" | "other" },
  ): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("deal_people").insert({
      deal_id: dealId,
      name: input.name.trim().slice(0, 160),
      title: input.title.trim().slice(0, 160),
      email: input.email.trim() || null,
      role: input.role,
      source_excerpt: "Manually recorded by a workspace member.",
      created_by: userId,
    });
    if (error) fail("Could not save this person", error);
  },

  async addDealInvestor(input: {
    dealId: string;
    investorId: string;
    relationshipStatus: RelationshipStatus;
    notes: string;
  }): Promise<DealInvestor> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("deal_investors")
      .insert({
        deal_id: input.dealId,
        investor_id: input.investorId,
        relationship_status: input.relationshipStatus,
        notes: input.notes.trim().slice(0, 1000),
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not link this investor to the deal", error);
    return mapDealInvestor(data);
  },

  async updateDealInvestor(
    id: string,
    patch: Partial<Pick<DealInvestor, "relationshipStatus" | "notes">>,
  ): Promise<void> {
    const update: Tables["deal_investors"]["Update"] = {};
    if (patch.relationshipStatus !== undefined) update.relationship_status = patch.relationshipStatus;
    if (patch.notes !== undefined) update.notes = patch.notes.trim().slice(0, 1000);
    const { error } = await supabase.from("deal_investors").update(update).eq("id", id);
    if (error) fail("Could not update this investor association", error);
  },

  async removeDealInvestor(id: string): Promise<void> {
    const { error } = await supabase.from("deal_investors").delete().eq("id", id);
    if (error) fail("Could not remove this investor association", error);
  },

  async createDealMemo(input: {
    dealId: string;
    title: string;
    content: string;
  }): Promise<DealMemo> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("deal_memos")
      .insert({
        deal_id: input.dealId,
        title: input.title.trim().slice(0, 200),
        content: input.content.slice(0, 100000),
        status: "draft",
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not save this memo", error);
    return mapDealMemo(data);
  },

  async updateDealMemo(id: string, input: { title: string; content: string }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("deal_memos")
      .update({
        title: input.title.trim().slice(0, 200),
        content: input.content.slice(0, 100000),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) fail("Could not update this memo", error);
  },

  async addCaseDocument(input: {
    dealId: string;
    title: string;
    file: File;
    sourceDate: string;
  }): Promise<CaseDocument> {
    const userId = await currentUserId();
    const extension = input.file.name.toLowerCase().split(".").pop() ?? "";
    const documentType =
      extension === "pdf"
        ? "pdf"
        : extension === "docx"
          ? "docx"
          : extension === "csv"
            ? "csv"
            : extension === "eml"
              ? "email"
              : extension === "txt"
                ? "txt"
                : null;
    if (!documentType || !["pdf", "docx", "csv", "txt", "email"].includes(documentType)) {
      throw new Error("Unsupported document type. Use PDF, DOCX, CSV, TXT or EML.");
    }
    if (input.file.size > 20 * 1024 * 1024) {
      throw new Error("This document is larger than 20 MB.");
    }
    const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const path = `${userId}/manual/${input.dealId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from("imports").upload(path, input.file, {
      contentType: input.file.type || "application/octet-stream",
      upsert: false,
    });
    if (uploadError) fail("Could not store this document", uploadError);
    const { data, error } = await supabase
      .from("case_documents")
      .insert({
        deal_id: input.dealId,
        import_file_id: null,
        batch_id: null,
        title: (input.title.trim() || input.file.name).slice(0, 240),
        document_type: documentType,
        source_date: input.sourceDate,
        storage_path: path,
        file_name: input.file.name.slice(0, 240),
        mime_type: input.file.type || "application/octet-stream",
        extracted_text: "",
        excerpt: "",
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not attach this document to the case", error);
    return mapCaseDocument(data);
  },

  async updateCase(id: string, patch: Partial<Omit<InvestmentCase, "id" | "createdAt">>): Promise<void> {
    const update: Tables["deals"]["Update"] = {};
    if (patch.companyName !== undefined) update.company_name = patch.companyName;
    if (patch.website !== undefined) update.website = patch.website;
    if (patch.summary !== undefined) update.summary = patch.summary;
    if (patch.sector !== undefined) update.sector = patch.sector;
    if (patch.geography !== undefined) update.geography = patch.geography;
    if (patch.roundStage !== undefined) update.stage = patch.roundStage;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.raiseAmount !== undefined) update.target_raise = patch.raiseAmount;
    if (patch.chequeSought !== undefined) update.cheque_sought = patch.chequeSought;
    if (patch.preMoneyValuation !== undefined) update.pre_money_valuation = patch.preMoneyValuation;
    if (patch.ownershipTarget !== undefined) update.ownership_target = patch.ownershipTarget;
    if (patch.leadRequired !== undefined) update.lead_required = patch.leadRequired;
    if (patch.leadPartner !== undefined) update.lead_partner = patch.leadPartner;
    if (patch.referredBy !== undefined) update.referred_by = patch.referredBy;
    if (patch.thesis !== undefined) update.thesis = patch.thesis;
    if (patch.nextStep !== undefined) update.next_step = patch.nextStep;
    if (patch.nextStepDue !== undefined) update.next_step_due = patch.nextStepDue;

    const { error } = await supabase.from("deals").update(update).eq("id", id);
    if (error) fail("Could not update this deal", error);
  },

  async createClaim(input: ClaimInput): Promise<void> {
    const userId = await currentUserId();
    let filePath: string | null = null;
    let fileName: string | null = null;

    if (input.file) {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${input.dealId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) fail("Could not upload this document", uploadError);
      filePath = path;
      fileName = input.file.name;
    }

    const { error } = await supabase.from("deal_claims").insert({
      deal_id: input.dealId,
      claim_type: input.claimType,
      label: input.label,
      supporting_excerpt: input.supportingExcerpt,
      value_text: input.valueText,
      normalized_value: input.normalizedValue,
      currency: input.currency,
      reporting_period: input.reportingPeriod,
      verification_status: input.verificationStatus,
      source_id: input.sourceId,
      file_name: fileName,
      file_path: filePath,
      created_by: userId,
    });

    if (error) {
      if (filePath) await supabase.storage.from(EVIDENCE_BUCKET).remove([filePath]);
      fail("Could not save this claim", error);
    }
  },

  async deleteClaim(id: string, filePath: string | null): Promise<void> {
    const { error } = await supabase.from("deal_claims").delete().eq("id", id);
    if (error) fail("Could not remove this claim", error);
    if (filePath) await supabase.storage.from(EVIDENCE_BUCKET).remove([filePath]);
  },

  async getClaimUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async createGap(input: {
    dealId: string;
    question: string;
    owner: string;
    severity: GapSeverity;
    blockingDecision: boolean;
    dueDate: string | null;
  }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("decision_gaps").insert({
      deal_id: input.dealId,
      question: input.question,
      owner: input.owner,
      severity: input.severity,
      blocking_decision: input.blockingDecision,
      due_date: input.dueDate,
      created_by: userId,
    });
    if (error) fail("Could not add this decision gap", error);
  },

  async updateGap(
    id: string,
    patch: Partial<Pick<DecisionGap, "answer" | "status" | "owner" | "severity" | "blockingDecision">>,
  ): Promise<void> {
    const update: Tables["decision_gaps"]["Update"] = {};
    if (patch.answer !== undefined) update.answer = patch.answer;
    if (patch.owner !== undefined) update.owner = patch.owner;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.blockingDecision !== undefined) update.blocking_decision = patch.blockingDecision;
    if (patch.status !== undefined) {
      update.status = patch.status;
      update.resolved_at =
        patch.status === "answered" || patch.status === "resolved" ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("decision_gaps").update(update).eq("id", id);
    if (error) fail("Could not update this decision gap", error);
  },

  async createInvestor(input: InvestorInput): Promise<{ id: string }> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("investors")
      .insert({
        name: input.name,
        investor_type: input.investorType,
        thesis: input.thesis,
        stages: input.stages,
        sectors: input.sectors,
        geography: input.geographies,
        minimum_check: input.checkMin,
        maximum_check: input.checkMax,
        currency: input.currency,
        status: input.status,
        leads_rounds: input.leadsRounds,
        relationship: input.relationship,
        notes: input.notes,
        next_step: input.nextStep,
        next_step_due: input.nextStepDue,
        created_by: userId,
      })
      .select("id")
      .single();
    if (error) fail("Could not add this investor", error);

    const contact = input.contact;
    if (contact && (contact.contactName || contact.email || contact.title)) {
      await saveContact(data.id, { ...contact, isPrimary: true }, userId);
    }

    return { id: data.id };
  },

  async updateInvestor(
    id: string,
    patch: Partial<Omit<Investor, "id" | "createdAt" | "contacts">>,
    contact?: ContactInput | null,
  ): Promise<void> {
    const userId = await currentUserId();
    const update: Tables["investors"]["Update"] = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.investorType !== undefined) update.investor_type = patch.investorType;
    if (patch.thesis !== undefined) update.thesis = patch.thesis;
    if (patch.stages !== undefined) update.stages = patch.stages;
    if (patch.sectors !== undefined) update.sectors = patch.sectors;
    if (patch.geographies !== undefined) update.geography = patch.geographies;
    if (patch.checkMin !== undefined) update.minimum_check = patch.checkMin;
    if (patch.checkMax !== undefined) update.maximum_check = patch.checkMax;
    if (patch.currency !== undefined) update.currency = patch.currency;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.leadsRounds !== undefined) update.leads_rounds = patch.leadsRounds;
    if (patch.relationship !== undefined) update.relationship = patch.relationship;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.nextStep !== undefined) update.next_step = patch.nextStep;
    if (patch.nextStepDue !== undefined) update.next_step_due = patch.nextStepDue;
    if (patch.lastContactAt !== undefined) update.last_contact_at = patch.lastContactAt;

    const { error } = await supabase.from("investors").update(update).eq("id", id);
    if (error) fail("Could not update this investor", error);

    if (contact && (contact.contactName || contact.email || contact.title || contact.id)) {
      await saveContact(id, { ...contact, isPrimary: true }, userId);
    }
  },

  async createContact(investorId: string, input: ContactInput): Promise<void> {
    const userId = await currentUserId();
    await saveContact(investorId, input, userId);
  },

  async updateContact(investorId: string, input: ContactInput): Promise<void> {
    const userId = await currentUserId();
    await saveContact(investorId, input, userId);
  },

  async deleteContact(id: string): Promise<void> {
    const { error } = await supabase.from("investor_contacts").delete().eq("id", id);
    if (error) fail("Could not remove this contact", error);
  },

  async createInteraction(input: {
    investorId: string;
    dealId: string | null;
    kind: InteractionKind;
    summary: string;
    occurredAt: string;
    nextStep: string;
    nextStepDue: string | null;
    contactId?: string | null;
  }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("investor_interactions").insert({
      investor_id: input.investorId,
      deal_id: input.dealId,
      kind: input.kind,
      summary: input.summary,
      occurred_at: input.occurredAt,
      next_step: input.nextStep,
      next_step_due: input.nextStepDue,
      created_by: userId,
    });
    if (error) fail("Could not log this interaction", error);

    const { data: investor } = await supabase
      .from("investors")
      .select("relationship")
      .eq("id", input.investorId)
      .maybeSingle();

    const update: Tables["investors"]["Update"] = { last_contact_at: input.occurredAt };
    if (investor?.relationship === "new") update.relationship = "warm";
    if (input.nextStep) {
      update.next_step = input.nextStep;
      update.next_step_due = input.nextStepDue;
    }
    await supabase.from("investors").update(update).eq("id", input.investorId);

    if (input.contactId) {
      await supabase
        .from("investor_contacts")
        .update({ last_interaction_at: input.occurredAt })
        .eq("id", input.contactId);
    }
  },

  async createOutreach(input: OutreachInput): Promise<Outreach> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("outreach_actions")
      .insert({
        deal_id: input.dealId,
        investor_id: input.investorId,
        contact_id: input.contactId,
        match_id: input.matchId,
        draft_subject: input.subject,
        draft_body: input.body,
        channel: input.channel,
        status: input.status,
        owner_user_id: input.ownerUserId ?? userId,
        next_followup_at: input.nextFollowupAt,
        generation_status: input.generationStatus,
        grounding: input.grounding as unknown as Json,
        missing_information: input.missingInformation as unknown as Json,
        generation_model: input.generationModel,
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not save this draft", error);
    return mapOutreach(data);
  },

  async updateOutreachContent(
    id: string,
    patch: Partial<Pick<Outreach, "subject" | "body" | "channel" | "contactId" | "nextFollowupAt">>,
  ): Promise<void> {
    const update: Tables["outreach_actions"]["Update"] = {};
    if (patch.subject !== undefined) update.draft_subject = patch.subject;
    if (patch.body !== undefined) update.draft_body = patch.body;
    if (patch.channel !== undefined) update.channel = patch.channel;
    if (patch.contactId !== undefined) update.contact_id = patch.contactId;
    if (patch.nextFollowupAt !== undefined) update.next_followup_at = patch.nextFollowupAt;
    const { error } = await supabase.from("outreach_actions").update(update).eq("id", id);
    if (error) fail("Could not update this outreach", error);
  },

  async approveOutreach(id: string): Promise<void> {
    const { error } = await supabase.rpc("approve_outreach", { p_id: id });
    if (error) fail("Could not approve this outreach", error);
  },

  async rejectOutreach(id: string, reason: string): Promise<void> {
    const { error } = await supabase.rpc("reject_outreach", { p_id: id, p_reason: reason });
    if (error) fail("Could not reject this outreach", error);
  },

  async recordOutreachProgress(
    id: string,
    input: {
      status: "contacted" | "replied" | "interested" | "not_interested" | "follow_up_needed";
      note: string;
      interactionAt: string | null;
      nextFollowupAt: string | null;
      followupNote: string;
    },
  ): Promise<void> {
    const { error } = await supabase.rpc("record_outreach_progress", {
      p_id: id,
      p_status: input.status,
      p_note: input.note,
      p_interaction_at: input.interactionAt,
      p_next_followup_at: input.nextFollowupAt,
      p_followup_note: input.followupNote,
    });
    if (error) fail("Could not record this outreach activity", error);
  },

  async assignOutreachOwner(id: string, ownerUserId: string): Promise<void> {
    const { error } = await supabase.rpc("assign_outreach_owner", {
      p_id: id,
      p_owner_user_id: ownerUserId,
    });
    if (error) fail("Could not assign this outreach owner", error);
  },

  async generateOutreachDraft(matchId: string): Promise<{
    configured: boolean;
    subject?: string;
    body?: string;
    grounding?: string[];
    missingInformation?: string[];
    model?: string;
    reason?: string;
  }> {
    const { data, error } = await supabase.functions.invoke("generateOutreachDraft", {
      body: { match_id: matchId },
    });
    if (error) throw new Error(await readFunctionError(error));
    return (data ?? { configured: false, reason: "The generation service returned no response." }) as {
      configured: boolean;
      subject?: string;
      body?: string;
      grounding?: string[];
      missingInformation?: string[];
      model?: string;
      reason?: string;
    };
  },

  async saveMatch(input: {
    dealId: string;
    investorId: string;
    score: number;
    rules: MatchRule[];
    explanation: string;
    gaps: string[];
    status: MatchStatus;
  }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("deal_investor_matches").upsert(
      {
        deal_id: input.dealId,
        investor_id: input.investorId,
        fit_score: input.score,
        score_breakdown: input.rules as unknown as Database["public"]["Tables"]["deal_investor_matches"]["Insert"]["score_breakdown"],
        fit_explanation: input.explanation,
        missing_information: input.gaps as unknown as Database["public"]["Tables"]["deal_investor_matches"]["Insert"]["missing_information"],
        match_status: input.status,
        created_by: userId,
      },
      { onConflict: "deal_id,investor_id" },
    );
    if (error) fail("Could not save this match", error);
  },

  async inviteMember(input: { email: string; role: MemberRole; displayName: string }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("workspace_members").insert({
      email: input.email.trim().toLowerCase(),
      role: input.role,
      display_name: input.displayName.trim(),
      status: "invited",
      invited_by: userId,
    });
    if (error) {
      if (error.code === "23505") throw new Error("That email is already on the workspace list.");
      fail("Could not invite this member", error);
    }
  },

  async updateMember(id: string, patch: Partial<Pick<WorkspaceMember, "role" | "status" | "displayName">>): Promise<void> {
    const update: Tables["workspace_members"]["Update"] = {};
    if (patch.role !== undefined) update.role = patch.role;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.displayName !== undefined) update.display_name = patch.displayName;
    const { error } = await supabase.from("workspace_members").update(update).eq("id", id);
    if (error) fail("Could not update this member", error);
  },

  async removeMember(id: string): Promise<void> {
    const { error } = await supabase.from("workspace_members").delete().eq("id", id);
    if (error) fail("Could not remove this member", error);
  },

  async importInvestors(rows: Record<string, unknown>[]): Promise<ImportSummary> {
    const { data, error } = await supabase.rpc("import_investors", { p_rows: rows as unknown as Json });
    if (error) fail("Could not import investors", error);
    const summary = (data ?? {}) as Partial<ImportSummary>;
    return {
      inserted: summary.inserted ?? 0,
      skipped: summary.skipped ?? 0,
      contacts: summary.contacts ?? 0,
    };
  },
};

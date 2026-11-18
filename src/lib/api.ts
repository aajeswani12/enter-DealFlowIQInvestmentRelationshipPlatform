import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { WorkspaceData } from "./workspace";
import type {
  Capture,
  CaptureSource,
  CaptureStatus,
  CaseQuestion,
  CaseStatus,
  Evidence,
  EvidenceKind,
  Interaction,
  InteractionKind,
  InvestmentCase,
  Investor,
  InvestorType,
  Outreach,
  OutreachChannel,
  OutreachStatus,
  QuestionStatus,
  RelationshipStatus,
} from "./types";

type Tables = Database["public"]["Tables"];
type CaptureRow = Tables["deal_inbox_items"]["Row"];
type CaseRow = Tables["investment_cases"]["Row"];
type EvidenceRow = Tables["case_evidence"]["Row"];
type QuestionRow = Tables["case_questions"]["Row"];
type InvestorRow = Tables["investors"]["Row"];
type InteractionRow = Tables["investor_interactions"]["Row"];
type OutreachRow = Tables["outreach_messages"]["Row"];

const VOICE_BUCKET = "voice-notes";
const EVIDENCE_BUCKET = "case-evidence";
const SIGNED_URL_TTL = 60 * 60 * 4;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`${context}: ${error?.message ?? "unknown error"}`);
}

function extensionFor(mimeType: string, fallback = "webm"): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("webm")) return "webm";
  return fallback;
}

const toNumber = (value: unknown): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

function mapCapture(row: CaptureRow, audioUrl: string | null): Capture {
  return {
    id: row.id,
    companyName: row.company_name,
    founderName: row.founder_name,
    founderEmail: row.founder_email,
    sector: row.sector,
    roundStage: row.round_stage,
    source: row.source as CaptureSource,
    notes: row.notes,
    audioUrl,
    audioPath: row.audio_path,
    durationSeconds: row.duration_seconds,
    status: row.status as CaptureStatus,
    referredBy: row.referred_by,
    caseId: row.case_id,
    createdAt: row.created_at,
  };
}

function mapCase(row: CaseRow): InvestmentCase {
  return {
    id: row.id,
    companyName: row.company_name,
    oneLiner: row.one_liner,
    sector: row.sector,
    geography: row.geography,
    roundStage: row.round_stage,
    status: row.status as CaseStatus,
    raiseAmount: toNumber(row.raise_amount),
    chequeSought: toNumber(row.cheque_sought),
    preMoneyValuation: toNumber(row.pre_money_valuation),
    ownershipTarget: toNumber(row.ownership_target),
    leadRequired: row.lead_required,
    leadPartner: row.lead_partner,
    referredBy: row.referred_by,
    thesis: row.thesis,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    captureId: row.capture_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvidence(row: EvidenceRow): Evidence {
  return {
    id: row.id,
    caseId: row.case_id,
    kind: row.kind as EvidenceKind,
    title: row.title,
    detail: row.detail,
    fileName: row.file_name,
    filePath: row.file_path,
    createdAt: row.created_at,
  };
}

function mapQuestion(row: QuestionRow): CaseQuestion {
  return {
    id: row.id,
    caseId: row.case_id,
    question: row.question,
    owner: row.owner,
    status: row.status as QuestionStatus,
    answer: row.answer,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

function mapInvestor(row: InvestorRow): Investor {
  return {
    id: row.id,
    firmName: row.firm_name,
    contactName: row.contact_name,
    email: row.email,
    investorType: row.investor_type as InvestorType,
    stages: row.stages ?? [],
    sectors: row.sectors ?? [],
    geographies: row.geographies ?? [],
    checkMin: toNumber(row.check_min),
    checkMax: toNumber(row.check_max),
    leadsRounds: row.leads_rounds,
    relationship: row.relationship as RelationshipStatus,
    notes: row.notes,
    lastContactAt: row.last_contact_at,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    createdAt: row.created_at,
  };
}

function mapInteraction(row: InteractionRow): Interaction {
  return {
    id: row.id,
    investorId: row.investor_id,
    caseId: row.case_id,
    kind: row.kind as InteractionKind,
    summary: row.summary,
    occurredAt: row.occurred_at,
    nextStep: row.next_step,
    nextStepDue: row.next_step_due,
    createdAt: row.created_at,
  };
}

function mapOutreach(row: OutreachRow): Outreach {
  return {
    id: row.id,
    caseId: row.case_id,
    investorId: row.investor_id,
    subject: row.subject,
    body: row.body,
    channel: row.channel as OutreachChannel,
    status: row.status as OutreachStatus,
    createdAt: row.created_at,
    approvedAt: row.approved_at,
    sentAt: row.sent_at,
  };
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) fail("Not signed in", error);
  return data.user.id;
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
  captureId?: string | null;
}

export interface InvestorInput {
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
  nextStep: string;
  nextStepDue: string | null;
}

export interface OutreachInput {
  caseId: string;
  investorId: string;
  subject: string;
  body: string;
  channel: OutreachChannel;
  status: OutreachStatus;
}

export interface EvidenceInput {
  caseId: string;
  kind: EvidenceKind;
  title: string;
  detail: string;
  file: File | null;
}

export const api = {
  async listWorkspace(): Promise<WorkspaceData> {
    const [captures, cases, evidence, questions, investors, interactions, outreach] = await Promise.all([
      supabase.from("deal_inbox_items").select("*").order("created_at", { ascending: false }),
      supabase.from("investment_cases").select("*").order("updated_at", { ascending: false }),
      supabase.from("case_evidence").select("*").order("created_at", { ascending: false }),
      supabase.from("case_questions").select("*").order("created_at", { ascending: false }),
      supabase.from("investors").select("*").order("created_at", { ascending: false }),
      supabase.from("investor_interactions").select("*").order("occurred_at", { ascending: false }),
      supabase.from("outreach_messages").select("*").order("created_at", { ascending: false }),
    ]);

    if (captures.error) fail("Could not load the Deal Inbox", captures.error);
    if (cases.error) fail("Could not load investment cases", cases.error);
    if (evidence.error) fail("Could not load case evidence", evidence.error);
    if (questions.error) fail("Could not load case questions", questions.error);
    if (investors.error) fail("Could not load the investor network", investors.error);
    if (interactions.error) fail("Could not load interactions", interactions.error);
    if (outreach.error) fail("Could not load outreach", outreach.error);

    const captureRows = captures.data ?? [];
    const audioPaths = captureRows
      .map((row) => row.audio_path)
      .filter((path): path is string => typeof path === "string" && path.length > 0);

    const signed = new Map<string, string>();
    if (audioPaths.length > 0) {
      const { data } = await supabase.storage.from(VOICE_BUCKET).createSignedUrls(audioPaths, SIGNED_URL_TTL);
      data?.forEach((item) => {
        if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      });
    }

    return {
      captures: captureRows.map((row) => mapCapture(row, row.audio_path ? signed.get(row.audio_path) ?? null : null)),
      cases: (cases.data ?? []).map(mapCase),
      evidence: (evidence.data ?? []).map(mapEvidence),
      questions: (questions.data ?? []).map(mapQuestion),
      investors: (investors.data ?? []).map(mapInvestor),
      interactions: (interactions.data ?? []).map(mapInteraction),
      outreach: (outreach.data ?? []).map(mapOutreach),
    };
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
      .from("deal_inbox_items")
      .insert({
        company_name: input.companyName,
        founder_name: input.founderName,
        founder_email: input.founderEmail,
        sector: input.sector,
        round_stage: input.roundStage,
        source: input.source,
        notes: input.notes,
        duration_seconds: input.durationSeconds,
        referred_by: input.referredBy,
        audio_path: audioPath,
        created_by: userId,
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

  async updateCapture(
    id: string,
    patch: Partial<Pick<Capture, "status" | "caseId" | "notes">>,
  ): Promise<void> {
    const update: Tables["deal_inbox_items"]["Update"] = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.caseId !== undefined) update.case_id = patch.caseId;
    if (patch.notes !== undefined) update.notes = patch.notes;

    const { error } = await supabase.from("deal_inbox_items").update(update).eq("id", id);
    if (error) fail("Could not update this capture", error);
  },

  async createCase(input: CaseInput): Promise<InvestmentCase> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("investment_cases")
      .insert({
        company_name: input.companyName,
        one_liner: input.oneLiner,
        sector: input.sector,
        geography: input.geography,
        round_stage: input.roundStage,
        status: input.status,
        raise_amount: input.raiseAmount,
        cheque_sought: input.chequeSought,
        pre_money_valuation: input.preMoneyValuation,
        ownership_target: input.ownershipTarget,
        lead_required: input.leadRequired,
        lead_partner: input.leadPartner,
        referred_by: input.referredBy,
        thesis: input.thesis,
        next_step: input.nextStep,
        next_step_due: input.nextStepDue,
        capture_id: input.captureId ?? null,
        created_by: userId,
      })
      .select()
      .single();

    if (error) fail("Could not open this case", error);

    if (input.captureId) {
      const { error: captureError } = await supabase
        .from("deal_inbox_items")
        .update({ status: "promoted", case_id: data.id })
        .eq("id", input.captureId);
      if (captureError) {
        // The case exists; report the partial update instead of hiding it.
        throw new Error(`Case opened, but the source capture was not linked: ${captureError.message}`);
      }
    }

    return mapCase(data);
  },

  async updateCase(id: string, patch: Partial<Omit<InvestmentCase, "id" | "createdAt">>): Promise<void> {
    const update: Tables["investment_cases"]["Update"] = { updated_at: new Date().toISOString() };
    if (patch.companyName !== undefined) update.company_name = patch.companyName;
    if (patch.oneLiner !== undefined) update.one_liner = patch.oneLiner;
    if (patch.sector !== undefined) update.sector = patch.sector;
    if (patch.geography !== undefined) update.geography = patch.geography;
    if (patch.roundStage !== undefined) update.round_stage = patch.roundStage;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.raiseAmount !== undefined) update.raise_amount = patch.raiseAmount;
    if (patch.chequeSought !== undefined) update.cheque_sought = patch.chequeSought;
    if (patch.preMoneyValuation !== undefined) update.pre_money_valuation = patch.preMoneyValuation;
    if (patch.ownershipTarget !== undefined) update.ownership_target = patch.ownershipTarget;
    if (patch.leadRequired !== undefined) update.lead_required = patch.leadRequired;
    if (patch.leadPartner !== undefined) update.lead_partner = patch.leadPartner;
    if (patch.referredBy !== undefined) update.referred_by = patch.referredBy;
    if (patch.thesis !== undefined) update.thesis = patch.thesis;
    if (patch.nextStep !== undefined) update.next_step = patch.nextStep;
    if (patch.nextStepDue !== undefined) update.next_step_due = patch.nextStepDue;

    const { error } = await supabase.from("investment_cases").update(update).eq("id", id);
    if (error) fail("Could not update this case", error);
  },

  async createEvidence(input: EvidenceInput): Promise<void> {
    const userId = await currentUserId();
    let filePath: string | null = null;

    if (input.file) {
      const safeName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${userId}/${input.caseId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(EVIDENCE_BUCKET).upload(path, input.file, {
        contentType: input.file.type || "application/octet-stream",
        upsert: false,
      });
      if (uploadError) fail("Could not upload this document", uploadError);
      filePath = path;
    }

    const { error } = await supabase.from("case_evidence").insert({
      case_id: input.caseId,
      kind: input.kind,
      title: input.title,
      detail: input.detail,
      file_name: input.file?.name ?? null,
      file_path: filePath,
      created_by: userId,
    });

    if (error) {
      if (filePath) await supabase.storage.from(EVIDENCE_BUCKET).remove([filePath]);
      fail("Could not save this evidence", error);
    }
  },

  async deleteEvidence(id: string, filePath: string | null): Promise<void> {
    const { error } = await supabase.from("case_evidence").delete().eq("id", id);
    if (error) fail("Could not remove this evidence", error);
    if (filePath) await supabase.storage.from(EVIDENCE_BUCKET).remove([filePath]);
  },

  async getEvidenceUrl(path: string): Promise<string | null> {
    const { data, error } = await supabase.storage.from(EVIDENCE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
    if (error) return null;
    return data?.signedUrl ?? null;
  },

  async createQuestion(input: { caseId: string; question: string; owner: string }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("case_questions").insert({
      case_id: input.caseId,
      question: input.question,
      owner: input.owner,
      created_by: userId,
    });
    if (error) fail("Could not add this question", error);
  },

  async updateQuestion(
    id: string,
    patch: Partial<Pick<CaseQuestion, "answer" | "status" | "owner">>,
  ): Promise<void> {
    const update: Tables["case_questions"]["Update"] = {};
    if (patch.answer !== undefined) update.answer = patch.answer;
    if (patch.owner !== undefined) update.owner = patch.owner;
    if (patch.status !== undefined) {
      update.status = patch.status;
      update.resolved_at = patch.status === "answered" ? new Date().toISOString() : null;
    }
    const { error } = await supabase.from("case_questions").update(update).eq("id", id);
    if (error) fail("Could not update this question", error);
  },

  async createInvestor(input: InvestorInput): Promise<Investor> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("investors")
      .insert({
        firm_name: input.firmName,
        contact_name: input.contactName,
        email: input.email,
        investor_type: input.investorType,
        stages: input.stages,
        sectors: input.sectors,
        geographies: input.geographies,
        check_min: input.checkMin,
        check_max: input.checkMax,
        leads_rounds: input.leadsRounds,
        relationship: input.relationship,
        notes: input.notes,
        next_step: input.nextStep,
        next_step_due: input.nextStepDue,
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not add this investor", error);
    return mapInvestor(data);
  },

  async updateInvestor(id: string, patch: Partial<Omit<Investor, "id" | "createdAt">>): Promise<void> {
    const update: Tables["investors"]["Update"] = {};
    if (patch.firmName !== undefined) update.firm_name = patch.firmName;
    if (patch.contactName !== undefined) update.contact_name = patch.contactName;
    if (patch.email !== undefined) update.email = patch.email;
    if (patch.investorType !== undefined) update.investor_type = patch.investorType;
    if (patch.stages !== undefined) update.stages = patch.stages;
    if (patch.sectors !== undefined) update.sectors = patch.sectors;
    if (patch.geographies !== undefined) update.geographies = patch.geographies;
    if (patch.checkMin !== undefined) update.check_min = patch.checkMin;
    if (patch.checkMax !== undefined) update.check_max = patch.checkMax;
    if (patch.leadsRounds !== undefined) update.leads_rounds = patch.leadsRounds;
    if (patch.relationship !== undefined) update.relationship = patch.relationship;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.nextStep !== undefined) update.next_step = patch.nextStep;
    if (patch.nextStepDue !== undefined) update.next_step_due = patch.nextStepDue;
    if (patch.lastContactAt !== undefined) update.last_contact_at = patch.lastContactAt;

    const { error } = await supabase.from("investors").update(update).eq("id", id);
    if (error) fail("Could not update this investor", error);
  },

  async createInteraction(input: {
    investorId: string;
    caseId: string | null;
    kind: InteractionKind;
    summary: string;
    occurredAt: string;
    nextStep: string;
    nextStepDue: string | null;
  }): Promise<void> {
    const userId = await currentUserId();
    const { error } = await supabase.from("investor_interactions").insert({
      investor_id: input.investorId,
      case_id: input.caseId,
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
  },

  async createOutreach(input: OutreachInput): Promise<Outreach> {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("outreach_messages")
      .insert({
        case_id: input.caseId,
        investor_id: input.investorId,
        subject: input.subject,
        body: input.body,
        channel: input.channel,
        status: input.status,
        created_by: userId,
      })
      .select()
      .single();
    if (error) fail("Could not save this draft", error);
    return mapOutreach(data);
  },

  async updateOutreach(
    id: string,
    patch: Partial<Pick<Outreach, "subject" | "body" | "status" | "channel">>,
  ): Promise<void> {
    const update: Tables["outreach_messages"]["Update"] = {};
    if (patch.subject !== undefined) update.subject = patch.subject;
    if (patch.body !== undefined) update.body = patch.body;
    if (patch.channel !== undefined) update.channel = patch.channel;
    if (patch.status !== undefined) {
      update.status = patch.status;
      const now = new Date().toISOString();
      if (patch.status === "approved") update.approved_at = now;
      if (patch.status === "sent") update.sent_at = now;
    }
    const { error } = await supabase.from("outreach_messages").update(update).eq("id", id);
    if (error) fail("Could not update this outreach", error);
  },
};

/**
 * Pure evidence analysis for DealFlow IQ.
 *
 * No network, Deno, or database access. The backend function fetches the source
 * and existing facts, then calls analyzeDealEvidence(). Keeping this pure makes
 * excerpt validation, discrepancy handling, and reviewed-fact protection
 * independently testable.
 */

export const ALLOWED_CLAIM_TYPES = [
  "traction",
  "revenue",
  "financial",
  "founder",
  "investor_mention",
  "product",
  "funding",
  "ownership",
  "next_action",
  "company",
  "sector",
  "stage",
  "metric",
  "document",
  "call_note",
  "reference",
] as const;

export type AllowedClaimType = (typeof ALLOWED_CLAIM_TYPES)[number];

export interface SourceContext {
  id: string;
  title: string;
  sourceDate: string;
}

export interface DealContext {
  id: string;
  companyName: string;
  sector: string;
  stage: string;
  targetRaise: number | null;
  ownershipTarget: number | null;
  nextStep: string;
  leadPartner: string;
}

export interface ExistingClaim {
  id: string;
  claimType: string;
  label: string;
  valueText: string;
  normalizedValue: number | null;
  currency: string;
  reportingPeriod: string;
  verificationStatus: string;
  reviewStatus: string;
  claimKey: string;
  sourceId: string | null;
  sourceTitle: string;
  sourceDate: string;
  supportingExcerpt: string;
}

export interface ExistingGap {
  id: string;
  gapKey: string;
  question: string;
  whyItMatters: string;
  status: string;
  sourceId: string | null;
  suggestedAction: string;
}

export interface ModelClaim {
  claim_type?: unknown;
  label?: unknown;
  value_text?: unknown;
  normalized_value?: unknown;
  currency?: unknown;
  reporting_period?: unknown;
  excerpt?: unknown;
  attribution?: unknown;
}

export interface ModelPayload {
  claims?: unknown;
  next_steps?: unknown;
  missing_information?: unknown;
  ownership_notes?: unknown;
}

export interface EvidenceClaim {
  claimType: AllowedClaimType;
  label: string;
  valueText: string;
  normalizedValue: number | null;
  currency: string;
  reportingPeriod: string;
  excerpt: string;
  attribution: "founder" | "third_party" | "unknown";
  verificationStatus: "founder_reported" | "unverified" | "corroborated";
  verificationNote: string;
  claimKey: string;
  proposedChangeTo: string | null;
  sourceId: string;
  reviewStatus: "draft";
}

export interface ReadinessGap {
  gapKey: string;
  question: string;
  whyItMatters: string;
  evidence: string;
  suggestedAction: string;
  status: "open" | "needs_review";
  severity: "low" | "medium" | "high" | "critical";
  sourceId: string | null;
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

export interface BriefContent {
  summary: string;
  knownFacts: BriefFact[];
  unknowns: BriefUnknown[];
  risks: BriefRisk[];
  followUps: string[];
  evidence: BriefEvidence[];
}

export interface AnalysisInput {
  payload: ModelPayload;
  sourceText: string;
  source: SourceContext;
  deal: DealContext;
  existingClaims: ExistingClaim[];
  existingGaps: ExistingGap[];
}

export interface AnalysisResult {
  claims: EvidenceClaim[];
  gaps: ReadinessGap[];
  brief: BriefContent;
  warnings: string[];
}

const FINANCIAL_TYPES = new Set(["traction", "revenue", "financial", "funding"]);

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)([mk])?$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed)) return null;
  return match[2] ? parsed * (match[2].toLowerCase() === "m" ? 1_000_000 : 1_000) : parsed;
}

function normalizeKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function normalizePeriod(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeValue(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function claimType(value: unknown): AllowedClaimType | null {
  const normalized = text(value, 40).toLowerCase();
  if (!normalized) return null;
  return (ALLOWED_CLAIM_TYPES as readonly string[]).includes(normalized)
    ? (normalized as AllowedClaimType)
    : null;
}

function attribution(value: unknown): "founder" | "third_party" | "unknown" {
  const normalized = text(value, 30).toLowerCase();
  return normalized === "founder" || normalized === "third_party" ? normalized : "unknown";
}

function sameStoredValue(existing: ExistingClaim, next: EvidenceClaim): boolean {
  const left = existing.normalizedValue ?? existing.valueText;
  const right = next.normalizedValue ?? next.valueText;
  if (typeof left === "number" && typeof right === "number") {
    return Math.abs(left - right) < 0.0001;
  }
  return normalizeValue(String(left)) === normalizeValue(String(right));
}

function samePeriod(left: string, right: string): boolean {
  if (!left && !right) return true;
  if (!left || !right) return false;
  return normalizePeriod(left) === normalizePeriod(right);
}

/**
 * Returns the exact substring from the source, or null. Surrounding quotes and
 * whitespace are stripped from the model output before matching, but the stored
 * excerpt is always characters taken from the source itself.
 */
export function exactExcerpt(sourceText: string, rawExcerpt: unknown): string | null {
  let candidate = text(rawExcerpt, 2000);
  if (!candidate) return null;
  candidate = candidate
    .replace(/^["'“”‘’\s]+/, "")
    .replace(/["'“”‘’\s]+$/, "")
    .trim();
  if (candidate.length < 8) return null;
  const index = sourceText.indexOf(candidate);
  if (index === -1) return null;
  return sourceText.slice(index, index + candidate.length);
}

function evidenceLine(excerpt: string, source: SourceContext): string {
  const date = source.sourceDate ? source.sourceDate.slice(0, 10) : "undated";
  return `"${excerpt}" — ${source.title || "Untitled source"}, ${date}`;
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function analyzeDealEvidence(input: AnalysisInput): AnalysisResult {
  const { payload, sourceText, source, deal, existingClaims, existingGaps } = input;
  const warnings: string[] = [];
  const claims: EvidenceClaim[] = [];
  const gaps: ReadinessGap[] = [];
  const gapKeys = new Set<string>();
  const existingGapKeys = new Set(existingGaps.map((gap) => gap.gapKey).filter(Boolean));
  const approvedClaims = existingClaims.filter((claim) => claim.reviewStatus === "approved");
  const activeClaims = existingClaims.filter((claim) => claim.reviewStatus !== "rejected");

  const addGap = (gap: ReadinessGap) => {
    if (existingGapKeys.has(gap.gapKey) || gapKeys.has(gap.gapKey)) return;
    gapKeys.add(gap.gapKey);
    gaps.push(gap);
  };

  const rawClaims = Array.isArray(payload.claims) ? payload.claims : [];
  if (!Array.isArray(payload.claims)) warnings.push("The model did not return a claims array.");

  for (const raw of rawClaims) {
    if (typeof raw !== "object" || raw === null) continue;
    const candidate = raw as ModelClaim;
    const type = claimType(candidate.claim_type);
    const label = text(candidate.label, 160);
    const excerpt = exactExcerpt(sourceText, candidate.excerpt);

    if (!type) {
      warnings.push(`Discarded a claim with an unsupported type: "${text(candidate.claim_type, 40)}".`);
      continue;
    }
    if (!label) {
      warnings.push(`Discarded a ${type} claim with no label.`);
      continue;
    }
    if (!excerpt) {
      warnings.push(`Discarded "${label}" because its excerpt was not found verbatim in the source.`);
      continue;
    }

    const normalized = amount(candidate.normalized_value);
    const valueText = text(candidate.value_text, 240);
    if (!valueText && normalized === null) {
      warnings.push(`Discarded "${label}" because it has no value.`);
      continue;
    }

    const period = text(candidate.reporting_period, 80);
    const attributionValue = attribution(candidate.attribution);
    const currency = text(candidate.currency, 3).toUpperCase() || "USD";
    const claimKey = `${type}:${normalizeKey(label)}`;
    const claim: EvidenceClaim = {
      claimType: type,
      label,
      valueText,
      normalizedValue: normalized,
      currency,
      reportingPeriod: period,
      excerpt,
      attribution: attributionValue,
      verificationStatus: attributionValue === "founder" ? "founder_reported" : "unverified",
      verificationNote:
        attributionValue === "founder"
          ? "Founder's own statement in this source."
          : attributionValue === "third_party"
            ? "Mentioned by a third party in this source; not independently verified."
            : "No clear attribution in this source; treated as unverified.",
      claimKey,
      proposedChangeTo: null,
      sourceId: source.id,
      reviewStatus: "draft",
    };

    const sameKey = activeClaims.filter(
      (existing) =>
        existing.claimKey === claimKey ||
        `${existing.claimType}:${normalizeKey(existing.label)}` === claimKey,
    );

    const duplicate = sameKey.find(
      (existing) => sameStoredValue(existing, claim) && samePeriod(existing.reportingPeriod, claim.reportingPeriod),
    );
    if (duplicate) {
      warnings.push(`Skipped "${label}" because the same value and period is already recorded.`);
      continue;
    }

    const reviewed = sameKey.filter((existing) => existing.reviewStatus === "approved");
    for (const existing of reviewed) {
      if (sameStoredValue(existing, claim)) {
        if (existing.verificationStatus === "corroborated" && samePeriod(existing.reportingPeriod, claim.reportingPeriod)) {
          claim.verificationStatus = "corroborated";
          claim.verificationNote = "Matches a previously human-corroborated claim.";
        } else {
          claim.verificationNote = `Repeats a previously reviewed claim (${existing.reportingPeriod || "no period"}); this is not independent corroboration.`;
        }
        continue;
      }

      claim.proposedChangeTo = existing.id;
      claim.verificationNote = "Differs from a reviewed fact; this draft needs human approval before it can change the case.";

      const evidence = `${evidenceLine(existing.supportingExcerpt || "No stored excerpt.", {
        id: existing.sourceId ?? "",
        title: existing.sourceTitle || "Earlier source",
        sourceDate: existing.sourceDate,
      })} ${evidenceLine(claim.excerpt, source)}`;

      addGap({
        gapKey: `discrepancy:${claimKey}`,
        question: `Which ${label.toLowerCase()} figure is correct: ${
          existing.valueText || existing.normalizedValue
        } or ${claim.valueText || claim.normalizedValue}?`,
        whyItMatters: !existing.reportingPeriod || !claim.reportingPeriod
          ? "At least one figure has no known reporting period, so the difference cannot be reconciled yet. A different period can explain different figures."
          : normalizePeriod(existing.reportingPeriod) !== normalizePeriod(claim.reportingPeriod)
            ? "The reporting periods differ, which may explain the figures. Confirm which period each figure covers before treating this as a contradiction."
            : "Both figures claim the same reporting period, so the difference needs reconciliation.",
        evidence,
        suggestedAction:
          "Ask the founder to confirm both figures with dates and, where possible, a supporting export. Record the confirmed period.",
        status: "needs_review",
        severity: "high",
        sourceId: source.id,
      });
    }

    // Drafts are not reviewed facts, but conflicting drafts still need attention.
    for (const existing of sameKey.filter((item) => item.reviewStatus === "draft")) {
      if (sameStoredValue(existing, claim)) continue;
      addGap({
        gapKey: `discrepancy:${claimKey}`,
        question: `Two draft figures for ${label.toLowerCase()} need reconciliation: ${
          existing.valueText || existing.normalizedValue
        } and ${claim.valueText || claim.normalizedValue}.`,
        whyItMatters:
          "Both figures are still drafts. They must be reconciled before either can be treated as a reviewed fact.",
        evidence: `${evidenceLine(existing.supportingExcerpt || "No stored excerpt.", {
          id: existing.sourceId ?? "",
          title: existing.sourceTitle || "Earlier source",
          sourceDate: existing.sourceDate,
        })} ${evidenceLine(claim.excerpt, source)}`,
        suggestedAction: "Confirm the metric definition and period with the founder before approving either draft.",
        status: "needs_review",
        severity: "medium",
        sourceId: source.id,
      });
    }

    if (!claim.reportingPeriod && FINANCIAL_TYPES.has(claim.claimType)) {
      addGap({
        gapKey: `unknown_period:${claimKey}`,
        question: `What reporting period does the ${label.toLowerCase()} figure cover?`,
        whyItMatters:
          "A financial or traction figure without a reporting period cannot be compared with later updates or treated as a point-in-time fact.",
        evidence: evidenceLine(claim.excerpt, source),
        suggestedAction: "Ask for the period end date and the metric definition, then update the claim.",
        status: "needs_review",
        severity: "medium",
        sourceId: source.id,
      });
    }

    claims.push(claim);
  }

  for (const claim of approvedClaims) {
    if (!FINANCIAL_TYPES.has(claim.claimType) || claim.reportingPeriod) continue;
    addGap({
      gapKey: `unknown_period:${claim.claimKey || `${claim.claimType}:${normalizeKey(claim.label)}`}`,
      question: `What reporting period does the earlier ${claim.label.toLowerCase()} figure cover?`,
      whyItMatters:
        "The existing reviewed figure has no period, so a later update cannot be compared to it.",
      evidence: evidenceLine(claim.supportingExcerpt || "No stored excerpt.", {
        id: claim.sourceId ?? "",
        title: claim.sourceTitle || "Earlier source",
        sourceDate: claim.sourceDate,
      }),
      suggestedAction: "Ask the founder for the period and update the reviewed fact through the approval flow.",
      status: "needs_review",
      severity: "medium",
      sourceId: claim.sourceId,
    });
  }

  const allClaims: Array<ExistingClaim | EvidenceClaim> = [...approvedClaims, ...claims];
  const claimValue = (claim: ExistingClaim | EvidenceClaim) => claim.normalizedValue ?? claim.valueText;
  const hasFunding = allClaims.some(
    (claim) =>
      (claim.claimType === "funding" || claim.claimType === "financial") &&
      Boolean(claimValue(claim)),
  );
  const tractionClaims = allClaims.filter(
    (claim) => claim.claimType === "traction" || claim.claimType === "revenue",
  );
  const hasQuantifiedTraction = tractionClaims.some((claim) => claim.normalizedValue !== null);
  const hasOwnership =
    Boolean(deal.ownershipTarget) ||
    allClaims.some((claim) => claim.claimType === "ownership" && Boolean(claimValue(claim)));
  const unresolvedOwnership = allClaims.some(
    (claim) =>
      claim.claimType === "ownership" &&
      /unresolved|pending|unknown|tbd|to be (?:determined|decided)/i.test(
        `${claim.label} ${claim.valueText}`,
      ),
  );
  const hasFounderDetails = allClaims.some(
    (claim) => claim.claimType === "founder" && Boolean(claimValue(claim)),
  );
  const modelNextSteps = Array.isArray(payload.next_steps)
    ? (payload.next_steps as unknown[]).filter((step): step is string => typeof step === "string")
    : [];
  const hasNextAction =
    Boolean(deal.nextStep.trim()) ||
    allClaims.some((claim) => claim.claimType === "next_action") ||
    modelNextSteps.length > 0;
  const mentionsUseOfFunds = allClaims.some((claim) =>
    /use of funds|allocation|runway|milestone/i.test(`${claim.label} ${claim.valueText}`),
  );

  if (!hasFunding && !deal.targetRaise) {
    addGap({
      gapKey: "missing_funding",
      question: "What is the round size, stage, valuation and use of funds?",
      whyItMatters:
        "Without the funding ask, the case cannot be sized, compared with the investor mandate or taken to a term sheet.",
      evidence: "The source does not state a complete fundraising amount.",
      suggestedAction: "Ask the founder for the round size, target close date, pre-money valuation and use of funds.",
      status: "open",
      severity: "high",
      sourceId: source.id,
    });
  }

  if ((hasFunding || deal.targetRaise) && !mentionsUseOfFunds) {
    addGap({
      gapKey: "missing_use_of_funds",
      question: "What will the new capital be used for, and which milestones does it fund?",
      whyItMatters: "A round size without a use of funds cannot be tested against the value-creation plan.",
      evidence: "A funding figure is recorded, but no use-of-funds statement is captured.",
      suggestedAction: "Request a use-of-funds breakdown with hiring and go-to-market milestones.",
      status: "open",
      severity: "medium",
      sourceId: source.id,
    });
  }

  if (tractionClaims.length === 0 || !hasQuantifiedTraction) {
    addGap({
      gapKey: "unclear_traction",
      question: "What quantified traction has been achieved, and over what period?",
      whyItMatters:
        "Traction needs a metric, a value and a reporting period to be diligence-ready and comparable over time.",
      evidence:
        tractionClaims.length === 0
          ? "No traction or revenue claim was found in the source."
          : "Traction is mentioned without a quantified value.",
      suggestedAction: "Request the latest cohort, revenue and retention metrics with the period end date.",
      status: "open",
      severity: "high",
      sourceId: source.id,
    });
  }

  if (!hasOwnership || unresolvedOwnership) {
    addGap({
      gapKey: "ownership",
      question: unresolvedOwnership
        ? "Which ownership or allocation remains unresolved, and what is the current cap table?"
        : "What is the current ownership, option pool and advisor allocation?",
      whyItMatters:
        "Unclear ownership or allocation blocks a term sheet and can change the effective price of the round.",
      evidence: unresolvedOwnership
        ? "The source mentions an unresolved ownership or allocation issue."
        : "No ownership target or allocation evidence is recorded for this case.",
      suggestedAction: "Request the cap table, option pool size and any pending advisor allocations.",
      status: "open",
      severity: "high",
      sourceId: source.id,
    });
  }

  if (!hasFounderDetails) {
    addGap({
      gapKey: "founder_details",
      question: "Who are the founders, and what is their relevant operating history?",
      whyItMatters:
        "Founder-market fit and references are material to an early-stage decision and are not yet evidenced.",
      evidence: "No founder details were captured in this source.",
      suggestedAction: "Collect founder backgrounds and run two reference calls.",
      status: "open",
      severity: "medium",
      sourceId: source.id,
    });
  }

  if (!hasNextAction) {
    addGap({
      gapKey: "next_action",
      question: "What is the next action, who owns it and when is it due?",
      whyItMatters: "A case with no owned next action stalls without a decision gate.",
      evidence: "No next action is recorded in the deal or the source.",
      suggestedAction: "Assign the next diligence step to the deal lead and set a due date.",
      status: "open",
      severity: "medium",
      sourceId: source.id,
    });
  }

  const knownFacts: BriefFact[] = allClaims.map((claim) => ({
    label: claim.label,
    value: [claim.valueText || (claim.normalizedValue !== null ? String(claim.normalizedValue) : ""), claim.currency]
      .filter(Boolean)
      .join(" "),
    period: claim.reportingPeriod,
    verification: claim.verificationStatus,
    reviewStatus: claim.reviewStatus,
    sourceId: claim.sourceId ?? source.id,
    sourceTitle: "sourceTitle" in claim ? claim.sourceTitle : source.title,
    sourceDate: "sourceDate" in claim ? claim.sourceDate : source.sourceDate,
    excerpt: "supportingExcerpt" in claim ? claim.supportingExcerpt : claim.excerpt,
    proposedChangeTo: "proposedChangeTo" in claim ? claim.proposedChangeTo : null,
  }));

  const allExistingUnknowns: BriefUnknown[] = existingGaps
    .filter((gap) => gap.status === "open" || gap.status === "needs_review")
    .map((gap) => ({
      question: gap.question,
      why: gap.whyItMatters,
      status: gap.status,
      sourceId: gap.sourceId,
    }));
  const newUnknowns: BriefUnknown[] = gaps.map((gap) => ({
    question: gap.question,
    why: gap.whyItMatters,
    status: gap.status,
    sourceId: gap.sourceId,
  }));
  const unknowns = [...allExistingUnknowns, ...newUnknowns].filter(
    (value, index, list) =>
      list.findIndex((item) => item.question.toLowerCase() === value.question.toLowerCase()) === index,
  );

  const risks: BriefRisk[] = [];
  for (const claim of claims) {
    if (claim.proposedChangeTo) {
      const existing = existingClaims.find((item) => item.id === claim.proposedChangeTo);
      risks.push({
        title: `Reviewed ${claim.label.toLowerCase()} differs from the new source`,
        detail:
          "The existing reviewed fact was preserved. A draft proposal requires human approval before it can replace it.",
        sourceId: source.id,
        excerpt: claim.excerpt,
      });
      if (existing) {
        risks.push({
          title: `Earlier reviewed ${existing.label.toLowerCase()} on file`,
          detail: "This figure remains the active reviewed fact until a human approves the proposal.",
          sourceId: existing.sourceId,
          excerpt: existing.supportingExcerpt,
        });
      }
    } else if (FINANCIAL_TYPES.has(claim.claimType) && claim.verificationStatus !== "corroborated") {
      risks.push({
        title: `${claim.label} is not independently corroborated`,
        detail: claim.verificationNote,
        sourceId: source.id,
        excerpt: claim.excerpt,
      });
    }
  }
  for (const gap of gaps.filter((item) => item.gapKey.startsWith("discrepancy:"))) {
    risks.push({
      title: "Differing financial figures",
      detail: gap.whyItMatters,
      sourceId: gap.sourceId,
      excerpt: gap.evidence,
    });
  }

  const followUps = dedupeStrings([
    ...modelNextSteps,
    ...gaps.map((gap) => gap.suggestedAction),
    ...(deal.nextStep ? [deal.nextStep] : []),
  ]).slice(0, 12);

  const evidence: BriefEvidence[] = allClaims
    .map((claim) => ({
      sourceId: claim.sourceId ?? source.id,
      sourceTitle: "sourceTitle" in claim ? claim.sourceTitle : source.title,
      sourceDate: "sourceDate" in claim ? claim.sourceDate : source.sourceDate,
      excerpt: "supportingExcerpt" in claim ? claim.supportingExcerpt : claim.excerpt,
    }))
    .filter((item) => Boolean(item.excerpt))
    .filter(
      (item, index, list) =>
        list.findIndex((value) => value.excerpt === item.excerpt) === index,
    )
    .slice(0, 20);

  const summary =
    `${knownFacts.length} known fact${knownFacts.length === 1 ? "" : "s"}, ` +
    `${unknowns.length} open question${unknowns.length === 1 ? "" : "s"}, ` +
    `${risks.length} risk${risks.length === 1 ? "" : "s"} from ${source.title || "the source"}. ` +
    "AI-assisted evidence analysis only; no investment decision is made.";

  return {
    claims,
    gaps,
    brief: { summary, knownFacts, unknowns, risks, followUps, evidence },
    warnings,
  };
}

// Evidence-backed deal analysis.
// Authorization: signed-in user with write access to the workspace.
// Credentials: the Enter AI token stays in the function environment.
// This function only creates new draft evidence and checklist items; it never
// edits or deletes an existing reviewed claim or makes an investment decision.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_API_BASE = "https://api.enter.pro";
const AI_MODEL = "deepseek/deepseek-v4-flash";
const ENTER_PROJECT_ID = "6f92e2693b094e9486160dabb429ab7e";
const MAX_SOURCE_CHARS = 20000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AuthContext {
  userId: string;
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
}

async function authenticate(req: Request): Promise<{ context?: AuthContext; response?: Response }> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { response: json({ error: "Authentication required." }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    console.error("analyzeDealSource: Supabase environment variables are missing");
    return { response: json({ error: "The analysis service is misconfigured." }, 500) };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return { response: json({ error: "Authentication required." }, 401) };
  const user = (await userResponse.json()) as { id?: string };
  if (!user?.id) return { response: json({ error: "Authentication required." }, 401) };

  const writerResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/can_write_project`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!writerResponse.ok) {
    console.error("analyzeDealSource: write-access check failed", writerResponse.status);
    return { response: json({ error: "Could not verify workspace access." }, 500) };
  }
  const canWrite = await writerResponse.json();
  if (canWrite !== true) {
    return { response: json({ error: "You need write access to run an analysis." }, 403) };
  }

  return { context: { userId: user.id, supabaseUrl, anonKey, authorization } };
}

async function rest(
  context: AuthContext,
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<{ response: Response; body: unknown }> {
  const headers: Record<string, string> = {
    apikey: context.anonKey,
    Authorization: context.authorization,
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.prefer) headers.Prefer = init.prefer;

  const response = await fetch(`${context.supabaseUrl}/rest/v1/${path}`, { ...init, headers });
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }
  return { response, body };
}

function databaseError(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.details;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const cleaned = content
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function sourceDateLabel(value: string | null): string {
  return value ? value.slice(0, 10) : "undated";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let runId: string | null = null;
  let auth: AuthContext | null = null;
  const failRun = async (message: string) => {
    if (!auth || !runId) return;
    await rest(auth, `deal_analysis_runs?id=eq.${runId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "failed", error: message, completed_at: new Date().toISOString() }),
    });
  };

  try {
    const authResult = await authenticate(req);
    if (!authResult.context) {
      return authResult.response ?? json({ error: "Authentication required." }, 401);
    }
    auth = authResult.context;

    const payload = (await req.json().catch(() => null)) as { source_id?: string; deal_id?: string } | null;
    const sourceId = typeof payload?.source_id === "string" ? payload.source_id : "";
    const dealId = typeof payload?.deal_id === "string" ? payload.deal_id : "";
    if (!sourceId || !dealId) {
      return json({ error: "source_id and deal_id are required." }, 400);
    }

    const sourceResult = await rest(
      auth,
      `sources?id=eq.${encodeURIComponent(sourceId)}&select=id,deal_id,title,raw_text,source_date,source_type&limit=1`,
    );
    if (!sourceResult.response.ok) {
      console.error("analyzeDealSource: source read failed", sourceResult.response.status);
      return json({ error: "Could not read the source." }, 500);
    }
    const source = (sourceResult.body as Record<string, unknown>[] | null)?.[0];
    if (!source) return json({ error: "Source not found or not accessible." }, 404);
    if (source.deal_id !== dealId) {
      return json({ error: "The source does not belong to this deal." }, 400);
    }

    const sourceText = typeof source.raw_text === "string" ? source.raw_text.trim() : "";
    if (!sourceText) {
      return json({ error: "This source has no transcript or text to analyse." }, 400);
    }
    if (sourceText.length > MAX_SOURCE_CHARS) {
      return json(
        { error: `This source is too long to analyse (${sourceText.length} characters; limit ${MAX_SOURCE_CHARS}).` },
        413,
      );
    }

    const dealResult = await rest(
      auth,
      `deals?id=eq.${encodeURIComponent(dealId)}&select=id,company_name,sector,stage,target_raise,ownership_target,next_step,lead_partner&limit=1`,
    );
    if (!dealResult.response.ok) {
      console.error("analyzeDealSource: deal read failed", dealResult.response.status);
      return json({ error: "Could not read the deal." }, 500);
    }
    const deal = (dealResult.body as Record<string, unknown>[] | null)?.[0];
    if (!deal) return json({ error: "Deal not found or not accessible." }, 404);

    const runResult = await rest(auth, "deal_analysis_runs?select=id", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        deal_id: dealId,
        source_id: sourceId,
        model: AI_MODEL,
        status: "running",
        created_by: auth.userId,
      }),
    });
    if (!runResult.response.ok) {
      console.error("analyzeDealSource: could not create run", databaseError(runResult.body, ""));
      return json({ error: "Could not start the analysis." }, 500);
    }
    runId = (runResult.body as { id?: string }[] | null)?.[0]?.id ?? null;
    if (!runId) return json({ error: "Could not start the analysis." }, 500);

    const aiToken = Deno.env.get("AI_API_TOKEN_6f92e2693b09");
    if (!aiToken) {
      await rest(auth, `deal_analysis_runs?id=eq.${runId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: "unavailable",
          error: "The AI analysis model is not configured for this project.",
          completed_at: new Date().toISOString(),
        }),
      });
      return json({
        configured: false,
        runId,
        reason: "The AI analysis model is not configured for this project.",
      });
    }

    const sourceTitle = typeof source.title === "string" ? source.title : "Untitled source";
    const sourceDate = typeof source.source_date === "string" ? source.source_date : "";

    const systemPrompt = [
      "You are an evidence analyst for an early-stage venture capital firm.",
      "Read the source transcript and extract only material investment facts.",
      "Return ONLY a JSON object. No markdown, commentary, or investment recommendation.",
      "NEVER decide to invest or reject. NEVER infer facts that are not in the source.",
      "The JSON shape is:",
      '{"claims":[{"claim_type":"funding|traction|revenue|financial|founder|investor_mention|product|ownership|next_action|company|sector|stage","label":"short label","value_text":"stated value","normalized_value":number_or_null,"currency":"USD","reporting_period":"exact period or empty","excerpt":"verbatim source text","attribution":"founder|third_party|unknown"}],"next_steps":["only concrete next actions stated in the source"],"missing_information":["only unresolved items explicitly mentioned in the source"],"ownership_notes":["only unresolved ownership items explicitly mentioned in the source"]}',
      "The excerpt MUST be copied character-for-character from the source. Do not paraphrase, trim mid-sentence, or combine sentences. If you cannot quote it exactly, omit the claim.",
      "reporting_period is only for a period explicitly stated in the source, e.g. December 2025 or Q1 2026; otherwise use an empty string.",
      "normalized_value is a number only when the source gives a numeric value; otherwise null. Do not convert currencies or invent a period.",
      "attribution is founder for the founder's own statements, third_party for customer/investor mentions, and unknown when unclear.",
      "Extract material funding, traction, revenue, product, founder, investor, ownership and next-step facts. Omit marketing language with no material content.",
    ].join("\n");

    const userPrompt = [
      `Deal: ${String(deal.company_name ?? "")}`,
      `Stored stage: ${String(deal.stage ?? "")}; stored sector: ${String(deal.sector ?? "")}`,
      `Source: ${sourceTitle} (${sourceDateLabel(sourceDate)})`,
      "Transcript:",
      '"""',
      sourceText,
      '"""',
      "Return the JSON now.",
    ].join("\n");

    const upstream = await fetch(`${AI_API_BASE}/code/api/v1/ai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiToken}`,
        "Content-Type": "application/json",
        "X-Session-ID": req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID(),
        "X-Enter-Project-ID": ENTER_PROJECT_ID,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 2500,
      }),
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error("analyzeDealSource: AI gateway error", upstream.status);
      let message = "The analysis model is temporarily unavailable.";
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep the generic message
      }
      if (upstream.status === 402) message = "AI credits are exhausted. No analysis was saved.";
      if (upstream.status === 403) message = "AI analysis is disabled for this project. No analysis was saved.";
      await failRun(message);
      return json({ error: message, runId }, 502);
    }

    let content = "";
    try {
      const parsed = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
      content = parsed.choices?.[0]?.message?.content ?? "";
    } catch {
      console.error("analyzeDealSource: unreadable AI gateway response");
    }
    if (!content) {
      await failRun("The analysis model returned an empty response.");
      return json({ error: "The analysis model returned an empty response.", runId }, 502);
    }

    const modelObject = parseJsonObject(content);
    if (!modelObject) {
      await failRun("The analysis model returned invalid JSON. Nothing was saved.");
      return json({ error: "The analysis model returned invalid JSON. Nothing was saved.", runId }, 502);
    }

    const claimsResult = await rest(
      auth,
      `deal_claims?deal_id=eq.${encodeURIComponent(dealId)}&select=id,claim_type,label,value_text,normalized_value,currency,reporting_period,verification_status,review_status,claim_key,source_id,supporting_excerpt&superseded_by=is.null&limit=500`,
    );
    if (!claimsResult.response.ok) {
      console.error("analyzeDealSource: claims read failed", claimsResult.response.status);
      await failRun("Could not read existing case claims.");
      return json({ error: "Could not read existing case claims.", runId }, 500);
    }
    const existingRows = (claimsResult.body as Record<string, unknown>[] | null) ?? [];

    const sourcesResult = await rest(
      auth,
      `sources?deal_id=eq.${encodeURIComponent(dealId)}&select=id,title,source_date&limit=200`,
    );
    const sourceRows = (sourcesResult.body as Record<string, unknown>[] | null) ?? [];
    const sourceMap = new Map(
      sourceRows.map((row) => [
        String(row.id),
        {
          title: typeof row.title === "string" ? row.title : "",
          date: typeof row.source_date === "string" ? row.source_date : "",
        },
      ]),
    );

    const existingClaims: ExistingClaim[] = existingRows.map((row) => {
      const rowSourceId = typeof row.source_id === "string" ? row.source_id : null;
      const rowSource = rowSourceId ? sourceMap.get(rowSourceId) : undefined;
      return {
        id: String(row.id),
        claimType: String(row.claim_type ?? ""),
        label: String(row.label ?? ""),
        valueText: String(row.value_text ?? ""),
        normalizedValue:
          row.normalized_value === null || row.normalized_value === undefined
            ? null
            : Number(row.normalized_value),
        currency: String(row.currency ?? "USD"),
        reportingPeriod: String(row.reporting_period ?? ""),
        verificationStatus: String(row.verification_status ?? "unverified"),
        reviewStatus: String(row.review_status ?? "approved"),
        claimKey: String(row.claim_key ?? ""),
        sourceId: rowSourceId,
        sourceTitle: rowSource?.title ?? "",
        sourceDate: rowSource?.date ?? "",
        supportingExcerpt: String(row.supporting_excerpt ?? ""),
      };
    });

    const gapsResult = await rest(
      auth,
      `decision_gaps?deal_id=eq.${encodeURIComponent(dealId)}&select=id,gap_key,question,why_it_matters,status,source_id,suggested_action&limit=500`,
    );
    if (!gapsResult.response.ok) {
      console.error("analyzeDealSource: gaps read failed", gapsResult.response.status);
      await failRun("Could not read existing decision gaps.");
      return json({ error: "Could not read existing decision gaps.", runId }, 500);
    }
    const existingGaps: ExistingGap[] = ((gapsResult.body as Record<string, unknown>[] | null) ?? []).map(
      (row) => ({
        id: String(row.id),
        gapKey: String(row.gap_key ?? ""),
        question: String(row.question ?? ""),
        whyItMatters: String(row.why_it_matters ?? ""),
        status: String(row.status ?? "open"),
        sourceId: typeof row.source_id === "string" ? row.source_id : null,
        suggestedAction: String(row.suggested_action ?? ""),
      }),
    );

    const analysis = analyzeDealEvidence({
      payload: modelObject,
      sourceText,
      source: { id: sourceId, title: sourceTitle, sourceDate },
      deal: {
        id: dealId,
        companyName: String(deal.company_name ?? ""),
        sector: String(deal.sector ?? ""),
        stage: String(deal.stage ?? ""),
        targetRaise:
          deal.target_raise === null || deal.target_raise === undefined ? null : Number(deal.target_raise),
        ownershipTarget:
          deal.ownership_target === null || deal.ownership_target === undefined
            ? null
            : Number(deal.ownership_target),
        nextStep: String(deal.next_step ?? ""),
        leadPartner: String(deal.lead_partner ?? ""),
      },
      existingClaims,
      existingGaps,
    });

    let createdClaims = 0;
    if (analysis.claims.length > 0) {
      const claimRows = analysis.claims.map((claim) => ({
        deal_id: dealId,
        source_id: sourceId,
        analysis_run_id: runId,
        claim_type: claim.claimType,
        label: claim.label,
        value_text: claim.valueText,
        normalized_value: claim.normalizedValue,
        currency: claim.currency,
        reporting_period: claim.reportingPeriod,
        supporting_excerpt: claim.excerpt,
        verification_status: claim.verificationStatus,
        verification_note: claim.verificationNote,
        attribution: claim.attribution,
        claim_key: claim.claimKey,
        review_status: "draft",
        proposed_change_to: claim.proposedChangeTo,
        created_by: auth.userId,
      }));
      const insertClaims = await rest(auth, "deal_claims", {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify(claimRows),
      });
      if (!insertClaims.response.ok) {
        const message = databaseError(insertClaims.body, "Could not save the extracted claims.");
        await failRun(message);
        return json({ error: message, runId }, 500);
      }
      createdClaims = claimRows.length;
    }

    let createdGaps = 0;
    if (analysis.gaps.length > 0) {
      const gapRows = analysis.gaps.map((gap) => ({
        deal_id: dealId,
        question: gap.question,
        owner: String(deal.lead_partner ?? "") || "Deal lead",
        why_it_matters: gap.whyItMatters,
        evidence: gap.evidence,
        suggested_action: gap.suggestedAction,
        source_id: gap.sourceId,
        analysis_run_id: runId,
        gap_key: gap.gapKey,
        origin: "analysis",
        status: gap.status,
        severity: gap.severity,
        created_by: auth.userId,
      }));
      const insertGaps = await rest(auth, "decision_gaps", {
        method: "POST",
        prefer: "resolution=ignore-duplicates,return=representation",
        body: JSON.stringify(gapRows),
      });
      if (!insertGaps.response.ok) {
        const message = databaseError(insertGaps.body, "Could not save the readiness checklist.");
        await failRun(message);
        return json({ error: message, runId }, 500);
      }
      createdGaps = ((insertGaps.body as unknown[] | null) ?? []).length;
    }

    const briefResult = await rest(auth, "deal_briefs?select=id", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify({
        deal_id: dealId,
        analysis_run_id: runId,
        summary: analysis.brief.summary,
        known_facts: analysis.brief.knownFacts,
        unknowns: analysis.brief.unknowns,
        risks: analysis.brief.risks,
        follow_ups: analysis.brief.followUps,
        evidence: analysis.brief.evidence,
        status: "draft",
        created_by: auth.userId,
      }),
    });
    if (!briefResult.response.ok) {
      const message = databaseError(briefResult.body, "Could not save the deal brief.");
      await failRun(message);
      return json({ error: message, runId }, 500);
    }
    const briefId = (briefResult.body as { id?: string }[] | null)?.[0]?.id ?? null;

    const warnings = analysis.warnings;
    const complete = await rest(auth, `deal_analysis_runs?id=eq.${runId}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: "completed",
        warnings,
        extracted: {
          model: AI_MODEL,
          claims: createdClaims,
          gaps: createdGaps,
          briefId,
          discardedClaims: warnings.filter((warning) => warning.startsWith("Discarded")).length,
        },
        completed_at: new Date().toISOString(),
      }),
    });
    if (!complete.response.ok) {
      console.error("analyzeDealSource: could not mark the run complete", complete.response.status);
    }

    return json({
      configured: true,
      runId,
      briefId,
      claims: createdClaims,
      gaps: createdGaps,
      warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The analysis failed.";
    console.error("analyzeDealSource failed:", message);
    await failRun(message);
    return json({ error: "The analysis failed. Nothing was saved.", runId }, 500);
  }
});

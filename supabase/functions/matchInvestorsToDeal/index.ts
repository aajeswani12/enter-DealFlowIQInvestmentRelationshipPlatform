/**
 * Pure, deterministic investor-to-deal scoring.
 *
 * Rules (weights editable in match_weight_configs):
 *  - sector & thesis fit
 *  - stage fit
 *  - cheque-size compatibility
 *  - geography fit
 *  - relationship strength
 *  - recent expressed interest
 *
 * Missing inputs are recorded separately from mismatches. No preference is
 * inferred, no contact is invented, and a score never implies investor interest.
 */

export interface MatchWeights {
  sectorThesis: number;
  stage: number;
  checkSize: number;
  geography: number;
  relationship: number;
  recentInterest: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  sectorThesis: 30,
  stage: 25,
  checkSize: 20,
  geography: 10,
  relationship: 10,
  recentInterest: 5,
};

export interface DealAttributes {
  id: string;
  companyName: string;
  sector: string;
  stage: string;
  geography: string;
  chequeSought: number | null;
  thesis: string;
  summary: string;
  claimText: string;
}

export interface InvestorContact {
  id: string;
  name: string;
  relationshipStrength: string;
  outreachPermissionStatus: string;
  relationshipOwner: string;
  relationshipOwnerUserId: string | null;
  isPrimary: boolean;
}

export interface InvestorInteraction {
  kind: string;
  summary: string;
  occurredAt: string;
}

export interface InvestorRecord {
  id: string;
  name: string;
  status: string;
  relationship: string;
  sectors: string[];
  stages: string[];
  geographies: string[];
  checkMin: number | null;
  checkMax: number | null;
  thesis: string;
  isSynthetic: boolean;
  contacts: InvestorContact[];
  interactions: InvestorInteraction[];
}

export type ScoreOutcome = "pass" | "partial" | "fail";

export interface ScoreRule {
  key: string;
  label: string;
  points: number;
  maxPoints: number;
  outcome: ScoreOutcome;
  detail: string;
}

export interface ScoredInvestor {
  investorId: string;
  investorName: string;
  score: number;
  tier: "strong" | "considered" | "weak";
  rules: ScoreRule[];
  missingInformation: string[];
  restrictions: string[];
  needsResearch: boolean;
  explanation: string;
  strategy: string;
}

export interface ExcludedInvestor {
  investorId: string;
  investorName: string;
  reasons: string[];
}

export interface MatchRunResult {
  weights: MatchWeights;
  warnings: string[];
  matches: ScoredInvestor[];
  excluded: ExcludedInvestor[];
  missingDealInputs: string[];
}

const STAGE_ORDER = ["pre-seed", "seed", "series a", "series b", "growth"];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "are", "was", "were",
  "has", "have", "will", "our", "their", "they", "its", "a", "an", "of", "to", "in",
  "on", "by", "as", "at", "or", "be", "is", "it", "we", "us", "company", "platform",
  "business", "deal", "startup", "product", "products", "using", "used", "about",
]);

const INTEREST_PATTERN = /interest|keen|excited|follow[\s-]?up|next step|warm|positive|liked|wants|eager/i;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeWeights(input: Partial<MatchWeights> | null | undefined): {
  weights: MatchWeights;
  warnings: string[];
} {
  const merged: MatchWeights = {
    sectorThesis: Number(input?.sectorThesis ?? DEFAULT_WEIGHTS.sectorThesis),
    stage: Number(input?.stage ?? DEFAULT_WEIGHTS.stage),
    checkSize: Number(input?.checkSize ?? DEFAULT_WEIGHTS.checkSize),
    geography: Number(input?.geography ?? DEFAULT_WEIGHTS.geography),
    relationship: Number(input?.relationship ?? DEFAULT_WEIGHTS.relationship),
    recentInterest: Number(input?.recentInterest ?? DEFAULT_WEIGHTS.recentInterest),
  };
  const values = Object.values(merged);
  const sum = values.reduce((total, value) => total + value, 0);
  const valid = values.every((value) => Number.isFinite(value) && value >= 0) && sum === 100;
  if (!valid) {
    return {
      weights: { ...DEFAULT_WEIGHTS },
      warnings: [
        `Configured weights were invalid (sum ${sum}). Defaults 30/25/20/10/10/5 were used for this run.`,
      ],
    };
  }
  return { weights: merged, warnings: [] };
}

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !STOPWORDS.has(word)),
  );
}

function overview(deal: DealAttributes): string {
  return [deal.thesis, deal.summary, deal.claimText].filter(Boolean).join(" ");
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function primaryContact(investor: InvestorRecord): InvestorContact | null {
  return investor.contacts.find((contact) => contact.isPrimary) ?? investor.contacts[0] ?? null;
}

function recentInteraction(investor: InvestorRecord, now: Date): InvestorInteraction | null {
  const cutoff = now.getTime() - 180 * 86_400_000;
  const recent = investor.interactions
    .filter((interaction) => {
      const at = new Date(interaction.occurredAt).getTime();
      return Number.isFinite(at) && at >= cutoff && at <= now.getTime();
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return recent[0] ?? null;
}

function latestInterest(investor: InvestorRecord, now: Date): InvestorInteraction | null {
  const cutoff = now.getTime() - 180 * 86_400_000;
  return (
    investor.interactions
      .filter((interaction) => {
        const at = new Date(interaction.occurredAt).getTime();
        return Number.isFinite(at) && at >= cutoff && at <= now.getTime() && INTEREST_PATTERN.test(interaction.summary);
      })
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())[0] ?? null
  );
}

function relationshipFactor(investor: InvestorRecord): { factor: number; detail: string } {
  const rollup: Record<string, number> = { active: 1, warm: 0.7, new: 0.3, dormant: 0 };
  const contactStrength: Record<string, number> = { strong: 1, warm: 0.7, weak: 0.3, unknown: 0 };
  const rollupFactor = rollup[investor.relationship] ?? 0.3;
  const strongestContact = investor.contacts
    .map((contact) => contactStrength[contact.relationshipStrength] ?? 0)
    .sort((a, b) => b - a)[0] ?? 0;
  const factor = Math.max(rollupFactor, strongestContact);
  const contact = primaryContact(investor);
  return {
    factor,
    detail: contact
      ? `Recorded relationship: ${investor.relationship}. ${contact.name || "A named contact"} is marked ${contact.relationshipStrength}.`
      : `Recorded relationship: ${investor.relationship}. No named contact is on file.`,
  };
}

function restrictedReasons(investor: InvestorRecord): string[] {
  const reasons: string[] = [];
  const status = investor.status.toLowerCase();
  if (status === "restricted") reasons.push("Investor is marked restricted");
  if (status === "inactive" || status === "archived" || status === "watchlist") {
    reasons.push("Investor is inactive");
  }
  const contact = primaryContact(investor);
  if (contact?.outreachPermissionStatus === "do_not_contact") {
    reasons.push("Primary contact is marked do not contact");
  }
  return reasons;
}

function statusMissing(investor: InvestorRecord): string | null {
  const status = investor.status.toLowerCase();
  if (status === "unknown" || status === "prospect") {
    return "Investor eligibility status is unknown; confirm before outreach.";
  }
  return null;
}

export function scoreInvestors(
  deal: DealAttributes,
  investors: InvestorRecord[],
  configuredWeights: Partial<MatchWeights> | null | undefined,
  now: Date = new Date(),
): MatchRunResult {
  const { weights, warnings } = normalizeWeights(configuredWeights);
  const matches: ScoredInvestor[] = [];
  const excluded: ExcludedInvestor[] = [];

  const missingDealInputs: string[] = [];
  if (!deal.sector.trim()) missingDealInputs.push("Deal sector is not recorded.");
  if (!deal.stage.trim()) missingDealInputs.push("Deal stage is not recorded.");
  if (!deal.geography.trim()) missingDealInputs.push("Deal geography is not recorded.");
  if (deal.chequeSought === null) missingDealInputs.push("Cheque sought is not recorded.");
  if (!deal.thesis.trim() && !deal.summary.trim() && !deal.claimText.trim()) {
    missingDealInputs.push("Deal thesis or summary is not recorded.");
  }

  const dealTokens = tokens(overview(deal));

  for (const investor of investors) {
    const reasons = restrictedReasons(investor);
    if (reasons.length > 0) {
      excluded.push({ investorId: investor.id, investorName: investor.name, reasons });
      continue;
    }

    const missing = new Set<string>();
    if (missingDealInputs.length > 0) {
      for (const item of missingDealInputs) missing.add(item);
    }
    const statusGap = statusMissing(investor);
    if (statusGap) missing.add(statusGap);

    const rules: ScoreRule[] = [];

    // 1. Sector & thesis
    const sectorMax = weights.sectorThesis;
    const sectorRecorded = Boolean(deal.sector.trim());
    const investorSectors = investor.sectors.map((sector) => sector.trim()).filter(Boolean);
    const sectorMatch =
      sectorRecorded &&
      investorSectors.some((sector) => normalizeText(sector) === normalizeText(deal.sector));
    if (!sectorRecorded) missing.add("Deal sector is missing, so sector fit cannot be scored.");
    if (investorSectors.length === 0) missing.add("Investor sector preferences are empty.");

    const investorTokens = tokens([investor.thesis, ...investor.sectors].join(" "));
    const overlap: string[] = [];
    for (const token of dealTokens) if (investorTokens.has(token)) overlap.push(token);
    if (dealTokens.size === 0) missing.add("Deal thesis text is missing, so thematic fit cannot be scored.");

    const thematicPoints =
      overlap.length >= 2
        ? Math.round(sectorMax * 0.6)
        : overlap.length === 1
          ? Math.round(sectorMax * 0.3)
          : 0;
    // An exact sector match earns the whole criterion. If sector is missing or
    // mismatched, thematic overlap is the only available partial-credit path.
    const sectorTotal = sectorMatch ? sectorMax : clamp(thematicPoints, 0, sectorMax);
    rules.push({
      key: "sector",
      label: "Sector & thesis",
      points: sectorTotal,
      maxPoints: sectorMax,
      outcome: sectorMatch || sectorTotal >= sectorMax * 0.8 ? "pass" : sectorTotal > 0 ? "partial" : "fail",
      detail: [
        sectorMatch
          ? `Sector ${deal.sector} is on the recorded mandate.`
          : sectorRecorded && investorSectors.length > 0
            ? `Sector mismatch: mandate covers ${investorSectors.join(", ") || "nothing recorded"}, not ${deal.sector}.`
            : "Sector fit cannot be confirmed from the recorded fields.",
        overlap.length > 0 ? `Thesis overlap: ${overlap.slice(0, 4).join(", ")}.` : "No thesis keyword overlap recorded.",
      ].join(" "),
    });

    // 2. Stage
    const stageRecorded = Boolean(deal.stage.trim());
    const investorStages = investor.stages.map((stage) => stage.trim()).filter(Boolean);
    if (!stageRecorded) missing.add("Deal stage is missing, so stage fit cannot be scored.");
    if (investorStages.length === 0) missing.add("Investor stage preferences are empty.");
    const stageExact = investorStages.some((stage) => normalizeText(stage) === normalizeText(deal.stage));
    const dealStageIndex = STAGE_ORDER.indexOf(normalizeText(deal.stage));
    const stageAdjacent =
      !stageExact &&
      dealStageIndex >= 0 &&
      investorStages.some((stage) => {
        const index = STAGE_ORDER.indexOf(normalizeText(stage));
        return index >= 0 && Math.abs(index - dealStageIndex) === 1;
      });
    const stagePoints = stageExact ? weights.stage : stageAdjacent ? Math.round(weights.stage * 0.4) : 0;
    rules.push({
      key: "stage",
      label: "Stage",
      points: stagePoints,
      maxPoints: weights.stage,
      outcome: stagePoints >= weights.stage * 0.8 ? "pass" : stagePoints > 0 ? "partial" : "fail",
      detail: stageExact
        ? `Invests at ${deal.stage}.`
        : stageAdjacent
          ? `Prefers ${investorStages.join(", ")}; adjacent to ${deal.stage}.`
          : `Prefers ${investorStages.join(", ") || "no recorded stage"}; deal is ${deal.stage || "unrecorded"}.`,
    });

    // 3. Cheque size
    if (deal.chequeSought === null) {
      missing.add("Cheque sought is missing, so cheque-size compatibility cannot be scored.");
    }
    if (investor.checkMin === null && investor.checkMax === null) {
      missing.add("Investor cheque range is empty.");
    }
    let checkPoints = 0;
    let checkDetail = "Cheque size cannot be evaluated from the recorded fields.";
    if (deal.chequeSought !== null && (investor.checkMin !== null || investor.checkMax !== null)) {
      const sought = deal.chequeSought;
      const min = investor.checkMin ?? 0;
      const max = investor.checkMax ?? Number.MAX_SAFE_INTEGER;
      if (sought >= min && sought <= max) {
        checkPoints = weights.checkSize;
        checkDetail = `Writes ${formatRange(investor.checkMin, investor.checkMax)}; the deal seeks ${formatMoney(sought)}.`;
      } else {
        const distance = sought < min ? min - sought : sought - max;
        if (distance <= sought * 0.25) {
          checkPoints = Math.round(weights.checkSize * 0.5);
          checkDetail = `Writes ${formatRange(investor.checkMin, investor.checkMax)}; ${formatMoney(sought)} is close but outside the recorded range.`;
        } else {
          checkDetail = `Writes ${formatRange(investor.checkMin, investor.checkMax)}; the deal seeks ${formatMoney(sought)}.`;
        }
      }
    }
    rules.push({
      key: "check",
      label: "Cheque size",
      points: checkPoints,
      maxPoints: weights.checkSize,
      outcome: checkPoints >= weights.checkSize * 0.8 ? "pass" : checkPoints > 0 ? "partial" : "fail",
      detail: checkDetail,
    });

    // 4. Geography
    const geographyRecorded = Boolean(deal.geography.trim());
    const investorGeographies = investor.geographies.map((geo) => geo.trim()).filter(Boolean);
    if (!geographyRecorded) missing.add("Deal geography is missing, so geography fit cannot be scored.");
    if (investorGeographies.length === 0) missing.add("Investor geography preferences are empty.");
    const geoMatch =
      geographyRecorded &&
      investorGeographies.some(
        (geo) => normalizeText(geo) === normalizeText(deal.geography) || normalizeText(geo) === "global",
      );
    rules.push({
      key: "geography",
      label: "Geography",
      points: geoMatch ? weights.geography : 0,
      maxPoints: weights.geography,
      outcome: geoMatch ? "pass" : "fail",
      detail: geoMatch
        ? `${deal.geography} is in the recorded geography focus.`
        : `Focus is ${investorGeographies.join(", ") || "not recorded"}; deal is in ${deal.geography || "an unrecorded geography"}.`,
    });

    // 5. Relationship strength
    const relationship = relationshipFactor(investor);
    if (investor.contacts.length === 0) missing.add("No named contact is recorded for this investor.");
    const relationshipPoints = Math.round(weights.relationship * relationship.factor);
    rules.push({
      key: "relationship",
      label: "Relationship strength",
      points: relationshipPoints,
      maxPoints: weights.relationship,
      outcome: relationshipPoints >= weights.relationship * 0.8 ? "pass" : relationshipPoints > 0 ? "partial" : "fail",
      detail: relationship.detail,
    });

    // 6. Recent interest
    const recent = recentInteraction(investor, now);
    const interest = latestInterest(investor, now);
    if (!recent) missing.add("No interaction in the last 180 days.");
    const interestPoints = interest ? weights.recentInterest : recent ? Math.round(weights.recentInterest * 0.5) : 0;
    rules.push({
      key: "recent_interest",
      label: "Recent interest",
      points: interestPoints,
      maxPoints: weights.recentInterest,
      outcome: interestPoints >= weights.recentInterest * 0.8 ? "pass" : interestPoints > 0 ? "partial" : "fail",
      detail: interest
        ? `Interest expressed in a ${interest.kind} on ${interest.occurredAt.slice(0, 10)}: "${truncate(interest.summary, 160)}".`
        : recent
          ? `Recent ${recent.kind} on ${recent.occurredAt.slice(0, 10)}; no explicit interest recorded.`
          : "No interaction in the last 180 days.",
    });

    const score = rules.reduce((total, rule) => total + rule.points, 0);
    const tier: ScoredInvestor["tier"] = score >= 75 ? "strong" : score >= 50 ? "considered" : "weak";
    const contact = primaryContact(investor);
    const otherRestrictions = investor.contacts
      .filter((item) => item.outreachPermissionStatus === "do_not_contact" && !item.isPrimary)
      .map((item) => `Contact ${item.name || "without a name"} is marked do not contact; do not use that person.`);

    const strategy = buildStrategy({
      investor,
      contact,
      interest,
      recent,
      missing: [...missing],
      restrictions: otherRestrictions,
    });

    const passLabels = rules.filter((rule) => rule.outcome === "pass").map((rule) => rule.label);
    const gapLabels = rules.filter((rule) => rule.outcome !== "pass").map((rule) => rule.label);
    const explanation = [
      `Preference fit ${score}/100 from recorded fields.`,
      passLabels.length ? `Passed: ${passLabels.join(", ")}.` : "No rule fully passed.",
      gapLabels.length ? `Partial or missing: ${gapLabels.join(", ")}.` : "",
      missing.size ? "This match is incomplete and marked Needs Research." : "",
      "Fit does not guarantee investor interest.",
    ]
      .filter(Boolean)
      .join(" ");

    matches.push({
      investorId: investor.id,
      investorName: investor.name,
      score,
      tier,
      rules,
      missingInformation: [...missing],
      restrictions: otherRestrictions,
      needsResearch: missing.size > 0,
      explanation,
      strategy,
    });
  }

  matches.sort((a, b) => b.score - a.score || a.investorName.localeCompare(b.investorName));
  return { weights, warnings, matches, excluded, missingDealInputs };
}

function buildStrategy(input: {
  investor: InvestorRecord;
  contact: InvestorContact | null;
  interest: InvestorInteraction | null;
  recent: InvestorInteraction | null;
  missing: string[];
  restrictions: string[];
}): string {
  const { investor, contact, interest, recent, missing, restrictions } = input;
  const parts: string[] = [];
  const status = investor.status.toLowerCase();
  if (status === "unknown" || status === "prospect") {
    parts.push("Confirm eligibility and current mandate before approaching.");
  }

  if (contact) {
    const owner = contact.relationshipOwner.trim();
    const strength = contact.relationshipStrength;
    if (owner && (strength === "strong" || strength === "warm")) {
      parts.push(
        `Ask ${owner} for a warm introduction to ${contact.name || "the recorded contact"}, grounded in the ${strength} relationship already on file.`,
      );
    } else {
      parts.push(
        `Approach ${contact.name || "the recorded contact"} directly; the relationship is marked ${strength}, so do not present it as warm.`,
      );
    }
  } else {
    parts.push("No named contact is recorded. Research a named partner before any outreach; do not assume a warm introduction.");
  }

  if (interest) {
    parts.push(
      `Reference the ${interest.kind} on ${interest.occurredAt.slice(0, 10)} where interest was recorded.`,
    );
  } else if (recent) {
    parts.push(`Reference the most recent ${recent.kind} on ${recent.occurredAt.slice(0, 10)} only if appropriate.`);
  } else {
    parts.push("There is no recent interaction, so start with a cold approach or find a shared connection.");
  }

  if (missing.length > 0) {
    parts.push(`Confirm before outreach: ${missing.slice(0, 2).join(" ")}`);
  }
  if (restrictions.length > 0) {
    parts.push(restrictions[0]);
  }
  parts.push("The score reflects recorded preferences only and does not signal investor interest.");
  return parts.join(" ");
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(value);
}

function formatRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return "no recorded range";
  if (min !== null && max !== null) return `${formatMoney(min)}–${formatMoney(max)}`;
  if (min !== null) return `${formatMoney(min)}+`;
  return `up to ${formatMoney(max ?? 0)}`;
}

// Deterministic investor-to-deal matching.
// Authorization: signed-in workspace member with write access.
// Reads only Talok's manually maintained investor database. No external sourcing.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_WEIGHT_ROW = {
  sector_thesis: 30,
  stage: 25,
  check_size: 20,
  geography: 10,
  relationship: 10,
  recent_interest: 5,
};

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
    console.error("matchInvestorsToDeal: Supabase environment variables are missing");
    return { response: json({ error: "The matching service is misconfigured." }, 500) };
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
    console.error("matchInvestorsToDeal: write-access check failed", writerResponse.status);
    return { response: json({ error: "Could not verify workspace access." }, 500) };
  }
  const canWrite = await writerResponse.json();
  if (canWrite !== true) {
    return { response: json({ error: "You need write access to run matching." }, 403) };
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

function errorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.details;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authResult = await authenticate(req);
    if (!authResult.context) return authResult.response ?? json({ error: "Authentication required." }, 401);
    const auth = authResult.context;

    const payload = (await req.json().catch(() => null)) as { deal_id?: string } | null;
    const dealId = typeof payload?.deal_id === "string" ? payload.deal_id : "";
    if (!dealId) return json({ error: "deal_id is required." }, 400);

    const dealResult = await rest(
      auth,
      `deals?id=eq.${encodeURIComponent(dealId)}&select=id,company_name,sector,stage,geography,cheque_sought,thesis,summary&limit=1`,
    );
    if (!dealResult.response.ok) {
      console.error("matchInvestorsToDeal: deal read failed", dealResult.response.status);
      return json({ error: "Could not read the deal." }, 500);
    }
    const dealRow = (dealResult.body as Record<string, unknown>[] | null)?.[0];
    if (!dealRow) return json({ error: "Deal not found or not accessible." }, 404);

    const claimsResult = await rest(
      auth,
      `deal_claims?deal_id=eq.${encodeURIComponent(dealId)}&review_status=eq.approved&verification_status=in.(founder_reported,corroborated)&select=claim_type,value_text,normalized_value,label&limit=200`,
    );
    const claimRows = (claimsResult.body as Record<string, unknown>[] | null) ?? [];
    const claimByType = (type: string): string =>
      text(claimRows.find((row) => row.claim_type === type)?.value_text) ||
      text(claimRows.find((row) => row.claim_type === type)?.label);

    const investorsResult = await rest(
      auth,
      `investors?select=id,name,status,relationship,sectors,stages,geography,minimum_check,maximum_check,thesis,is_synthetic&limit=1000`,
    );
    if (!investorsResult.response.ok) {
      console.error("matchInvestorsToDeal: investor read failed", investorsResult.response.status);
      return json({ error: "Could not read the investor network." }, 500);
    }
    const investorRows = (investorsResult.body as Record<string, unknown>[] | null) ?? [];

    const contactsResult = await rest(
      auth,
      `investor_contacts?select=id,investor_id,contact_name,relationship_strength,outreach_permission_status,relationship_owner,relationship_owner_user_id,is_primary&limit=1000`,
    );
    const contactRows = (contactsResult.body as Record<string, unknown>[] | null) ?? [];

    const interactionsResult = await rest(
      auth,
      `investor_interactions?select=investor_id,kind,summary,occurred_at&order=occurred_at.desc&limit=2000`,
    );
    const interactionRows = (interactionsResult.body as Record<string, unknown>[] | null) ?? [];

    const configResult = await rest(
      auth,
      "match_weight_configs?select=sector_thesis,stage,check_size,geography,relationship,recent_interest&order=updated_at.desc&limit=1",
    );
    const configRow = (configResult.body as Record<string, unknown>[] | null)?.[0] ?? DEFAULT_WEIGHT_ROW;
    const configuredWeights: Partial<MatchWeights> = {
      sectorThesis: Number(configRow.sector_thesis ?? DEFAULT_WEIGHT_ROW.sector_thesis),
      stage: Number(configRow.stage ?? DEFAULT_WEIGHT_ROW.stage),
      checkSize: Number(configRow.check_size ?? DEFAULT_WEIGHT_ROW.check_size),
      geography: Number(configRow.geography ?? DEFAULT_WEIGHT_ROW.geography),
      relationship: Number(configRow.relationship ?? DEFAULT_WEIGHT_ROW.relationship),
      recentInterest: Number(configRow.recent_interest ?? DEFAULT_WEIGHT_ROW.recent_interest),
    };

    const matchesResult = await rest(
      auth,
      `deal_investor_matches?deal_id=eq.${encodeURIComponent(dealId)}&select=investor_id,match_status&limit=1000`,
    );
    const existingStatus = new Map<string, string>();
    for (const row of (matchesResult.body as Record<string, unknown>[] | null) ?? []) {
      existingStatus.set(String(row.investor_id), String(row.match_status ?? "suggested"));
    }

    const investors: InvestorRecord[] = investorRows.map((row) => {
      const id = String(row.id);
      return {
        id,
        name: String(row.name ?? ""),
        status: String(row.status ?? "unknown"),
        relationship: String(row.relationship ?? "new"),
        sectors: textArray(row.sectors),
        stages: textArray(row.stages),
        geographies: textArray(row.geography),
        checkMin: num(row.minimum_check),
        checkMax: num(row.maximum_check),
        thesis: text(row.thesis),
        isSynthetic: Boolean(row.is_synthetic),
        contacts: contactRows
          .filter((contact) => String(contact.investor_id) === id)
          .map((contact) => ({
            id: String(contact.id),
            name: text(contact.contact_name),
            relationshipStrength: text(contact.relationship_strength) || "unknown",
            outreachPermissionStatus: text(contact.outreach_permission_status) || "unknown",
            relationshipOwner: text(contact.relationship_owner),
            relationshipOwnerUserId: contact.relationship_owner_user_id
              ? String(contact.relationship_owner_user_id)
              : null,
            isPrimary: Boolean(contact.is_primary),
          })),
        interactions: interactionRows
          .filter((interaction) => String(interaction.investor_id) === id)
          .map((interaction) => ({
            kind: text(interaction.kind),
            summary: text(interaction.summary),
            occurredAt: text(interaction.occurred_at),
          })),
      };
    });

    const deal: DealAttributes = {
      id: dealId,
      companyName: text(dealRow.company_name),
      sector: text(dealRow.sector) || claimByType("sector"),
      stage: text(dealRow.stage) || claimByType("stage"),
      geography: text(dealRow.geography) || claimByType("geography"),
      chequeSought: num(dealRow.cheque_sought),
      thesis: text(dealRow.thesis),
      summary: text(dealRow.summary),
      claimText: claimRows.map((row) => text(row.value_text)).filter(Boolean).join(" "),
    };

    const run = scoreInvestors(deal, investors, configuredWeights);

    let saved = 0;
    if (run.matches.length > 0) {
      const rows = run.matches.map((match) => ({
        deal_id: dealId,
        investor_id: match.investorId,
        fit_score: match.score,
        score_breakdown: match.rules,
        fit_explanation: match.explanation,
        missing_information: match.missingInformation,
        restrictions: match.restrictions,
        introduction_strategy: match.strategy,
        needs_research: match.needsResearch,
        weights: run.weights,
        match_status: existingStatus.get(match.investorId) ?? "suggested",
        created_by: auth.userId,
      }));

      const saveResult = await rest(auth, "deal_investor_matches?on_conflict=deal_id,investor_id", {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: JSON.stringify(rows),
      });
      if (!saveResult.response.ok) {
        const message = errorMessage(saveResult.body, "Could not save the match results.");
        console.error("matchInvestorsToDeal: save failed", saveResult.response.status);
        return json({ error: message }, 500);
      }
      saved = ((saveResult.body as unknown[] | null) ?? []).length;
    }

    return json({
      configured: true,
      weights: run.weights,
      matchesSaved: saved,
      excluded: run.excluded,
      missingDealInputs: run.missingDealInputs,
      warnings: run.warnings,
      needsResearch: run.matches.filter((match) => match.needsResearch).length,
    });
  } catch (error) {
    console.error("matchInvestorsToDeal failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The matching run failed. No owner decisions were changed." }, 500);
  }
});

/**
 * Pure delta-review rules. No network or database access.
 * Kept separate so exact-excerpt validation and period/definition handling can be
 * exercised without touching production records.
 */

export const ALLOWED_CLAIM_TYPES = [
  "metric",
  "document",
  "call_note",
  "reference",
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
] as const;

export type ClaimType = (typeof ALLOWED_CLAIM_TYPES)[number];
export type Attribution = "founder" | "third_party" | "unknown";
export type ProposalRelation = "new" | "changed" | "clarification" | "conflict";

export interface ExistingClaim {
  id: string;
  claim_type: string;
  label: string;
  value_text: string;
  normalized_value: number | null;
  currency: string;
  reporting_period: string;
  metric_definition: string;
  review_status: string;
  superseded_by: string | null;
  supporting_excerpt: string;
  source_title: string;
}

export interface RawProposal {
  claim_type?: unknown;
  label?: unknown;
  value_text?: unknown;
  normalized_value?: unknown;
  currency?: unknown;
  reporting_period?: unknown;
  metric_definition?: unknown;
  attribution?: unknown;
  confidence?: unknown;
  relation?: unknown;
  previous_claim_id?: unknown;
  excerpt?: unknown;
  reason?: unknown;
}

export interface ParsedProposal {
  claimType: ClaimType;
  label: string;
  valueText: string;
  normalizedValue: number | null;
  currency: string;
  reportingPeriod: string;
  metricDefinition: string;
  attribution: Attribution;
  confidence: "high" | "medium" | "low";
  relation: ProposalRelation;
  previousClaimId: string | null;
  previousValueText: string;
  previousPeriod: string;
  previousCurrency: string;
  excerpt: string;
  reason: string;
}

export interface RelationResult {
  relation: ProposalRelation;
  previousClaimId: string | null;
  unchanged: boolean;
}

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizedPeriod(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedValue(value: string, numeric: number | null): string {
  if (numeric !== null) return `n:${numeric}`;
  return normalized(value);
}

export function amount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function exactExcerpt(sourceText: string, rawExcerpt: unknown): string | null {
  const candidate = text(rawExcerpt, 2000)
    .replace(/^["'“”‘’\s]+/, "")
    .replace(/["'“”‘’\s]+$/, "")
    .trim();
  if (candidate.length < 8) return null;
  const index = sourceText.indexOf(candidate);
  if (index !== -1) return sourceText.slice(index, index + candidate.length);
  const collapsedChars: string[] = [];
  const originalIndexes: number[] = [];
  let previousWhitespace = false;
  for (let i = 0; i < sourceText.length; i += 1) {
    const char = sourceText[i];
    if (/\s/.test(char)) {
      if (previousWhitespace) continue;
      collapsedChars.push(" ");
      originalIndexes.push(i);
      previousWhitespace = true;
    } else {
      collapsedChars.push(char);
      originalIndexes.push(i);
      previousWhitespace = false;
    }
  }
  const collapsedSource = collapsedChars.join("");
  const collapsedCandidate = candidate.replace(/\s+/g, " ");
  const collapsedIndex = collapsedSource.indexOf(collapsedCandidate);
  if (collapsedIndex === -1) return null;
  const start = originalIndexes[collapsedIndex];
  const end = originalIndexes[collapsedIndex + collapsedCandidate.length - 1] + 1;
  const exact = sourceText.slice(start, end).trim();
  return exact.length >= 8 ? exact : null;
}

export function classify(
  proposal: {
    claimType: string;
    label: string;
    valueText: string;
    normalizedValue: number | null;
    currency: string;
    reportingPeriod: string;
    metricDefinition: string;
    previousClaimId: string | null;
  },
  existing: ExistingClaim[],
): RelationResult {
  const active = existing.filter(
    (claim) => claim.review_status === "approved" && !claim.superseded_by,
  );
  const previous =
    (proposal.previousClaimId ? active.find((claim) => claim.id === proposal.previousClaimId) : null) ??
    active.find((claim) => normalized(claim.label) === normalized(proposal.label)) ??
    null;

  if (!previous) {
    return { relation: "new", previousClaimId: null, unchanged: false };
  }

  const samePeriod = normalizedPeriod(previous.reporting_period) === normalizedPeriod(proposal.reportingPeriod);
  const sameDefinition =
    !previous.metric_definition ||
    !proposal.metricDefinition ||
    normalized(previous.metric_definition) === normalized(proposal.metricDefinition);
  const sameCurrency =
    !previous.currency ||
    !proposal.currency ||
    previous.currency.toUpperCase() === proposal.currency.toUpperCase();
  const sameValue = normalizedValue(previous.value_text, previous.normalized_value) ===
    normalizedValue(proposal.valueText, proposal.normalizedValue);

  if (sameValue && samePeriod && sameDefinition && sameCurrency) {
    return { relation: "new", previousClaimId: previous.id, unchanged: true };
  }

  // A different reporting period, metric definition or currency is not by itself
  // a contradiction. It stays a clarification for a human to accept or reject.
  if (!samePeriod || !sameDefinition || !sameCurrency) {
    return { relation: "clarification", previousClaimId: previous.id, unchanged: false };
  }

  return { relation: "changed", previousClaimId: previous.id, unchanged: false };
}

export function parseProposal(
  raw: RawProposal,
  sourceText: string,
  existing: ExistingClaim[],
): { proposal?: ParsedProposal; warning?: string } {
  const claimType = text(raw.claim_type, 40).toLowerCase();
  if (!ALLOWED_CLAIM_TYPES.includes(claimType as ClaimType)) {
    return { warning: `Discarded a proposal with an unsupported claim type${claimType ? `: ${claimType}` : ""}.` };
  }
  const label = text(raw.label, 160);
  const valueText = text(raw.value_text, 240);
  const excerpt = exactExcerpt(sourceText, raw.excerpt);
  if (!label) return { warning: "Discarded a proposal without a label." };
  if (!valueText) return { warning: `Discarded "${label}" because it has no value.` };
  if (!excerpt) return { warning: `Discarded "${label}" because the excerpt was not found verbatim in the source.` };

  const attributionRaw = text(raw.attribution, 30).toLowerCase();
  const attribution: Attribution =
    attributionRaw === "founder" || attributionRaw === "third_party" ? attributionRaw : "unknown";
  const confidenceRaw = text(raw.confidence, 10).toLowerCase();
  const confidence = confidenceRaw === "high" || confidenceRaw === "low" ? confidenceRaw : "medium";
  const previousRaw = text(raw.previous_claim_id, 50);
  const relation = classify(
    {
      claimType,
      label,
      valueText,
      normalizedValue: amount(raw.normalized_value) ?? amount(valueText),
      currency: text(raw.currency, 3).toUpperCase() || "USD",
      reportingPeriod: text(raw.reporting_period, 80),
      metricDefinition: text(raw.metric_definition, 240),
      previousClaimId: previousRaw || null,
    },
    existing,
  );
  if (relation.unchanged) {
    return { warning: `Skipped "${label}" because the same value and period are already reviewed.` };
  }
  const previous = relation.previousClaimId
    ? existing.find((claim) => claim.id === relation.previousClaimId) ?? null
    : null;

  return {
    proposal: {
      claimType: claimType as ClaimType,
      label,
      valueText,
      normalizedValue: amount(raw.normalized_value) ?? amount(valueText),
      currency: text(raw.currency, 3).toUpperCase() || "USD",
      reportingPeriod: text(raw.reporting_period, 80),
      metricDefinition: text(raw.metric_definition, 240),
      attribution,
      confidence,
      relation: relation.relation,
      previousClaimId: relation.previousClaimId,
      previousValueText: previous?.value_text ?? "",
      previousPeriod: previous?.reporting_period ?? "",
      previousCurrency: previous?.currency ?? "",
      excerpt,
      reason: text(raw.reason, 500),
    },
  };
}

export function proposalFingerprint(input: {
  claimType: string;
  label: string;
  valueText: string;
  reportingPeriod: string;
  metricDefinition: string;
  excerpt: string;
}): string {
  return [
    input.claimType,
    normalized(input.label),
    normalized(input.valueText),
    normalized(input.reportingPeriod),
    normalized(input.metricDefinition),
    normalized(input.excerpt),
  ].join("|").slice(0, 900);
}

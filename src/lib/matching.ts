import type { InvestmentCase, Investor, MatchResult, MatchRule, RelationshipStatus } from "./types";
import { formatCurrency, formatCurrencyRange } from "./format";

/**
 * Deterministic, explainable matching between a stored investment case and a
 * manually maintained investor record. No model inference: every point comes
 * from a field a human entered, and each rule is surfaced in the UI.
 */
export const MATCH_WEIGHTS = {
  stage: 28,
  sector: 24,
  geography: 14,
  cheque: 18,
  lead: 8,
  relationship: 8,
} as const;

const STAGE_ORDER = ["Pre-seed", "Seed", "Series A", "Series B", "Growth"];

const RELATIONSHIP_POINTS: Record<RelationshipStatus, number> = {
  active: 8,
  warm: 6,
  new: 3,
  dormant: 0,
};

const RELATIONSHIP_DETAIL: Record<RelationshipStatus, string> = {
  active: "Active relationship — recent two-way contact recorded.",
  warm: "Warm relationship — an introduction or meeting is on file.",
  new: "New relationship — no prior interaction recorded.",
  dormant: "Dormant relationship — no recent contact on file.",
};

function stageRule(caseItem: InvestmentCase, investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.stage;
  const preferred = investor.stages;
  const label = "Stage fit";

  if (preferred.length === 0) {
    return {
      key: "stage",
      label,
      points: 0,
      maxPoints,
      outcome: "fail",
      detail: "No stage preference recorded for this investor.",
    };
  }

  if (preferred.includes(caseItem.roundStage)) {
    return {
      key: "stage",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: `Invests at ${caseItem.roundStage}, matching the current round.`,
    };
  }

  const caseIndex = STAGE_ORDER.indexOf(caseItem.roundStage);
  const adjacent = preferred.some((stage) => Math.abs(STAGE_ORDER.indexOf(stage) - caseIndex) === 1);

  if (adjacent) {
    const points = Math.round(maxPoints * 0.4);
    return {
      key: "stage",
      label,
      points,
      maxPoints,
      outcome: "partial",
      detail: `Prefers ${preferred.join(", ")} — adjacent to ${caseItem.roundStage}.`,
    };
  }

  return {
    key: "stage",
    label,
    points: 0,
    maxPoints,
    outcome: "fail",
    detail: `Prefers ${preferred.join(", ")}; this case is ${caseItem.roundStage}.`,
  };
}

function sectorRule(caseItem: InvestmentCase, investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.sector;
  const label = "Sector fit";

  if (!caseItem.sector) {
    return {
      key: "sector",
      label,
      points: 0,
      maxPoints,
      outcome: "fail",
      detail: "No sector recorded on the case.",
    };
  }

  if (investor.sectors.includes(caseItem.sector)) {
    return {
      key: "sector",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: `Sector ${caseItem.sector} is on the investor's mandate.`,
    };
  }

  return {
    key: "sector",
    label,
    points: 0,
    maxPoints,
    outcome: "fail",
    detail: investor.sectors.length
      ? `Mandate covers ${investor.sectors.join(", ")}, not ${caseItem.sector}.`
      : "No sector preference recorded for this investor.",
  };
}

function geographyRule(caseItem: InvestmentCase, investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.geography;
  const label = "Geography";

  if (investor.geographies.length === 0) {
    return {
      key: "geography",
      label,
      points: 0,
      maxPoints,
      outcome: "fail",
      detail: "No geography preference recorded for this investor.",
    };
  }

  if (investor.geographies.includes("Global")) {
    return {
      key: "geography",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: "Invests globally, so this geography is in scope.",
    };
  }

  if (investor.geographies.includes(caseItem.geography)) {
    return {
      key: "geography",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: `Covers ${caseItem.geography}.`,
    };
  }

  return {
    key: "geography",
    label,
    points: 0,
    maxPoints,
    outcome: "fail",
    detail: `Focus is ${investor.geographies.join(", ")}; case is in ${caseItem.geography}.`,
  };
}

function chequeRule(caseItem: InvestmentCase, investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.cheque;
  const label = "Cheque size";
  const sought = caseItem.chequeSought;

  if (!sought) {
    return {
      key: "cheque",
      label,
      points: 0,
      maxPoints,
      outcome: "fail",
      detail: "Record the cheque sought on the case to evaluate size fit.",
    };
  }

  if (investor.checkMin === null && investor.checkMax === null) {
    return {
      key: "cheque",
      label,
      points: 0,
      maxPoints,
      outcome: "fail",
      detail: `No cheque range recorded; case seeks ${formatCurrency(sought)}.`,
    };
  }

  const min = investor.checkMin ?? 0;
  const max = investor.checkMax ?? Number.MAX_SAFE_INTEGER;

  if (sought >= min && sought <= max) {
    return {
      key: "cheque",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: `Writes ${formatCurrencyRange(investor.checkMin, investor.checkMax)}; case seeks ${formatCurrency(sought)}.`,
    };
  }

  const distance = sought < min ? min - sought : sought - max;
  const tolerance = sought * 0.25;

  if (distance <= tolerance) {
    const points = Math.round(maxPoints * 0.5);
    return {
      key: "cheque",
      label,
      points,
      maxPoints,
      outcome: "partial",
      detail: `Writes ${formatCurrencyRange(investor.checkMin, investor.checkMax)}; case seeks ${formatCurrency(sought)} — close but outside range.`,
    };
  }

  return {
    key: "cheque",
    label,
    points: 0,
    maxPoints,
    outcome: "fail",
    detail: `Writes ${formatCurrencyRange(investor.checkMin, investor.checkMax)}; case seeks ${formatCurrency(sought)}.`,
  };
}

function leadRule(caseItem: InvestmentCase, investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.lead;
  const label = "Lead capacity";

  if (!caseItem.leadRequired) {
    return {
      key: "lead",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: "This round does not require a lead investor.",
    };
  }

  if (investor.leadsRounds) {
    return {
      key: "lead",
      label,
      points: maxPoints,
      maxPoints,
      outcome: "pass",
      detail: "Recorded as willing to lead rounds.",
    };
  }

  return {
    key: "lead",
    label,
    points: 0,
    maxPoints,
    outcome: "fail",
    detail: "This round needs a lead; investor is not recorded as leading.",
  };
}

function relationshipRule(investor: Investor): MatchRule {
  const maxPoints = MATCH_WEIGHTS.relationship;
  const points = RELATIONSHIP_POINTS[investor.relationship];

  return {
    key: "relationship",
    label: "Relationship signal",
    points,
    maxPoints,
    outcome: points === maxPoints ? "pass" : points > 0 ? "partial" : "fail",
    detail: RELATIONSHIP_DETAIL[investor.relationship],
  };
}

export function scoreMatch(caseItem: InvestmentCase, investor: Investor): MatchResult {
  const rules = [
    stageRule(caseItem, investor),
    sectorRule(caseItem, investor),
    geographyRule(caseItem, investor),
    chequeRule(caseItem, investor),
    leadRule(caseItem, investor),
    relationshipRule(investor),
  ];

  const score = rules.reduce((total, rule) => total + rule.points, 0);
  const tier: MatchResult["tier"] = score >= 75 ? "strong" : score >= 50 ? "considered" : "weak";

  return {
    investor,
    caseId: caseItem.id,
    score,
    tier,
    rules,
    gaps: rules.filter((rule) => rule.outcome !== "pass").map((rule) => rule.label),
  };
}

export function rankMatches(caseItem: InvestmentCase, investors: Investor[]): MatchResult[] {
  return investors
    .map((investor) => scoreMatch(caseItem, investor))
    .sort((a, b) => b.score - a.score || a.investor.firmName.localeCompare(b.investor.firmName));
}

export const MATCH_TIER_LABEL: Record<MatchResult["tier"], string> = {
  strong: "Strong fit",
  considered: "Worth a look",
  weak: "Low fit",
};

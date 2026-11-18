import type {
  CaseStatus,
  CaptureStatus,
  EvidenceKind,
  InteractionKind,
  InvestorType,
  OutreachChannel,
  OutreachStatus,
  RelationshipStatus,
} from "./types";

export const ROUND_STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Growth"] as const;

export const SECTORS = [
  "Fintech",
  "Enterprise SaaS",
  "Healthtech",
  "Climate",
  "Logistics",
  "Consumer",
  "Marketplace",
  "Vertical SaaS",
  "Infrastructure",
] as const;

export const GEOGRAPHIES = [
  "Southeast Asia",
  "India",
  "US & Canada",
  "Europe",
  "MENA",
  "Latin America",
  "Global",
] as const;

export const CASE_STATUS_OPTIONS: { value: CaseStatus; label: string }[] = [
  { value: "sourcing", label: "Sourcing" },
  { value: "diligence", label: "Diligence" },
  { value: "ic_review", label: "IC review" },
  { value: "term_sheet", label: "Term sheet" },
  { value: "invested", label: "Invested" },
  { value: "passed", label: "Passed" },
];

export const ACTIVE_CASE_STATUSES: CaseStatus[] = [
  "sourcing",
  "diligence",
  "ic_review",
  "term_sheet",
];

export const CAPTURE_STATUS_OPTIONS: { value: CaptureStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "promoted", label: "Promoted" },
  { value: "archived", label: "Archived" },
];

export const INVESTOR_TYPE_OPTIONS: { value: InvestorType; label: string }[] = [
  { value: "vc", label: "Venture fund" },
  { value: "angel", label: "Angel" },
  { value: "family_office", label: "Family office" },
  { value: "corporate", label: "Corporate VC" },
];

export const RELATIONSHIP_OPTIONS: { value: RelationshipStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "warm", label: "Warm" },
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
];

export const EVIDENCE_KIND_OPTIONS: { value: EvidenceKind; label: string }[] = [
  { value: "metric", label: "Metric" },
  { value: "document", label: "Document" },
  { value: "call_note", label: "Call note" },
  { value: "reference", label: "Reference" },
];

export const INTERACTION_KIND_OPTIONS: { value: InteractionKind; label: string }[] = [
  { value: "intro", label: "Intro" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
];

export const OUTREACH_CHANNEL_OPTIONS: { value: OutreachChannel; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "linkedin", label: "LinkedIn message" },
  { value: "intro", label: "Warm intro request" },
];

export const OUTREACH_STATUS_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  sourcing: "Sourcing",
  diligence: "Diligence",
  ic_review: "IC review",
  term_sheet: "Term sheet",
  invested: "Invested",
  passed: "Passed",
};

export const CAPTURE_STATUS_LABEL: Record<CaptureStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  promoted: "Promoted",
  archived: "Archived",
};

export const INVESTOR_TYPE_LABEL: Record<InvestorType, string> = {
  vc: "Venture fund",
  angel: "Angel",
  family_office: "Family office",
  corporate: "Corporate VC",
};

export const RELATIONSHIP_LABEL: Record<RelationshipStatus, string> = {
  new: "New",
  warm: "Warm",
  active: "Active",
  dormant: "Dormant",
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  metric: "Metric",
  document: "Document",
  call_note: "Call note",
  reference: "Reference",
};

export const INTERACTION_KIND_LABEL: Record<InteractionKind, string> = {
  intro: "Intro",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export const OUTREACH_STATUS_LABEL: Record<OutreachStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  sent: "Sent",
};

export const OUTREACH_CHANNEL_LABEL: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  intro: "Warm intro",
};

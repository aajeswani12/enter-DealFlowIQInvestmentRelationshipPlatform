import type {
  CaseStatus,
  CaptureStatus,
  ClaimType,
  GapSeverity,
  InteractionKind,
  InvestorStatus,
  InvestorType,
  MemberRole,
  OutreachChannel,
  OutreachPermission,
  OutreachStatus,
  QuestionStatus,
  RelationshipStatus,
  RelationshipStrength,
  VerificationStatus,
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

export const ACTIVE_CASE_STATUSES: CaseStatus[] = ["sourcing", "diligence", "ic_review", "term_sheet"];

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

export const INVESTOR_STATUS_OPTIONS: { value: InvestorStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "restricted", label: "Restricted" },
  { value: "unknown", label: "Unknown" },
];

export const RELATIONSHIP_OPTIONS: { value: RelationshipStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "warm", label: "Warm" },
  { value: "active", label: "Active" },
  { value: "dormant", label: "Dormant" },
];

export const RELATIONSHIP_STRENGTH_OPTIONS: { value: RelationshipStrength; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "weak", label: "Weak" },
  { value: "warm", label: "Warm" },
  { value: "strong", label: "Strong" },
];

export const OUTREACH_PERMISSION_OPTIONS: { value: OutreachPermission; label: string }[] = [
  { value: "unknown", label: "Unknown" },
  { value: "permitted", label: "Permitted" },
  { value: "requires_intro", label: "Requires intro" },
  { value: "do_not_contact", label: "Do not contact" },
];

export const CLAIM_TYPE_OPTIONS: { value: ClaimType; label: string }[] = [
  { value: "metric", label: "Metric" },
  { value: "traction", label: "Traction" },
  { value: "revenue", label: "Revenue" },
  { value: "financial", label: "Financial" },
  { value: "funding", label: "Funding" },
  { value: "founder", label: "Founder" },
  { value: "investor_mention", label: "Investor mention" },
  { value: "product", label: "Product" },
  { value: "ownership", label: "Ownership" },
  { value: "next_action", label: "Next action" },
  { value: "company", label: "Company" },
  { value: "sector", label: "Sector" },
  { value: "stage", label: "Stage" },
  { value: "document", label: "Document" },
  { value: "call_note", label: "Call note" },
  { value: "reference", label: "Reference" },
];

export const VERIFICATION_OPTIONS: { value: VerificationStatus; label: string }[] = [
  { value: "unverified", label: "Unverified" },
  { value: "founder_reported", label: "Founder reported" },
  { value: "corroborated", label: "Corroborated" },
  { value: "disputed", label: "Disputed" },
];

export const SEVERITY_OPTIONS: { value: GapSeverity; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
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
  { value: "contacted", label: "Contacted" },
  { value: "replied", label: "Replied" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "follow_up_needed", label: "Follow-up Needed" },
  { value: "rejected", label: "Rejected" },
];

export const MEMBER_ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "partner", label: "Partner" },
  { value: "analyst", label: "Analyst" },
  { value: "viewer", label: "Viewer" },
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

export const INVESTOR_STATUS_LABEL: Record<InvestorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  restricted: "Restricted",
  unknown: "Unknown",
  prospect: "Unknown (legacy)",
  watchlist: "Inactive (legacy)",
  archived: "Inactive (legacy)",
};

export const RELATIONSHIP_LABEL: Record<RelationshipStatus, string> = {
  new: "New",
  warm: "Warm",
  active: "Active",
  dormant: "Dormant",
};

export const RELATIONSHIP_STRENGTH_LABEL: Record<RelationshipStrength, string> = {
  unknown: "Unknown",
  weak: "Weak",
  warm: "Warm",
  strong: "Strong",
};

export const OUTREACH_PERMISSION_LABEL: Record<OutreachPermission, string> = {
  unknown: "Unknown",
  permitted: "Permitted",
  requires_intro: "Requires intro",
  do_not_contact: "Do not contact",
};

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  metric: "Metric",
  traction: "Traction",
  revenue: "Revenue",
  financial: "Financial",
  funding: "Funding",
  founder: "Founder",
  investor_mention: "Investor mention",
  product: "Product",
  ownership: "Ownership",
  next_action: "Next action",
  company: "Company",
  sector: "Sector",
  stage: "Stage",
  document: "Document",
  call_note: "Call note",
  reference: "Reference",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  unverified: "Unverified",
  founder_reported: "Founder reported",
  corroborated: "Corroborated",
  disputed: "Disputed",
};

export const SEVERITY_LABEL: Record<GapSeverity, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const QUESTION_STATUS_LABEL: Record<QuestionStatus, string> = {
  open: "Open",
  answered: "Resolved",
  needs_review: "Needs Review",
  resolved: "Resolved",
};

export const QUESTION_STATUS_OPTIONS: { value: QuestionStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "needs_review", label: "Needs Review" },
  { value: "resolved", label: "Resolved" },
];

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
  contacted: "Contacted",
  replied: "Replied",
  interested: "Interested",
  not_interested: "Not Interested",
  follow_up_needed: "Follow-up Needed",
  rejected: "Rejected",
  sent: "Contacted (legacy)",
};

export const OUTREACH_EVENT_LABEL: Record<string, string> = {
  drafted: "Draft created",
  edited: "Draft edited",
  approved: "Approved by a human",
  approval_revoked: "Approval reset after edit",
  rejected: "Rejected",
  contacted: "Marked contacted",
  replied: "Reply recorded",
  interested: "Marked interested",
  not_interested: "Marked not interested",
  followup_needed: "Follow-up needed",
  followup_scheduled: "Follow-up scheduled",
  owner_assigned: "Outreach owner changed",
};

export const OUTREACH_CHANNEL_LABEL: Record<OutreachChannel, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  intro: "Warm intro",
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  owner: "Owner",
  partner: "Partner",
  analyst: "Analyst",
  viewer: "Viewer",
};

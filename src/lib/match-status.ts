import type { MatchStatus } from "./types";

export const MATCH_STATUS_META: Record<
  MatchStatus,
  { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }
> = {
  suggested: { label: "Suggested", tone: "neutral" },
  accepted: { label: "Accepted", tone: "success" },
  dismissed: { label: "Dismissed", tone: "neutral" },
  deferred: { label: "Deferred", tone: "warning" },
  shortlisted: { label: "Shortlisted", tone: "brand" },
  outreach_drafted: { label: "Outreach drafted", tone: "brand" },
  approved: { label: "Approved", tone: "success" },
  contacted: { label: "Contacted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
};

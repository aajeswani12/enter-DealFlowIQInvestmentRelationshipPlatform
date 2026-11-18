import { Bookmark, ChevronDown, Circle, CircleAlert, CircleCheck, Send } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Pill, TierPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { MATCH_TIER_LABEL } from "@/lib/matching";
import { contactLabel, primaryContact } from "@/lib/investors";
import type { MatchResult, MatchStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MatchCardProps {
  match: MatchResult;
  rank: number;
  hasOutreach: boolean;
  matchStatus?: MatchStatus;
  onDraft: () => void;
  onShortlist?: () => void;
}

const STATUS_LABEL: Partial<Record<MatchStatus, string>> = {
  shortlisted: "Shortlisted",
  outreach_drafted: "Draft saved",
  approved: "Approved",
  contacted: "Contacted",
  declined: "Declined",
};

const STATUS_TONE = {
  shortlisted: "brand",
  outreach_drafted: "warning",
  approved: "brand",
  contacted: "success",
  declined: "danger",
} as const;

export function MatchCard({ match, rank, hasOutreach, matchStatus = "suggested", onDraft, onShortlist }: MatchCardProps) {
  const [expanded, setExpanded] = useState(rank === 1);
  const { investor, rules, score, tier } = match;
  const passing = rules.filter((rule) => rule.outcome === "pass").length;
  const contact = primaryContact(investor);
  const statusLabel = STATUS_LABEL[matchStatus];

  return (
    <article className="panel p-4 sm:p-5" aria-labelledby={`match-${investor.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary font-display text-[15px] text-muted-foreground">
            {rank}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 id={`match-${investor.id}`} className="truncate text-[14.5px] font-semibold tracking-tight">
                {investor.name}
              </h3>
              {investor.isSynthetic ? <Pill tone="warning">Sample</Pill> : null}
            </div>
            <p className="truncate text-[11.5px] text-muted-foreground">
              {contactLabel(contact)}
              {contact?.title ? ` · ${contact.title}` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <TierPill tier={tier} label={MATCH_TIER_LABEL[tier]} />
              {statusLabel ? (
                <Pill tone={STATUS_TONE[matchStatus as keyof typeof STATUS_TONE]}>{statusLabel}</Pill>
              ) : null}
              <span className="text-[10.5px] text-muted-foreground">
                {passing}/{rules.length} rules met
              </span>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[30px] leading-none text-foreground">{score}</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">of 100</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            tier === "strong" ? "bg-brand" : tier === "considered" ? "bg-brand/60" : "bg-muted-foreground/40",
          )}
          style={{ width: `${score}%` }}
          role="img"
          aria-label={`Match score ${score} out of 100`}
        />
      </div>

      <ul className="mt-3 space-y-1">
        {rules.slice(0, 2).map((rule) => (
          <li key={rule.key} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed">
            {rule.outcome === "pass" ? (
              <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            ) : rule.outcome === "partial" ? (
              <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
            <span className="text-muted-foreground">{rule.detail}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" className="gap-1.5" onClick={onDraft} disabled={hasOutreach}>
          <Send className="h-3.5 w-3.5" aria-hidden="true" />
          {hasOutreach ? "Draft already exists" : "Draft outreach"}
        </Button>
        {onShortlist ? (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onShortlist}
            disabled={matchStatus === "shortlisted"}
          >
            <Bookmark className={matchStatus === "shortlisted" ? "h-3.5 w-3.5 fill-current" : "h-3.5 w-3.5"} aria-hidden="true" />
            {matchStatus === "shortlisted" ? "Shortlisted" : "Shortlist"}
          </Button>
        ) : null}
        <Button asChild size="sm" variant="ghost">
          <Link to={`/investors/${investor.id}`}>View investor</Link>
        </Button>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={`rules-${investor.id}`}
          className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-brand-strong hover:underline"
        >
          Why this score
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </button>
      </div>

      {expanded ? (
        <div id={`rules-${investor.id}`} className="mt-3 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Rule breakdown · recorded preferences only
          </p>
          {rules.map((rule) => (
            <div key={rule.key} className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2">
                {rule.outcome === "pass" ? (
                  <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                ) : rule.outcome === "partial" ? (
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                ) : (
                  <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                )}
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold">{rule.label}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{rule.detail}</p>
                </div>
              </div>
              <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
                {rule.points}
                <span className="font-normal text-muted-foreground/70">/{rule.maxPoints}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

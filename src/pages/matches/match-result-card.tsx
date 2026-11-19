import { CircleAlert, CircleCheck, Send, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Pill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { MATCH_TIER_LABEL } from "@/lib/matching";
import { formatCurrencyRange } from "@/lib/format";
import { MATCH_STATUS_META } from "@/lib/match-status";
import type { DealInvestorMatch, Investor } from "@/lib/types";
import { cn } from "@/lib/utils";

const TONE_ICON = {
  pass: CircleCheck,
  partial: CircleAlert,
  fail: CircleAlert,
} as const;

const TONE_CLASS = {
  pass: "text-success",
  partial: "text-warning",
  fail: "text-muted-foreground/50",
} as const;

export function MatchResultCard({
  match,
  investor,
  canWrite,
  deciding,
  hasOutreach,
  onDecision,
  onDraft,
}: {
  match: DealInvestorMatch;
  investor: Investor;
  canWrite: boolean;
  deciding: boolean;
  hasOutreach: boolean;
  onDecision: (status: "accepted" | "dismissed" | "deferred") => void;
  onDraft: () => void;
}) {
  const tier = match.fitScore >= 75 ? "strong" : match.fitScore >= 50 ? "considered" : "weak";
  const status = MATCH_STATUS_META[match.matchStatus] ?? MATCH_STATUS_META.suggested;
  const passing = match.scoreBreakdown.filter((rule) => rule.outcome === "pass").length;

  return (
    <article className="panel p-4 sm:p-5" aria-labelledby={`match-${match.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id={`match-${match.id}`} className="truncate text-[14.5px] font-semibold tracking-tight">
              {investor.name}
            </h3>
            {investor.isSynthetic ? <Pill tone="neutral">Sample</Pill> : null}
            <Pill tone={status.tone}>{status.label}</Pill>
            {match.needsResearch ? <Pill tone="warning">Needs Research</Pill> : null}
          </div>
          <p className="mt-0.5 text-[11.5px] text-muted-foreground">
            {investor.stages.join(", ") || "No stage preference"} · {investor.sectors.join(", ") || "No sector preference"}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {formatCurrencyRange(investor.checkMin, investor.checkMax, investor.currency)} ·{" "}
            {investor.geographies.join(", ") || "No geography preference"} · Relationship {investor.relationship}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[30px] leading-none text-foreground">{Math.round(match.fitScore)}</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">of 100</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">{MATCH_TIER_LABEL[tier]}</p>
        </div>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            tier === "strong" ? "bg-brand" : tier === "considered" ? "bg-brand/60" : "bg-muted-foreground/40",
          )}
          style={{ width: `${match.fitScore}%` }}
          role="img"
          aria-label={`Match score ${Math.round(match.fitScore)} out of 100`}
        />
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-foreground/90">{match.fitExplanation}</p>

      <div className="mt-3 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Matching criteria · recorded inputs only
        </p>
        {match.scoreBreakdown.map((rule) => {
          const Icon = TONE_ICON[rule.outcome] ?? CircleAlert;
          return (
            <div key={rule.key} className="flex items-start justify-between gap-3 border-b border-border/50 py-1.5 last:border-0 last:pb-0">
              <div className="flex min-w-0 items-start gap-2">
                <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", TONE_CLASS[rule.outcome])} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[11.5px] font-semibold">{rule.label}</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">{rule.detail}</p>
                </div>
              </div>
              <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted-foreground">
                {Math.round(rule.points)}
                <span className="font-normal text-muted-foreground/70">/{rule.maxPoints}</span>
              </span>
            </div>
          );
        })}
        <p className="pt-1 text-[10px] text-muted-foreground">
          {passing}/{match.scoreBreakdown.length} criteria fully met. Weights:{" "}
          {Object.entries(match.weights ?? {})
            .map(([key, value]) => `${key} ${value}`)
            .join(" · ")}
        </p>
      </div>

      {match.missingInformation.length > 0 ? (
        <div className="mt-3 rounded-md border border-warning/25 bg-warning-soft/50 px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-warning">Needs Research — missing inputs</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-warning">
            {match.missingInformation.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {match.restrictions.length > 0 ? (
        <div className="mt-2 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-destructive">Restrictions</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-destructive">
            {match.restrictions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 rounded-md border border-brand/20 bg-brand-soft/40 px-3 py-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand-strong">
          Recommended introduction strategy
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-brand-strong">{match.introductionStrategy}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {canWrite ? (
          <>
            <Button
              size="sm"
              variant={match.matchStatus === "accepted" ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => onDecision("accepted")}
              disabled={deciding || match.matchStatus === "accepted"}
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant={match.matchStatus === "deferred" ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => onDecision("deferred")}
              disabled={deciding || match.matchStatus === "deferred"}
            >
              Defer
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-muted-foreground"
              onClick={() => onDecision("dismissed")}
              disabled={deciding || match.matchStatus === "dismissed"}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              className="ml-auto h-7 gap-1 text-[11px]"
              onClick={onDraft}
              disabled={hasOutreach}
            >
              <Send className="h-3 w-3" aria-hidden="true" />
              {hasOutreach ? "Draft exists" : "Draft outreach"}
            </Button>
          </>
        ) : null}
        <Button asChild size="sm" variant="ghost" className="h-7 text-[11px]">
          <Link to={`/investors/${investor.id}`}>Investor record</Link>
        </Button>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          Preference fit, not interest
        </span>
      </div>
    </article>
  );
}

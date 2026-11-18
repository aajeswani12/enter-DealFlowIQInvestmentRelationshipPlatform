import { CircleAlert, FileText, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { VERIFICATION_LABEL } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type {
  Capture,
  DealAnalysisRun,
  DealBrief,
  InvestmentCase,
  VerificationStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const VERIFICATION_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  founder_reported: "brand",
  corroborated: "success",
  unverified: "neutral",
  disputed: "danger",
};

const RUN_TONE: Record<DealAnalysisRun["status"], "neutral" | "brand" | "success" | "warning" | "danger"> = {
  running: "brand",
  completed: "success",
  failed: "danger",
  unavailable: "warning",
};

const RUN_LABEL: Record<DealAnalysisRun["status"], string> = {
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  unavailable: "Not configured",
};

function SourceLink({ sourceId, label }: { sourceId: string | null; label: string }) {
  if (!sourceId) return <span className="text-muted-foreground">{label}</span>;
  return (
    <Link to={`/inbox#source-${sourceId}`} className="font-medium text-brand-strong hover:underline">
      {label}
    </Link>
  );
}

export function AnalysisSection({
  deal,
  sources,
  runs,
  briefs,
}: {
  deal: InvestmentCase;
  sources: Capture[];
  runs: DealAnalysisRun[];
  briefs: DealBrief[];
}) {
  const actions = useWorkspaceActions();
  const [runningSource, setRunningSource] = useState<string | null>(null);
  const [error, setError] = useState("");

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const sortedBriefs = [...briefs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestRun = sortedRuns[0];
  const latestBrief = sortedBriefs[0];

  const analyze = async (sourceId: string) => {
    setRunningSource(sourceId);
    setError("");
    try {
      const result = await actions.analyzeDealSource.mutateAsync({ sourceId, dealId: deal.id });
      if (!result.configured) {
        toast.warning(result.reason ?? "AI analysis is not configured. Nothing was generated.");
      } else {
        toast.success(
          `Analysis saved: ${result.claims ?? 0} draft claim${result.claims === 1 ? "" : "s"} and ${
            result.gaps ?? 0
          } checklist gap${result.gaps === 1 ? "" : "s"}.`,
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The analysis failed.";
      setError(message);
      toast.error(message);
    } finally {
      setRunningSource(null);
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="analysis-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps">Case intelligence</p>
          <h2 id="analysis-heading" className="mt-0.5 text-[15px] font-semibold tracking-tight">
            Evidence analysis
          </h2>
          <p className="mt-0.5 max-w-2xl text-[11.5px] leading-relaxed text-muted-foreground">
            Reads a linked source, extracts only verbatim evidence, compares it with reviewed facts and generates a
            readiness checklist and brief. Nothing here is an investment decision.
          </p>
        </div>
        <Pill tone="brand">
          <Sparkles className="mr-1 h-3 w-3" aria-hidden="true" />
          AI-assisted · {deal.isSynthetic ? "synthetic case" : "evidence only"}
        </Pill>
      </div>

      <div className="mt-4">
        <p className="label-caps">Linked sources</p>
        {sources.length === 0 ? (
          <div className="mt-2 rounded-lg border border-dashed border-border px-3 py-5 text-center">
            <p className="text-[12px] text-muted-foreground">
              No source is linked to this deal yet. Capture a voice note or paste a transcript, then select this deal.
            </p>
            <Button asChild size="sm" variant="outline" className="mt-2">
              <Link to="/inbox/capture">Add a source</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {sources.map((source) => {
              const sourceRun = sortedRuns.find((run) => run.sourceId === source.id);
              const hasTranscript = Boolean(source.notes.trim());
              const busy = runningSource === source.id;
              return (
                <li
                  key={source.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-medium">{source.companyName}</p>
                    <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                      {formatShortDate(source.sourceDate)} · {source.source === "voice" ? "Voice" : "Text"} source
                      {sourceRun ? ` · ${RUN_LABEL[sourceRun.status]}` : " · Not analysed"}
                      {!hasTranscript ? " · No transcript" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button asChild size="sm" variant="ghost" className="h-7 px-2 text-[11px]">
                      <Link to={`/inbox#source-${source.id}`}>View</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-[11px]"
                      onClick={() => void analyze(source.id)}
                      disabled={Boolean(runningSource) || !hasTranscript}
                    >
                      {busy ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      {busy ? "Analysing…" : "Analyse"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {error ? (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-destructive">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      {latestRun ? (
        <div className="mt-4 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Pill tone={RUN_TONE[latestRun.status]}>{RUN_LABEL[latestRun.status]}</Pill>
              <span className="text-[10.5px] text-muted-foreground">
                Latest run · {formatShortDate(latestRun.createdAt)}
              </span>
            </div>
            {latestRun.status === "completed" ? (
              <span className="text-[10.5px] text-muted-foreground">
                {String(latestRun.extracted.claims ?? 0)} draft claims · {String(latestRun.extracted.gaps ?? 0)} gaps
              </span>
            ) : null}
          </div>
          {latestRun.error ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{latestRun.error}</p>
          ) : null}
          {latestRun.status === "unavailable" ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-warning">
              No analysis was generated. The deal evidence is unchanged.
            </p>
          ) : null}
          {latestRun.warnings.length > 0 ? (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-[10.5px] font-medium text-muted-foreground">
                {latestRun.warnings.length} model validation note
                {latestRun.warnings.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1.5 space-y-1">
                {latestRun.warnings.slice(0, 8).map((warning, index) => (
                  <li key={`${warning}-${index}`} className="text-[10.5px] leading-relaxed text-muted-foreground">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {latestBrief ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4">
            <div>
              <p className="label-caps">Deal Brief</p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                Generated {formatShortDate(latestBrief.createdAt)} · AI-assisted snapshot
              </p>
            </div>
            <Pill tone="neutral">{latestBrief.status === "draft" ? "Draft brief" : "Reviewed brief"}</Pill>
          </div>
          <p className="text-[12.5px] leading-relaxed text-foreground/90">{latestBrief.summary}</p>

          {latestBrief.knownFacts.length > 0 ? (
            <div>
              <p className="label-caps">Known facts</p>
              <ul className="mt-2 space-y-2">
                {latestBrief.knownFacts.map((fact, index) => (
                  <li key={`${fact.label}-${index}`} className="rounded-lg border border-border bg-card p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-[12.5px] font-medium">{fact.label}</p>
                      <span className="text-[12px] font-semibold tabular-nums">{fact.value}</span>
                      {fact.period ? (
                        <span className="text-[10.5px] text-muted-foreground">· {fact.period}</span>
                      ) : (
                        <Pill tone="warning">No period</Pill>
                      )}
                      <Pill tone={VERIFICATION_TONE[fact.verification] ?? "neutral"}>
                        {VERIFICATION_LABEL[fact.verification as VerificationStatus] ?? fact.verification}
                      </Pill>
                      <Pill tone={fact.reviewStatus === "approved" ? "success" : "warning"}>
                        {fact.reviewStatus === "approved" ? "Reviewed" : "Draft fact"}
                      </Pill>
                      {fact.proposedChangeTo ? <Pill tone="danger">Proposed change</Pill> : null}
                    </div>
                    {fact.excerpt ? (
                      <blockquote className="mt-1.5 border-l-2 border-border pl-2 text-[11px] leading-relaxed text-muted-foreground">
                        “{fact.excerpt}”
                      </blockquote>
                    ) : null}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      <SourceLink
                        sourceId={fact.sourceId}
                        label={`${fact.sourceTitle || "Source"}${fact.sourceDate ? ` · ${formatShortDate(fact.sourceDate)}` : ""}`}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="label-caps">Unknowns</p>
              {latestBrief.unknowns.length === 0 ? (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">No open questions recorded.</p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {latestBrief.unknowns.map((unknown, index) => (
                    <li key={`${unknown.question}-${index}`} className="text-[11.5px] leading-relaxed">
                      <p className="font-medium text-foreground">{unknown.question}</p>
                      <p className="text-muted-foreground">{unknown.why}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                        {unknown.status.replace("_", " ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="label-caps">Risks</p>
              {latestBrief.risks.length === 0 ? (
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">No evidence risks recorded.</p>
              ) : (
                <ul className="mt-1.5 space-y-2">
                  {latestBrief.risks.map((risk, index) => (
                    <li key={`${risk.title}-${index}`} className="text-[11.5px] leading-relaxed">
                      <p className="font-medium text-foreground">{risk.title}</p>
                      <p className="text-muted-foreground">{risk.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {latestBrief.followUps.length > 0 ? (
            <div>
              <p className="label-caps">Follow-ups</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11.5px] leading-relaxed text-muted-foreground">
                {latestBrief.followUps.map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {latestBrief.evidence.length > 0 ? (
            <details>
              <summary className="cursor-pointer text-[10.5px] font-medium text-muted-foreground">
                {latestBrief.evidence.length} source excerpt
                {latestBrief.evidence.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-2 space-y-2">
                {latestBrief.evidence.map((item, index) => (
                  <li key={`${item.excerpt}-${index}`} className="rounded-md border border-border bg-card p-2.5">
                    <blockquote className="text-[11px] leading-relaxed text-muted-foreground">
                      “{item.excerpt}”
                    </blockquote>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      <SourceLink
                        sourceId={item.sourceId}
                        label={`${item.sourceTitle || "Source"}${
                          item.sourceDate ? ` · ${formatShortDate(item.sourceDate)}` : ""
                        }`}
                      />
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <p className="border-t border-border pt-2 text-[10px] leading-relaxed text-muted-foreground">
            {latestBrief.scopeNote} Facts marked draft require human approval. Reviewed facts are never overwritten by
            analysis.
          </p>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
          No Deal Brief yet. Analyse a linked source to generate evidence-backed facts and readiness questions.
        </p>
      )}

      <p className={cn("mt-3 text-[10px] leading-relaxed text-muted-foreground")}>
        This analysis never decides to invest or reject. Missing configuration or a failed model call leaves the case
        unchanged.
      </p>
    </section>
  );
}

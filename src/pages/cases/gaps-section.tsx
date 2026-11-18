import { CircleHelp, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { QUESTION_STATUS_LABEL, QUESTION_STATUS_OPTIONS, SEVERITY_LABEL, SEVERITY_OPTIONS } from "@/lib/constants";
import { formatShortDate, fromDateInputValue } from "@/lib/format";
import type { DecisionGap, GapSeverity, QuestionStatus } from "@/lib/types";

const SEVERITY_TONE = { low: "neutral", medium: "brand", high: "warning", critical: "danger" } as const;

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  open: "warning",
  needs_review: "brand",
  resolved: "success",
  answered: "success",
};

export function DecisionGapsSection({ dealId, items }: { dealId: string; items: DecisionGap[] }) {
  const actions = useWorkspaceActions();
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [owner, setOwner] = useState("");
  const [severity, setSeverity] = useState<GapSeverity>("medium");
  const [blocking, setBlocking] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const open = items.filter((item) => item.status === "open" || item.status === "needs_review");
  const answered = items.filter((item) => item.status === "answered" || item.status === "resolved");

  const handleStatus = async (item: DecisionGap, status: QuestionStatus) => {
    try {
      await actions.updateGap.mutateAsync({ id: item.id, patch: { status } });
      toast.success(`Checklist item marked ${QUESTION_STATUS_LABEL[status].toLowerCase()}`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update this checklist item.");
    }
  };

  const handleAdd = async () => {
    if (!question.trim()) {
      setError("Write the gap you need to close.");
      return;
    }
    try {
      await actions.createGap.mutateAsync({
        dealId,
        question: question.trim(),
        owner: owner.trim(),
        severity,
        blockingDecision: blocking,
        dueDate: fromDateInputValue(dueDate),
      });
      toast.success("Decision gap added");
      setQuestion("");
      setOwner("");
      setSeverity("medium");
      setBlocking(false);
      setDueDate("");
      setError("");
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add this gap.");
    }
  };

  const handleAnswer = async (id: string) => {
    if (!answer.trim()) return;
    try {
      await actions.updateGap.mutateAsync({ id, patch: { answer: answer.trim(), status: "answered" } });
      toast.success("Decision gap closed");
      setAnsweringId(null);
      setAnswer("");
    } catch {
      toast.error("Could not save this answer.");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await actions.updateGap.mutateAsync({ id, patch: { status: "open" } });
    } catch {
      toast.error("Could not reopen this gap.");
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="gaps-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="gaps-heading" className="text-[15px] font-semibold tracking-tight">
            Decision gaps
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            {open.length === 0
              ? "Nothing open on this deal."
              : `${open.length} open${open.some((item) => item.status === "needs_review") ? " (incl. needs review)" : ""} · ${
                  open.filter((item) => item.blockingDecision).length
                } blocking · ${answered.length} resolved`}
          </p>
        </div>
        {!adding ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add gap
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <Field label="What is unresolved" htmlFor="gap-question" hint={error}>
            <Textarea
              id="gap-question"
              rows={2}
              value={question}
              onChange={(event) => {
                setQuestion(event.target.value);
                setError("");
              }}
              placeholder="What has to be true before we commit?"
              className="bg-card"
              aria-invalid={Boolean(error)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Owner" htmlFor="gap-owner" optional>
              <Input
                id="gap-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Who is chasing this?"
                className="bg-card"
              />
            </Field>
            <Field label="Severity" htmlFor="gap-severity">
              <SelectField
                id="gap-severity"
                value={severity}
                onChange={(value) => setSeverity(value as GapSeverity)}
                options={SEVERITY_OPTIONS}
              />
            </Field>
            <Field label="Due date" htmlFor="gap-due" optional>
              <Input
                id="gap-due"
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="bg-card"
              />
            </Field>
            <Field label="Blocks a decision" htmlFor="gap-blocking" hint="Flags this as a gate for IC.">
              <div className="flex h-10 items-center">
                <Button
                  type="button"
                  id="gap-blocking"
                  variant={blocking ? "default" : "outline"}
                  size="sm"
                  aria-pressed={blocking}
                  onClick={() => setBlocking((value) => !value)}
                >
                  {blocking ? "Blocking" : "Not blocking"}
                </Button>
              </div>
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={actions.createGap.isPending}>
              {actions.createGap.isPending ? "Adding…" : "Add gap"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
          No decision gaps recorded. Add the first thing you need to verify.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {[...open, ...answered].map((item) => (
            <li key={item.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-start gap-2.5">
                <CircleHelp
                  className={
                    item.status === "open" || item.status === "needs_review"
                      ? "mt-0.5 h-4 w-4 shrink-0 text-warning"
                      : "mt-0.5 h-4 w-4 shrink-0 text-success"
                  }
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[13px] font-medium leading-snug">{item.question}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Pill tone={SEVERITY_TONE[item.severity]}>{SEVERITY_LABEL[item.severity]}</Pill>
                      {item.blockingDecision ? <Pill tone="danger">Blocking</Pill> : null}
                      <Pill tone={STATUS_TONE[item.status] ?? "neutral"}>{QUESTION_STATUS_LABEL[item.status]}</Pill>
                      {item.origin === "analysis" ? <Pill tone="neutral">AI analysis</Pill> : null}
                      {item.origin === "import" ? <Pill tone="neutral">Imported</Pill> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {item.owner ? `${item.owner} · ` : ""}Raised {formatShortDate(item.createdAt)}
                    {item.dueDate ? ` · due ${formatShortDate(item.dueDate)}` : ""}
                  </p>

                  {item.whyItMatters ? (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Why it matters: </span>
                      {item.whyItMatters}
                    </p>
                  ) : null}
                  {item.evidence ? (
                    <blockquote className="mt-1.5 border-l-2 border-border pl-2 text-[10.5px] leading-relaxed text-muted-foreground">
                      {item.evidence}
                    </blockquote>
                  ) : null}
                  {item.suggestedAction ? (
                    <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground">
                      <span className="font-medium text-foreground">Suggested next action: </span>
                      {item.suggestedAction}
                    </p>
                  ) : null}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <div className="w-[148px]">
                      <SelectField
                        value={item.status === "answered" ? "resolved" : item.status}
                        onChange={(value) => void handleStatus(item, value as QuestionStatus)}
                        options={QUESTION_STATUS_OPTIONS}
                        ariaLabel="Checklist status"
                        className="h-8 text-[11.5px]"
                      />
                    </div>
                    {item.sourceId ? (
                      <Link
                        to={`/inbox#source-${item.sourceId}`}
                        className="text-[10.5px] font-medium text-brand-strong hover:underline"
                      >
                        Source evidence
                      </Link>
                    ) : null}
                  </div>

                  {item.status === "answered" || item.status === "resolved" ? (
                    <div className="mt-2 rounded-md border border-success/20 bg-success-soft/50 px-3 py-2">
                      <p className="text-[12px] leading-relaxed text-foreground/90">
                        {item.answer || "Marked resolved by a human reviewer."}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleReopen(item.id)}
                        className="mt-1 text-[10.5px] font-medium text-muted-foreground underline-offset-2 hover:underline"
                      >
                        Reopen
                      </button>
                    </div>
                  ) : answeringId === item.id ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        rows={2}
                        value={answer}
                        onChange={(event) => setAnswer(event.target.value)}
                        placeholder="What did you learn?"
                        aria-label={`Answer to: ${item.question}`}
                        className="bg-card"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleAnswer(item.id)} disabled={!answer.trim()}>
                          Save answer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setAnsweringId(null);
                            setAnswer("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-1 h-7 px-2 text-[11.5px] text-brand-strong"
                      onClick={() => {
                        setAnsweringId(item.id);
                        setAnswer("");
                      }}
                    >
                      Close the gap
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

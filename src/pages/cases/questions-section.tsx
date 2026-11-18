import { CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { formatShortDate } from "@/lib/format";
import type { CaseQuestion } from "@/lib/types";

export function QuestionsSection({ caseId, items }: { caseId: string; items: CaseQuestion[] }) {
  const actions = useWorkspaceActions();
  const [adding, setAdding] = useState(false);
  const [question, setQuestion] = useState("");
  const [owner, setOwner] = useState("");
  const [error, setError] = useState("");
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");

  const open = items.filter((item) => item.status === "open");
  const answered = items.filter((item) => item.status === "answered");

  const handleAdd = async () => {
    if (!question.trim()) {
      setError("Write the question you need answered.");
      return;
    }
    try {
      await actions.createQuestion.mutateAsync({
        caseId,
        question: question.trim(),
        owner: owner.trim(),
      });
      toast.success("Question added");
      setQuestion("");
      setOwner("");
      setError("");
      setAdding(false);
    } catch {
      toast.error("Could not add this question.");
    }
  };

  const handleAnswer = async (id: string) => {
    if (!answer.trim()) return;
    try {
      await actions.updateQuestion.mutateAsync({
        id,
        patch: { answer: answer.trim(), status: "answered" },
      });
      toast.success("Question answered");
      setAnsweringId(null);
      setAnswer("");
    } catch {
      toast.error("Could not save this answer.");
    }
  };

  const handleReopen = async (id: string) => {
    try {
      await actions.updateQuestion.mutateAsync({ id, patch: { status: "open" } });
    } catch {
      toast.error("Could not reopen this question.");
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="questions-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="questions-heading" className="text-[15px] font-semibold tracking-tight">
            Outstanding questions
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            {open.length === 0 ? "Nothing open on this case." : `${open.length} open · ${answered.length} answered`}
          </p>
        </div>
        {!adding ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add question
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <Field label="Question" htmlFor="question-text" hint={error}>
            <Textarea
              id="question-text"
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Owner" htmlFor="question-owner" optional className="flex-1">
              <Input
                id="question-owner"
                value={owner}
                onChange={(event) => setOwner(event.target.value)}
                placeholder="Who is chasing this?"
                className="bg-card"
              />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={actions.createQuestion.isPending}>
                {actions.createQuestion.isPending ? "Adding…" : "Add question"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
          No questions recorded. Add the first thing you need to verify.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {[...open, ...answered].map((item) => (
            <li key={item.id} className="py-3 first:pt-1 last:pb-0">
              <div className="flex items-start gap-2.5">
                <CircleHelp
                  className={item.status === "open" ? "mt-0.5 h-4 w-4 shrink-0 text-warning" : "mt-0.5 h-4 w-4 shrink-0 text-success"}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-[13px] font-medium leading-snug">{item.question}</p>
                    <Pill tone={item.status === "open" ? "warning" : "success"}>
                      {item.status === "open" ? "Open" : "Answered"}
                    </Pill>
                  </div>
                  <p className="mt-1 text-[10.5px] text-muted-foreground">
                    {item.owner ? `${item.owner} · ` : ""}Raised {formatShortDate(item.createdAt)}
                  </p>

                  {item.status === "answered" ? (
                    <div className="mt-2 rounded-md border border-success/20 bg-success-soft/50 px-3 py-2">
                      <p className="text-[12px] leading-relaxed text-foreground/90">{item.answer || "No answer recorded."}</p>
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
                      Add answer
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

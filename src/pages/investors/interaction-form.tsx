import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, FormGrid } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { INTERACTION_KIND_OPTIONS } from "@/lib/constants";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import type { InteractionKind, InvestmentCase } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InteractionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorId: string;
  cases: InvestmentCase[];
}

export function InteractionForm({ open, onOpenChange, investorId, cases }: InteractionFormProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [kind, setKind] = useState<InteractionKind>("call");
  const [summary, setSummary] = useState("");
  const [occurredAt, setOccurredAt] = useState(toDateInputValue(new Date().toISOString()));
  const [nextStep, setNextStep] = useState("");
  const [nextStepDue, setNextStepDue] = useState("");
  const [caseId, setCaseId] = useState("none");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setKind("call");
    setSummary("");
    setOccurredAt(toDateInputValue(new Date().toISOString()));
    setNextStep("");
    setNextStepDue("");
    setCaseId("none");
    setError("");
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!summary.trim()) {
      setError("Add a short note on what was discussed.");
      return;
    }
    try {
      await actions.createInteraction.mutateAsync({
        investorId,
        caseId: caseId === "none" ? null : caseId,
        kind,
        summary: summary.trim(),
        occurredAt: fromDateInputValue(occurredAt) ?? new Date().toISOString(),
        nextStep: nextStep.trim(),
        nextStepDue: fromDateInputValue(nextStepDue),
      });
      toast.success("Interaction logged");
      onOpenChange(false);
    } catch {
      toast.error("Could not log this interaction.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[90dvh] rounded-t-2xl" : "sm:max-w-[480px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">Log an interaction</SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            What was said, and what happens next. This also updates the relationship's last-contact date.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <FormGrid>
              <Field label="Type" htmlFor="interaction-kind">
                <SelectField
                  id="interaction-kind"
                  value={kind}
                  onChange={(value) => setKind(value as InteractionKind)}
                  options={INTERACTION_KIND_OPTIONS}
                />
              </Field>
              <Field label="Date" htmlFor="interaction-date">
                <Input
                  id="interaction-date"
                  type="date"
                  value={occurredAt}
                  onChange={(event) => setOccurredAt(event.target.value)}
                  className="bg-card"
                />
              </Field>
            </FormGrid>

            <Field label="What was discussed" htmlFor="interaction-summary" hint={error}>
              <Textarea
                id="interaction-summary"
                rows={4}
                value={summary}
                onChange={(event) => {
                  setSummary(event.target.value);
                  setError("");
                }}
                placeholder="Their reaction, what they asked for, what you committed to."
                className="bg-card"
                aria-invalid={Boolean(error)}
              />
            </Field>

            <Field label="Related case" htmlFor="interaction-case" optional>
              <SelectField
                id="interaction-case"
                value={caseId}
                onChange={setCaseId}
                options={[
                  { value: "none", label: "No case attached" },
                  ...cases.map((item) => ({ value: item.id, label: item.companyName })),
                ]}
              />
            </Field>

            <FormGrid>
              <Field label="Next step" htmlFor="interaction-next" optional>
                <Input
                  id="interaction-next"
                  value={nextStep}
                  onChange={(event) => setNextStep(event.target.value)}
                  placeholder="e.g. Send cohort file"
                  className="bg-card"
                />
              </Field>
              <Field label="Due date" htmlFor="interaction-due" optional>
                <Input
                  id="interaction-due"
                  type="date"
                  value={nextStepDue}
                  onChange={(event) => setNextStepDue(event.target.value)}
                  className="bg-card"
                />
              </Field>
            </FormGrid>
          </div>

          <div className="flex justify-end gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="gap-1.5" disabled={actions.createInteraction.isPending}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {actions.createInteraction.isPending ? "Saving…" : "Log interaction"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

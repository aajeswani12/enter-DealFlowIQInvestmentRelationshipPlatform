import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, FormGrid, FormSection } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { CASE_STATUS_OPTIONS, GEOGRAPHIES, ROUND_STAGES, SECTORS } from "@/lib/constants";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import type { Capture, CaseStatus, InvestmentCase } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: InvestmentCase | null;
  capture?: Capture | null;
  onCreated?: (id: string) => void;
}

interface FormState {
  companyName: string;
  oneLiner: string;
  sector: string;
  geography: string;
  roundStage: string;
  status: CaseStatus;
  raiseAmount: string;
  chequeSought: string;
  preMoneyValuation: string;
  ownershipTarget: string;
  leadRequired: boolean;
  leadPartner: string;
  referredBy: string;
  thesis: string;
  nextStep: string;
  nextStepDue: string;
}

const BLANK: FormState = {
  companyName: "",
  oneLiner: "",
  sector: "",
  geography: "",
  roundStage: "",
  status: "sourcing",
  raiseAmount: "",
  chequeSought: "",
  preMoneyValuation: "",
  ownershipTarget: "",
  leadRequired: true,
  leadPartner: "",
  referredBy: "",
  thesis: "",
  nextStep: "",
  nextStepDue: "",
};

const numberOrNull = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

function toState(initial?: InvestmentCase | null, capture?: Capture | null): FormState {
  if (initial) {
    return {
      companyName: initial.companyName,
      oneLiner: initial.oneLiner,
      sector: initial.sector,
      geography: initial.geography,
      roundStage: initial.roundStage,
      status: initial.status,
      raiseAmount: initial.raiseAmount?.toString() ?? "",
      chequeSought: initial.chequeSought?.toString() ?? "",
      preMoneyValuation: initial.preMoneyValuation?.toString() ?? "",
      ownershipTarget: initial.ownershipTarget?.toString() ?? "",
      leadRequired: initial.leadRequired,
      leadPartner: initial.leadPartner,
      referredBy: initial.referredBy,
      thesis: initial.thesis,
      nextStep: initial.nextStep,
      nextStepDue: toDateInputValue(initial.nextStepDue),
    };
  }
  if (capture) {
    return {
      ...BLANK,
      companyName: capture.companyName,
      sector: capture.sector,
      roundStage: capture.roundStage,
      referredBy: capture.referredBy,
      thesis: capture.notes,
      leadPartner: "",
    };
  }
  return BLANK;
}

export function CaseForm({ open, onOpenChange, initial, capture, onCreated }: CaseFormProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [fields, setFields] = useState<FormState>(BLANK);
  const [companyError, setCompanyError] = useState("");
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (open) {
      setFields(toState(initial, capture));
      setCompanyError("");
    }
  }, [open, initial, capture]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fields.companyName.trim()) {
      setCompanyError("A company name is required.");
      return;
    }

    const payload = {
      companyName: fields.companyName.trim(),
      oneLiner: fields.oneLiner.trim(),
      sector: fields.sector,
      geography: fields.geography,
      roundStage: fields.roundStage,
      status: fields.status,
      raiseAmount: numberOrNull(fields.raiseAmount),
      chequeSought: numberOrNull(fields.chequeSought),
      preMoneyValuation: numberOrNull(fields.preMoneyValuation),
      ownershipTarget: numberOrNull(fields.ownershipTarget),
      leadRequired: fields.leadRequired,
      leadPartner: fields.leadPartner.trim(),
      referredBy: fields.referredBy.trim(),
      thesis: fields.thesis.trim(),
      nextStep: fields.nextStep.trim(),
      nextStepDue: fromDateInputValue(fields.nextStepDue),
    };

    try {
      if (initial) {
        await actions.updateCase.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Investment case updated");
      } else {
        const created = await actions.createCase.mutateAsync({
          ...payload,
          captureId: capture?.id ?? null,
        });
        toast.success("Investment case opened");
        onCreated?.(created.id);
      }
      onOpenChange(false);
    } catch {
      toast.error("Could not save this case. Please try again.");
    }
  };

  const pending = actions.createCase.isPending || actions.updateCase.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "sm:max-w-[600px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">
            {isEdit ? "Edit investment case" : "Open an investment case"}
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            {isEdit
              ? "Update the case file. Changes are saved to the workspace immediately."
              : "A persistent case file for diligence, evidence and outstanding questions."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
            <FormSection title="Company">
              <FormGrid>
                <Field label="Company" htmlFor="case-company" hint={companyError} className="sm:col-span-2">
                  <Input
                    id="case-company"
                    value={fields.companyName}
                    onChange={(event) => {
                      set("companyName", event.target.value);
                      setCompanyError("");
                    }}
                    placeholder="e.g. Atura Health"
                    className="bg-card"
                    aria-invalid={Boolean(companyError)}
                  />
                </Field>
                <Field label="One-liner" htmlFor="case-oneliner" optional className="sm:col-span-2">
                  <Input
                    id="case-oneliner"
                    value={fields.oneLiner}
                    onChange={(event) => set("oneLiner", event.target.value)}
                    placeholder="What the company does, in one sentence"
                    className="bg-card"
                  />
                </Field>
                <Field label="Sector" htmlFor="case-sector">
                  <SelectField
                    id="case-sector"
                    value={fields.sector}
                    onChange={(value) => set("sector", value)}
                    options={SECTORS}
                    placeholder="Select sector"
                  />
                </Field>
                <Field label="Geography" htmlFor="case-geography">
                  <SelectField
                    id="case-geography"
                    value={fields.geography}
                    onChange={(value) => set("geography", value)}
                    options={GEOGRAPHIES}
                    placeholder="Select geography"
                  />
                </Field>
                <Field label="Round" htmlFor="case-stage">
                  <SelectField
                    id="case-stage"
                    value={fields.roundStage}
                    onChange={(value) => set("roundStage", value)}
                    options={ROUND_STAGES}
                    placeholder="Select stage"
                  />
                </Field>
                <Field label="Case status" htmlFor="case-status">
                  <SelectField
                    id="case-status"
                    value={fields.status}
                    onChange={(value) => set("status", value as CaseStatus)}
                    options={CASE_STATUS_OPTIONS}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Round mechanics" description="Used by the matching rules to test cheque-size and stage fit.">
              <FormGrid>
                <Field label="Round size (USD)" htmlFor="case-raise" optional>
                  <Input
                    id="case-raise"
                    inputMode="numeric"
                    value={fields.raiseAmount}
                    onChange={(event) => set("raiseAmount", event.target.value)}
                    placeholder="4000000"
                    className="bg-card"
                  />
                </Field>
                <Field label="Cheque sought from a partner" htmlFor="case-cheque" optional hint="The slice you would want this investor to take.">
                  <Input
                    id="case-cheque"
                    inputMode="numeric"
                    value={fields.chequeSought}
                    onChange={(event) => set("chequeSought", event.target.value)}
                    placeholder="2000000"
                    className="bg-card"
                  />
                </Field>
                <Field label="Pre-money valuation (USD)" htmlFor="case-premoney" optional>
                  <Input
                    id="case-premoney"
                    inputMode="numeric"
                    value={fields.preMoneyValuation}
                    onChange={(event) => set("preMoneyValuation", event.target.value)}
                    placeholder="18000000"
                    className="bg-card"
                  />
                </Field>
                <Field label="Ownership target (%)" htmlFor="case-ownership" optional>
                  <Input
                    id="case-ownership"
                    inputMode="decimal"
                    value={fields.ownershipTarget}
                    onChange={(event) => set("ownershipTarget", event.target.value)}
                    placeholder="10"
                    className="bg-card"
                  />
                </Field>
                <Field label="Lead partner" htmlFor="case-lead" optional>
                  <Input
                    id="case-lead"
                    value={fields.leadPartner}
                    onChange={(event) => set("leadPartner", event.target.value)}
                    placeholder="Talok Capital partner"
                    className="bg-card"
                  />
                </Field>
                <Field label="Referred by" htmlFor="case-referral" optional>
                  <Input
                    id="case-referral"
                    value={fields.referredBy}
                    onChange={(event) => set("referredBy", event.target.value)}
                    placeholder="Founder, fund or operator"
                    className="bg-card"
                  />
                </Field>
              </FormGrid>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="space-y-0.5">
                  <p className="text-[13px] font-medium text-foreground">This round needs a lead investor</p>
                  <p className="text-[11px] text-muted-foreground">Feeds the lead-capacity rule in matching.</p>
                </div>
                <Switch
                  checked={fields.leadRequired}
                  onCheckedChange={(checked) => set("leadRequired", checked)}
                  aria-label="This round needs a lead investor"
                />
              </div>
            </FormSection>

            <FormSection title="Investment thesis" description="Your own words. This is not generated.">
              <Field label="Why this deal" htmlFor="case-thesis">
                <Textarea
                  id="case-thesis"
                  rows={4}
                  value={fields.thesis}
                  onChange={(event) => set("thesis", event.target.value)}
                  placeholder="What makes this interesting, and what has to be true?"
                  className="bg-card"
                />
              </Field>
            </FormSection>

            <FormSection title="Next step">
              <FormGrid>
                <Field label="Next action" htmlFor="case-next" optional className="sm:col-span-2">
                  <Input
                    id="case-next"
                    value={fields.nextStep}
                    onChange={(event) => set("nextStep", event.target.value)}
                    placeholder="e.g. Reference calls with two pilot hospitals"
                    className="bg-card"
                  />
                </Field>
                <Field label="Due date" htmlFor="case-due" optional>
                  <Input
                    id="case-due"
                    type="date"
                    value={fields.nextStepDue}
                    onChange={(event) => set("nextStepDue", event.target.value)}
                    className="bg-card"
                  />
                </Field>
              </FormGrid>
            </FormSection>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-1.5">
              {isEdit ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              {pending ? "Saving…" : isEdit ? "Save changes" : "Open case"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

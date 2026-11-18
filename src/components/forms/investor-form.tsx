import { Plus, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ChipGroup, Field, FormGrid, FormSection } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import {
  GEOGRAPHIES,
  INVESTOR_TYPE_OPTIONS,
  RELATIONSHIP_OPTIONS,
  ROUND_STAGES,
  SECTORS,
} from "@/lib/constants";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import type { InvestmentCase, Investor, InvestorType, RelationshipStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InvestorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Investor | null;
  prefill?: { caseItem?: InvestmentCase; firmName?: string; contactName?: string };
}

interface FormState {
  firmName: string;
  contactName: string;
  email: string;
  investorType: InvestorType;
  relationship: RelationshipStatus;
  stages: string[];
  sectors: string[];
  geographies: string[];
  checkMin: string;
  checkMax: string;
  leadsRounds: boolean;
  notes: string;
  nextStep: string;
  nextStepDue: string;
}

const BLANK: FormState = {
  firmName: "",
  contactName: "",
  email: "",
  investorType: "vc",
  relationship: "new",
  stages: [],
  sectors: [],
  geographies: [],
  checkMin: "",
  checkMax: "",
  leadsRounds: false,
  notes: "",
  nextStep: "",
  nextStepDue: "",
};

const numberOrNull = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

export function InvestorForm({ open, onOpenChange, initial, prefill }: InvestorFormProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [fields, setFields] = useState<FormState>(BLANK);
  const [nameError, setNameError] = useState("");
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setFields({
        firmName: initial.firmName,
        contactName: initial.contactName,
        email: initial.email,
        investorType: initial.investorType,
        relationship: initial.relationship,
        stages: initial.stages,
        sectors: initial.sectors,
        geographies: initial.geographies,
        checkMin: initial.checkMin?.toString() ?? "",
        checkMax: initial.checkMax?.toString() ?? "",
        leadsRounds: initial.leadsRounds,
        notes: initial.notes,
        nextStep: initial.nextStep,
        nextStepDue: toDateInputValue(initial.nextStepDue),
      });
    } else {
      setFields({
        ...BLANK,
        firmName: prefill?.firmName ?? "",
        contactName: prefill?.contactName ?? "",
        sectors: prefill?.caseItem?.sector ? [prefill.caseItem.sector] : [],
        geographies: prefill?.caseItem?.geography ? [prefill.caseItem.geography] : [],
        stages: prefill?.caseItem?.roundStage ? [prefill.caseItem.roundStage] : [],
      });
    }
    setNameError("");
  }, [open, initial, prefill]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fields.firmName.trim()) {
      setNameError("Add the investor or firm name.");
      return;
    }

    const payload = {
      firmName: fields.firmName.trim(),
      contactName: fields.contactName.trim(),
      email: fields.email.trim(),
      investorType: fields.investorType,
      stages: fields.stages,
      sectors: fields.sectors,
      geographies: fields.geographies,
      checkMin: numberOrNull(fields.checkMin),
      checkMax: numberOrNull(fields.checkMax),
      leadsRounds: fields.leadsRounds,
      relationship: fields.relationship,
      notes: fields.notes.trim(),
      nextStep: fields.nextStep.trim(),
      nextStepDue: fromDateInputValue(fields.nextStepDue),
    };

    try {
      if (initial) {
        await actions.updateInvestor.mutateAsync({ id: initial.id, patch: payload });
        toast.success("Investor record updated");
      } else {
        await actions.createInvestor.mutateAsync(payload);
        toast.success("Investor added to the network");
      }
      onOpenChange(false);
    } catch {
      toast.error("Could not save this investor. Please try again.");
    }
  };

  const pending = actions.createInvestor.isPending || actions.updateInvestor.isPending;

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
            {isEdit ? "Edit investor record" : "Add an investor"}
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            Preferences are entered by hand and drive the matching rules directly. Nothing is inferred or scraped.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
            <FormSection title="Who they are">
              <FormGrid>
                <Field label="Firm or investor name" htmlFor="investor-firm" hint={nameError} className="sm:col-span-2">
                  <Input
                    id="investor-firm"
                    value={fields.firmName}
                    onChange={(event) => {
                      set("firmName", event.target.value);
                      setNameError("");
                    }}
                    placeholder="e.g. Tanjong Ventures"
                    className="bg-card"
                    aria-invalid={Boolean(nameError)}
                  />
                </Field>
                <Field label="Primary contact" htmlFor="investor-contact" optional>
                  <Input
                    id="investor-contact"
                    value={fields.contactName}
                    onChange={(event) => set("contactName", event.target.value)}
                    placeholder="Full name"
                    className="bg-card"
                  />
                </Field>
                <Field label="Email" htmlFor="investor-email" optional>
                  <Input
                    id="investor-email"
                    type="email"
                    value={fields.email}
                    onChange={(event) => set("email", event.target.value)}
                    placeholder="name@fund.com"
                    className="bg-card"
                  />
                </Field>
                <Field label="Investor type" htmlFor="investor-type">
                  <SelectField
                    id="investor-type"
                    value={fields.investorType}
                    onChange={(value) => set("investorType", value as InvestorType)}
                    options={INVESTOR_TYPE_OPTIONS}
                  />
                </Field>
                <Field label="Relationship" htmlFor="investor-relationship" hint="Used as one matching signal.">
                  <SelectField
                    id="investor-relationship"
                    value={fields.relationship}
                    onChange={(value) => set("relationship", value as RelationshipStatus)}
                    options={RELATIONSHIP_OPTIONS}
                  />
                </Field>
              </FormGrid>
            </FormSection>

            <FormSection title="Investment preferences" description="These fields are the only inputs to matching.">
              <div className="space-y-4">
                <ChipGroup
                  label="Stages"
                  hint="Select all that apply"
                  options={ROUND_STAGES}
                  selected={fields.stages}
                  onChange={(next) => set("stages", next)}
                />
                <ChipGroup
                  label="Sectors"
                  options={SECTORS}
                  selected={fields.sectors}
                  onChange={(next) => set("sectors", next)}
                />
                <ChipGroup
                  label="Geographies"
                  options={GEOGRAPHIES}
                  selected={fields.geographies}
                  onChange={(next) => set("geographies", next)}
                />
                <FormGrid>
                  <Field label="Cheque size — minimum (USD)" htmlFor="investor-min">
                    <Input
                      id="investor-min"
                      inputMode="numeric"
                      value={fields.checkMin}
                      onChange={(event) => set("checkMin", event.target.value)}
                      placeholder="1000000"
                      className="bg-card"
                    />
                  </Field>
                  <Field label="Cheque size — maximum (USD)" htmlFor="investor-max">
                    <Input
                      id="investor-max"
                      inputMode="numeric"
                      value={fields.checkMax}
                      onChange={(event) => set("checkMax", event.target.value)}
                      placeholder="6000000"
                      className="bg-card"
                    />
                  </Field>
                </FormGrid>
                <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5">
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium text-foreground">Willing to lead rounds</p>
                    <p className="text-[11px] text-muted-foreground">Tested against rounds that need a lead.</p>
                  </div>
                  <Switch
                    checked={fields.leadsRounds}
                    onCheckedChange={(checked) => set("leadsRounds", checked)}
                    aria-label="Willing to lead rounds"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Relationship notes">
              <Field label="Notes" htmlFor="investor-notes" optional>
                <Textarea
                  id="investor-notes"
                  rows={3}
                  value={fields.notes}
                  onChange={(event) => set("notes", event.target.value)}
                  placeholder="How you know them, what they care about, what to avoid."
                  className="bg-card"
                />
              </Field>
              <FormGrid>
                <Field label="Next step" htmlFor="investor-next" optional>
                  <Input
                    id="investor-next"
                    value={fields.nextStep}
                    onChange={(event) => set("nextStep", event.target.value)}
                    placeholder="e.g. Share cohort update"
                    className="bg-card"
                  />
                </Field>
                <Field label="Due date" htmlFor="investor-due" optional>
                  <Input
                    id="investor-due"
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
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add investor"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

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
  INVESTOR_STATUS_OPTIONS,
  INVESTOR_TYPE_OPTIONS,
  OUTREACH_PERMISSION_OPTIONS,
  RELATIONSHIP_OPTIONS,
  RELATIONSHIP_STRENGTH_OPTIONS,
  ROUND_STAGES,
  SECTORS,
} from "@/lib/constants";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import type {
  InvestmentCase,
  Investor,
  InvestorStatus,
  InvestorType,
  OutreachPermission,
  RelationshipStatus,
  RelationshipStrength,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface InvestorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Investor | null;
  prefill?: { caseItem?: InvestmentCase };
}

interface FormState {
  name: string;
  investorType: InvestorType;
  status: InvestorStatus;
  relationship: RelationshipStatus;
  thesis: string;
  stages: string[];
  sectors: string[];
  geographies: string[];
  checkMin: string;
  checkMax: string;
  currency: string;
  leadsRounds: boolean;
  notes: string;
  nextStep: string;
  nextStepDue: string;
  contactId: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  relationshipOwner: string;
  relationshipStrength: RelationshipStrength;
  outreachPermissionStatus: OutreachPermission;
}

const BLANK: FormState = {
  name: "",
  investorType: "vc",
  status: "active",
  relationship: "new",
  thesis: "",
  stages: [],
  sectors: [],
  geographies: [],
  checkMin: "",
  checkMax: "",
  currency: "USD",
  leadsRounds: false,
  notes: "",
  nextStep: "",
  nextStepDue: "",
  contactId: "",
  contactName: "",
  contactTitle: "",
  contactEmail: "",
  relationshipOwner: "",
  relationshipStrength: "unknown",
  outreachPermissionStatus: "unknown",
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const contact = primaryContact(initial);
      setFields({
        name: initial.name,
        investorType: initial.investorType,
        status: initial.status,
        relationship: initial.relationship,
        thesis: initial.thesis,
        stages: initial.stages,
        sectors: initial.sectors,
        geographies: initial.geographies,
        checkMin: initial.checkMin?.toString() ?? "",
        checkMax: initial.checkMax?.toString() ?? "",
        currency: initial.currency,
        leadsRounds: initial.leadsRounds,
        notes: initial.notes,
        nextStep: initial.nextStep,
        nextStepDue: toDateInputValue(initial.nextStepDue),
        contactId: contact?.id ?? "",
        contactName: contact?.contactName ?? "",
        contactTitle: contact?.title ?? "",
        contactEmail: contact?.email ?? "",
        relationshipOwner: contact?.relationshipOwner ?? "",
        relationshipStrength: contact?.relationshipStrength ?? "unknown",
        outreachPermissionStatus: contact?.outreachPermissionStatus ?? "unknown",
      });
    } else {
      setFields({
        ...BLANK,
        sectors: prefill?.caseItem?.sector ? [prefill.caseItem.sector] : [],
        geographies: prefill?.caseItem?.geography ? [prefill.caseItem.geography] : [],
        stages: prefill?.caseItem?.roundStage ? [prefill.caseItem.roundStage] : [],
      });
    }
    setErrors({});
    // Reset only on open/target change; background query refreshes must not
    // overwrite fields while the user is typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, prefill?.caseItem?.id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setFields((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fields.name.trim()) nextErrors.name = "Add the investor or firm name.";

    const min = numberOrNull(fields.checkMin);
    const max = numberOrNull(fields.checkMax);
    if (min !== null && max !== null && min > max) nextErrors.checkMax = "Maximum must be at least the minimum.";
    if (fields.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fields.contactEmail.trim())) {
      nextErrors.contactEmail = "Use a valid email address.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const payload = {
      name: fields.name.trim(),
      investorType: fields.investorType,
      thesis: fields.thesis.trim(),
      stages: fields.stages,
      sectors: fields.sectors,
      geographies: fields.geographies,
      checkMin: min,
      checkMax: max,
      currency: (fields.currency || "USD").toUpperCase(),
      status: fields.status,
      leadsRounds: fields.leadsRounds,
      relationship: fields.relationship,
      notes: fields.notes.trim(),
      nextStep: fields.nextStep.trim(),
      nextStepDue: fromDateInputValue(fields.nextStepDue),
    };

    const hasContact =
      Boolean(fields.contactId) ||
      Boolean(fields.contactName.trim()) ||
      Boolean(fields.contactEmail.trim()) ||
      Boolean(fields.contactTitle.trim());

    const contact = hasContact
      ? {
          id: fields.contactId || undefined,
          contactName: fields.contactName.trim(),
          title: fields.contactTitle.trim(),
          email: fields.contactEmail.trim().toLowerCase(),
          relationshipOwner: fields.relationshipOwner.trim(),
          relationshipStrength: fields.relationshipStrength,
          outreachPermissionStatus: fields.outreachPermissionStatus,
          isPrimary: true,
        }
      : null;

    try {
      if (initial) {
        await actions.updateInvestor.mutateAsync({ id: initial.id, patch: payload, contact });
        toast.success("Investor record updated");
      } else {
        await actions.createInvestor.mutateAsync({ ...payload, contact });
        toast.success("Investor added to the network");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this investor.");
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
            Preferences are entered by hand and drive the matching rules directly. Contacts are separate records with
            their own outreach permission.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
            <FormSection title="Investor">
              <FormGrid>
                <Field label="Firm or investor name" htmlFor="investor-name" hint={errors.name} className="sm:col-span-2">
                  <Input
                    id="investor-name"
                    value={fields.name}
                    onChange={(event) => {
                      set("name", event.target.value);
                      setErrors((current) => ({ ...current, name: "" }));
                    }}
                    placeholder="e.g. Blue Harbor Partners"
                    className="bg-card"
                    aria-invalid={Boolean(errors.name)}
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
                <Field label="Status" htmlFor="investor-status">
                  <SelectField
                    id="investor-status"
                    value={fields.status}
                    onChange={(value) => set("status", value as InvestorStatus)}
                    options={INVESTOR_STATUS_OPTIONS}
                  />
                </Field>
                <Field label="Thesis" htmlFor="investor-thesis" optional className="sm:col-span-2">
                  <Textarea
                    id="investor-thesis"
                    rows={3}
                    value={fields.thesis}
                    onChange={(event) => set("thesis", event.target.value)}
                    placeholder="What this investor believes, in their words."
                    className="bg-card"
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
                  label="Geography"
                  options={GEOGRAPHIES}
                  selected={fields.geographies}
                  onChange={(next) => set("geographies", next)}
                />
                <FormGrid>
                  <Field label="Minimum cheque" htmlFor="investor-min">
                    <Input
                      id="investor-min"
                      inputMode="numeric"
                      value={fields.checkMin}
                      onChange={(event) => set("checkMin", event.target.value)}
                      placeholder="1000000"
                      className="bg-card"
                    />
                  </Field>
                  <Field label="Maximum cheque" htmlFor="investor-max" hint={errors.checkMax}>
                    <Input
                      id="investor-max"
                      inputMode="numeric"
                      value={fields.checkMax}
                      onChange={(event) => {
                        set("checkMax", event.target.value);
                        setErrors((current) => ({ ...current, checkMax: "" }));
                      }}
                      placeholder="6000000"
                      className="bg-card"
                      aria-invalid={Boolean(errors.checkMax)}
                    />
                  </Field>
                  <Field label="Currency" htmlFor="investor-currency">
                    <Input
                      id="investor-currency"
                      value={fields.currency}
                      onChange={(event) => set("currency", event.target.value.toUpperCase().slice(0, 3))}
                      placeholder="USD"
                      className="bg-card uppercase"
                    />
                  </Field>
                  <Field label="Relationship rollup" htmlFor="investor-relationship" hint="Used by the relationship rule.">
                    <SelectField
                      id="investor-relationship"
                      value={fields.relationship}
                      onChange={(value) => set("relationship", value as RelationshipStatus)}
                      options={RELATIONSHIP_OPTIONS}
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

            <FormSection
              title="Primary contact"
              description="Optional. Names and emails are never generated for you."
            >
              <FormGrid>
                <Field label="Contact name" htmlFor="contact-name" optional>
                  <Input
                    id="contact-name"
                    value={fields.contactName}
                    onChange={(event) => set("contactName", event.target.value)}
                    placeholder="As recorded"
                    className="bg-card"
                  />
                </Field>
                <Field label="Title" htmlFor="contact-title" optional>
                  <Input
                    id="contact-title"
                    value={fields.contactTitle}
                    onChange={(event) => set("contactTitle", event.target.value)}
                    placeholder="e.g. Partner"
                    className="bg-card"
                  />
                </Field>
                <Field label="Email" htmlFor="contact-email" optional hint={errors.contactEmail}>
                  <Input
                    id="contact-email"
                    type="email"
                    value={fields.contactEmail}
                    onChange={(event) => {
                      set("contactEmail", event.target.value);
                      setErrors((current) => ({ ...current, contactEmail: "" }));
                    }}
                    placeholder="name@fund.com"
                    className="bg-card"
                    aria-invalid={Boolean(errors.contactEmail)}
                  />
                </Field>
                <Field label="Relationship owner" htmlFor="contact-owner" optional hint="Partner who owns the relationship.">
                  <Input
                    id="contact-owner"
                    value={fields.relationshipOwner}
                    onChange={(event) => set("relationshipOwner", event.target.value)}
                    placeholder="e.g. Priya Raman"
                    className="bg-card"
                  />
                </Field>
                <Field label="Relationship strength" htmlFor="contact-strength">
                  <SelectField
                    id="contact-strength"
                    value={fields.relationshipStrength}
                    onChange={(value) => set("relationshipStrength", value as RelationshipStrength)}
                    options={RELATIONSHIP_STRENGTH_OPTIONS}
                  />
                </Field>
                <Field label="Outreach permission" htmlFor="contact-permission">
                  <SelectField
                    id="contact-permission"
                    value={fields.outreachPermissionStatus}
                    onChange={(value) => set("outreachPermissionStatus", value as OutreachPermission)}
                    options={OUTREACH_PERMISSION_OPTIONS}
                  />
                </Field>
              </FormGrid>
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

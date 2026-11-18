import { CircleAlert, Loader2, PenLine, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, FormGrid } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { OUTREACH_CHANNEL_OPTIONS } from "@/lib/constants";
import { fromDateInputValue, toDateInputValue } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import type {
  DealInvestorMatch,
  InvestmentCase,
  Investor,
  Outreach,
  OutreachChannel,
} from "@/lib/types";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import { cn } from "@/lib/utils";

interface OutreachComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseItem: InvestmentCase | null;
  investor: Investor | null;
  match?: DealInvestorMatch | null;
  initial?: Outreach | null;
}

export function OutreachComposer({
  open,
  onOpenChange,
  caseItem,
  investor,
  match,
  initial,
}: OutreachComposerProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const { data } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const { user } = useAuth();
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [contactId, setContactId] = useState("none");
  const [ownerId, setOwnerId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [followup, setFollowup] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [grounding, setGrounding] = useState<string[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [generationStatus, setGenerationStatus] = useState<"manual" | "generated" | "unavailable">("manual");
  const [generationModel, setGenerationModel] = useState("");
  const [generationError, setGenerationError] = useState("");

  const contacts = investor?.contacts ?? [];
  const selectedContact = contacts.find((contact) => contact.id === contactId) ?? null;
  const blocked = selectedContact?.outreachPermissionStatus === "do_not_contact";
  const members = workspace.members.filter((member) => member.status === "active" && member.userId);
  const matchId = initial?.matchId ?? match?.id ?? null;
  const isEdit = Boolean(initial);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setChannel(initial.channel);
      setContactId(initial.contactId ?? "none");
      setOwnerId(initial.ownerUserId ?? user?.id ?? "");
      setSubject(initial.subject);
      setBody(initial.body);
      setFollowup(toDateInputValue(initial.nextFollowupAt));
      setGrounding(initial.grounding ?? []);
      setMissing(initial.missingInformation ?? []);
      setGenerationStatus(initial.generationStatus);
      setGenerationModel(initial.generationModel);
    } else {
      setChannel("email");
      setContactId(investor ? primaryContact(investor)?.id ?? "none" : "none");
      setOwnerId(user?.id ?? "");
      setSubject("");
      setBody("");
      setFollowup("");
      setGrounding([]);
      setMissing([]);
      setGenerationStatus("manual");
      setGenerationModel("");
    }
    setErrors({});
    setGenerationError("");
    // Initialize only when the editor opens or targets a different record; do
    // not reset typed content when the workspace snapshot refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial?.id, investor?.id, user?.id]);

  const generate = async () => {
    if (!matchId) return;
    setGenerationError("");
    try {
      const result = await actions.generateOutreachDraft.mutateAsync(matchId);
      if (!result.configured) {
        setGenerationError(result.reason ?? "Generation is not configured. Write the draft manually.");
        setGrounding(result.grounding ?? []);
        setMissing(result.missingInformation ?? []);
        setGenerationStatus("unavailable");
        return;
      }
      setSubject(result.subject ?? "");
      setBody(result.body ?? "");
      setGrounding(result.grounding ?? []);
      setMissing(result.missingInformation ?? []);
      setGenerationStatus("generated");
      setGenerationModel(result.model ?? "");
      toast.success("Grounded draft generated. Review and edit it before approving.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not generate a draft.";
      setGenerationError(message);
      toast.error(message);
    }
  };

  const handleSave = async () => {
    if (!caseItem || !investor) return;
    const nextErrors: Record<string, string> = {};
    if (!subject.trim()) nextErrors.subject = "Add a subject so the message is easy to find.";
    if (!body.trim()) nextErrors.body = "Write the message before saving.";
    if (blocked) nextErrors.contact = "This contact is marked do-not-contact.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      if (initial) {
        const contentChanged = subject.trim() !== initial.subject || body.trim() !== initial.body;
        await actions.updateOutreachContent.mutateAsync({
          id: initial.id,
          patch: {
            subject: subject.trim(),
            body: body.trim(),
            channel,
            contactId: contactId === "none" ? null : contactId,
            nextFollowupAt: fromDateInputValue(followup),
          },
        });
        if (ownerId && ownerId !== initial.ownerUserId) {
          await actions.assignOutreachOwner.mutateAsync({ id: initial.id, ownerUserId: ownerId });
        }
        toast.success(
          initial.status === "approved" && contentChanged
            ? "Saved. Approval was reset because the draft changed; approve it again before copying."
            : "Outreach saved",
        );
      } else {
        await actions.createOutreach.mutateAsync({
          dealId: caseItem.id,
          investorId: investor.id,
          contactId: contactId === "none" ? null : contactId,
          matchId,
          subject: subject.trim(),
          body: body.trim(),
          channel,
          status: "draft",
          ownerUserId: ownerId || user?.id || null,
          nextFollowupAt: fromDateInputValue(followup),
          generationStatus,
          grounding,
          missingInformation: missing,
          generationModel,
        });
        toast.success("Draft saved. It needs human approval before it can be copied or sent.");
      }
      onOpenChange(false);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not save this outreach.";
      setErrors((current) => ({ ...current, save: message }));
    }
  };

  const pending = actions.createOutreach.isPending || actions.updateOutreachContent.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[94dvh] rounded-t-2xl" : "sm:max-w-[580px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">
            {isEdit ? "Edit outreach" : "Draft outreach"}
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            {investor ? `${investor.name}` : "Investor"} · {caseItem ? caseItem.companyName : "Deal"}. Written or
            generated from stored facts, reviewed by a human, and never sent automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/60 px-3 py-2.5 text-[11px] leading-relaxed text-brand-strong">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              Nothing is emailed from DealFlow IQ. A partner approves the draft, copies it, sends it from their own
              inbox, then records the activity here.
            </p>
          </div>

          {isEdit && initial?.status === "approved" ? (
            <div className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
              This draft is approved. Editing its content resets approval; it must be approved again before copying as
              an approved email.
            </div>
          ) : null}

          {matchId ? (
            <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11.5px] font-semibold">Personalized draft generation</p>
                  <p className="text-[10px] text-muted-foreground">
                    Uses stored deal facts, approved claims, investor preferences and recorded relationship history only.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-[11px]"
                  onClick={() => void generate()}
                  disabled={actions.generateOutreachDraft.isPending}
                >
                  {actions.generateOutreachDraft.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {actions.generateOutreachDraft.isPending ? "Generating…" : "Generate with AI"}
                </Button>
              </div>
              {generationError ? (
                <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-warning">
                  <CircleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {generationError}
                </p>
              ) : null}
              {grounding.length > 0 ? (
                <details className="rounded-md border border-border bg-card px-2.5 py-2">
                  <summary className="cursor-pointer text-[10.5px] font-medium text-muted-foreground">
                    {generationStatus === "generated" ? "Grounded in" : "Available facts"} · {grounding.length}
                  </summary>
                  <ul className="mt-1.5 space-y-1 text-[10px] leading-relaxed text-muted-foreground">
                    {grounding.map((fact) => (
                      <li key={fact}>· {fact}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {missing.length > 0 ? (
                <p className="text-[10px] leading-relaxed text-warning">
                  Kept unknown: {missing.join(" ")}
                </p>
              ) : null}
            </div>
          ) : null}

          <FormGrid>
            <Field label="Contact" htmlFor="outreach-contact" hint={errors.contact}>
              <SelectField
                id="outreach-contact"
                value={contactId}
                onChange={setContactId}
                options={[
                  { value: "none", label: "No specific contact" },
                  ...contacts.map((contact) => ({
                    value: contact.id,
                    label: `${contact.contactName || contact.email || "Unnamed contact"}${
                      contact.outreachPermissionStatus === "do_not_contact" ? " (do not contact)" : ""
                    }`,
                  })),
                ]}
              />
            </Field>
            <Field label="Outreach owner" htmlFor="outreach-owner" hint="Approval is limited to this owner or an admin.">
              <SelectField
                id="outreach-owner"
                value={ownerId}
                onChange={setOwnerId}
                options={members.map((member) => ({
                  value: member.userId as string,
                  label: member.displayName || member.email,
                }))}
                placeholder="Select an owner"
              />
            </Field>
            <Field label="Channel" htmlFor="outreach-channel">
              <SelectField
                id="outreach-channel"
                value={channel}
                onChange={(value) => setChannel(value as OutreachChannel)}
                options={OUTREACH_CHANNEL_OPTIONS}
              />
            </Field>
            <Field label="Next follow-up" htmlFor="outreach-followup" optional>
              <Input
                id="outreach-followup"
                type="date"
                value={followup}
                onChange={(event) => setFollowup(event.target.value)}
                className="bg-card"
              />
            </Field>
          </FormGrid>

          {contacts.length === 0 ? (
            <p className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
              No contact is recorded for this investor. No name or email will be invented. Add a contact on the investor
              record before sending anything.
            </p>
          ) : null}

          {blocked ? (
            <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-destructive">
              This contact is marked do-not-contact. Choose another contact or update the permission on the investor
              record.
            </p>
          ) : null}

          <Field label="Subject" htmlFor="outreach-subject" hint={errors.subject}>
            <Input
              id="outreach-subject"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setErrors((current) => ({ ...current, subject: "" }));
              }}
              placeholder={`${caseItem?.companyName ?? "Deal"} — introduction`}
              className="bg-card"
              aria-invalid={Boolean(errors.subject)}
            />
          </Field>

          <Field label="Message" htmlFor="outreach-body" hint={errors.body ?? "Plain text. Review every fact before approving."}>
            <Textarea
              id="outreach-body"
              rows={12}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setErrors((current) => ({ ...current, body: "" }));
              }}
              placeholder={"Hello,\n\nI am reaching out from Talok Capital about…"}
              className="min-h-[240px] bg-card leading-relaxed"
              aria-invalid={Boolean(errors.body)}
            />
          </Field>

          {errors.save ? (
            <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11px] text-destructive">
              {errors.save}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="hidden text-[10px] text-muted-foreground sm:block">
            {generationStatus === "generated" ? "AI-assisted draft · human approval required" : "Manually authored"}
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 gap-1.5 sm:flex-none"
              onClick={() => void handleSave()}
              disabled={pending || blocked}
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save draft"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

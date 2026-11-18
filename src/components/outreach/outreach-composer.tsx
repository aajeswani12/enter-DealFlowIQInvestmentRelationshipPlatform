import { PenLine, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { OUTREACH_CHANNEL_OPTIONS } from "@/lib/constants";
import type { InvestmentCase, Investor, OutreachChannel } from "@/lib/types";
import { cn } from "@/lib/utils";

interface OutreachComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseItem: InvestmentCase | null;
  investor: Investor | null;
}

export function OutreachComposer({ open, onOpenChange, caseItem, investor }: OutreachComposerProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [channel, setChannel] = useState<OutreachChannel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ subject?: string; body?: string }>({});

  useEffect(() => {
    if (!open) return;
    setChannel("email");
    setSubject("");
    setBody("");
    setErrors({});
  }, [open]);

  const handleSave = async () => {
    if (!caseItem || !investor) return;
    const nextErrors: typeof errors = {};
    if (!subject.trim()) nextErrors.subject = "Add a subject so the message is easy to find.";
    if (!body.trim()) nextErrors.body = "Write the message yourself before saving.";
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await actions.createOutreach.mutateAsync({
        caseId: caseItem.id,
        investorId: investor.id,
        subject: subject.trim(),
        body: body.trim(),
        channel,
        status: "draft",
      });
      toast.success("Draft saved. It still needs human approval before it is sent.");
      onOpenChange(false);
    } catch {
      toast.error("Could not save this draft.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "sm:max-w-[560px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">Draft outreach</SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            {investor ? `${investor.firmName}` : "Investor"} · {caseItem ? caseItem.companyName : "Case"}. Written by you,
            approved by a human, sent from your own inbox.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="flex items-start gap-2 rounded-lg border border-brand/20 bg-brand-soft/60 px-3 py-2.5 text-[11px] leading-relaxed text-brand-strong">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              DealFlow IQ does not send email. Saving creates a draft in the outreach queue; a partner approves it, sends
              it, then records it as sent.
            </p>
          </div>

          <Field label="Channel" htmlFor="outreach-channel">
            <SelectField
              id="outreach-channel"
              value={channel}
              onChange={(value) => setChannel(value as OutreachChannel)}
              options={OUTREACH_CHANNEL_OPTIONS}
            />
          </Field>

          <Field label="Subject" htmlFor="outreach-subject" hint={errors.subject}>
            <Input
              id="outreach-subject"
              value={subject}
              onChange={(event) => {
                setSubject(event.target.value);
                setErrors((current) => ({ ...current, subject: undefined }));
              }}
              placeholder={`${caseItem?.companyName ?? "Company"} — update for ${investor?.contactName ?? "the team"}`}
              className="bg-card"
              aria-invalid={Boolean(errors.subject)}
            />
          </Field>

          <Field label="Message" htmlFor="outreach-body" hint={errors.body ?? "Plain text. Keep it short and specific."}>
            <Textarea
              id="outreach-body"
              rows={12}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setErrors((current) => ({ ...current, body: undefined }));
              }}
              placeholder={"Hi,\n\nSharing an update on…\n\nBest,"}
              className="min-h-[220px] bg-card leading-relaxed"
              aria-invalid={Boolean(errors.body)}
            />
          </Field>

          <p className="text-[10.5px] leading-relaxed text-muted-foreground">
            Facts to reference: {caseItem?.roundStage || "round not set"} round ·{" "}
            {caseItem?.chequeSought ? `cheque sought ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(caseItem.chequeSought)}` : "cheque not set"} ·{" "}
            {caseItem?.geography || "geography not set"}.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="gap-1.5" onClick={handleSave} disabled={actions.createOutreach.isPending}>
            <PenLine className="h-4 w-4" aria-hidden="true" />
            {actions.createOutreach.isPending ? "Saving…" : "Save draft"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

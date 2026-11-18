import { Mic, PenLine, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { VoiceRecorder, type VoiceRecording } from "@/components/forms/voice-recorder";
import { Field, FormGrid } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { ROUND_STAGES, SECTORS } from "@/lib/constants";
import type { CaptureSource } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CaptureFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSource?: CaptureSource;
}

const EMPTY = {
  companyName: "",
  founderName: "",
  founderEmail: "",
  sector: "",
  roundStage: "",
  referredBy: "",
  notes: "",
};

export function CaptureForm({ open, onOpenChange, defaultSource = "voice" }: CaptureFormProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [source, setSource] = useState<CaptureSource>(defaultSource);
  const [fields, setFields] = useState(EMPTY);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setSource(defaultSource);
      setFields(EMPTY);
      setRecording(null);
      setErrors({});
    }
  }, [open, defaultSource]);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!fields.companyName.trim()) nextErrors.companyName = "Add the company name so this can be triaged.";
    if (source === "voice" && !recording) nextErrors.recording = "Record the voice note, or switch to a typed note.";
    if (source === "text" && fields.notes.trim().length < 8) {
      nextErrors.notes = "Add a few lines on what you heard.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    try {
      await actions.createCapture.mutateAsync({
        companyName: fields.companyName.trim(),
        founderName: fields.founderName.trim(),
        founderEmail: fields.founderEmail.trim(),
        sector: fields.sector,
        roundStage: fields.roundStage,
        source,
        notes: fields.notes.trim(),
        durationSeconds: source === "voice" ? recording?.durationSeconds ?? null : null,
        referredBy: fields.referredBy.trim(),
        audioBlob: source === "voice" ? recording?.blob ?? null : null,
      });
      toast.success("Update saved to the Deal Inbox");
      onOpenChange(false);
    } catch {
      toast.error("Could not save this update. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "sm:max-w-[520px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">Capture a deal update</SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            Record what you heard or type it up. Saved to the Deal Inbox for triage — no automated analysis runs on it.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
              {[
                { value: "voice" as CaptureSource, label: "Voice note", icon: Mic },
                { value: "text" as CaptureSource, label: "Typed note", icon: PenLine },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSource(option.value)}
                  aria-pressed={source === option.value}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                    source === option.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {option.label}
                </button>
              ))}
            </div>

            {source === "voice" ? (
              <div className="space-y-1.5">
                <VoiceRecorder
                  onRecorded={(value) => {
                    setRecording(value);
                    setErrors((current) => ({ ...current, recording: "" }));
                  }}
                  onCleared={() => setRecording(null)}
                  disabled={actions.createCapture.isPending}
                />
                {errors.recording ? (
                  <p role="alert" className="text-[11px] font-medium text-destructive">
                    {errors.recording}
                  </p>
                ) : null}
              </div>
            ) : null}

            <FormGrid>
              <Field label="Company" htmlFor="capture-company" hint={errors.companyName} className="sm:col-span-2">
                <Input
                  id="capture-company"
                  value={fields.companyName}
                  onChange={(event) => set("companyName", event.target.value)}
                  placeholder="e.g. Meridian Pay"
                  className="bg-card"
                  aria-invalid={Boolean(errors.companyName)}
                />
              </Field>
              <Field label="Founder" htmlFor="capture-founder" optional>
                <Input
                  id="capture-founder"
                  value={fields.founderName}
                  onChange={(event) => set("founderName", event.target.value)}
                  placeholder="Full name"
                  className="bg-card"
                />
              </Field>
              <Field label="Founder email" htmlFor="capture-email" optional>
                <Input
                  id="capture-email"
                  type="email"
                  value={fields.founderEmail}
                  onChange={(event) => set("founderEmail", event.target.value)}
                  placeholder="name@company.com"
                  className="bg-card"
                />
              </Field>
              <Field label="Sector" htmlFor="capture-sector">
                <SelectField
                  id="capture-sector"
                  value={fields.sector}
                  onChange={(value) => set("sector", value)}
                  options={SECTORS}
                  placeholder="Select sector"
                />
              </Field>
              <Field label="Round" htmlFor="capture-stage">
                <SelectField
                  id="capture-stage"
                  value={fields.roundStage}
                  onChange={(value) => set("roundStage", value)}
                  options={ROUND_STAGES}
                  placeholder="Select stage"
                />
              </Field>
              <Field label="Referred by" htmlFor="capture-referral" optional className="sm:col-span-2">
                <Input
                  id="capture-referral"
                  value={fields.referredBy}
                  onChange={(event) => set("referredBy", event.target.value)}
                  placeholder="Who made the introduction?"
                  className="bg-card"
                />
              </Field>
              <Field
                label={source === "voice" ? "Notes from the conversation" : "Update"}
                htmlFor="capture-notes"
                hint={errors.notes ?? "Write what matters for triage: traction, round, open questions."}
                className="sm:col-span-2"
              >
                <Textarea
                  id="capture-notes"
                  value={fields.notes}
                  onChange={(event) => set("notes", event.target.value)}
                  rows={5}
                  placeholder="Spoke with the founder after the panel…"
                  className="bg-card"
                  aria-invalid={Boolean(errors.notes)}
                />
              </Field>
            </FormGrid>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            <p className="hidden text-[11px] text-muted-foreground sm:block">Stored in your workspace</p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
                Cancel
              </Button>
              <Button type="submit" disabled={actions.createCapture.isPending} className="flex-1 gap-1.5 sm:flex-none">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {actions.createCapture.isPending ? "Saving…" : "Save to inbox"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

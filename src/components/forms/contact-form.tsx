import { Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Field, FormGrid } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { OUTREACH_PERMISSION_OPTIONS, RELATIONSHIP_STRENGTH_OPTIONS } from "@/lib/constants";
import type { InvestorContact, OutreachPermission, RelationshipStrength } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorId: string;
  initial?: InvestorContact | null;
  hasPrimary: boolean;
}

export function ContactForm({ open, onOpenChange, investorId, initial, hasPrimary }: ContactFormProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [contactName, setContactName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [relationshipOwner, setRelationshipOwner] = useState("");
  const [strength, setStrength] = useState<RelationshipStrength>("unknown");
  const [permission, setPermission] = useState<OutreachPermission>("unknown");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setContactName(initial?.contactName ?? "");
    setTitle(initial?.title ?? "");
    setEmail(initial?.email ?? "");
    setRelationshipOwner(initial?.relationshipOwner ?? "");
    setStrength(initial?.relationshipStrength ?? "unknown");
    setPermission(initial?.outreachPermissionStatus ?? "unknown");
    setIsPrimary(initial?.isPrimary ?? !hasPrimary);
    setError("");
  }, [open, initial, hasPrimary]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!contactName.trim() && !email.trim()) {
      setError("Add a name or an email so the contact is identifiable.");
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Use a valid email address.");
      return;
    }

    const payload = {
      id: initial?.id,
      contactName: contactName.trim(),
      title: title.trim(),
      email: email.trim().toLowerCase(),
      relationshipOwner: relationshipOwner.trim(),
      relationshipStrength: strength,
      outreachPermissionStatus: permission,
      isPrimary,
    };

    try {
      if (initial) {
        await actions.updateContact.mutateAsync({ investorId, input: payload });
        toast.success("Contact updated");
      } else {
        await actions.createContact.mutateAsync({ investorId, input: payload });
        toast.success("Contact added");
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this contact.");
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    try {
      await actions.deleteContact.mutateAsync(initial.id);
      toast.success("Contact removed");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this contact.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[88dvh] rounded-t-2xl" : "sm:max-w-[480px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">
            {initial ? "Edit contact" : "Add a contact"}
          </SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            Contacts carry their own relationship strength and outreach permission. Nothing is inferred.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <FormGrid>
              <Field label="Name" htmlFor="contact-form-name">
                <Input
                  id="contact-form-name"
                  value={contactName}
                  onChange={(event) => {
                    setContactName(event.target.value);
                    setError("");
                  }}
                  placeholder="As recorded"
                  className="bg-card"
                />
              </Field>
              <Field label="Title" htmlFor="contact-form-title" optional>
                <Input
                  id="contact-form-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Partner"
                  className="bg-card"
                />
              </Field>
              <Field label="Email" htmlFor="contact-form-email" optional className="sm:col-span-2">
                <Input
                  id="contact-form-email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError("");
                  }}
                  placeholder="name@fund.com"
                  className="bg-card"
                />
              </Field>
              <Field label="Relationship owner" htmlFor="contact-form-owner" optional className="sm:col-span-2">
                <Input
                  id="contact-form-owner"
                  value={relationshipOwner}
                  onChange={(event) => setRelationshipOwner(event.target.value)}
                  placeholder="Partner who owns the relationship"
                  className="bg-card"
                />
              </Field>
              <Field label="Relationship strength" htmlFor="contact-form-strength">
                <SelectField
                  id="contact-form-strength"
                  value={strength}
                  onChange={(value) => setStrength(value as RelationshipStrength)}
                  options={RELATIONSHIP_STRENGTH_OPTIONS}
                />
              </Field>
              <Field label="Outreach permission" htmlFor="contact-form-permission">
                <SelectField
                  id="contact-form-permission"
                  value={permission}
                  onChange={(value) => setPermission(value as OutreachPermission)}
                  options={OUTREACH_PERMISSION_OPTIONS}
                />
              </Field>
            </FormGrid>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-3 py-2.5">
              <div className="space-y-0.5">
                <p className="text-[13px] font-medium">Primary contact</p>
                <p className="text-[11px] text-muted-foreground">Used on list views and outreach drafts.</p>
              </div>
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} aria-label="Primary contact" />
            </div>

            {error ? (
              <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11.5px] text-destructive">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
            {initial ? (
              <Button type="button" variant="ghost" className="gap-1.5 text-muted-foreground" onClick={handleDelete}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="gap-1.5" disabled={actions.createContact.isPending || actions.updateContact.isPending}>
                {initial ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {initial ? "Save contact" : "Add contact"}
              </Button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

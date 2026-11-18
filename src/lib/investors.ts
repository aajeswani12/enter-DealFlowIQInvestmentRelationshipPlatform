import type { Investor, InvestorContact } from "./types";

export function primaryContact(investor: Investor): InvestorContact | null {
  return (
    investor.contacts.find((contact) => contact.isPrimary) ??
    investor.contacts[0] ??
    null
  );
}

export function contactLabel(contact: InvestorContact | null): string {
  if (!contact) return "No contact recorded";
  return contact.contactName || contact.email || "Unnamed contact";
}

export function canContact(contact: InvestorContact | null): boolean {
  return contact?.outreachPermissionStatus !== "do_not_contact";
}

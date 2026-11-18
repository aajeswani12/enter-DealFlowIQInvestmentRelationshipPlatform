import { Check, Mail, Send } from "lucide-react";
import { useState } from "react";
import { OutreachStatusPill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { OUTREACH_CHANNEL_LABEL, OUTREACH_STATUS_LABEL } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import type { InvestmentCase, Investor, Outreach } from "@/lib/types";

interface OutreachQueueProps {
  outreach: Outreach[];
  cases: InvestmentCase[];
  investors: Investor[];
  pending: boolean;
  onApprove: (item: Outreach) => void;
  onRecordSent: (item: Outreach) => void;
}

export function OutreachQueue({ outreach, cases, investors, pending, onApprove, onRecordSent }: OutreachQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (outreach.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
        <p className="text-sm font-semibold">The outreach queue is empty</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
          Draft a message from a match on the left. Nothing is ever sent automatically: a partner approves it, sends it
          from their own inbox, then records it here.
        </p>
      </div>
    );
  }

  const sorted = [...outreach].sort((a, b) => {
    const weight = { draft: 0, approved: 1, sent: 2 } as const;
    return weight[a.status] - weight[b.status] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <ul className="space-y-3">
      {sorted.map((item) => {
        const deal = cases.find((record) => record.id === item.dealId);
        const investor = investors.find((record) => record.id === item.investorId);
        const contact =
          investor?.contacts.find((person) => person.id === item.contactId) ??
          (investor ? primaryContact(investor) : null);
        const expanded = expandedId === item.id;

        return (
          <li key={item.id} className="panel p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[14px] font-semibold tracking-tight">{investor?.name ?? "Investor removed"}</h3>
                  <OutreachStatusPill status={item.status} label={OUTREACH_STATUS_LABEL[item.status]} />
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {deal?.companyName ?? "Deal removed"} · {OUTREACH_CHANNEL_LABEL[item.channel]} ·{" "}
                  {contact?.contactName || contact?.email || "No contact recorded"}
                </p>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                {item.sentAt
                  ? `Sent ${formatShortDate(item.sentAt)}`
                  : item.approvedAt
                    ? `Approved ${formatShortDate(item.approvedAt)}`
                    : `Drafted ${formatShortDate(item.createdAt)}`}
              </p>
            </div>

            <p className="mt-3 text-[13px] font-medium leading-snug">{item.subject}</p>
            <p
              className={
                expanded
                  ? "mt-1 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground"
                  : "mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground"
              }
            >
              {item.body}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Button size="sm" variant="ghost" onClick={() => setExpandedId(expanded ? null : item.id)} aria-expanded={expanded}>
                {expanded ? "Collapse" : "Read full message"}
              </Button>

              {item.status === "draft" ? (
                <Button size="sm" className="gap-1.5" onClick={() => onApprove(item)} disabled={pending}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Approve draft
                </Button>
              ) : null}

              {item.status === "approved" ? (
                <>
                  <Button size="sm" className="gap-1.5" onClick={() => onRecordSent(item)} disabled={pending}>
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                    Record as sent
                  </Button>
                  <span className="text-[10.5px] leading-relaxed text-muted-foreground">
                    Send it from your inbox first, then record it.
                  </span>
                </>
              ) : null}

              {item.status === "sent" ? (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
                  <Mail className="h-3 w-3" aria-hidden="true" />
                  Sent outside DealFlow IQ · recorded by a partner
                </span>
              ) : null}

              {item.nextFollowupAt ? (
                <span className="ml-auto text-[10.5px] text-muted-foreground">
                  Follow-up {formatShortDate(item.nextFollowupAt)}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

import { CalendarClock, Check, Copy, Pencil, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import {
  OUTREACH_CHANNEL_LABEL,
  OUTREACH_EVENT_LABEL,
  OUTREACH_STATUS_LABEL,
} from "@/lib/constants";
import { dueLabel, formatShortDate, fromDateInputValue } from "@/lib/format";
import { primaryContact } from "@/lib/investors";
import type { InvestmentCase, Investor, Outreach, OutreachStatus } from "@/lib/types";
import { EMPTY_WORKSPACE } from "@/lib/workspace";

const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  approved: "brand",
  contacted: "success",
  replied: "brand",
  interested: "success",
  not_interested: "danger",
  follow_up_needed: "warning",
  rejected: "danger",
  sent: "success",
};

const CLOSED = new Set<OutreachStatus>(["not_interested", "rejected"]);

interface OutreachQueueProps {
  outreach: Outreach[];
  cases: InvestmentCase[];
  investors: Investor[];
  onEdit: (item: Outreach) => void;
}

export function OutreachQueue({ outreach, cases, investors, onEdit }: OutreachQueueProps) {
  const { data } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const { user, membership } = useAuth();
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState("replied");
  const [responseNote, setResponseNote] = useState("");
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().slice(0, 10));
  const [followingUpId, setFollowingUpId] = useState<string | null>(null);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNote, setFollowupNote] = useState("");

  const members = workspace.members.filter((member) => member.status === "active" && member.userId);
  const memberLabel = (userId: string | null) => {
    const member = members.find((item) => item.userId === userId);
    return member?.displayName || member?.email || "Unassigned";
  };

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const followupsDue = outreach.filter(
    (item) =>
      item.nextFollowupAt &&
      !CLOSED.has(item.status) &&
      new Date(item.nextFollowupAt).getTime() <= endOfToday.getTime(),
  );

  const sorted = [...outreach].sort((a, b) => {
    const weight: Record<string, number> = {
      draft: 0,
      approved: 1,
      follow_up_needed: 2,
      contacted: 3,
      replied: 4,
      interested: 5,
      sent: 5,
      not_interested: 6,
      rejected: 6,
    };
    return (weight[a.status] ?? 9) - (weight[b.status] ?? 9) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const run = async (task: () => Promise<unknown>, success: string) => {
    try {
      await task();
      toast.success(success);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update this outreach.");
    }
  };

  const copyApproved = async (item: Outreach) => {
    if (item.status !== "approved") {
      toast.error("Only an approved email can be copied as approved.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`Subject: ${item.subject}\n\n${item.body}`);
      toast.success("Approved email copied. Nothing was sent automatically.");
    } catch {
      toast.error("Could not copy to the clipboard. Select and copy the text manually.");
    }
  };

  const recordResponse = async (item: Outreach) => {
    if (!responseNote.trim()) {
      toast.error("Add a short note about the response.");
      return;
    }
    await run(
      () =>
        actions.recordOutreachProgress.mutateAsync({
          id: item.id,
          input: {
            status: responseStatus as "replied" | "interested" | "not_interested",
            note: responseNote.trim(),
            interactionAt: fromDateInputValue(interactionDate),
            nextFollowupAt: item.nextFollowupAt,
            followupNote: item.followupNote,
          },
        }),
      "Response recorded in the relationship timeline",
    );
    setRespondingId(null);
    setResponseNote("");
  };

  const scheduleFollowup = async (item: Outreach) => {
    if (!followupDate) {
      toast.error("Choose a follow-up date.");
      return;
    }
    await run(
      () =>
        actions.recordOutreachProgress.mutateAsync({
          id: item.id,
          input: {
            status: "follow_up_needed",
            note: "",
            interactionAt: null,
            nextFollowupAt: fromDateInputValue(followupDate),
            followupNote: followupNote.trim(),
          },
        }),
      "Manual follow-up scheduled",
    );
    setFollowingUpId(null);
    setFollowupNote("");
  };

  if (outreach.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
        <p className="text-sm font-semibold">The outreach queue is empty</p>
        <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-muted-foreground">
          Draft a message from a match on the previous tab. Nothing is sent automatically: a human approves it, copies it,
          sends it from their own inbox, then records the activity.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {followupsDue.length > 0 ? (
        <section className="rounded-lg border border-warning/30 bg-warning-soft/50 px-3.5 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-warning">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Follow-ups due · {followupsDue.length}
            </p>
            <span className="text-[10.5px] text-warning">From persisted outreach dates</span>
          </div>
          <ul className="mt-2 space-y-1">
            {followupsDue.map((item) => {
              const investor = investors.find((record) => record.id === item.investorId);
              const deal = cases.find((record) => record.id === item.dealId);
              return (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                  <span className="font-medium text-warning">
                    {investor?.name ?? "Investor"} · {deal?.companyName ?? "Deal"}
                  </span>
                  <span className="text-warning">
                    {item.nextFollowupAt ? dueLabel(item.nextFollowupAt) : ""} · {OUTREACH_STATUS_LABEL[item.status]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <ul className="space-y-3">
        {sorted.map((item) => {
          const deal = cases.find((record) => record.id === item.dealId);
          const investor = investors.find((record) => record.id === item.investorId);
          const contact =
            investor?.contacts.find((person) => person.id === item.contactId) ??
            (investor ? primaryContact(investor) : null);
          const expanded = expandedId === item.id;
          const events = workspace.outreachEvents
            .filter((event) => event.outreachId === item.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const isOwner = item.ownerUserId === user?.id || membership?.role === "owner" || membership?.role === "partner";
          const canAct = canWrite && isOwner;
          const due = item.nextFollowupAt && new Date(item.nextFollowupAt).getTime() <= endOfToday.getTime();

          return (
            <li key={item.id} id={`outreach-${item.id}`} className="panel scroll-mt-24 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold tracking-tight">{investor?.name ?? "Investor removed"}</h3>
                    <Pill tone={STATUS_TONE[item.status] ?? "neutral"}>{OUTREACH_STATUS_LABEL[item.status]}</Pill>
                    {due && !CLOSED.has(item.status) ? <Pill tone="warning">Follow-up due</Pill> : null}
                    {item.generationStatus === "generated" ? <Pill tone="brand">AI-assisted draft</Pill> : null}
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {deal?.companyName ?? "Deal removed"} · {OUTREACH_CHANNEL_LABEL[item.channel]} ·{" "}
                    {contact?.contactName || contact?.email || "No contact recorded"} · Owner {memberLabel(item.ownerUserId)}
                  </p>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  {item.sentAt
                    ? `Contacted ${formatShortDate(item.sentAt)}`
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

              {item.rejectionReason ? (
                <p className="mt-2 rounded-md border border-destructive/20 bg-danger-soft px-2.5 py-1.5 text-[10.5px] text-destructive">
                  Rejected: {item.rejectionReason}
                </p>
              ) : null}
              {item.responseSummary ? (
                <p className="mt-2 rounded-md border border-border bg-secondary/30 px-2.5 py-1.5 text-[10.5px] text-muted-foreground">
                  Response ({item.repliedAt ? formatShortDate(item.repliedAt) : "recorded"}): {item.responseSummary}
                </p>
              ) : null}
              {item.missingInformation.length > 0 ? (
                <p className="mt-1.5 text-[10px] leading-relaxed text-warning">
                  Kept unknown: {item.missingInformation.join(" ")}
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setExpandedId(expanded ? null : item.id)}>
                  {expanded ? "Collapse" : "Read full email"}
                </Button>

                {canAct && item.status === "draft" ? (
                  <>
                    <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => void run(() => actions.approveOutreach.mutateAsync(item.id), "Approved by a human")}>
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Approve
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onEdit(item)}>
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => { setRejectingId(item.id); setRejectReason(""); }}>
                      <X className="h-3 w-3" aria-hidden="true" />
                      Reject
                    </Button>
                  </>
                ) : null}

                {canAct && item.status === "approved" ? (
                  <>
                    <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={() => void copyApproved(item)}>
                      <Copy className="h-3 w-3" aria-hidden="true" />
                      Copy approved email
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => onEdit(item)}>
                      <Pencil className="h-3 w-3" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-[11px]"
                      onClick={() => void run(() => actions.recordOutreachProgress.mutateAsync({ id: item.id, input: { status: "contacted", note: "", interactionAt: new Date().toISOString(), nextFollowupAt: item.nextFollowupAt, followupNote: item.followupNote } }), "Marked contacted")}
                    >
                      <Send className="h-3 w-3" aria-hidden="true" />
                      Mark contacted
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setFollowingUpId(item.id); setFollowupDate(""); setFollowupNote(""); }}>
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      Schedule follow-up
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => { setRejectingId(item.id); setRejectReason(""); }}>
                      Reject
                    </Button>
                  </>
                ) : null}

                {canAct && ["contacted", "replied", "interested", "follow_up_needed"].includes(item.status) ? (
                  <>
                    {item.status !== "follow_up_needed" ? (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setRespondingId(item.id); setResponseStatus("replied"); setResponseNote(""); setInteractionDate(new Date().toISOString().slice(0, 10)); }}>
                        Record response
                      </Button>
                    ) : null}
                    {item.status === "follow_up_needed" ? (
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => void run(() => actions.recordOutreachProgress.mutateAsync({ id: item.id, input: { status: "contacted", note: "", interactionAt: new Date().toISOString(), nextFollowupAt: item.nextFollowupAt, followupNote: item.followupNote } }), "Follow-up marked contacted")}>
                        Mark follow-up contacted
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { setFollowingUpId(item.id); setFollowupDate(""); setFollowupNote(""); }}>
                        Schedule follow-up
                      </Button>
                    )}
                  </>
                ) : null}

                {canAct && !CLOSED.has(item.status) ? (
                  <div className="ml-auto w-[150px]">
                    <SelectField
                      value={item.ownerUserId ?? ""}
                      onChange={(value) => void run(() => actions.assignOutreachOwner.mutateAsync({ id: item.id, ownerUserId: value }), "Outreach owner updated")}
                      options={members.map((member) => ({
                        value: member.userId as string,
                        label: member.displayName || member.email,
                      }))}
                      placeholder="Owner"
                      ariaLabel="Assign outreach owner"
                      className="h-7 text-[10.5px]"
                    />
                  </div>
                ) : null}

                {!canAct ? (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Only the outreach owner or an admin can approve or record activity.
                  </span>
                ) : null}
              </div>

              {rejectingId === item.id ? (
                <div className="mt-2 space-y-2 rounded-md border border-destructive/20 bg-danger-soft/50 p-2.5">
                  <Textarea rows={2} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Why is this draft rejected? This is required." className="bg-card text-[12px]" aria-label="Rejection reason" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" className="h-7" disabled={!rejectReason.trim() || actions.rejectOutreach.isPending} onClick={() => void (async () => { await run(() => actions.rejectOutreach.mutateAsync({ id: item.id, reason: rejectReason.trim() }), "Draft rejected"); setRejectingId(null); })()}>
                      Confirm rejection
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setRejectingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}

              {respondingId === item.id ? (
                <div className="mt-2 space-y-2 rounded-md border border-border bg-secondary/30 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <SelectField
                      value={responseStatus}
                      onChange={setResponseStatus}
                      options={[
                        { value: "replied", label: "Replied" },
                        { value: "interested", label: "Interested" },
                        { value: "not_interested", label: "Not interested" },
                      ]}
                      ariaLabel="Response status"
                    />
                    <Input type="date" value={interactionDate} onChange={(event) => setInteractionDate(event.target.value)} className="h-10 bg-card text-[12px]" aria-label="Interaction date" />
                  </div>
                  <Textarea rows={2} value={responseNote} onChange={(event) => setResponseNote(event.target.value)} placeholder="What did the investor say?" className="bg-card text-[12px]" aria-label="Response note" />
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7" onClick={() => void recordResponse(item)} disabled={!responseNote.trim() || actions.recordOutreachProgress.isPending}>Save response</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setRespondingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}

              {followingUpId === item.id ? (
                <div className="mt-2 space-y-2 rounded-md border border-warning/25 bg-warning-soft/40 p-2.5">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input type="date" value={followupDate} onChange={(event) => setFollowupDate(event.target.value)} className="h-10 bg-card text-[12px]" aria-label="Follow-up date" />
                    <Input value={followupNote} onChange={(event) => setFollowupNote(event.target.value)} placeholder="Follow-up task note" className="h-10 bg-card text-[12px]" aria-label="Follow-up note" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7" onClick={() => void scheduleFollowup(item)} disabled={!followupDate || actions.recordOutreachProgress.isPending}>Schedule</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setFollowingUpId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}

              {events.length > 0 ? (
                <details className="mt-2 border-t border-border pt-2">
                  <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">
                    Activity timeline · {events.length}
                  </summary>
                  <ul className="mt-1.5 space-y-1">
                    {events.map((event) => (
                      <li key={event.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[10.5px]">
                        <span className="text-muted-foreground">
                          {OUTREACH_EVENT_LABEL[event.eventType] ?? event.eventType}
                          {event.note ? ` — ${event.note}` : ""}
                        </span>
                        <span className="shrink-0 text-muted-foreground/70">{formatShortDate(event.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

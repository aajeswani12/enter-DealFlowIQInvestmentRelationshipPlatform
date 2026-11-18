import { ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { MEMBER_ROLE_LABEL, MEMBER_ROLE_OPTIONS } from "@/lib/constants";
import { formatShortDate, initials, relativeDays } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { MemberRole, WorkspaceMember } from "@/lib/types";
import { cn } from "@/lib/utils";

const WorkspaceAccess = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const { membership, user, refreshMembership } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("analyst");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");

  const isAdmin = membership?.role === "owner" || membership?.role === "partner";
  const isOwner = membership?.role === "owner";
  const activeMembers = workspace.members.filter((member) => member.status === "active");
  const pending = workspace.members.filter((member) => member.status === "invited");

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setError("Enter a valid work email address.");
      return;
    }
    try {
      await actions.inviteMember.mutateAsync({ email: trimmed, role, displayName });
      toast.success("Invitation added. Access starts when that email signs in.");
      setEmail("");
      setDisplayName("");
      setRole("analyst");
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not invite this member.";
      setError(message);
    }
  };

  const handleRole = async (member: WorkspaceMember, nextRole: MemberRole) => {
    try {
      await actions.updateMember.mutateAsync({ id: member.id, patch: { role: nextRole } });
      toast.success(`${member.email} is now ${MEMBER_ROLE_LABEL[nextRole].toLowerCase()}`);
      if (member.userId === user?.id) await refreshMembership();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change this role.");
    }
  };

  const handleStatus = async (member: WorkspaceMember, status: "active" | "revoked") => {
    try {
      await actions.updateMember.mutateAsync({ id: member.id, patch: { status } });
      toast.success(status === "revoked" ? "Access revoked" : "Access restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update this member.");
    }
  };

  const handleRemove = async (member: WorkspaceMember) => {
    try {
      await actions.removeMember.mutateAsync(member.id);
      toast.success("Invitation removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove this member.");
    }
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Workspace"
        title="Team access"
        description="Investment records are readable only by active members of this workspace. A login on its own grants nothing."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="panel p-5" aria-labelledby="members-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="members-heading" className="text-[15px] font-semibold tracking-tight">
                Members
              </h2>
              <p className="text-[11.5px] text-muted-foreground">
                {activeMembers.length} active · {pending.length} invited
              </p>
            </div>
            <Pill tone="brand" dot>
              {membership ? MEMBER_ROLE_LABEL[membership.role] : "No access"}
            </Pill>
          </div>

          {isLoading ? (
            <LoadingPanel rows={3} className="mt-4 space-y-2" />
          ) : workspace.members.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No memberships yet"
              compact
              description="Reload the workspace to claim ownership as the first account."
              className="mt-4"
            />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {workspace.members.map((member) => {
                const isSelf = member.userId === user?.id;
                return (
                  <li key={member.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-1 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-semibold text-muted-foreground">
                      {initials(member.displayName || member.email)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="truncate text-[13px] font-medium">{member.email}</p>
                        {isSelf ? <Pill tone="neutral">You</Pill> : null}
                        <Pill tone={member.status === "active" ? "success" : member.status === "invited" ? "warning" : "danger"}>
                          {member.status === "active" ? "Active" : member.status === "invited" ? "Invited" : "Revoked"}
                        </Pill>
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {member.displayName || "No display name"} · added {formatShortDate(member.createdAt)}
                      </p>
                    </div>

                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <div className="w-[120px]">
                          <SelectField
                            value={member.role}
                            onChange={(value) => handleRole(member, value as MemberRole)}
                            options={MEMBER_ROLE_OPTIONS}
                            disabled={!isOwner || member.status === "revoked"}
                            ariaLabel={`Role for ${member.email}`}
                            className="h-8 text-[12px]"
                          />
                        </div>
                        {member.status === "revoked" ? (
                          <Button size="sm" variant="outline" className="h-8" onClick={() => handleStatus(member, "active")}>
                            Restore
                          </Button>
                        ) : member.status === "invited" ? (
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => handleRemove(member)}>
                            Remove
                          </Button>
                        ) : isSelf ? null : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-muted-foreground"
                            onClick={() => handleStatus(member, "revoked")}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-4">
          <section className="panel p-5" aria-labelledby="invite-heading">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-brand" aria-hidden="true" />
              <h2 id="invite-heading" className="text-[15px] font-semibold tracking-tight">
                Invite by email
              </h2>
            </div>
            {isAdmin ? (
              <form onSubmit={handleInvite} className="mt-4 space-y-3">
                <Field label="Work email" htmlFor="invite-email" hint={error}>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setError("");
                    }}
                    placeholder="partner@talokcapital.com"
                    className="bg-card"
                    aria-invalid={Boolean(error)}
                  />
                </Field>
                <Field label="Display name" htmlFor="invite-name" optional>
                  <Input
                    id="invite-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Optional"
                    className="bg-card"
                  />
                </Field>
                <Field label="Role" htmlFor="invite-role" hint="Only owners can change a role later.">
                  <SelectField
                    id="invite-role"
                    value={role}
                    onChange={(value) => setRole(value as MemberRole)}
                    options={MEMBER_ROLE_OPTIONS.filter((option) => isOwner || option.value !== "owner")}
                  />
                </Field>
                <Button type="submit" className="w-full gap-1.5" disabled={actions.inviteMember.isPending}>
                  {actions.inviteMember.isPending ? "Adding…" : "Add invitation"}
                </Button>
                <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                  The invited person must sign in with this exact email. Access is applied automatically on their next
                  load; no email is sent by DealFlow IQ.
                </p>
              </form>
            ) : (
              <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                Only owners and partners can invite members. Ask them to add your teammate's email.
              </p>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="audit-heading">
            <h2 id="audit-heading" className="text-[15px] font-semibold tracking-tight">
              Audit trail
            </h2>
            <p className="text-[11.5px] text-muted-foreground">Written by database triggers, not the browser.</p>
            {workspace.audit.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted-foreground">No recorded changes yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {workspace.audit.slice(0, 10).map((event) => (
                  <li key={event.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
                    <p className={cn("text-[11.5px] leading-snug", event.action === "deleted" && "text-destructive")}>
                      {event.summary}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {event.actorEmail ?? "System"} · {relativeDays(event.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceAccess;

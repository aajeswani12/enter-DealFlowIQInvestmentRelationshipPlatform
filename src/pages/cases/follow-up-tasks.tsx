import { CalendarClock, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { dueLabel, formatShortDate, isOverdue } from "@/lib/format";
import type { FollowUpTask } from "@/lib/types";

export function FollowUpTasks({ tasks }: { tasks: FollowUpTask[] }) {
  const actions = useWorkspaceActions();
  const open = tasks.filter((task) => task.status === "open");
  const closed = tasks.filter((task) => task.status !== "open");

  if (tasks.length === 0) return null;

  const setStatus = async (task: FollowUpTask, status: "open" | "done") => {
    try {
      await actions.updateFollowUpTask.mutateAsync({ id: task.id, status });
      toast.success(status === "done" ? "Follow-up marked done" : "Follow-up reopened");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not update this follow-up.");
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="followup-heading">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 id="followup-heading" className="text-[15px] font-semibold tracking-tight">
            Follow-up tasks
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            Persisted actions reconstructed from source documents. Manual completion only.
          </p>
        </div>
        <Pill tone={open.length > 0 ? "warning" : "success"}>{open.length} open</Pill>
      </div>

      <ul className="mt-3 space-y-2">
        {[...open, ...closed].map((task) => (
          <li key={task.id} className="rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className={task.status === "done" ? "text-[12px] font-medium text-muted-foreground line-through" : "text-[12px] font-medium"}>
                    {task.title}
                  </p>
                  {task.status === "done" ? <Pill tone="success">Done</Pill> : null}
                  {task.status === "dismissed" ? <Pill tone="neutral">Dismissed</Pill> : null}
                </div>
                {task.detail ? (
                  <p className="mt-0.5 whitespace-pre-line text-[10.5px] leading-relaxed text-muted-foreground">{task.detail}</p>
                ) : null}
                <p
                  className={
                    task.status === "open" && isOverdue(task.dueDate)
                      ? "mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-destructive"
                      : "mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                  }
                >
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {task.dueDate ? dueLabel(task.dueDate) : `Added ${formatShortDate(task.createdAt)}`}
                </p>
              </div>
              {task.status === "open" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1 text-[10.5px]"
                  onClick={() => void setStatus(task, "done")}
                  disabled={actions.updateFollowUpTask.isPending}
                >
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Done
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 gap-1 text-[10.5px]"
                  onClick={() => void setStatus(task, "open")}
                  disabled={actions.updateFollowUpTask.isPending}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  Reopen
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

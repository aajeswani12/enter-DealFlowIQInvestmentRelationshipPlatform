import { Archive, ArrowUpRight, Briefcase, Inbox, Mic, PenLine, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingPanel } from "@/components/common/loading-panel";
import { CaptureStatusPill } from "@/components/common/status-pill";
import { CaptureForm } from "@/components/forms/capture-form";
import { CaseForm } from "@/components/forms/case-form";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { CAPTURE_STATUS_LABEL, CAPTURE_STATUS_OPTIONS } from "@/lib/constants";
import { formatDuration, relativeDays } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { Capture, CaptureSource, CaptureStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: { value: "all" | CaptureStatus; label: string }[] = [
  { value: "all", label: "All" },
  ...CAPTURE_STATUS_OPTIONS,
];

const DealInbox = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const captureParam = searchParams.get("capture");
  const [formOpen, setFormOpen] = useState(false);
  const [formSource, setFormSource] = useState<CaptureSource>("voice");
  const [filter, setFilter] = useState<"all" | CaptureStatus>("all");
  const [promoteCapture, setPromoteCapture] = useState<Capture | null>(null);

  useEffect(() => {
    if (!captureParam) return;
    setFormSource(captureParam === "text" ? "text" : "voice");
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("capture");
    setSearchParams(next, { replace: true });
  }, [captureParam, searchParams, setSearchParams]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    workspace.captures.forEach((capture) => {
      map.set(capture.status, (map.get(capture.status) ?? 0) + 1);
    });
    return map;
  }, [workspace.captures]);

  const visible = useMemo(() => {
    const list = filter === "all" ? workspace.captures : workspace.captures.filter((item) => item.status === filter);
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [workspace.captures, filter]);

  const openForm = (source: CaptureSource) => {
    setFormSource(source);
    setFormOpen(true);
  };

  const setStatus = async (capture: Capture, status: CaptureStatus) => {
    try {
      await actions.updateCapture.mutateAsync({ id: capture.id, patch: { status } });
      toast.success(`Marked ${CAPTURE_STATUS_LABEL[status].toLowerCase()}`);
    } catch {
      toast.error("Could not update this capture.");
    }
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Intake"
        title="Deal Inbox"
        description="Record what you heard before it disappears. Triage here, then promote the good ones into investment cases."
        actions={
          <>
            <Button className="gap-1.5" onClick={() => openForm("voice")}>
              <Mic className="h-4 w-4" aria-hidden="true" />
              Record update
            </Button>
            <Button variant="outline" className="gap-1.5" onClick={() => openForm("text")}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Typed note
            </Button>
          </>
        }
      />

      <button
        type="button"
        onClick={() => openForm("voice")}
        className="flex w-full items-center gap-4 rounded-xl border border-brand/25 bg-gradient-to-br from-brand-soft via-card to-card p-4 text-left transition-shadow hover:shadow-card lg:hidden"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-sm">
          <Mic className="h-6 w-6" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold">Record a voice update</span>
          <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">
            Capture the takeaway while it is fresh. Audio is stored with the record.
          </span>
        </span>
        <ArrowUpRight className="ml-auto h-4 w-4 shrink-0 text-brand-strong" aria-hidden="true" />
      </button>

      <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((option) => {
          const count = option.value === "all" ? workspace.captures.length : counts.get(option.value) ?? 0;
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
              <span className={cn("ml-1.5 tabular-nums", active ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <LoadingPanel rows={3} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === "all" ? "The inbox is empty" : `No ${FILTERS.find((item) => item.value === filter)?.label.toLowerCase()} captures`}
          description={
            filter === "all"
              ? "Record a voice note after a founder call, or type a quick update. Nothing is analysed automatically."
              : "Try another filter, or add a new capture."
          }
          action={
            <Button size="sm" className="gap-1.5" onClick={() => openForm("voice")}>
              <Mic className="h-3.5 w-3.5" aria-hidden="true" />
              Record update
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map((capture) => (
            <li key={capture.id} className="panel p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold tracking-tight">{capture.companyName}</h2>
                    <CaptureStatusPill status={capture.status} label={CAPTURE_STATUS_LABEL[capture.status]} />
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      {capture.source === "voice" ? (
                        <Mic className="h-3 w-3" aria-hidden="true" />
                      ) : (
                        <PenLine className="h-3 w-3" aria-hidden="true" />
                      )}
                      {capture.source === "voice"
                        ? `Voice${capture.durationSeconds ? ` · ${formatDuration(capture.durationSeconds)}` : ""}`
                        : "Typed"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {[capture.founderName, capture.sector, capture.roundStage, capture.referredBy && `via ${capture.referredBy}`]
                      .filter(Boolean)
                      .join(" · ") || "No founder details recorded"}
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">{relativeDays(capture.createdAt)}</p>
              </div>

              {capture.notes ? (
                <p className="mt-3 whitespace-pre-line text-[13px] leading-relaxed text-foreground/90">{capture.notes}</p>
              ) : (
                <p className="mt-3 text-[12px] italic text-muted-foreground">No typed notes on this capture.</p>
              )}

              {capture.audioUrl ? (
                <div className="mt-3">
                  <audio
                    src={capture.audioUrl}
                    controls
                    className="h-9 w-full max-w-md"
                    aria-label={`Voice note for ${capture.companyName}`}
                  />
                </div>
              ) : capture.source === "voice" ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Mic className="h-3 w-3" aria-hidden="true" />
                  {capture.audioPath
                    ? "Voice note stored · playback link unavailable right now"
                    : "No audio file attached to this voice capture"}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                {capture.status === "new" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus(capture, "reviewing")}
                    disabled={actions.updateCapture.isPending}
                  >
                    Start triage
                  </Button>
                ) : null}

                {capture.dealId ? (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/cases/${capture.dealId}`)}>
                    <Briefcase className="h-3.5 w-3.5" aria-hidden="true" />
                    Open case
                  </Button>
                ) : (
                  <Button size="sm" className="gap-1.5" onClick={() => setPromoteCapture(capture)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Promote to case
                  </Button>
                )}

                {capture.status !== "archived" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setStatus(capture, "archived")}
                    disabled={actions.updateCapture.isPending}
                  >
                    <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                    Archive
                  </Button>
                ) : null}

                <span className="ml-auto text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground/70">
                  {capture.status === "promoted" ? "Case created" : "Manual triage"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CaptureForm open={formOpen} onOpenChange={setFormOpen} defaultSource={formSource} />
      <CaseForm
        open={Boolean(promoteCapture)}
        onOpenChange={(open) => {
          if (!open) setPromoteCapture(null);
        }}
        capture={promoteCapture}
        onCreated={(id) => {
          setPromoteCapture(null);
          navigate(`/cases/${id}`);
        }}
      />
    </div>
  );
};

export default DealInbox;

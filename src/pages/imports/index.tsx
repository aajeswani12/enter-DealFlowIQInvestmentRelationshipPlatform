import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FolderInput,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { ImportFileType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ImportBatchCard } from "./import-batch-card";
import { ImportReview } from "./import-review";
import {
  fetchDemoFile,
  MUSEFLOW_DEMO_FILES,
  MUSEFLOW_FOLLOWUP_FILE,
  MUSEFLOW_PILOT_UPDATE_FILE,
  STORYHARBOR_DEMO_FILES,
} from "./demo";

const MAX_BYTES = 20 * 1024 * 1024;

const FILE_TYPE_LABEL: Record<ImportFileType, string> = {
  csv: "CSV",
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  email: "Email",
};

function fileTypeForName(name: string): ImportFileType | null {
  const extension = name.toLowerCase().split(".").pop() ?? "";
  if (extension === "csv") return "csv";
  if (extension === "pdf") return "pdf";
  if (extension === "docx") return "docx";
  if (extension === "txt" || extension === "md") return "txt";
  if (extension === "eml") return "email";
  return null;
}

interface QueuedLog {
  text: string;
  tone: "info" | "success" | "error";
}

const SESSION_BATCH_KEY = "dealflowiq.import-session-batches";

function readSessionBatches(): string[] {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SESSION_BATCH_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function persistSessionBatches(ids: string[]) {
  try {
    sessionStorage.setItem(SESSION_BATCH_KEY, JSON.stringify(ids));
  } catch {
    // Session storage unavailable; the current-session list resets on reload.
  }
}

const ImportsPage = () => {
  const { data, isLoading: workspaceLoading, isError: workspaceError } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const { membership } = useAuth();
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";
  const [label, setLabel] = useState("Historical deal archive");
  const [synthetic, setSynthetic] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [pasteTitle, setPasteTitle] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [pasteType, setPasteType] = useState<"email" | "txt">("email");
  const [pasteDate, setPasteDate] = useState(new Date().toISOString().slice(0, 10));
  const [processing, setProcessing] = useState(false);
  const [logs, setLogs] = useState<QueuedLog[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sessionBatchIds, setSessionBatchIds] = useState<string[]>(readSessionBatches);
  const [scope, setScope] = useState<"session" | "history">("session");
  const [retryingFileId, setRetryingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reviewRef = useRef<HTMLDivElement>(null);

  const batches = useMemo(
    () => [...workspace.importBatches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [workspace.importBatches],
  );
  const sessionBatchSet = useMemo(() => new Set(sessionBatchIds), [sessionBatchIds]);
  const { sessionBatches, historyBatches } = useMemo(() => {
    const current: typeof batches = [];
    const earlier: typeof batches = [];
    for (const batch of batches) (sessionBatchSet.has(batch.id) ? current : earlier).push(batch);
    return { sessionBatches: current, historyBatches: earlier };
  }, [batches, sessionBatchSet]);

  useEffect(() => {
    if (sessionBatchIds.length > 0 || batches.length === 0) return;
    const newest = batches[0];
    if (!newest) return;
    persistSessionBatches([newest.id]);
    setSessionBatchIds([newest.id]);
  }, [batches, sessionBatchIds.length]);

  const visibleBatches = useMemo(
    () => (scope === "session" ? sessionBatches : historyBatches),
    [scope, sessionBatches, historyBatches],
  );
  const visibleBatchIds = useMemo(() => new Set(visibleBatches.map((batch) => batch.id)), [visibleBatches]);
  const visibleFiles = workspace.importFiles.filter((file) => visibleBatchIds.has(file.batchId));
  const visibleCandidates = workspace.importCandidates.filter((candidate) => visibleBatchIds.has(candidate.batchId));

  const switchScope = (next: "session" | "history") => {
    setScope(next);
    const nextIds = new Set((next === "session" ? sessionBatches : historyBatches).map((batch) => batch.id));
    if (selectedBatchId && !nextIds.has(selectedBatchId)) setSelectedBatchId(null);
  };
  const processingBatches = batches.filter((batch) => batch.status === "processing" || batch.status === "uploading");

  const addFiles = (incoming: File[]) => {
    const accepted: File[] = [];
    for (const file of incoming) {
      const type = fileTypeForName(file.name);
      if (!type) {
        toast.error(`${file.name}: unsupported. Use CSV, PDF, DOCX, TXT or EML.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: larger than 20 MB.`);
        continue;
      }
      accepted.push(file);
    }
    setFiles((current) => [...current, ...accepted].slice(0, 20));
  };

  const log = (text: string, tone: QueuedLog["tone"] = "info") => {
    setLogs((current) => [...current, { text, tone }]);
  };

  const pushFile = async (
    batchId: string,
    file: File,
    fileType: ImportFileType,
    sourceDate?: string,
  ) => {
    log(`Uploading ${file.name} to private storage…`);
    const uploaded = await actions.uploadImportFile.mutateAsync({
      batchId,
      file,
      fileType,
      sourceDate,
    });
    log(`Processing ${file.name} (${FILE_TYPE_LABEL[fileType]})…`);
    const result = await actions.processImportFile.mutateAsync(uploaded.id);
    if (result.status === "failed") {
      log(`${file.name}: ${result.error ?? "processing failed"}`, "error");
    } else if (result.status === "duplicate") {
      log(`${file.name}: duplicate skipped.`, "error");
    } else {
      log(
        `${file.name}: ${result.status} · ${result.records_processed ?? 0} records, ${
          result.records_needing_review ?? 0
        } need review.`,
        "success",
      );
    }
    for (const warning of result.warnings ?? []) log(warning, "error");
  };

  const runBatch = async (
    batchLabel: string,
    batchSynthetic: boolean,
    batchFiles: File[],
    pasted?: { title: string; content: string; type: "email" | "txt"; date: string },
  ) => {
    if (!canWrite) {
      toast.error("You need write access to import records.");
      return;
    }
    setProcessing(true);
    setLogs([]);
    try {
      log(`Creating batch “${batchLabel}”…`);
      const batch = await actions.createImportBatch.mutateAsync({
        label: batchLabel,
        isSynthetic: batchSynthetic,
      });
      setSelectedBatchId(batch.id);
      setScope("session");
      setSessionBatchIds((current) => {
        if (current.includes(batch.id)) return current;
        const next = [batch.id, ...current];
        persistSessionBatches(next);
        return next;
      });

      for (const file of batchFiles) {
        const fileType = fileTypeForName(file.name);
        if (!fileType) {
          log(`${file.name}: unsupported type.`, "error");
          continue;
        }
        try {
          await pushFile(batch.id, file, fileType);
        } catch (caught) {
          log(
            `${file.name}: ${caught instanceof Error ? caught.message : "upload failed"}`,
            "error",
          );
        }
      }

      if (pasted?.content.trim()) {
        try {
          log(`Saving pasted ${pasted.type === "email" ? "email" : "transcript"} “${pasted.title}”…`);
          const record = await actions.createPastedImport.mutateAsync({
            batchId: batch.id,
            title: pasted.title || "pasted-record",
            content: pasted.content,
            fileType: pasted.type,
            sourceDate: pasted.date ? new Date(`${pasted.date}T12:00:00`).toISOString() : undefined,
          });
          const result = await actions.processImportFile.mutateAsync(record.id);
          if (result.status === "failed") {
            log(`${record.fileName}: ${result.error ?? "processing failed"}`, "error");
          } else {
            log(
              `${record.fileName}: ${result.status} · ${result.records_processed ?? 0} records, ${
                result.records_needing_review ?? 0
              } need review.`,
              "success",
            );
          }
        } catch (caught) {
          log(caught instanceof Error ? caught.message : "Pasted record failed.", "error");
        }
      }

      toast.success("Import finished. Review any records marked Needs review.");
      setFiles([]);
      setPasteContent("");
      setPasteTitle("");
      reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not create the import batch.");
    } finally {
      setProcessing(false);
    }
  };

  const startImport = async () => {
    if (files.length === 0 && !pasteContent.trim()) {
      toast.error("Choose at least one file or paste an email/transcript.");
      return;
    }
    await runBatch(label.trim() || "Historical import", synthetic, files, {
      title: pasteTitle.trim() || "Pasted historical record",
      content: pasteContent,
      type: pasteType,
      date: pasteDate,
    });
  };

  const loadDemoPack = async () => {
    setProcessing(true);
    try {
      const loaded: File[] = [];
      for (const definition of MUSEFLOW_DEMO_FILES) loaded.push(await fetchDemoFile(definition));
      setProcessing(false);
      await runBatch("MuseFlow synthetic historical pack", true, loaded);
    } catch (caught) {
      setProcessing(false);
      toast.error(caught instanceof Error ? caught.message : "Could not load the synthetic demo pack.");
    }
  };

  const loadFollowup = async () => {
    setProcessing(true);
    try {
      const loaded = await fetchDemoFile(MUSEFLOW_FOLLOWUP_FILE);
      setProcessing(false);
      await runBatch("MuseFlow follow-up transcript (synthetic)", true, [loaded]);
    } catch (caught) {
      setProcessing(false);
      toast.error(caught instanceof Error ? caught.message : "Could not load the follow-up transcript.");
    }
  };

  const loadPilotClarification = async () => {
    setProcessing(true);
    try {
      const loaded = await fetchDemoFile(MUSEFLOW_PILOT_UPDATE_FILE);
      setProcessing(false);
      await runBatch("MuseFlow pilot clarification transcript (synthetic)", true, [loaded]);
    } catch (caught) {
      setProcessing(false);
      toast.error(caught instanceof Error ? caught.message : "Could not load the pilot clarification transcript.");
    }
  };

  const loadStoryHarborDemo = async () => {
    setProcessing(true);
    try {
      const loaded: File[] = [];
      for (const definition of STORYHARBOR_DEMO_FILES) loaded.push(await fetchDemoFile(definition));
      setProcessing(false);
      await runBatch("StoryHarbor AI synthetic company test", true, loaded);
    } catch (caught) {
      setProcessing(false);
      toast.error(caught instanceof Error ? caught.message : "Could not load the StoryHarbor test files.");
    }
  };

  const selectedBatch = batches.find((batch) => batch.id === selectedBatchId) ?? null;
  const selectedFiles = selectedBatchId
    ? workspace.importFiles.filter((file) => file.batchId === selectedBatchId)
    : [];
  const selectedCandidates = selectedBatchId
    ? workspace.importCandidates.filter((candidate) => candidate.batchId === selectedBatchId)
    : [];
  const selectedDocuments = selectedBatchId
    ? workspace.caseDocuments.filter((document) => document.batchId === selectedBatchId)
    : [];
  const pendingCount = selectedCandidates.filter(
    (candidate) =>
      candidate.status === "needs_review" ||
      (candidate.entityType === "claim" && candidate.status === "pending"),
  ).length;
  const reviewQueueCount = visibleCandidates.filter(
    (candidate) =>
      candidate.status === "needs_review" ||
      (candidate.entityType === "claim" && candidate.status === "pending"),
  ).length;
  const dealsFound = new Set(
    visibleCandidates
      .filter((candidate) => candidate.entityType === "deal" && ["applied", "kept_separate"].includes(candidate.status))
      .map((candidate) => candidate.appliedRecordId ?? candidate.proposedDealId ?? candidate.id),
  ).size;
  const failedFiles = visibleFiles
    .filter((file) => file.processingStatus === "failed" && file.errorMessage)
    .slice(0, 4);

  const scrollToReview = () => {
    reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        title="Import Files"
        description="Bring your deal information together."
        actions={
          <>
            <Button className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={!canWrite || processing}>
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Upload Files
            </Button>
            {selectedBatchId ? (
              <Button variant="outline" className="gap-1.5" onClick={scrollToReview}>
                <FolderInput className="h-4 w-4" aria-hidden="true" />
                Review queue
                {pendingCount > 0 ? (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[14px] font-semibold text-warning">{pendingCount}</span>
                ) : null}
              </Button>
            ) : null}
          </>
        }
      />

      <section className="panel grid gap-4 p-5 sm:grid-cols-3" aria-label="Import summary">
        <div className="flex flex-wrap items-center gap-1 sm:col-span-3">
          <Button
            size="sm"
            variant={scope === "session" ? "default" : "ghost"}
            className="h-8 px-2.5 text-[14px]"
            onClick={() => switchScope("session")}
          >
            This session{sessionBatches.length ? ` · ${sessionBatches.length}` : ""}
          </Button>
          <Button
            size="sm"
            variant={scope === "history" ? "default" : "ghost"}
            className="h-8 px-2.5 text-[14px]"
            onClick={() => switchScope("history")}
          >
            History{historyBatches.length ? ` · ${historyBatches.length}` : ""}
          </Button>
        </div>
        <div>
          <p className="text-[14px] text-muted-foreground">Files imported</p>
          <p className="mt-1 text-[24px] font-semibold tabular-nums">{workspaceLoading ? "…" : workspaceError ? "—" : visibleFiles.length}</p>
        </div>
        <div>
          <p className="text-[14px] text-muted-foreground">Deals found</p>
          <p className="mt-1 text-[24px] font-semibold tabular-nums">{workspaceLoading ? "…" : workspaceError ? "—" : dealsFound}</p>
        </div>
        <div>
          <p className="text-[14px] text-muted-foreground">Records needing review</p>
          <p className="mt-1 text-[24px] font-semibold tabular-nums">{workspaceLoading ? "…" : workspaceError ? "—" : reviewQueueCount}</p>
        </div>
        {failedFiles.length > 0 ? (
          <details className="sm:col-span-3">
            <summary className="cursor-pointer text-[14px] font-medium text-warning">{failedFiles.length} import error{failedFiles.length === 1 ? "" : "s"} to review</summary>
            <ul className="mt-2 space-y-1">
              {failedFiles.map((file) => (
                <li key={file.id} className="text-[14px] leading-[1.5] text-muted-foreground">
                  <span className="font-medium text-foreground">{file.fileName}</span>: {file.errorMessage}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <section className="panel p-4 sm:p-5" aria-labelledby="new-import-heading">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 id="new-import-heading" className="text-[21px] font-semibold tracking-tight">
                New import
              </h2>
              <p className="text-[14px] text-muted-foreground">PDF, DOCX, CSV, TXT, EML or pasted text.</p>
            </div>
            {!canWrite ? <span className="text-[10.5px] text-warning">Read-only access</span> : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
            <Field label="Batch label" htmlFor="import-label">
              <Input id="import-label" value={label} onChange={(event) => setLabel(event.target.value)} maxLength={160} />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={synthetic}
                onChange={(event) => setSynthetic(event.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Synthetic / demo records
            </label>
          </div>

          <div
            className={cn(
              "mt-3 flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
              canWrite ? "border-border bg-secondary/20 hover:border-brand/40" : "border-border/60 bg-secondary/10",
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!canWrite) return;
              addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <UploadCloud className="h-7 w-7 text-brand" aria-hidden="true" />
            <p className="mt-2 text-[16px] font-semibold">Drop files here</p>
            <p className="mt-0.5 text-[14px] text-muted-foreground">Up to 20 MB each. Scanned files and XLSX are unsupported.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".csv,.pdf,.docx,.txt,.eml,text/csv,application/pdf,text/plain,message/rfc822"
              className="sr-only"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
              disabled={!canWrite || processing}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 h-9 text-[16px]"
              disabled={!canWrite || processing}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose files
            </Button>
          </div>

          {files.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                  <span className="truncate text-[11px]">
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground"> · {(file.size / 1024).toFixed(0)} KB</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    className="rounded p-1 text-muted-foreground hover:bg-danger-soft hover:text-destructive"
                    onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-4 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[16px] font-semibold">Paste email or text</p>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_145px]">
              <Input
                value={pasteTitle}
                onChange={(event) => setPasteTitle(event.target.value)}
                placeholder="Title, e.g. MuseFlow investor email"
                className="bg-background text-[12px]"
                aria-label="Pasted record title"
              />
              <SelectField
                value={pasteType}
                onChange={(value) => setPasteType(value as "email" | "txt")}
                options={[
                  { value: "email", label: "Email" },
                  { value: "txt", label: "Transcript / text" },
                ]}
                ariaLabel="Pasted record type"
              />
              <Input
                type="date"
                value={pasteDate}
                onChange={(event) => setPasteDate(event.target.value)}
                className="bg-background text-[12px]"
                aria-label="Pasted record date"
              />
            </div>
            <Textarea
              rows={5}
              value={pasteContent}
              onChange={(event) => setPasteContent(event.target.value)}
              placeholder="Paste email or notes"
              className="mt-2 bg-background text-[12px] leading-relaxed"
              aria-label="Pasted email or transcript"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button onClick={() => void startImport()} disabled={!canWrite || processing} className="gap-1.5">
              {processing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-4 w-4" aria-hidden="true" />}
              {processing ? "Importing…" : "Start import"}
            </Button>
          </div>

          <details className="mt-4 rounded-lg border border-brand/20 bg-brand-soft/40">
            <summary className="cursor-pointer px-3 py-2.5 text-[16px] font-semibold text-brand-strong">Synthetic test data</summary>
            <div className="flex flex-wrap items-start justify-between gap-2 border-t border-brand/15 p-3">
              <div>
                <p className="text-[14px] text-brand-strong/80">Clearly labelled test imports; nothing is linked automatically.</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-9 text-[14px]" disabled={!canWrite || processing} onClick={() => void loadStoryHarborDemo()}>
                  StoryHarbor test files
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-[14px]" disabled={!canWrite || processing} onClick={() => void loadDemoPack()}>
                  MuseFlow pack
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-[14px]" disabled={!canWrite || processing} onClick={() => void loadFollowup()}>
                  ARR follow-up
                </Button>
                <Button size="sm" variant="ghost" className="h-9 text-[14px]" disabled={!canWrite || processing} onClick={() => void loadPilotClarification()}>
                  Pilot clarification
                </Button>
              </div>
            </div>
          </details>

          {logs.length > 0 ? (
            <div className="mt-3 max-h-44 overflow-y-auto rounded-md border border-border bg-secondary/25 p-2.5">
              <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Import log</p>
              <ul className="space-y-1">
                {logs.map((entry, index) => (
                  <li
                    key={`${entry.text}-${index}`}
                    className={cn(
                      "flex items-start gap-1.5 text-[10.5px] leading-relaxed",
                      entry.tone === "error" ? "text-destructive" : entry.tone === "success" ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {entry.tone === "error" ? (
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    ) : entry.tone === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    ) : (
                      <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin" aria-hidden="true" />
                    )}
                    <span className="break-words">{entry.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="space-y-3" aria-labelledby="batches-heading">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 id="batches-heading" className="text-[21px] font-semibold tracking-tight">
                {scope === "session" ? "This session" : "History"}
              </h2>
            </div>
            <span className="text-[14px] text-muted-foreground">{visibleBatches.length} batch{visibleBatches.length === 1 ? "" : "es"}</span>
          </div>

          {visibleBatches.length > 0 ? (
            <div className="space-y-3">
              {visibleBatches.map((batch) => (
                <ImportBatchCard
                  key={batch.id}
                  batch={batch}
                  files={workspace.importFiles.filter((file) => file.batchId === batch.id)}
                  candidates={workspace.importCandidates.filter((candidate) => candidate.batchId === batch.id)}
                  documents={workspace.caseDocuments.filter((document) => document.batchId === batch.id)}
                  cases={workspace.cases}
                  selected={batch.id === selectedBatchId}
                  onSelect={() => setSelectedBatchId(batch.id)}
                  onReview={() => {
                    setSelectedBatchId(batch.id);
                    scrollToReview();
                  }}
                  retryingFileId={retryingFileId}
                  onOpenFile={(file) => {
                    void api.getImportDocumentUrl(file.storagePath).then((url) => {
                      if (!url) {
                        toast.error("The original file is not available in private storage.");
                        return;
                      }
                      window.open(url, "_blank", "noopener,noreferrer");
                    });
                  }}
                  onRetryFile={(fileId) => {
                    setRetryingFileId(fileId);
                    void actions.processImportFile
                      .mutateAsync(fileId)
                      .then((result) => {
                        if (result.status === "failed") {
                          toast.error(result.error ?? "The file still could not be processed.");
                        } else {
                          toast.success("File retried.");
                        }
                      })
                      .catch((caught) => {
                        toast.error(caught instanceof Error ? caught.message : "Could not retry this file.");
                      })
                      .finally(() => setRetryingFileId(null));
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-6 text-center text-[14px] text-muted-foreground">
              {scope === "session"
                ? "No batches in this session yet. Upload files to start one."
                : "No earlier imports."}
            </p>
          )}
        </section>
      </div>

      {selectedBatchId ? (
        <div ref={reviewRef} className="scroll-mt-24">
          <ImportReview
            candidates={selectedCandidates}
            reviews={workspace.importReviews.filter((review) => review.batchId === selectedBatchId)}
            files={selectedFiles}
            batches={workspace.importBatches}
            cases={workspace.cases}
            investors={workspace.investors}
            batchId={selectedBatchId}
            canWrite={canWrite}
            showAll={showAll}
            onShowAllChange={setShowAll}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ImportsPage;

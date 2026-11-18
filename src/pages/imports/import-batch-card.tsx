import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  FileSpreadsheet,
  FileText,
  FileType2,
  ExternalLink,
  ImageOff,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";
import { Pill } from "@/components/common/status-pill";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { formatDate, formatShortDate } from "@/lib/format";
import type {
  CaseDocument,
  ImportBatch,
  ImportCandidate,
  ImportFileRecord,
  InvestmentCase,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_TONE = {
  uploading: "neutral",
  processing: "brand",
  review: "warning",
  completed: "success",
  failed: "danger",
} as const;

const FILE_STATUS_LABEL: Record<string, string> = {
  pending: "Waiting",
  extracting: "Extracting",
  needs_review: "Needs review",
  completed: "Completed",
  failed: "Failed",
  duplicate: "Duplicate",
};

const FILE_STATUS_TONE: Record<string, "neutral" | "brand" | "warning" | "success" | "danger"> = {
  pending: "neutral",
  extracting: "brand",
  needs_review: "warning",
  completed: "success",
  failed: "danger",
  duplicate: "warning",
};

function FileIcon({ type }: { type: string }) {
  if (type === "csv") return <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />;
  if (type === "email" || type === "txt") return <Mail className="h-4 w-4" aria-hidden="true" />;
  if (type === "pdf") return <FileType2 className="h-4 w-4" aria-hidden="true" />;
  return <FileText className="h-4 w-4" aria-hidden="true" />;
}

interface ImportBatchCardProps {
  batch: ImportBatch;
  files: ImportFileRecord[];
  candidates: ImportCandidate[];
  documents: CaseDocument[];
  cases: InvestmentCase[];
  selected: boolean;
  onSelect: () => void;
  onReview: () => void;
  onRetryFile?: (fileId: string) => void;
  onOpenFile?: (file: ImportFileRecord) => void;
  retryingFileId?: string | null;
}

export function ImportBatchCard({
  batch,
  files,
  candidates,
  documents,
  cases,
  selected,
  onSelect,
  onReview,
  onRetryFile,
  onOpenFile,
  retryingFileId,
}: ImportBatchCardProps) {
  const linkedCaseIds = [...new Set(documents.map((document) => document.dealId))];
  const pendingReview = candidates.filter(
    (candidate) =>
      candidate.status === "needs_review" ||
      (candidate.entityType === "claim" && candidate.status === "pending"),
  ).length;
  const reviewCount = pendingReview || batch.recordsNeedingReview;
  const successfullyProcessed = files.filter(
    (file) => file.processingStatus === "completed" || file.processingStatus === "needs_review",
  ).length;
  const companiesIdentified = new Set(
    candidates
      .filter((candidate) => candidate.entityType === "deal")
      .map((candidate) => String(candidate.payload.name ?? "").trim().toLowerCase())
      .filter(Boolean),
  ).size;
  const recordsMatched = candidates.filter(
    (candidate) => candidate.status === "applied" && Boolean(candidate.dealId || candidate.investorId),
  ).length;

  return (
    <article
      className={cn(
        "panel p-4 transition-colors",
        selected ? "border-brand/45 bg-brand-soft/20" : "hover:border-border/80",
      )}
      aria-labelledby={`batch-${batch.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 id={`batch-${batch.id}`} className="truncate text-[13.5px] font-semibold tracking-tight">
              {batch.label}
            </h3>
            <Pill tone={STATUS_TONE[batch.status]}>{batch.status}</Pill>
            {batch.isSynthetic ? <Pill tone="warning">Synthetic demo</Pill> : null}
          </div>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            Job {batch.id.slice(0, 8)} · {formatDate(batch.createdAt)} · {batch.filesProcessed}/{batch.totalFiles} files processed ·{" "}
            {batch.recordsProcessed} records
          </p>
        </div>
        <Button size="sm" variant={selected ? "default" : "ghost"} className="h-7 text-[11px]" onClick={onSelect}>
          {selected ? "Selected" : "View"}
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center sm:grid-cols-6">
        {[
          { label: "Files uploaded", value: files.length },
          { label: "Files processed", value: successfullyProcessed },
          { label: "Companies", value: companiesIdentified },
          { label: "Records matched", value: recordsMatched },
          { label: "Records to review", value: reviewCount },
          { label: "File issues", value: batch.errorCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-md border border-border bg-card px-1.5 py-1.5">
            <p className="text-[14px] font-semibold tabular-nums">{stat.value}</p>
            <p className="text-[8.5px] uppercase tracking-[0.08em] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {files.map((file) => (
          <li key={file.id} className="rounded-md border border-border bg-card px-2.5 py-2">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-secondary text-muted-foreground">
                  <FileIcon type={file.fileType} />
                </span>
                <span className="truncate text-[11px] font-medium">{file.fileName}</span>
                {onOpenFile ? (
                  <button
                    type="button"
                    aria-label={`Open original ${file.fileName}`}
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-brand-strong"
                    onClick={() => onOpenFile(file)}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
              <Pill tone={FILE_STATUS_TONE[file.processingStatus] ?? "neutral"}>
                {FILE_STATUS_LABEL[file.processingStatus] ?? file.processingStatus}
              </Pill>
            </div>
            <p className="mt-1 text-[9.5px] text-muted-foreground">
              {file.recordsProcessed} records · {file.recordsNeedingReview} need review
              {file.pageCount ? ` · ${file.pageCount} pages` : ""}
            </p>
            {file.processingStatus === "failed" && onRetryFile ? (
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-6 gap-1 px-1.5 text-[10px]"
                onClick={() => onRetryFile(file.id)}
                disabled={retryingFileId === file.id}
              >
                {retryingFileId === file.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                )}
                {retryingFileId === file.id ? "Retrying…" : "Retry file"}
              </Button>
            ) : null}
            {file.errorMessage ? (
              <p
                role={file.processingStatus === "failed" ? "alert" : undefined}
                className={cn(
                  "mt-1 flex items-start gap-1 rounded px-1.5 py-1 text-[10px] leading-relaxed",
                  file.processingStatus === "failed"
                    ? "bg-danger-soft text-destructive"
                    : "bg-warning-soft text-warning",
                )}
              >
                {file.processingStatus === "failed" ? (
                  <ImageOff className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                )}
                <span className="break-words">{file.errorMessage}</span>
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      {linkedCaseIds.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">Linked cases:</span>
          {linkedCaseIds.map((id) => {
            const linked = cases.find((item) => item.id === id);
            return linked ? (
              <Link
                key={id}
                to={`/cases/${id}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[10px] font-medium text-brand-strong hover:underline"
              >
                {linked.companyName}
              </Link>
            ) : null;
          })}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <p className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          {batch.status === "failed" ? (
            <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden="true" />
          ) : batch.status === "completed" ? (
            <CheckCircle2 className="h-3 w-3 text-success" aria-hidden="true" />
          ) : batch.status === "processing" ? (
            <Loader2 className="h-3 w-3 animate-spin text-brand" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-3 w-3 text-warning" aria-hidden="true" />
          )}
          Updated {formatShortDate(batch.updatedAt)}
        </p>
        {reviewCount > 0 ? (
          <Button size="sm" className="h-7 gap-1 text-[11px]" onClick={onReview}>
            <Copy className="h-3 w-3" aria-hidden="true" />
            Review {reviewCount}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

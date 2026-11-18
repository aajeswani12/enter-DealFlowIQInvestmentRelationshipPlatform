import { FileText, Mail, MessageSquare, Mic, Paperclip, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { Capture, CaseDocument, ImportBatch, Interaction, Investor } from "@/lib/types";

interface EvidenceTimelineProps {
  documents: CaseDocument[];
  captures: Capture[];
  batches: ImportBatch[];
  interactions: Interaction[];
  investors: Investor[];
}

type Entry =
  | { kind: "capture"; date: string; capture: Capture }
  | { kind: "document"; date: string; document: CaseDocument }
  | { kind: "interaction"; date: string; interaction: Interaction };

export function EvidenceTimeline({ documents, captures, batches, interactions, investors }: EvidenceTimelineProps) {
  const [opening, setOpening] = useState<string | null>(null);
  const entries: Entry[] = [
    ...captures.map((capture) => ({ kind: "capture" as const, date: capture.sourceDate, capture })),
    ...documents.map((document) => ({ kind: "document" as const, date: document.sourceDate, document })),
    ...interactions.map((interaction) => ({ kind: "interaction" as const, date: interaction.occurredAt, interaction })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const openDocument = async (document: CaseDocument) => {
    setOpening(document.id);
    try {
      const url = await api.getImportDocumentUrl(document.storagePath);
      if (!url) {
        toast.error("The original file is no longer available in private storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpening(null);
    }
  };

  if (entries.length === 0) {
    return null;
  }

  return (
    <section className="panel p-5" aria-labelledby="evidence-timeline-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="evidence-timeline-heading" className="text-[15px] font-semibold tracking-tight">
            Evidence timeline
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            Chronological source history. Imported originals remain private and link back to this case.
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">{entries.length} source{entries.length === 1 ? "" : "s"}</span>
      </div>

      <ol className="mt-4 space-y-0">
        {entries.map((entry, index) => {
          const isLast = index === entries.length - 1;
          const batch =
            entry.kind === "document"
              ? batches.find((item) => item.id === entry.document.batchId)
              : null;
          return (
            <li
              key={
                entry.kind === "capture"
                  ? entry.capture.id
                  : entry.kind === "document"
                    ? entry.document.id
                    : entry.interaction.id
              }
              className="relative flex gap-3 pb-4 last:pb-0"
            >
              <div className="flex flex-col items-center">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                  {entry.kind === "capture" ? (
                    entry.capture.source === "voice" ? (
                      <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    )
                  ) : entry.kind === "interaction" ? (
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : entry.document.documentType === "email" ? (
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </span>
                {!isLast ? <span className="mt-1 w-px flex-1 bg-border" aria-hidden="true" /> : null}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[12.5px] font-semibold">
                    {entry.kind === "capture"
                      ? entry.capture.companyName || "Deal update"
                      : entry.kind === "interaction"
                        ? `${investors.find((investor) => investor.id === entry.interaction.investorId)?.name ?? "Investor"} · ${entry.interaction.kind}`
                        : entry.document.title}
                  </p>
                  <span className="text-[10px] text-muted-foreground">{formatDate(entry.date)}</span>
                  {entry.kind === "document" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-soft px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-brand-strong">
                      <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                      Imported {entry.document.documentType}
                    </span>
                  ) : null}
                  {entry.kind === "interaction" ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                      Relationship interaction
                    </span>
                  ) : null}
                  {batch?.isSynthetic ? <span className="text-[9px] uppercase tracking-[0.1em] text-warning">Synthetic</span> : null}
                </div>
                {entry.kind === "capture" ? (
                  <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11.5px] leading-relaxed text-muted-foreground">
                    {entry.capture.notes || entry.capture.originalTranscript || "Captured source note."}
                  </p>
                ) : entry.kind === "interaction" ? (
                  <>
                    <p className="mt-1 whitespace-pre-line text-[11.5px] leading-relaxed text-muted-foreground">
                      {entry.interaction.summary}
                    </p>
                    {entry.interaction.nextStep ? (
                      <p className="mt-1 text-[10px] text-muted-foreground/80">Next: {entry.interaction.nextStep}</p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <p className="mt-1 line-clamp-3 whitespace-pre-line text-[11.5px] leading-relaxed text-muted-foreground">
                      {entry.document.excerpt || entry.document.extractedText.slice(0, 500)}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 gap-1 px-1.5 text-[10px]"
                        onClick={() => void openDocument(entry.document)}
                        disabled={opening === entry.document.id}
                      >
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        {opening === entry.document.id ? "Opening…" : "Open original"}
                      </Button>
                      {batch ? <span className="text-[9.5px] text-muted-foreground">{batch.label}</span> : null}
                    </div>
                  </>
                )}
                {entry.kind === "capture" ? (
                  <Link
                    to={`/inbox#source-${entry.capture.id}`}
                    className="mt-1 inline-block text-[10px] font-medium text-brand-strong hover:underline"
                  >
                    Open source
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

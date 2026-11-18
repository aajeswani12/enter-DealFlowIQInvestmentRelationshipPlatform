import { ExternalLink, FileText, Loader2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { api } from "@/lib/api";
import { EVIDENCE_KIND_LABEL, EVIDENCE_KIND_OPTIONS } from "@/lib/constants";
import { formatShortDate } from "@/lib/format";
import type { Evidence, EvidenceKind } from "@/lib/types";

export function EvidenceSection({ caseId, items }: { caseId: string; items: Evidence[] }) {
  const actions = useWorkspaceActions();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<EvidenceKind>("metric");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);

  const reset = () => {
    setKind("metric");
    setTitle("");
    setDetail("");
    setFile(null);
    setError("");
    setAdding(false);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Give the evidence a short title.");
      return;
    }
    try {
      await actions.createEvidence.mutateAsync({
        caseId,
        kind,
        title: title.trim(),
        detail: detail.trim(),
        file,
      });
      toast.success("Evidence added to the case");
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save this evidence.");
    }
  };

  const handleDelete = async (item: Evidence) => {
    try {
      await actions.deleteEvidence.mutateAsync({ id: item.id, filePath: item.filePath });
      toast.success("Evidence removed");
    } catch {
      toast.error("Could not remove this evidence.");
    }
  };

  const handleOpen = async (item: Evidence) => {
    if (!item.filePath) return;
    setOpeningId(item.id);
    try {
      const url = await api.getEvidenceUrl(item.filePath);
      if (!url) {
        toast.error("This document is no longer available in storage.");
        return;
      }
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <section className="panel p-5" aria-labelledby="evidence-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="evidence-heading" className="text-[15px] font-semibold tracking-tight">
            Evidence
          </h2>
          <p className="text-[11.5px] text-muted-foreground">
            {items.length === 0
              ? "Metrics, documents and call notes you have collected."
              : `${items.length} item${items.length === 1 ? "" : "s"} on file`}
          </p>
        </div>
        {!adding ? (
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add evidence
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-4 space-y-3 rounded-lg border border-border bg-secondary/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <Field label="Type" htmlFor="evidence-kind">
              <SelectField
                id="evidence-kind"
                value={kind}
                onChange={(value) => setKind(value as EvidenceKind)}
                options={EVIDENCE_KIND_OPTIONS}
              />
            </Field>
            <Field label="Title" htmlFor="evidence-title" hint={error}>
              <Input
                id="evidence-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
                placeholder="e.g. Net revenue retention 128%"
                className="bg-card"
                aria-invalid={Boolean(error)}
              />
            </Field>
          </div>
          <Field label="Detail" htmlFor="evidence-detail" optional>
            <Textarea
              id="evidence-detail"
              rows={3}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Source, period, and what it proves."
              className="bg-card"
            />
          </Field>
          <Field
            label="Attach a document"
            htmlFor="evidence-file"
            optional
            hint={file ? `Selected: ${file.name}` : "PDF, deck or spreadsheet, up to 50 MB. Stored in the private evidence library."}
          >
            <div className="flex items-center gap-2">
              <Input
                id="evidence-file"
                type="file"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="bg-card file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-secondary-foreground"
              />
              {file ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
                  Clear
                </Button>
              ) : (
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={actions.createEvidence.isPending}>
              {actions.createEvidence.isPending ? "Saving…" : "Save evidence"}
            </Button>
          </div>
        </div>
      ) : null}

      {items.length === 0 && !adding ? (
        <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-muted-foreground">
          No evidence recorded yet. Add the first data point or document.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="group rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-medium">{item.title}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                        {EVIDENCE_KIND_LABEL[item.kind]}
                      </span>
                    </div>
                    {item.detail ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground/80">
                      <span>{formatShortDate(item.createdAt)}</span>
                      {item.fileName ? (
                        item.filePath ? (
                          <button
                            type="button"
                            onClick={() => handleOpen(item)}
                            className="inline-flex items-center gap-1 font-medium text-brand-strong hover:underline"
                          >
                            {openingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                            ) : (
                              <ExternalLink className="h-3 w-3" aria-hidden="true" />
                            )}
                            {item.fileName}
                          </button>
                        ) : (
                          <span>{item.fileName}</span>
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  aria-label={`Remove evidence: ${item.title}`}
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground/60 transition-colors hover:bg-danger-soft hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

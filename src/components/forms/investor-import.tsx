import { FileUp, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { buildInvestorImport, type ImportRowError, type InvestorImportRow } from "@/lib/csv";
import { cn } from "@/lib/utils";

interface InvestorImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TEMPLATE_HEADERS = "name,investor_type,thesis,sectors,stages,geography,minimum_check,maximum_check,currency,status,notes,contact_name,title,email,relationship_owner,relationship_strength,outreach_permission_status";

export function InvestorImport({ open, onOpenChange }: InvestorImportProps) {
  const isMobile = useIsMobile();
  const actions = useWorkspaceActions();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<InvestorImportRow[]>([]);
  const [errors, setErrors] = useState<ImportRowError[]>([]);
  const [total, setTotal] = useState(0);

  const reset = () => {
    setFileName("");
    setRows([]);
    setErrors([]);
    setTotal(0);
  };

  const handleFile = async (file: File | null) => {
    reset();
    if (!file) return;
    if (file.size > 2_000_000) {
      setErrors([{ row: 0, message: "File is larger than 2 MB. Split it into smaller imports." }]);
      return;
    }
    setFileName(file.name);
    const text = await file.text();
    const parsed = buildInvestorImport(text);
    setRows(parsed.rows);
    setErrors(parsed.errors);
    setTotal(parsed.total);
  };

  const handleImport = async () => {
    if (errors.length > 0 || rows.length === 0) return;
    try {
      const summary = await actions.importInvestors.mutateAsync(rows as unknown as Record<string, unknown>[]);
      toast.success(
        `Imported ${summary.inserted} investor${summary.inserted === 1 ? "" : "s"}` +
          (summary.contacts ? ` and ${summary.contacts} contact${summary.contacts === 1 ? "" : "s"}` : "") +
          (summary.skipped ? ` · ${summary.skipped} skipped as duplicates` : ""),
      );
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import this file.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden border-border bg-background p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "sm:max-w-[640px]",
        )}
      >
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="font-display text-2xl tracking-tight">Import investors from CSV</SheetTitle>
          <SheetDescription className="text-[13px] leading-relaxed">
            Validated in the browser, then inserted through a server-side function. Duplicate investor names are skipped,
            not overwritten.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="label-caps">Required column</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">name</span>. Optional: investor_type, thesis, sectors, stages,
              geography, minimum_check, maximum_check, currency, status, notes, contact_name, title, email,
              relationship_owner, relationship_strength, outreach_permission_status.
            </p>
            <p className="mt-2 text-[10.5px] leading-relaxed text-muted-foreground">
              Separate multiple sectors, stages or geographies with a semicolon, e.g.
              <span className="font-mono text-foreground"> Fintech;Enterprise SaaS</span>. Cheque amounts are plain
              numbers.
            </p>
            <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded bg-card px-2 py-1.5 text-[10px] text-muted-foreground">
              {TEMPLATE_HEADERS}
            </code>
          </div>

          <label
            htmlFor="investor-csv"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center transition-colors hover:border-brand/40"
          >
            <FileUp className="h-5 w-5 text-brand" aria-hidden="true" />
            <span className="text-[13px] font-medium">{fileName || "Choose a CSV file"}</span>
            <span className="text-[11px] text-muted-foreground">Up to 2 MB. Nothing is uploaded until you import.</span>
            <Input
              id="investor-csv"
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </label>

          {fileName ? (
            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
              <span className="rounded-full border border-border bg-card px-2.5 py-0.5 font-medium">{total} data rows</span>
              <span className="rounded-full border border-brand/25 bg-brand-soft px-2.5 py-0.5 font-medium text-brand-strong">
                {rows.length} valid
              </span>
              {errors.length > 0 ? (
                <span className="rounded-full border border-destructive/20 bg-danger-soft px-2.5 py-0.5 font-medium text-destructive">
                  {errors.length} error{errors.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          ) : null}

          {errors.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-danger-soft/60 px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-destructive">
                <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                Fix these rows before importing
              </p>
              <ul className="mt-2 space-y-1">
                {errors.slice(0, 8).map((error, index) => (
                  <li key={`${error.row}-${index}`} className="text-[11px] leading-relaxed text-destructive">
                    Row {error.row || "—"}: {error.message}
                  </li>
                ))}
                {errors.length > 8 ? (
                  <li className="text-[11px] text-destructive">…and {errors.length - 8} more.</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left">
                <caption className="sr-only">Validated investor rows</caption>
                <thead className="bg-secondary/50">
                  <tr>
                    {["Name", "Type", "Stages", "Cheque", "Contact"].map((heading) => (
                      <th key={heading} scope="col" className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 6).map((row) => (
                    <tr key={row.name} className="border-t border-border/70">
                      <td className="max-w-[160px] truncate px-3 py-2 text-[11.5px] font-medium">{row.name}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{row.investor_type}</td>
                      <td className="max-w-[130px] truncate px-3 py-2 text-[11px] text-muted-foreground">
                        {row.stages.join(", ") || "—"}
                      </td>
                      <td className="px-3 py-2 text-[11px] tabular-nums text-muted-foreground">
                        {row.minimum_check ?? "—"} – {row.maximum_check ?? "—"}
                      </td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-[11px] text-muted-foreground">
                        {row.contact_name || row.email || "None"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 6 ? (
                <p className="border-t border-border px-3 py-2 text-[10.5px] text-muted-foreground">
                  Showing 6 of {rows.length} rows.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-card px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-[10.5px] text-muted-foreground">Validated rows only</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || errors.length > 0 || actions.importInvestors.isPending}
            >
              {actions.importInvestors.isPending ? "Importing…" : `Import ${rows.length || ""} investors`}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

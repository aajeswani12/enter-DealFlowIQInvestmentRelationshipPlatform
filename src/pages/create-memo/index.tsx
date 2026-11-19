import { ArrowLeft, ArrowRight, Check, FileText, Loader2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { LoadingPanel } from "@/components/common/loading-panel";
import { Pill } from "@/components/common/status-pill";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useWorkspace } from "@/hooks/use-workspace";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type { InvestmentCase, MemoFocus, MemoTemplate, MemoTemplateKind } from "@/lib/types";
import { MemoWorkspace } from "@/pages/cases/memo-workspace";

const STEPS = [
  { id: 1, label: "Choose Deal" },
  { id: 2, label: "Memo Type" },
  { id: 3, label: "Generate Draft" },
  { id: 4, label: "Review & Approve" },
];

const MEMO_TYPES: { id: MemoTemplateKind; label: string; description: string }[] = [
  { id: "internal", label: "Internal Memo", description: "For the team; includes internal review context." },
  { id: "external", label: "External Brief", description: "Authorized sharing only; internal commentary excluded by default." },
  { id: "custom", label: "Custom Template", description: "Reuse an approved precedent's structure, not its facts." },
];

const FOCUS: { id: MemoFocus; label: string }[] = [
  { id: "team", label: "Team" },
  { id: "market", label: "Market" },
  { id: "traction", label: "Traction" },
  { id: "investment_thesis", label: "Investment thesis" },
  { id: "risks", label: "Risks and questions" },
];

const CreateMemo = () => {
  const { data, isLoading } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const actions = useWorkspaceActions();
  const { membership } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDeal = searchParams.get("deal") ?? "";
  const [step, setStep] = useState(1);
  const [dealId, setDealId] = useState(initialDeal);
  const [memoType, setMemoType] = useState<MemoTemplateKind>("internal");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [focusAreas, setFocusAreas] = useState<MemoFocus[]>([]);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateDraft, setTemplateDraft] = useState<MemoTemplate | null>(null);
  const [headings, setHeadings] = useState("");
  const [styleNotes, setStyleNotes] = useState("");
  const [lengthGuidance, setLengthGuidance] = useState("");
  const [templateError, setTemplateError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [memoRequestId, setMemoRequestId] = useState(() => crypto.randomUUID());

  const deals = useMemo(
    () => [...workspace.cases].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [workspace.cases],
  );
  const selectedDeal = deals.find((deal) => deal.id === dealId) ?? null;
  const templates = workspace.memoTemplates;
  const canWrite = membership?.role === "owner" || membership?.role === "partner" || membership?.role === "analyst";

  const chooseDeal = (deal: InvestmentCase) => {
    setDealId(deal.id);
    setMemoRequestId(crypto.randomUUID());
    const next = new URLSearchParams(searchParams);
    next.set("deal", deal.id);
    setSearchParams(next, { replace: true });
  };

  const toggleFocus = (focus: MemoFocus) => {
    setFocusAreas((current) => (current.includes(focus) ? current.filter((item) => item !== focus) : [...current, focus]));
    setMemoRequestId(crypto.randomUUID());
  };

  const continueTo = (next: number) => {
    setError("");
    if (next > 1 && !selectedDeal) {
      setError("Choose a deal first.");
      return;
    }
    if (next > 2 && memoType === "custom" && !templateId) {
      setError("Choose or save a custom template first.");
      return;
    }
    setStep(next);
  };

  const extractTemplate = async () => {
    if (!templateFile) {
      setTemplateError("Choose a supported precedent file.");
      return;
    }
    setBusy(true);
    setTemplateError("");
    try {
      const template = await actions.uploadMemoTemplate.mutateAsync({
        name: templateName.trim() || templateFile.name,
        file: templateFile,
      });
      setTemplateDraft(template);
      setHeadings(template.headings.join("\n"));
      setStyleNotes(template.styleNotes);
      setLengthGuidance(template.lengthGuidance);
    } catch (caught) {
      setTemplateError(caught instanceof Error ? caught.message : "Precedent extraction failed. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateDraft) return;
    setBusy(true);
    setTemplateError("");
    try {
      await actions.updateMemoTemplate.mutateAsync({
        id: templateDraft.id,
        name: templateDraft.name,
        headings: headings.split("\n").map((item) => item.trim()).filter(Boolean),
        styleNotes,
        lengthGuidance,
        status: "active",
      });
      setMemoType("custom");
      setTemplateId(templateDraft.id);
      setMemoRequestId(crypto.randomUUID());
      setNotice("Custom template saved. Only structure and style are reused.");
    } catch (caught) {
      setTemplateError(caught instanceof Error ? caught.message : "Could not save this template.");
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!selectedDeal) return;
    if (memoType === "custom" && !templateId) {
      setError("Choose or save a custom template first.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await actions.generateCaseMemo.mutateAsync({
        dealId: selectedDeal.id,
        requestId: memoRequestId,
        proposalIds: workspace.factProposals
          .filter((proposal) => proposal.dealId === selectedDeal.id && proposal.status === "accepted")
          .map((proposal) => proposal.id),
        templateKind: memoType,
        templateId,
        focusAreas,
      });
      if (result.status !== "created" || !result.memo) {
        setError(result.error ?? "The draft was not created.");
        return;
      }
      setNotice("Draft created. Review the editor and sources before approval.");
      setMemoRequestId(crypto.randomUUID());
      setStep(4);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The draft was not created.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-7">
      <PageHeader
        title="Create Memo"
        description="Build a source-linked draft from information already on file."
        backTo={{ to: "/", label: "Home" }}
      />

      <ol className="grid gap-2 sm:grid-cols-4" aria-label="Memo creation steps">
        {STEPS.map((item) => (
          <li key={item.id} className={`rounded-lg border px-4 py-3 ${step === item.id ? "border-brand/40 bg-brand-soft/50" : "border-border bg-card"}`}>
            <span className="flex items-center gap-2 text-[14px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {step > item.id ? <Check className="h-4 w-4 text-brand" aria-hidden="true" /> : <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[12px]">{item.id}</span>}
              {item.label}
            </span>
          </li>
        ))}
      </ol>

      {isLoading ? <LoadingPanel rows={4} /> : null}

      {!isLoading && step === 1 ? (
        <section className="panel p-6 sm:p-8" aria-labelledby="choose-deal-heading">
          <h2 id="choose-deal-heading" className="text-[21px] font-semibold tracking-tight">Choose a deal</h2>
          <p className="mt-1 text-[17px] text-muted-foreground">Use an existing deal folder, or bring documents in through Import Files first.</p>
          {deals.length === 0 ? (
            <div className="mt-5">
              <Button asChild className="text-[16px]"><Link to="/imports">Import Files</Link></Button>
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-border">
              {deals.map((deal) => (
                <li key={deal.id}>
                  <button type="button" onClick={() => chooseDeal(deal)} className={`flex w-full items-center justify-between gap-4 py-4 text-left ${selectedDeal?.id === deal.id ? "text-brand-strong" : ""}`}>
                    <span>
                      <span className="block text-[18px] font-medium">{deal.companyName}</span>
                      <span className="mt-0.5 block text-[14px] text-muted-foreground">{deal.roundStage || "Unknown stage"} · {deal.sector || "Unknown sector"}</span>
                    </span>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${selectedDeal?.id === deal.id ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}>
                      {selectedDeal?.id === deal.id ? <Check className="h-4 w-4" aria-hidden="true" /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button asChild variant="outline" className="text-[16px]"><Link to="/imports">Import Files</Link></Button>
            <Button className="text-[16px]" onClick={() => continueTo(2)} disabled={!selectedDeal}>Continue <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </section>
      ) : null}

      {!isLoading && step === 2 ? (
        <section className="panel p-6 sm:p-8" aria-labelledby="memo-type-heading">
          <h2 id="memo-type-heading" className="text-[21px] font-semibold tracking-tight">Choose memo type</h2>
          <p className="mt-1 text-[17px] text-muted-foreground">The type controls disclosure and the sections the draft follows.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {MEMO_TYPES.map((type) => (
              <button key={type.id} type="button" onClick={() => { setMemoType(type.id); setTemplateId(type.id === "custom" ? templateId : null); setMemoRequestId(crypto.randomUUID()); }} className={`rounded-lg border p-4 text-left ${memoType === type.id ? "border-brand/40 bg-brand-soft/40" : "border-border bg-card"}`}>
                <span className="flex items-center justify-between gap-2 text-[17px] font-semibold">{type.label}{memoType === type.id ? <Check className="h-4 w-4 text-brand" aria-hidden="true" /> : null}</span>
                <span className="mt-1 block text-[14px] leading-[1.5] text-muted-foreground">{type.description}</span>
              </button>
            ))}
          </div>

          {memoType === "external" ? (
            <p className="mt-4 rounded-md border border-warning/25 bg-warning-soft/30 px-3 py-2 text-[14px] leading-[1.5] text-warning">
              External drafts exclude internal commentary, opinions and gaps from generation. Final export still needs separate authorization.
            </p>
          ) : null}

          {memoType === "custom" ? (
            <div className="mt-5 rounded-lg border border-border p-4">
              <p className="text-[17px] font-medium">Precedent template</p>
              <p className="mt-1 text-[14px] text-muted-foreground">Structure and style only. Precedent company facts and narrative are never carried into a new deal.</p>
              {templates.length > 0 ? (
                <select value={templateId ?? ""} onChange={(event) => { setTemplateId(event.target.value || null); setMemoRequestId(crypto.randomUUID()); }} className="mt-3 h-10 w-full rounded-md border border-input bg-card px-3 text-[16px]">
                  <option value="">Choose a saved template</option>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              ) : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
                <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className="h-10 bg-card text-[16px]" />
                <Input type="file" accept=".pdf,.docx,.txt,.eml,.csv" onChange={(event) => setTemplateFile(event.target.files?.[0] ?? null)} className="h-10 bg-card text-[14px]" />
              </div>
              <Button className="mt-2 gap-2 text-[16px]" onClick={() => void extractTemplate()} disabled={busy || !templateFile}><Upload className="h-4 w-4" aria-hidden="true" />Extract structure</Button>
              {templateDraft ? (
                <div className="mt-4 space-y-2 border-t border-border pt-4">
                  <label className="text-[16px] font-medium" htmlFor="custom-headings">Proposed headings</label>
                  <Textarea id="custom-headings" rows={6} value={headings} onChange={(event) => setHeadings(event.target.value)} className="bg-card text-[16px]" />
                  <label className="text-[16px] font-medium" htmlFor="custom-style">Style notes</label>
                  <Textarea id="custom-style" rows={2} value={styleNotes} onChange={(event) => setStyleNotes(event.target.value)} className="bg-card text-[16px]" />
                  <label className="text-[16px] font-medium" htmlFor="custom-length">Length guidance</label>
                  <Input id="custom-length" value={lengthGuidance} onChange={(event) => setLengthGuidance(event.target.value)} className="h-10 bg-card text-[16px]" />
                  <Button className="text-[16px]" onClick={() => void saveTemplate()} disabled={busy}>Save template</Button>
                </div>
              ) : null}
              {templateError ? <p role="alert" className="mt-2 text-[14px] text-destructive">{templateError}</p> : null}
            </div>
          ) : null}

          <fieldset className="mt-5">
            <legend className="text-[17px] font-medium">Emphasis</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOCUS.map((focus) => (
                <label key={focus.id} className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[16px]">
                  <input type="checkbox" checked={focusAreas.includes(focus.id)} onChange={() => toggleFocus(focus.id)} className="h-4 w-4 accent-primary" />
                  {focus.label}
                </label>
              ))}
            </div>
          </fieldset>

          {notice ? <p className="mt-3 text-[14px] text-success">{notice}</p> : null}
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="text-[16px]" onClick={() => setStep(1)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Button>
            <Button className="text-[16px]" onClick={() => continueTo(3)} disabled={memoType === "custom" && !templateId}>Continue <ArrowRight className="h-4 w-4" aria-hidden="true" /></Button>
          </div>
        </section>
      ) : null}

      {!isLoading && step === 3 ? (
        <section className="panel p-6 sm:p-8" aria-labelledby="generate-heading">
          <h2 id="generate-heading" className="text-[21px] font-semibold tracking-tight">Generate draft</h2>
          <p className="mt-1 text-[17px] text-muted-foreground">The draft uses stored case facts and linked sources. Missing evidence stays visible.</p>
          {selectedDeal ? (
            <div className="mt-5 space-y-2 rounded-lg border border-border bg-secondary/20 p-4 text-[16px]">
              <p><span className="text-muted-foreground">Deal:</span> {selectedDeal.companyName}</p>
              <p><span className="text-muted-foreground">Type:</span> {MEMO_TYPES.find((type) => type.id === memoType)?.label}</p>
              <p><span className="text-muted-foreground">Emphasis:</span> {focusAreas.length > 0 ? focusAreas.join(", ") : "Even coverage"}</p>
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="mt-3 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[14px] text-destructive">
              <p>{error}</p>
              {/not configured|API|model|gateway/i.test(error) ? <p className="mt-1">The memo backend could not use its configured text model. Ask a workspace owner to verify the AI capability and model configuration; no memo was saved.</p> : null}
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button variant="ghost" className="text-[16px]" onClick={() => setStep(2)}><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back</Button>
            <Button className="gap-2 text-[16px]" onClick={() => void generate()} disabled={busy || !canWrite || !selectedDeal}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileText className="h-4 w-4" aria-hidden="true" />}
              {busy ? "Generating…" : "Generate Draft"}
            </Button>
          </div>
          {!canWrite ? <p className="mt-2 text-[14px] text-warning">Your role can view this flow but cannot create a draft.</p> : null}
        </section>
      ) : null}

      {!isLoading && step === 4 && selectedDeal ? (
        <section className="space-y-4" aria-labelledby="review-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="review-heading" className="text-[21px] font-semibold tracking-tight">Review &amp; Approve</h2>
              <p className="mt-1 text-[14px] text-muted-foreground">Edit the draft, inspect sources, then approve as the authorized reviewer.</p>
            </div>
            <Button variant="outline" className="text-[16px]" onClick={() => setStep(3)}>Back to generation</Button>
          </div>
          <MemoWorkspace deal={selectedDeal} wizardMode />
        </section>
      ) : null}
    </div>
  );
};

export default CreateMemo;

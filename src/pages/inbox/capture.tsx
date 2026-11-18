import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Clipboard,
  ExternalLink,
  FileAudio,
  Loader2,
  Mic,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pill } from "@/components/common/status-pill";
import { Field } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceRecorder, MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS, type RecordedClip } from "@/hooks/use-voice-recorder";
import { useWorkspace } from "@/hooks/use-workspace";
import { api } from "@/lib/api";
import { formatCurrency, formatDuration } from "@/lib/format";
import { EMPTY_WORKSPACE } from "@/lib/workspace";
import type {
  ExtractedDealFields,
  ExtractionStatus,
  TranscriptionStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface AudioClip extends RecordedClip {
  source: "recording" | "upload";
  fileName?: string;
}

interface TranscriptionUi {
  status: TranscriptionStatus;
  message?: string;
  provider?: string;
  model?: string;
}

interface SavedCapture {
  sourceId: string;
  dealId: string | null;
  dealCreated: boolean;
  companyName: string;
  extractionStatus: ExtractionStatus;
  extractionError: string;
  fields: Partial<ExtractedDealFields> | null;
  analysisStatus: "completed" | "failed" | "unavailable" | "not_applicable";
  analysisMessage: string;
  analysisClaims: number;
  analysisGaps: number;
}

const WAVE_BARS = [34, 58, 22, 76, 44, 88, 30, 68, 50, 82, 26, 60, 40, 72, 32, 64, 46, 86, 24, 56, 42, 70];

const TRANSCRIPTION_PILL: Record<
  TranscriptionStatus,
  { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }
> = {
  not_requested: { label: "No transcript yet", tone: "neutral" },
  processing: { label: "Transcribing", tone: "brand" },
  completed: { label: "Transcribed", tone: "success" },
  manual: { label: "Manual transcript", tone: "brand" },
  unavailable: { label: "Not configured", tone: "warning" },
  failed: { label: "Transcription failed", tone: "danger" },
};

const SUPPORTED_AUDIO_MIME = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
]);
const SUPPORTED_AUDIO_EXTENSION = /\.(webm|mp3|m4a|mp4|ogg|wav)$/i;

function guessMimeType(fileName: string): string {
  const extension = fileName.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "mp3":
      return "audio/mpeg";
    case "m4a":
    case "mp4":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    case "ogg":
      return "audio/ogg";
    case "webm":
      return "audio/webm";
    default:
      return "audio/webm";
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const VoiceCapture = () => {
  const { data } = useWorkspace();
  const workspace = data ?? EMPTY_WORKSPACE;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const recorder = useVoiceRecorder();

  const [clientCaptureId, setClientCaptureId] = useState(() => crypto.randomUUID());
  const [sourceDate, setSourceDate] = useState(() => new Date().toISOString());
  const [audio, setAudio] = useState<AudioClip | null>(null);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [audioError, setAudioError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [transcription, setTranscription] = useState<TranscriptionUi>({ status: "not_requested" });
  const [transcript, setTranscript] = useState("");
  const [originalTranscript, setOriginalTranscript] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteDraft, setPasteDraft] = useState("");
  const [targetMode, setTargetMode] = useState<"new" | "existing">("new");
  const [companyName, setCompanyName] = useState("");
  const [dealId, setDealId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState<SavedCapture | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement | null>(null);
  const processedClipRef = useRef<string | null>(null);

  const processing = uploading || transcription.status === "processing";
  const recording = recorder.status === "recording" || recorder.status === "requesting";
  const showTranscript = Boolean(audio) || processing || transcription.status !== "not_requested" || pasteOpen;
  const canSave =
    transcript.trim().length > 0 &&
    !saving &&
    !processing &&
    !recording &&
    (targetMode === "new" || Boolean(dealId));
  const pill = TRANSCRIPTION_PILL[transcription.status];

  useEffect(() => {
    if (searchParams.get("mode") === "paste") setPasteOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!pasteOpen) return;
    const handle = window.setTimeout(() => pasteRef.current?.focus(), 60);
    return () => window.clearTimeout(handle);
  }, [pasteOpen]);

  useEffect(() => {
    if (!saved) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [saved]);

  const processClip = useCallback(
    async (clip: AudioClip, fileName?: string) => {
      if (clip.sizeBytes > MAX_AUDIO_BYTES) {
        setAudioError(`That recording is ${formatBytes(clip.sizeBytes)}. The limit is 25 MB.`);
        setTranscription({ status: "failed", message: "The recording is larger than the 25 MB limit." });
        return;
      }

      setUploading(true);
      setAudioError("");
      setTranscription({ status: "processing" });
      setTranscript("");
      setOriginalTranscript("");

      let path: string;
      try {
        path = await api.uploadVoiceAudio(clip.blob, clientCaptureId, clip.mimeType, fileName);
        setAudioPath(path);
      } catch (error) {
        setUploading(false);
        setTranscription({
          status: "failed",
          message: "The audio could not be uploaded. The recording is still on this page; try again.",
        });
        setAudioError(error instanceof Error ? error.message : "Could not upload the audio.");
        return;
      }

      setUploading(false);

      try {
        const result = await api.transcribeVoiceNote(path, clip.mimeType);
        if (!result.configured) {
          setTranscription({
            status: "unavailable",
            message: result.reason ?? "Speech-to-text is not configured for this workspace.",
            provider: result.provider,
          });
          return;
        }
        const text = (result.transcript ?? "").trim();
        if (!text) {
          setTranscription({
            status: "failed",
            message: "The transcription service returned an empty transcript. You can type or paste it instead.",
          });
          return;
        }
        setTranscript(text);
        setOriginalTranscript(text);
        setTranscription({
          status: "completed",
          provider: result.provider,
          model: result.model,
        });
      } catch (error) {
        setTranscription({
          status: "failed",
          message: error instanceof Error ? error.message : "Transcription failed. Type or paste the transcript instead.",
        });
      }
    },
    [clientCaptureId],
  );

  useEffect(() => {
    const next = recorder.clip;
    if (!next || processedClipRef.current === next.url) return;
    processedClipRef.current = next.url;
    if (audio?.source === "upload") URL.revokeObjectURL(audio.url);
    const pageClip: AudioClip = { ...next, source: "recording" };
    setAudio(pageClip);
    setAudioPath(null);
    setAudioError("");
    void processClip(pageClip);
  }, [audio, processClip, recorder.clip]);

  useEffect(() => {
    const dirty = !saved && (Boolean(audio) || transcript.trim().length > 0);
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [audio, saved, transcript]);

  const clearPageAudioUrl = () => {
    if (audio?.source === "upload") URL.revokeObjectURL(audio.url);
  };

  const handleRecord = () => {
    if (processing || saving) return;
    setAudioError("");
    void recorder.start();
  };

  const handleStop = () => {
    void recorder.stop();
  };

  const handleCancelRecording = () => {
    recorder.cancel();
    setAudioError("");
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleFileChange = async (file: File | null) => {
    if (!file || processing || saving) return;
    const mimeType = file.type || guessMimeType(file.name);
    const normalizedMime = mimeType.toLowerCase().split(";")[0];
    const looksLikeAudio =
      SUPPORTED_AUDIO_MIME.has(normalizedMime) || SUPPORTED_AUDIO_EXTENSION.test(file.name);
    if (!looksLikeAudio) {
      setAudioError(
        "Unsupported audio format. Use MP3, M4A/MP4, WAV, OGG or WebM. AAC and FLAC are not accepted.",
      );
      return;
    }
    if (file.size === 0) {
      setAudioError("That file is empty. Choose another recording.");
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setAudioError(`That file is ${formatBytes(file.size)}. The limit is 25 MB.`);
      return;
    }

    recorder.reset();
    clearPageAudioUrl();
    const url = URL.createObjectURL(file);
    const pageClip: AudioClip = {
      blob: file,
      mimeType,
      durationSeconds: 0,
      sizeBytes: file.size,
      url,
      source: "upload",
      fileName: file.name,
    };
    processedClipRef.current = url;
    setAudio(pageClip);
    setAudioPath(null);
    setTranscription({ status: "not_requested" });
    await processClip(pageClip, file.name);
  };

  const handleRemoveAudio = () => {
    if (processing || saving) return;
    recorder.reset();
    clearPageAudioUrl();
    if (audioPath) void api.deleteVoiceAudio(audioPath);
    setAudio(null);
    setAudioPath(null);
    setUploading(false);
    setAudioError("");
    processedClipRef.current = null;
    if (transcript.trim()) {
      setTranscription({ status: "manual" });
    } else {
      setTranscription({ status: "not_requested" });
    }
  };

  const handleReRecord = () => {
    if (processing || saving) return;
    recorder.reset();
    clearPageAudioUrl();
    if (audioPath) void api.deleteVoiceAudio(audioPath);
    setAudio(null);
    setAudioPath(null);
    setTranscript("");
    setOriginalTranscript("");
    setPasteOpen(false);
    setPasteDraft("");
    setTranscription({ status: "not_requested" });
    setAudioError("");
    setSaveError("");
    processedClipRef.current = null;
    void recorder.start();
  };

  const handleRetryTranscription = () => {
    if (audioPath) {
      setTranscription({ status: "processing" });
      void api
        .transcribeVoiceNote(audioPath, audio?.mimeType ?? "audio/webm")
        .then((result) => {
          if (!result.configured) {
            setTranscription({
              status: "unavailable",
              message: result.reason ?? "Speech-to-text is not configured for this workspace.",
            });
            return;
          }
          const text = (result.transcript ?? "").trim();
          if (!text) {
            setTranscription({ status: "failed", message: "The transcription service returned an empty transcript." });
            return;
          }
          setTranscript(text);
          setOriginalTranscript(text);
          setTranscription({ status: "completed", provider: result.provider, model: result.model });
        })
        .catch((error: unknown) => {
          setTranscription({
            status: "failed",
            message: error instanceof Error ? error.message : "Transcription failed.",
          });
        });
      return;
    }
    if (audio) void processClip(audio, audio.fileName);
  };

  const applyPaste = () => {
    if (processing) return;
    const text = pasteDraft.trim();
    if (!text) return;
    setTranscript(text);
    setTranscription({ status: "manual" });
    setPasteOpen(false);
    setPasteDraft("");
    if (!audio) setAudioError("");
  };

  const handleTranscriptChange = (value: string) => {
    setTranscript(value);
    if (["not_requested", "unavailable", "failed"].includes(transcription.status)) {
      setTranscription((current) => ({ ...current, status: "manual" }));
    }
  };

  const restoreOriginal = () => {
    if (!originalTranscript) return;
    setTranscript(originalTranscript);
    setTranscription({ status: "completed" });
  };

  const resetAll = () => {
    recorder.reset();
    clearPageAudioUrl();
    setClientCaptureId(crypto.randomUUID());
    setSourceDate(new Date().toISOString());
    setAudio(null);
    setAudioPath(null);
    setAudioError("");
    setUploading(false);
    setTranscription({ status: "not_requested" });
    setTranscript("");
    setOriginalTranscript("");
    setPasteOpen(false);
    setPasteDraft("");
    setTargetMode("new");
    setCompanyName("");
    setDealId("");
    setSaving(false);
    setSaveStage("");
    setSaveError("");
    setSaved(null);
    processedClipRef.current = null;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadMuseFlowPilotSample = async () => {
    const museflow = workspace.cases.find((item) => item.companyName.toLowerCase().includes("museflow"));
    if (!museflow) {
      toast.error("No MuseFlow case exists in this workspace.");
      return;
    }
    if (audio) {
      toast.error("Remove the current recording first; the pilot demo uses the paste fallback.");
      return;
    }
    try {
      const response = await fetch("/import-samples/museflow-pilot-update.txt");
      if (!response.ok) throw new Error("The synthetic pilot transcript could not be loaded.");
      const content = await response.text();
      setTargetMode("existing");
      setDealId(museflow.id);
      setTranscript(content);
      setOriginalTranscript(content);
      setTranscription({ status: "manual" });
      setSourceDate(new Date().toISOString());
      setSaveError("");
      toast.success("Synthetic MuseFlow pilot update loaded. Review and edit the transcript before saving.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the synthetic pilot update.");
    }
  };

  const handleSave = async () => {
    if (!canSave) {
      setSaveError(
        targetMode === "existing" && !dealId
          ? "Choose the deal this capture belongs to."
          : "Add or paste a transcript before saving.",
      );
      return;
    }

    setSaving(true);
    setSaveError("");
    let sourceSaved = false;

    try {
      let path = audioPath;
      if (audio && !path) {
        setSaveStage("Uploading audio…");
        path = await api.uploadVoiceAudio(audio.blob, clientCaptureId, audio.mimeType, audio.fileName);
        setAudioPath(path);
      }

      const initialDealId = targetMode === "existing" ? dealId : null;
      const selectedExistingDeal = workspace.cases.find((item) => item.id === initialDealId) ?? null;
      const baseTitle =
        targetMode === "existing" ? selectedExistingDeal?.companyName ?? "Voice note" : companyName.trim() || "Voice note";
      const basePayload = {
        clientCaptureId,
        sourceType: (audio ? "voice" : "text") as "voice" | "text",
        transcript: transcript.trim(),
        originalTranscript,
        audioPath: path,
        audioMimeType: audio?.mimeType ?? "",
        audioSizeBytes: audio?.sizeBytes ?? null,
        durationSeconds: audio?.durationSeconds || null,
        sourceDate,
        transcriptionStatus: transcription.status,
        transcriptionProvider: transcription.provider ?? "",
        transcriptionModel: transcription.model ?? "",
        transcriptionError: transcription.status === "failed" ? transcription.message ?? "" : "",
        processedAt: new Date().toISOString(),
      };

      setSaveStage("Saving transcript…");
      const base = await api.upsertVoiceSource({
        ...basePayload,
        title: baseTitle,
        dealId: initialDealId,
        extractionStatus: "processing",
        extractionError: "",
        extractedFields: null,
      });
      sourceSaved = true;

      setSaveStage("Extracting deal fields…");
      let fields: Partial<ExtractedDealFields> | null = null;
      let extractionStatus: ExtractionStatus = "not_requested";
      let extractionError = "";

      try {
        const result = await api.extractDealFields(transcript.trim());
        if (!result.configured) {
          extractionStatus = "unavailable";
          extractionError = result.reason ?? "Structured extraction is not configured for this workspace.";
        } else if (result.fields) {
          fields = result.fields;
          extractionStatus = "completed";
        } else {
          extractionStatus = "failed";
          extractionError = "The extraction service returned no fields.";
        }
      } catch (error) {
        extractionStatus = "failed";
        extractionError = error instanceof Error ? error.message : "Structured extraction failed.";
      }

      setSaveStage("Finishing capture…");
      let finalDealId = initialDealId;
      let dealCreated = false;

      if (targetMode === "new") {
        const resolvedCompany = companyName.trim() || (fields?.company_name ?? "").trim();
        if (resolvedCompany) {
          const created = await api.createDealFromCapture({
            clientCaptureId,
            companyName: resolvedCompany,
            fields: fields ?? {},
          });
          finalDealId = created.dealId;
          dealCreated = created.created;
        }
      }

      const finalTitle =
        targetMode === "existing"
          ? selectedExistingDeal?.companyName ?? "Voice note"
          : companyName.trim() || (fields?.company_name ?? "").trim() || "Voice note";
      await api.upsertVoiceSource({
        ...basePayload,
        title: finalTitle,
        dealId: finalDealId,
        extractionStatus,
        extractionError,
        extractedFields: fields,
      });

      let analysisStatus: SavedCapture["analysisStatus"] = finalDealId ? "completed" : "not_applicable";
      let analysisMessage = "";
      let analysisClaims = 0;
      let analysisGaps = 0;
      if (finalDealId) {
        setSaveStage("Analyzing evidence and gaps…");
        try {
          const analysis = await api.analyzeDealSource(base.id, finalDealId);
          if (!analysis.configured) {
            analysisStatus = "unavailable";
            analysisMessage =
              analysis.reason || "Evidence analysis is not configured. The source was saved without proposed claims.";
          } else {
            analysisClaims = analysis.claims ?? 0;
            analysisGaps = analysis.gaps ?? 0;
            analysisMessage = `${analysisClaims} draft claim${analysisClaims === 1 ? "" : "s"} and ${analysisGaps} gap${analysisGaps === 1 ? "" : "s"} proposed. Nothing has been approved automatically.`;
          }
        } catch (analysisError) {
          analysisStatus = "failed";
          analysisMessage =
            analysisError instanceof Error
              ? analysisError.message
              : "Evidence analysis failed. The source is saved and can be analyzed again from the case.";
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setSaved({
        sourceId: base.id,
        dealId: finalDealId,
        dealCreated,
        companyName: finalTitle,
        extractionStatus,
        extractionError,
        fields,
        analysisStatus,
        analysisMessage,
        analysisClaims,
        analysisGaps,
      });
      toast.success(
        analysisStatus === "completed"
          ? "Capture saved; draft evidence is awaiting human review"
          : "Capture saved",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "The capture could not be saved.";
      setSaveError(
        `${message} ${
          sourceSaved
            ? "The transcript was saved; retrying updates the same capture instead of creating a duplicate."
            : "Nothing was saved; your transcript is still on this page. Retrying is safe."
        }`,
      );
    } finally {
      setSaving(false);
      setSaveStage("");
    }
  };

  const dealOptions = workspace.cases.map((item) => ({
    value: item.id,
    label: item.companyName,
  }));

  if (saved) {
    const extracted = saved.fields ?? {};
    const hasFields = Boolean(
      extracted.company_name ||
        extracted.sector ||
        extracted.stage ||
        extracted.geography ||
        extracted.target_raise ||
        extracted.next_step ||
        (extracted.open_questions?.length ?? 0) > 0,
    );

    return (
      <div className="page-enter space-y-5">
        <PageHeader
          eyebrow="Deal Inbox · Voice"
          title="Capture saved"
          description={
            audio
              ? "The original audio and the corrected transcript are stored in the workspace."
              : "The corrected transcript is stored in the workspace."
          }
          backTo={{ to: "/inbox", label: "Deal Inbox" }}
        />

        <section className="panel p-5 sm:p-6" aria-labelledby="saved-heading">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
              <CircleCheck className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="saved-heading" className="font-display text-2xl tracking-tight">
                {saved.dealId ? "Saved and linked to a deal" : "Transcript saved to the Deal Inbox"}
              </h2>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {saved.dealId
                  ? `${saved.companyName} is on file. Review the deal before using the extracted fields.`
                  : "No deal was created because no company name was available. The transcript and audio are preserved in the Deal Inbox."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {saved.dealId ? (
                  <Button asChild className="gap-1.5">
                    <Link to={`/cases/${saved.dealId}`}>
                      Open deal
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
                <Button asChild variant="outline">
                  <Link to="/inbox">Open Deal Inbox</Link>
                </Button>
                <Button variant="ghost" onClick={resetAll} className="gap-1.5">
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Capture another
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-secondary/30 p-3.5">
              <p className="label-caps">Stored</p>
              <ul className="mt-2 space-y-1 text-[11.5px] text-muted-foreground">
                <li>{audio ? "Original audio · private bucket" : "No audio · pasted transcript"}</li>
                <li>Corrected transcript · {transcript.trim().split(/\s+/).length} words</li>
                <li>Deal link · {saved.dealId ? "yes" : "not created"}</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-3.5">
              <p className="label-caps">Structured extraction</p>
              <p className="mt-1.5 text-[12px] font-medium">
                {saved.extractionStatus === "completed"
                  ? hasFields
                    ? "Fields extracted"
                    : "Completed · no usable fields"
                  : "Not applied"}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                {saved.extractionStatus === "completed"
                  ? hasFields
                    ? "AI-extracted from the confirmed transcript. Verify each value."
                    : "The model returned no usable fields. The transcript and audio are saved."
                  : saved.extractionStatus === "unavailable"
                    ? saved.extractionError || "Structured extraction is not configured. The transcript was saved without generated fields."
                    : saved.extractionStatus === "failed"
                      ? saved.extractionError || "Extraction failed. The transcript was saved without generated fields."
                      : "No extraction was requested."}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="label-caps">Evidence analysis</p>
                <p className="mt-1 text-[12px] font-medium">
                  {saved.analysisStatus === "completed"
                    ? "Draft evidence and gaps proposed"
                    : saved.analysisStatus === "unavailable"
                      ? "Not configured"
                      : saved.analysisStatus === "failed"
                        ? "Analysis failed"
                        : "No linked case to analyse"}
                </p>
              </div>
              {saved.dealId ? (
                <Link
                  to={`/cases/${saved.dealId}#claims-heading`}
                  className="text-[10.5px] font-medium text-brand-strong hover:underline"
                >
                  Review proposed evidence
                </Link>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {saved.analysisMessage
                ? saved.analysisMessage
                : saved.analysisStatus === "not_applicable"
                  ? "The transcript was not linked to a case, so no evidence analysis was run."
                  : `${saved.analysisClaims} drafts · ${saved.analysisGaps} gaps.`}
            </p>
            {saved.analysisStatus === "completed" ? (
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                {saved.analysisClaims} draft claim{saved.analysisClaims === 1 ? "" : "s"} and {saved.analysisGaps} open
                gap{saved.analysisGaps === 1 ? "" : "s"} were proposed. Prior approved facts were preserved; nothing is
                approved until a human reviews it.
              </p>
            ) : null}
          </div>

          {saved.extractionStatus === "completed" && hasFields ? (
            <div className="mt-3 rounded-lg border border-brand/20 bg-brand-soft/40 p-3.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand-strong" aria-hidden="true" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-brand-strong">
                  AI-extracted fields · verify
                </p>
              </div>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  { label: "Company", value: extracted.company_name },
                  { label: "Sector", value: extracted.sector },
                  { label: "Stage", value: extracted.stage },
                  { label: "Geography", value: extracted.geography },
                  {
                    label: "Target raise",
                    value: extracted.target_raise ? formatCurrency(extracted.target_raise, { compact: false }) : "",
                  },
                  { label: "Next step", value: extracted.next_step },
                ]
                  .filter((row) => Boolean(row.value))
                  .map((row) => (
                    <div key={row.label}>
                      <dt className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{row.label}</dt>
                      <dd className="mt-0.5 text-[12px] font-medium">{row.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : null}

          {audio ? (
            <div className="mt-3">
              <audio src={audio.url} controls className="h-9 w-full" aria-label="Saved capture audio" />
            </div>
          ) : null}
        </section>
      </div>
    );
  }

  return (
    <div className="page-enter space-y-5">
      <PageHeader
        eyebrow="Deal Inbox · Voice"
        title="Voice deal capture"
        description="Record the takeaway while it is fresh. Review the transcript, attach it to a deal, and save the original audio privately."
        backTo={{ to: "/inbox", label: "Deal Inbox" }}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-4">
          <section className="panel p-5 sm:p-6" aria-labelledby="capture-heading">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label-caps">Step 1</p>
                <h2 id="capture-heading" className="mt-0.5 text-[17px] font-semibold tracking-tight">
                  Capture the note
                </h2>
              </div>
              <Pill tone={pill.tone}>{pill.label}</Pill>
            </div>

            {recorder.embedded ? (
              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-brand/25 bg-brand-soft/50 px-3.5 py-2.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-2">
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-strong" aria-hidden="true" />
                  <div>
                    <p className="text-[11.5px] font-semibold text-brand-strong">Recording in the embedded preview</p>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-brand-strong/80">
                      Browsers often block the microphone inside this preview even after you allow it. Open DealFlow IQ in
                      its own tab to record; audio upload and paste work here.
                    </p>
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5 border-brand/30 bg-card">
                  <a href={window.location.href} target="_blank" rel="noopener noreferrer">
                    Open in new tab
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </a>
                </Button>
              </div>
            ) : null}

            {recorder.status === "stopping" ? (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
                <p className="text-[13px] font-medium">Finishing the recording…</p>
              </div>
            ) : recorder.status === "recording" ? (
              <div className="mt-5 flex flex-col items-center gap-4 rounded-xl border border-brand/30 bg-brand-soft/40 px-4 py-8">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-strong">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
                  Recording
                </div>
                <p className="font-display text-5xl leading-none tabular-nums">{formatDuration(recorder.duration)}</p>
                <div className="flex h-12 items-center justify-center gap-[3px]" aria-hidden="true">
                  {WAVE_BARS.map((height, index) => (
                    <span
                      key={`${height}-${index}`}
                      className="w-[3px] animate-[wave_1s_ease-in-out_infinite] rounded-full bg-brand motion-reduce:animate-none"
                      style={{
                        height: `${height}%`,
                        animationDelay: `${(index % 7) * 0.09}s`,
                        transformOrigin: "center",
                      }}
                    />
                  ))}
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button onClick={handleStop} className="h-12 gap-2 px-8" size="lg">
                    <Square className="h-4 w-4 fill-current" aria-hidden="true" />
                    Stop recording
                  </Button>
                  <Button variant="ghost" size="lg" onClick={handleCancelRecording} className="h-12 gap-2">
                    <X className="h-4 w-4" aria-hidden="true" />
                    Cancel
                  </Button>
                </div>
                <p className="text-[10.5px] text-muted-foreground">
                  Maximum {Math.floor(MAX_RECORDING_SECONDS / 60)} minutes · 25 MB
                </p>
              </div>
            ) : recorder.status === "requesting" ? (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden="true" />
                <p className="text-[13px] font-medium">Waiting for microphone permission…</p>
                <p className="max-w-sm text-[11.5px] leading-relaxed text-muted-foreground">
                  Your browser is asking whether DealFlow IQ may use the microphone. Allow it to continue.
                </p>
              </div>
            ) : audio ? (
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-strong">
                  <FileAudio className="h-3.5 w-3.5" aria-hidden="true" />
                  {audio.source === "upload" ? "Uploaded audio" : "Recording captured"}
                </div>
                <audio src={audio.url} controls className="h-10 w-full" aria-label="Captured audio playback" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {audio.durationSeconds > 0 ? `${formatDuration(audio.durationSeconds)} · ` : ""}
                    {formatBytes(audio.sizeBytes)}
                  </span>
                  <span className="text-muted-foreground/50" aria-hidden="true">·</span>
                  <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={handleReRecord} disabled={processing || saving}>
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    Re-record
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground" onClick={handleRemoveAudio} disabled={processing || saving}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove audio
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-muted-foreground" onClick={handleUploadClick} disabled={processing || saving}>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Replace with file
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-col items-center gap-4">
                <button
                  type="button"
                  onClick={handleRecord}
                  disabled={saving || processing || !recorder.supported || recorder.policyBlocked}
                  aria-label="Record voice note"
                  className="group flex h-28 w-28 flex-col items-center justify-center gap-1.5 rounded-full bg-brand text-brand-foreground shadow-lift transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 disabled:opacity-50"
                >
                  <Mic className="h-8 w-8" aria-hidden="true" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em]">Record</span>
                </button>
                <div className="text-center">
                  <p className="text-[14px] font-semibold">Record Voice Note</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Your browser will ask for microphone permission. Audio stays private.
                  </p>
                  {recorder.permission !== "unknown" ? (
                    <p
                      className={cn(
                        "mt-1.5 text-[10.5px] font-medium",
                        recorder.permission === "granted"
                          ? "text-success"
                          : recorder.permission === "denied"
                            ? "text-warning"
                            : "text-muted-foreground",
                      )}
                    >
                      {recorder.permission === "granted"
                        ? "Microphone allowed in this browser"
                        : recorder.permission === "denied"
                          ? "Microphone blocked in this browser"
                          : "Microphone permission will be requested"}
                    </p>
                  ) : null}
                  {recorder.policyBlocked ? (
                    <p className="mt-1.5 text-[10.5px] leading-relaxed text-warning">
                      This frame's permissions policy blocks the microphone. Open the page in its own tab to record.
                    </p>
                  ) : null}
                </div>
                {!recorder.supported ? (
                  <p className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-center text-[11px] leading-relaxed text-warning">
                    Recording is not supported in this browser. Upload an audio file or paste the transcript below.
                  </p>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={handleUploadClick}>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Upload audio
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setPasteOpen((value) => !value)}
                    disabled={processing}
                  >
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Paste transcript
                  </Button>
                </div>
                <p className="max-w-sm text-center text-[10.5px] leading-relaxed text-muted-foreground">
                  Speech-to-text is provided only when a provider is configured. Your audio and transcript are never
                  posted publicly.
                </p>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg,.mp4"
              className="sr-only"
              onChange={(event) => {
                void handleFileChange(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />

            {recorder.error ? (
              <div role="alert" className="mt-4 rounded-md border border-warning/25 bg-warning-soft px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                  <p className="text-[11px] leading-relaxed text-warning">{recorder.error}</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
                  {recorder.errorKind !== "unsupported" &&
                  recorder.errorKind !== "insecure" &&
                  !recorder.policyBlocked ? (
                    <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={handleRecord}>
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Try microphone again
                    </Button>
                  ) : null}
                  {recorder.embedded ? (
                    <Button asChild variant="outline" size="sm" className="h-7 gap-1.5">
                      <a href={window.location.href} target="_blank" rel="noopener noreferrer">
                        Open in new tab
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                    </Button>
                  ) : null}
                  {recorder.errorKind === "permission" && !recorder.embedded ? (
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => window.location.reload()}>
                      Reload page
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={handleUploadClick}>
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    Upload audio
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setPasteOpen(true)}>
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Paste instead
                  </Button>
                </div>
                {recorder.errorKind === "permission" ? (
                  <p className="mt-1.5 pl-5 text-[10px] leading-relaxed text-warning/80">
                    If you just allowed the microphone, try again first. Some browsers keep a remembered block until the
                    page is reloaded.
                  </p>
                ) : null}
              </div>
            ) : null}

            {audioError ? (
              <p role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11px] leading-relaxed text-destructive">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {audioError}
              </p>
            ) : null}

            {processing ? (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                {uploading ? "Uploading the audio privately…" : "Transcribing the recording…"}
              </div>
            ) : null}

            {transcription.status === "unavailable" ? (
              <div className="mt-4 rounded-md border border-warning/25 bg-warning-soft px-3 py-2.5">
                <p className="text-[11.5px] font-semibold text-warning">Speech-to-text is not configured</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-warning">
                  {transcription.message} Paste or type the transcript below; the audio is already stored privately.
                </p>
              </div>
            ) : null}

            {transcription.status === "failed" ? (
              <div className="mt-4 rounded-md border border-destructive/20 bg-danger-soft px-3 py-2.5">
                <p className="text-[11.5px] font-semibold text-destructive">Transcription did not complete</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-destructive">{transcription.message}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-7 gap-1.5" onClick={handleRetryTranscription}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Try transcription again
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5"
                    onClick={() => setPasteOpen(true)}
                  >
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                    Paste instead
                  </Button>
                </div>
              </div>
            ) : null}
          </section>

          {showTranscript ? (
            <section className="panel p-5 sm:p-6" aria-labelledby="transcript-heading">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="label-caps">Step 2</p>
                  <h2 id="transcript-heading" className="mt-0.5 text-[17px] font-semibold tracking-tight">
                    Review the transcript
                  </h2>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    Correct names, numbers and next steps before saving. The original machine output is kept.
                  </p>
                </div>
                <Pill tone={pill.tone}>{pill.label}</Pill>
              </div>

              {transcription.status === "processing" ? (
                <div className="mt-4 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-[11.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                  Generating a transcript… you can edit it as soon as it arrives.
                </div>
              ) : null}

              {pasteOpen ? (
                <div className="mt-4 space-y-2 rounded-lg border border-brand/25 bg-brand-soft/40 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-brand-strong">Paste a transcript</p>
                    <button
                      type="button"
                      onClick={() => setPasteOpen(false)}
                      className="rounded-md p-1 text-brand-strong/70 hover:text-brand-strong"
                      aria-label="Close paste panel"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <Textarea
                    ref={pasteRef}
                    rows={5}
                    value={pasteDraft}
                    onChange={(event) => setPasteDraft(event.target.value)}
                    placeholder="Paste the call notes or an export from your recorder…"
                    className="bg-card"
                    aria-label="Pasted transcript"
                  />
                  {transcript.trim() ? (
                    <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                      This replaces the transcript currently shown. The original machine transcript is still preserved.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={applyPaste} disabled={!pasteDraft.trim() || processing}>
                      Use this transcript
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPasteDraft("");
                        setPasteOpen(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="mt-4">
                <Textarea
                  value={transcript}
                  onChange={(event) => handleTranscriptChange(event.target.value)}
                  rows={9}
                  disabled={transcription.status === "processing" || uploading}
                  placeholder={
                    transcription.status === "unavailable"
                      ? "Speech-to-text is not configured. Paste or type what was said…"
                      : "The transcript will appear here. You can also type or paste it."
                  }
                  className="min-h-[190px] bg-card text-[13px] leading-relaxed"
                  aria-label="Corrected transcript"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-muted-foreground">
                    <span>{transcript.trim() ? `${transcript.trim().split(/\s+/).length} words` : "No transcript yet"}</span>
                    {originalTranscript && transcript.trim() !== originalTranscript.trim() ? (
                      <button
                        type="button"
                        onClick={restoreOriginal}
                        className="font-medium text-brand-strong hover:underline"
                      >
                        Restore machine transcript
                      </button>
                    ) : null}
                  </div>
                  {!pasteOpen ? (
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setPasteOpen(true)} disabled={processing}>
                      <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                      Paste transcript
                    </Button>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {showTranscript ? (
            <section className="panel p-5 sm:p-6" aria-labelledby="save-heading">
              <p className="label-caps">Step 3</p>
              <h2 id="save-heading" className="mt-0.5 text-[17px] font-semibold tracking-tight">
                Analyze and save
              </h2>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                The corrected transcript is sent to AI for structured extraction, then the audio and transcript are
                stored. If extraction is unavailable, the transcript is still saved.
              </p>

              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-secondary/50 p-1">
                  {[
                    { value: "new" as const, label: "New deal" },
                    { value: "existing" as const, label: "Existing deal" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={targetMode === option.value}
                      onClick={() => {
                        setTargetMode(option.value);
                        setSaveError("");
                      }}
                      className={cn(
                        "rounded-md px-3 py-2 text-[12.5px] font-medium transition-colors",
                        targetMode === option.value
                          ? "bg-card text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {targetMode === "new" ? (
                  <Field
                    label="Company name"
                    htmlFor="capture-company"
                    optional
                    hint="Extraction may fill this in. If no name is available, the transcript is saved without a deal."
                  >
                    <Input
                      id="capture-company"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      placeholder="e.g. Meridian Pay"
                      className="bg-card"
                    />
                  </Field>
                ) : (
                  <Field
                    label="Deal"
                    htmlFor="capture-deal"
                    hint={dealOptions.length === 0 ? "No deals exist yet. Use New deal instead." : "The capture is linked without overwriting the deal."}
                  >
                    <SelectField
                      id="capture-deal"
                      value={dealId}
                      onChange={setDealId}
                      options={dealOptions}
                      placeholder="Choose a deal"
                    />
                  </Field>
                )}

                <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                  <p className="text-[11px] font-medium">What gets stored</p>
                  <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                    Original audio in the private bucket, the corrected transcript, the transcription status, and any
                    extracted fields. Retrying a failed save updates the same capture.
                  </p>
                </div>

                {workspace.cases.some((item) => item.companyName.toLowerCase().includes("museflow")) ? (
                  <div className="rounded-md border border-warning/25 bg-warning-soft/40 px-3 py-2.5">
                    <p className="text-[10.5px] font-medium text-warning">Synthetic demo · MuseFlow pilot follow-up</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-warning">
                      Loads a labelled synthetic transcript for the existing MuseFlow case. It reports 12 historical
                      pilots, then two paying and ten unpaid. Review it before saving; analysis creates drafts, not
                      approved facts.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-[10.5px]"
                      onClick={() => void loadMuseFlowPilotSample()}
                      disabled={saving}
                    >
                      Load synthetic pilot update
                    </Button>
                  </div>
                ) : null}

                {saveError ? (
                  <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft px-3 py-2 text-[11.5px] leading-relaxed text-destructive">
                    {saveError}
                  </p>
                ) : null}

                <Button
                  onClick={() => void handleSave()}
                  disabled={!canSave}
                  className="h-11 w-full gap-2"
                  size="lg"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  {saving ? saveStage || "Saving…" : "Analyze and Save"}
                </Button>
                {!canSave && !saving ? (
                  <p className="text-center text-[10.5px] text-muted-foreground">
                    {transcript.trim().length === 0
                      ? "Add or paste a transcript to continue."
                      : targetMode === "existing" && !dealId
                        ? "Choose the deal this capture belongs to."
                        : "Finish recording and transcription first."}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4">
          <section className="panel p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold tracking-tight">Privacy and access</h2>
            </div>
            <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <li>Audio is uploaded to a private bucket readable only by active workspace members.</li>
              <li>The microphone is requested only when you tap Record.</li>
              <li>Transcription credentials are never sent to the browser.</li>
              <li>Outreach and investor records are untouched by this workflow.</li>
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-[13px] font-semibold tracking-tight">Limits</h2>
            <ul className="mt-2.5 space-y-1.5 text-[11px] text-muted-foreground">
              <li>Maximum recording: {Math.floor(MAX_RECORDING_SECONDS / 60)} minutes</li>
              <li>Maximum file size: 25 MB</li>
              <li>Accepted: WebM, M4A, MP3, WAV, OGG</li>
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="text-[13px] font-semibold tracking-tight">If something fails</h2>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              You can always upload an existing audio file or paste a transcript. Audio is uploaded before transcription,
              so a provider outage never discards the recording.
            </p>
            <Button asChild variant="link" className="mt-1 h-auto justify-start px-0 text-[11.5px]">
              <Link to="/inbox">Back to Deal Inbox</Link>
            </Button>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default VoiceCapture;

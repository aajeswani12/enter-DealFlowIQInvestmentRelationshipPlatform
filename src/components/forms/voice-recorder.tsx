import { Mic, RotateCcw, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface VoiceRecording {
  dataUrl: string;
  durationSeconds: number;
  mimeType: string;
  blob: Blob;
}

type RecorderState = "idle" | "requesting" | "recording" | "ready" | "error";

const MAX_SECONDS = 300;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

const BAR_HEIGHTS = [38, 62, 24, 78, 46, 90, 32, 70, 52, 84, 28, 60, 42, 74, 34, 66, 48, 88, 26, 58, 44, 72, 36, 80];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

interface VoiceRecorderProps {
  onRecorded: (recording: VoiceRecording) => void;
  onCleared: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecorded, onCleared, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; duration: number; mimeType: string } | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const supported = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopRecorder = useCallback(() => {
    clearTimer();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    releaseStream();
  }, [clearTimer, releaseStream]);

  useEffect(() => {
    return () => {
      clearTimer();
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      releaseStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [clearTimer, releaseStream]);

  const handleStop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    clearTimer();
    const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      chunksRef.current = [];
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        const url = URL.createObjectURL(blob);
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = url;
        setPreview({ url, duration, mimeType: blob.type });
        setState("ready");
        setElapsed(duration);
        onRecorded({ dataUrl, durationSeconds: duration, mimeType: blob.type, blob });
      };
      reader.readAsDataURL(blob);
    };
    stopRecorder();
  }, [clearTimer, onRecorded, stopRecorder]);

  const handleStart = async () => {
    setError(null);
    if (!supported) {
      setState("error");
      setError("This browser cannot record audio. Type the update instead, or use a recent Chrome, Safari or Edge.");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setState("error");
        setError("Recording stopped unexpectedly. Please try again.");
        clearTimer();
        releaseStream();
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setPreview(null);
      setElapsed(0);
      recorder.start();
      setState("recording");

      timerRef.current = window.setInterval(() => {
        const seconds = Math.round((Date.now() - startedAtRef.current) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) handleStop();
      }, 250);
    } catch (err) {
      releaseStream();
      setState("error");
      const name = err instanceof DOMException ? err.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Microphone access was blocked. Allow the microphone in your browser, or type the update instead."
          : name === "NotFoundError"
            ? "No microphone was found on this device. Type the update instead."
            : "Could not start recording. Check your microphone and try again.",
      );
    }
  };

  const handleReset = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setElapsed(0);
    setState("idle");
    setError(null);
    onCleared();
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-gradient-to-b from-secondary/40 to-card p-4 sm:p-5",
        state === "recording" && "border-brand/40 from-brand-soft/60",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-semibold text-foreground">Voice capture</p>
          <p className="text-[11px] text-muted-foreground">Audio is stored with the record. No transcription is generated.</p>
        </div>
        <span className="label-caps shrink-0">{state === "recording" ? "Recording" : `${formatDuration(elapsed)} / 5:00`}</span>
      </div>

      <div className="mt-4 flex flex-col items-center gap-4">
        <div
          className={cn(
            "flex h-12 w-full items-center justify-center gap-[3px] overflow-hidden rounded-lg px-3",
            state === "recording" ? "bg-brand-soft" : "bg-secondary/70",
          )}
          aria-hidden="true"
        >
          {BAR_HEIGHTS.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className={cn(
                "w-[3px] rounded-full",
                state === "recording" ? "bg-brand" : "bg-muted-foreground/30",
              )}
              style={{
                height: `${state === "recording" ? height : Math.max(10, height * 0.3)}%`,
                animation:
                  state === "recording" && !reduceMotion
                    ? `wave 1s ease-in-out ${(index % 7) * 0.09}s infinite`
                    : undefined,
                transformOrigin: "center",
              }}
            />
          ))}
        </div>

        {state === "recording" ? (
          <Button type="button" onClick={handleStop} className="h-12 w-full gap-2 sm:w-auto sm:px-8">
            <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            Stop recording
          </Button>
        ) : state === "requesting" ? (
          <Button type="button" disabled className="h-12 w-full gap-2 sm:w-auto sm:px-8">
            <Mic className="h-4 w-4 animate-pulse" aria-hidden="true" />
            Waiting for microphone…
          </Button>
        ) : state === "ready" && preview ? (
          <div className="w-full space-y-3">
            <audio src={preview.url} controls className="h-9 w-full" aria-label="Recorded voice note playback" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-medium text-muted-foreground">
                Recorded · {formatDuration(preview.duration)} · saved with this capture
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Re-record
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground">
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <Button
              type="button"
              onClick={handleStart}
              disabled={disabled}
              className="h-12 w-full gap-2 rounded-full bg-brand text-brand-foreground hover:bg-brand/90 sm:w-auto sm:px-8"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              Start recording
            </Button>
            <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
              Record on the way back from a meeting. You can add typed notes alongside the audio.
            </p>
          </>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {state === "recording" ? `Recording, ${formatDuration(elapsed)} elapsed` : state === "ready" ? "Recording saved" : ""}
      </p>

      {error ? (
        <p role="alert" className="mt-3 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-[11px] leading-relaxed text-warning">
          {error}
        </p>
      ) : null}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_SECONDS = 600;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export interface RecordedClip {
  blob: Blob;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  url: string;
}

type RecorderStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function permissionMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access was blocked. Allow the microphone in your browser settings, or upload an audio file or paste a transcript instead.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No microphone was found on this device. Upload an audio file or paste a transcript instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The microphone is already in use by another app. Close it and try again, or use the fallbacks.";
  }
  return "Could not start recording. Check your microphone, or use the upload or paste fallback.";
}

/**
 * MediaRecorder wrapper. Recording requires an explicit getUserMedia permission
 * request, which happens only when start() is called from a user action.
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<RecordedClip | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const clipUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const supported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

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

  const revokeClipUrl = useCallback(() => {
    if (clipUrlRef.current) {
      URL.revokeObjectURL(clipUrlRef.current);
      clipUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(async (): Promise<void> => {
    const recorder = recorderRef.current;
    clearTimer();
    if (!recorder || recorder.state === "inactive") {
      releaseStream();
      setStatus((current) => (current === "requesting" ? "idle" : current));
      return;
    }
    setStatus("stopping");
    discardRef.current = false;
    recorder.stop();
    releaseStream();
  }, [clearTimer, releaseStream]);

  const start = useCallback(async (): Promise<void> => {
    if (!supported) {
      setStatus("error");
      setError("This browser cannot record audio. Use the upload or paste fallback instead.");
      return;
    }
    if (status === "requesting" || status === "recording" || status === "stopping") return;

    revokeClipUrl();
    if (mountedRef.current) {
      setClip(null);
      setError(null);
      setDuration(0);
      setStatus("requesting");
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        clearTimer();
        releaseStream();
        if (!mountedRef.current) return;
        setStatus("error");
        setError("Recording stopped unexpectedly. Try again or use the fallback options.");
      };

      recorder.onstop = () => {
        clearTimer();
        releaseStream();
        if (!mountedRef.current) return;

        if (discardRef.current) {
          discardRef.current = false;
          setStatus("idle");
          return;
        }

        const seconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        const mime = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];

        if (blob.size < 1024) {
          setStatus("error");
          setError("That recording was empty. Hold the record button a little longer and try again.");
          setDuration(0);
          return;
        }

        const url = URL.createObjectURL(blob);
        clipUrlRef.current = url;
        setClip({
          blob,
          mimeType: mime,
          durationSeconds: seconds,
          sizeBytes: blob.size,
          url,
        });
        setDuration(seconds);
        setStatus("idle");
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setStatus("recording");

      timerRef.current = window.setInterval(() => {
        if (!mountedRef.current) return;
        const seconds = Math.min(
          MAX_RECORDING_SECONDS,
          Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000)),
        );
        setDuration(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) {
          void stop();
        }
      }, 250);
    } catch (caught) {
      releaseStream();
      if (!mountedRef.current) return;
      setStatus("error");
      setError(permissionMessage(caught));
    }
  }, [clearTimer, releaseStream, revokeClipUrl, status, stop, supported]);

  const cancel = useCallback(() => {
    clearTimer();
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    releaseStream();
    revokeClipUrl();
    if (mountedRef.current) {
      setClip(null);
      setDuration(0);
      setError(null);
      setStatus("idle");
    }
  }, [clearTimer, releaseStream, revokeClipUrl]);

  const reset = useCallback(() => {
    cancel();
  }, [cancel]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore teardown errors
        }
      }
      releaseStream();
      if (clipUrlRef.current) {
        URL.revokeObjectURL(clipUrlRef.current);
        clipUrlRef.current = null;
      }
    };
  }, [clearTimer, releaseStream]);

  return {
    status,
    supported,
    error,
    duration,
    clip,
    start,
    stop,
    cancel,
    reset,
  };
}

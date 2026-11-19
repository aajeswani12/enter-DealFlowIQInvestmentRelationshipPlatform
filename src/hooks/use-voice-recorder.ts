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

export type RecorderErrorKind =
  | "permission"
  | "no_device"
  | "busy"
  | "unsupported"
  | "insecure"
  | "empty"
  | "constraints"
  | "unknown";

export type MicrophonePermission = "granted" | "denied" | "prompt" | "unknown";

type RecorderStatus = "idle" | "requesting" | "recording" | "stopping" | "error";

interface PolicyDocument extends Document {
  permissionsPolicy?: { allowsFeature: (feature: string) => boolean };
  featurePolicy?: { allowsFeature: (feature: string) => boolean };
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

function describeMicrophoneError(
  caught: unknown,
  context: { embedded: boolean; policyBlocked: boolean },
): { kind: RecorderErrorKind; message: string } {
  const name = caught instanceof DOMException ? caught.name : "";
  const embeddedHint = context.embedded
    ? "This embedded preview blocks the microphone. Open DealflowIQ in its own tab to record; uploading audio or pasting a transcript also works here."
    : "Allow the microphone from the browser's site controls (the microphone icon in the address bar), then tap Try microphone again. If the browser still remembers the block, reload the page.";

  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return {
      kind: "permission",
      message:
        context.policyBlocked && !context.embedded
          ? "This page's permissions policy blocks the microphone. Open DealflowIQ in its own tab and allow microphone access there."
          : `Microphone access is blocked. ${embeddedHint}`,
    };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return {
      kind: "no_device",
      message: "No microphone was found on this device. Connect a microphone, or upload an audio file or paste a transcript instead.",
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return {
      kind: "busy",
      message:
        "The microphone is already in use by another app or tab. Close it and tap Try microphone again, or use the upload and paste fallbacks.",
    };
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return {
      kind: "constraints",
      message: "Your microphone rejected the requested audio settings. Try again, or use the upload and paste fallbacks.",
    };
  }
  if (name === "AbortError") {
    return {
      kind: "unknown",
      message: "The recording was interrupted before it started. Tap Try microphone again.",
    };
  }
  if (name === "TypeError") {
    return {
      kind: "insecure",
      message:
        "The microphone is unavailable here. Recording needs HTTPS and a browser with MediaRecorder support; use the upload or paste fallback.",
    };
  }
  return {
    kind: "unknown",
    message: "Could not start recording. Check your microphone, then tap Try microphone again, or use the upload or paste fallback.",
  };
}

/**
 * MediaRecorder wrapper. Recording requires an explicit getUserMedia permission
 * request, which happens only when start() is called from a user action.
 *
 * The embedded preview runs in a cross-origin frame. Browsers commonly deny
 * microphone access there even when the top-level site has permission, so the
 * hook exposes frame/policy state for the UI to offer a standalone tab.
 */
export function useVoiceRecorder() {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<RecorderErrorKind | null>(null);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [permission, setPermission] = useState<MicrophonePermission>("unknown");
  const [policyBlocked, setPolicyBlocked] = useState(false);
  const [embedded] = useState(() => typeof window !== "undefined" && window.self !== window.top);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const discardRef = useRef(false);
  const clipUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const errorKindRef = useRef<RecorderErrorKind | null>(null);

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

  const setRecorderError = useCallback((kind: RecorderErrorKind, message: string) => {
    errorKindRef.current = kind;
    setErrorKind(kind);
    setError(message);
    setStatus("error");
  }, []);

  const clearRecorderError = useCallback(() => {
    errorKindRef.current = null;
    setErrorKind(null);
    setError(null);
    setStatus((current) => (current === "error" ? "idle" : current));
  }, []);

  // Detect whether the frame's permissions policy allows microphone use, and
  // track the browser permission so the UI can explain and re-offer access.
  useEffect(() => {
    const doc = document as PolicyDocument;
    const policy = doc.permissionsPolicy ?? doc.featurePolicy;
    if (policy?.allowsFeature) {
      try {
        setPolicyBlocked(policy.allowsFeature("microphone") === false);
      } catch {
        setPolicyBlocked(false);
      }
    }

    let permissionStatus: PermissionStatus | null = null;
    let active = true;
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((status) => {
          if (!active) return;
          permissionStatus = status;
          setPermission(status.state as MicrophonePermission);
          status.onchange = () => {
            setPermission(status.state as MicrophonePermission);
            if (status.state === "granted" && errorKindRef.current === "permission") {
              errorKindRef.current = null;
              setErrorKind(null);
              setError(null);
              setStatus("idle");
            }
          };
        })
        .catch(() => {
          // Permissions API support for microphone is not universal.
        });
    }

    return () => {
      active = false;
      if (permissionStatus) permissionStatus.onchange = null;
    };
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
      setRecorderError("unsupported", "This browser cannot record audio. Use the upload or paste fallback instead.");
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setRecorderError(
        "insecure",
        "Recording requires HTTPS. Open the app over a secure connection, or upload an audio file or paste a transcript.",
      );
      return;
    }
    if (status === "requesting" || status === "recording" || status === "stopping") return;

    revokeClipUrl();
    errorKindRef.current = null;
    setErrorKind(null);
    setError(null);
    if (mountedRef.current) {
      setClip(null);
      setDuration(0);
      setStatus("requesting");
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (first) {
        const name = first instanceof DOMException ? first.name : "";
        if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw first;
        }
      }

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
        setRecorderError("unknown", "Recording stopped unexpectedly. Try again or use the fallback options.");
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
          setRecorderError("empty", "That recording was empty. Hold the record button a little longer and try again.");
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
      const described = describeMicrophoneError(caught, { embedded, policyBlocked });
      const name = caught instanceof DOMException ? caught.name : "unknown";
      console.warn("[voice] microphone start failed", {
        name,
        embedded,
        policyBlocked,
        permission,
      });
      setRecorderError(described.kind, described.message);
    }
  }, [
    clearTimer,
    embedded,
    permission,
    policyBlocked,
    releaseStream,
    revokeClipUrl,
    setRecorderError,
    status,
    stop,
    supported,
  ]);

  const cancel = useCallback(() => {
    clearTimer();
    discardRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    releaseStream();
    revokeClipUrl();
    errorKindRef.current = null;
    if (mountedRef.current) {
      setClip(null);
      setDuration(0);
      setError(null);
      setErrorKind(null);
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
    errorKind,
    permission,
    embedded,
    policyBlocked,
    duration,
    clip,
    start,
    stop,
    cancel,
    reset,
    clearError: clearRecorderError,
  };
}

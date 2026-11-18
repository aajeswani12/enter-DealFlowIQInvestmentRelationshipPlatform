// Voice transcription backend function.
// Authorization: a valid signed-in user who is an active workspace member.
// Credentials: STT_API_KEY lives only in backend secrets. Speech-to-text is
// configurable and reports itself as unconfigured when the secret is absent.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VOICE_BUCKET = "voice-notes";
const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AuthContext = { userId: string; supabaseUrl: string; anonKey: string; authorization: string };

async function authenticate(req: Request): Promise<{ context?: AuthContext; response?: Response }> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) {
    return { response: json({ error: "Authentication required." }, 401) };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    console.error("transcribeVoiceNote: Supabase environment variables are missing");
    return { response: json({ error: "The transcription service is misconfigured." }, 500) };
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) {
    return { response: json({ error: "Authentication required." }, 401) };
  }
  const user = (await userResponse.json()) as { id?: string };
  if (!user?.id) {
    return { response: json({ error: "Authentication required." }, 401) };
  }

  const memberResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/is_project_member`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!memberResponse.ok) {
    console.error("transcribeVoiceNote: membership check failed", memberResponse.status);
    return { response: json({ error: "Could not verify workspace access." }, 500) };
  }
  const isMember = await memberResponse.json();
  if (isMember !== true) {
    return { response: json({ error: "You do not have access to this workspace." }, 403) };
  }

  return { context: { userId: user.id, supabaseUrl, anonKey, authorization } };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const authResult = await authenticate(req);
    if (!authResult.context) {
      return authResult.response ?? json({ error: "Authentication required." }, 401);
    }
    const { userId, supabaseUrl, anonKey, authorization } = authResult.context;

    const body = (await req.json().catch(() => null)) as { audioPath?: string; mimeType?: string } | null;
    const audioPath = typeof body?.audioPath === "string" ? body.audioPath.trim() : "";
    const mimeType = typeof body?.mimeType === "string" ? body.mimeType : "audio/webm";
    const normalizedMime = mimeType.toLowerCase().split(";")[0];
    const supportedMime = new Set([
      "audio/webm", "audio/ogg", "audio/mp4", "audio/m4a", "audio/x-m4a",
      "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/wave",
    ]);
    const audioExtension = audioPath.split(".").pop()?.toLowerCase() ?? "";
    if (!supportedMime.has(normalizedMime) && !["webm", "ogg", "mp4", "m4a", "mp3", "wav"].includes(audioExtension)) {
      return json(
        { error: "Unsupported audio format. Use MP3, M4A/MP4, WAV, OGG or WebM.", configured: false },
        415,
      );
    }

    if (!audioPath || audioPath.includes("..") || !audioPath.startsWith(`${userId}/`)) {
      return json({ error: "Invalid audio path." }, 400);
    }

    // The caller's own JWT signs the object, so storage RLS also applies.
    const encodedPath = audioPath.split("/").map(encodeURIComponent).join("/");
    const signResponse = await fetch(`${supabaseUrl}/storage/v1/object/sign/${VOICE_BUCKET}/${encodedPath}`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 120 }),
    });
    if (!signResponse.ok) {
      console.error("transcribeVoiceNote: could not sign audio", signResponse.status);
      return json({ error: "The audio file could not be opened." }, 404);
    }
    const signed = (await signResponse.json()) as { signedURL?: string; signedUrl?: string };
    const relative = signed.signedURL ?? signed.signedUrl ?? "";
    let signedUrl = relative;
    if (relative.startsWith("/object/")) signedUrl = `${supabaseUrl}/storage/v1${relative}`;
    else if (relative.startsWith("/")) signedUrl = `${supabaseUrl}${relative}`;
    if (!signedUrl) {
      return json({ error: "The audio file could not be opened." }, 404);
    }

    const sttApiKey = Deno.env.get("STT_API_KEY");
    const provider = Deno.env.get("STT_PROVIDER") ?? "openai-compatible";
    const model = Deno.env.get("STT_MODEL") ?? "whisper-1";

    if (!sttApiKey) {
      return json({
        configured: false,
        provider,
        reason:
          "Speech-to-text is not configured for this workspace. The audio is stored privately; add a transcript below or ask an administrator to configure STT_API_KEY.",
      });
    }

    const audioResponse = await fetch(signedUrl);
    if (!audioResponse.ok) {
      console.error("transcribeVoiceNote: audio download failed", audioResponse.status);
      return json({ error: "The audio file could not be downloaded." }, 502);
    }
    const audio = await audioResponse.arrayBuffer();
    if (audio.byteLength === 0 || audio.byteLength < 1024) {
      return json({ error: "The recording is empty." }, 400);
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      return json({ error: "The recording is larger than 25 MB." }, 413);
    }

    const extension = normalizedMime.includes("mp4") || normalizedMime.includes("m4a")
      ? "m4a"
      : normalizedMime.includes("ogg")
        ? "ogg"
        : normalizedMime.includes("mpeg") || normalizedMime.includes("mp3")
          ? "mp3"
          : normalizedMime.includes("wav")
            ? "wav"
            : "webm";
    const form = new FormData();
    form.append("file", new Blob([audio], { type: mimeType || "audio/webm" }), `recording.${extension}`);
    form.append("model", model);
    form.append("response_format", "json");

    const baseUrl = Deno.env.get("STT_BASE_URL") ?? "https://api.openai.com/v1/audio/transcriptions";
    const upstream = await fetch(baseUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${sttApiKey}` },
      body: form,
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error("transcribeVoiceNote: provider rejected the request", upstream.status);
      let message = "The transcription provider rejected the request.";
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string }; message?: string };
        message = parsed.error?.message ?? parsed.message ?? message;
      } catch {
        // keep the generic message
      }
      return json({ error: message, configured: true }, 502);
    }

    let transcript = "";
    try {
      const parsed = JSON.parse(raw) as { text?: string };
      transcript = typeof parsed.text === "string" ? parsed.text : "";
    } catch {
      console.error("transcribeVoiceNote: provider returned non-JSON output");
    }
    if (!transcript.trim()) {
      return json({ error: "The transcription provider returned an empty transcript." }, 502);
    }

    return json({ configured: true, transcript: transcript.trim(), provider, model });
  } catch (error) {
    console.error(
      "transcribeVoiceNote failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return json({ error: "The transcription service failed. Please try again." }, 500);
  }
});

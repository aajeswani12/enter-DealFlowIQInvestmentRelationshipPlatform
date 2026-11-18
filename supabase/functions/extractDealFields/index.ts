// Structured deal extraction backend function.
// Uses Enter AI (text model) and only ever returns fields supported by the
// transcript. It never creates records; the client saves after confirmation.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_API_BASE = "https://api.enter.pro";
const AI_MODEL = "deepseek/deepseek-v4-flash";
const ENTER_PROJECT_ID = "6f92e2693b094e9486160dabb429ab7e";
const MAX_TRANSCRIPT_CHARS = 20000;

const SECTORS = [
  "Fintech",
  "Enterprise SaaS",
  "Healthtech",
  "Climate",
  "Logistics",
  "Consumer",
  "Marketplace",
  "Vertical SaaS",
  "Infrastructure",
];
const STAGES = ["Pre-seed", "Seed", "Series A", "Series B", "Growth"];
const GEOGRAPHIES = [
  "Southeast Asia",
  "India",
  "US & Canada",
  "Europe",
  "MENA",
  "Latin America",
  "Global",
];

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
    console.error("extractDealFields: Supabase environment variables are missing");
    return { response: json({ error: "The extraction service is misconfigured." }, 500) };
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
    console.error("extractDealFields: membership check failed", memberResponse.status);
    return { response: json({ error: "Could not verify workspace access." }, 500) };
  }
  const isMember = await memberResponse.json();
  if (isMember !== true) {
    return { response: json({ error: "You do not have access to this workspace." }, 403) };
  }

  return { context: { userId: user.id, supabaseUrl, anonKey, authorization } };
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function asAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  const match = cleaned.match(/^([0-9]*\.?[0-9]+)([mk])?$/i);
  if (!match) return null;
  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  if (match[2]) amount *= match[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
  return amount;
}

function matchOption(value: unknown, options: string[]): string {
  const text = asString(value, 80).toLowerCase();
  return options.find((option) => option.toLowerCase() === text) ?? "";
}

function asStringArray(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function asClaims(value: unknown): { label: string; value_text: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      label: asString(item.label, 160),
      value_text: asString(item.value_text, 300),
    }))
    .filter((item) => item.label.length > 0)
    .slice(0, 10);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const cleaned = text
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
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

    const body = (await req.json().catch(() => null)) as { transcript?: string } | null;
    const transcript = typeof body?.transcript === "string" ? body.transcript.trim() : "";
    if (transcript.length < 1) {
      return json({ error: "The transcript is empty." }, 400);
    }
    if (transcript.length > MAX_TRANSCRIPT_CHARS) {
      return json({ error: "The transcript is too long to analyse." }, 413);
    }

    const aiToken = Deno.env.get("AI_API_TOKEN_6f92e2693b09");
    if (!aiToken) {
      return json({
        configured: false,
        reason: "Structured extraction is not configured for this workspace. The transcript will still be saved.",
      });
    }

    const systemPrompt = [
      "You extract structured deal information from a venture capital investor's voice note.",
      "Return ONLY a JSON object. Do not include markdown, commentary, or explanations.",
      "Use only facts explicitly supported by the transcript. Never invent a company, person, metric, round size or date.",
      "Use empty strings for unknown text, null for unknown numbers, and [] for empty arrays.",
      'The JSON keys are: "company_name", "website", "one_liner", "sector", "geography", "stage", "target_raise", "cheque_sought", "thesis", "next_step", "open_questions", "claims", "confidence".',
      `"sector" must be one of: ${SECTORS.join(", ")}. If none fits, use "".`,
      `"stage" must be one of: ${STAGES.join(", ")}. If none fits, use "".`,
      `"geography" must be one of: ${GEOGRAPHIES.join(", ")}. If none fits, use "".`,
      '"target_raise" and "cheque_sought" are plain USD numbers when stated, otherwise null.',
      '"thesis" is a short summary of why the speaker finds the deal interesting, in their own framing.',
      '"next_step" is a concrete next action only if one is stated.',
      '"open_questions" is an array of unresolved questions mentioned in the note.',
      '"claims" is an array of up to 10 objects with "label" and "value_text" for metrics or assertions actually stated.',
      '"confidence" must be "low", "medium", or "high" based on how complete the transcript is.',
    ].join("\n");

    const upstream = await fetch(`${AI_API_BASE}/code/api/v1/ai/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${aiToken}`,
        "Content-Type": "application/json",
        "X-Session-ID": req.headers.get("X-Session-ID")?.trim() || crypto.randomUUID(),
        "X-Enter-Project-ID": ENTER_PROJECT_ID,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcript:\n"""\n${transcript}\n"""` },
        ],
        stream: false,
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error("extractDealFields: AI gateway error", upstream.status);
      let message = "The extraction service is temporarily unavailable.";
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep the generic message
      }
      if (upstream.status === 402) {
        message = "AI credits are exhausted. The transcript will still be saved.";
      }
      if (upstream.status === 403) {
        message = "AI extraction is disabled for this project. The transcript will still be saved.";
      }
      return json({ error: message, configured: true }, 502);
    }

    let content = "";
    try {
      const parsed = JSON.parse(raw) as {
        choices?: { message?: { content?: string } }[];
      };
      content = parsed.choices?.[0]?.message?.content ?? "";
    } catch {
      console.error("extractDealFields: unreadable gateway response");
    }

    if (!content) {
      return json({ error: "The extraction service returned an empty response." }, 502);
    }

    const object = parseJsonObject(content);
    if (!object) {
      console.error("extractDealFields: model response was not valid JSON");
      return json({ error: "The extraction service returned an unreadable response." }, 502);
    }

    const fields = {
      company_name: asString(object.company_name, 200),
      website: asString(object.website, 300),
      one_liner: asString(object.one_liner, 500),
      sector: matchOption(object.sector, SECTORS),
      geography: matchOption(object.geography, GEOGRAPHIES),
      stage: matchOption(object.stage, STAGES),
      target_raise: asAmount(object.target_raise),
      cheque_sought: asAmount(object.cheque_sought),
      thesis: asString(object.thesis, 4000),
      next_step: asString(object.next_step, 500),
      open_questions: asStringArray(object.open_questions, 10),
      claims: asClaims(object.claims),
      confidence: ["low", "medium", "high"].includes(asString(object.confidence, 20))
        ? asString(object.confidence, 20)
        : "unknown",
    };

    return json({ configured: true, fields, model: AI_MODEL });
  } catch (error) {
    console.error("extractDealFields failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The extraction service failed. Please try again; the transcript is preserved." }, 500);
  }
});

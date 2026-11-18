// Personalized outreach draft generation.
// Authorization: signed-in workspace member with write access.
// Grounding: only stored deal facts, approved claims, investor preferences and
// recorded relationship information. The function never sends email.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AI_API_BASE = "https://api.enter.pro";
const AI_MODEL = "deepseek/deepseek-v4-flash";
const ENTER_PROJECT_ID = "6f92e2693b094e9486160dabb429ab7e";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface AuthContext {
  userId: string;
  supabaseUrl: string;
  anonKey: string;
  authorization: string;
}

async function authenticate(req: Request): Promise<{ context?: AuthContext; response?: Response }> {
  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return { response: json({ error: "Authentication required." }, 401) };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!supabaseUrl || !anonKey) {
    console.error("generateOutreachDraft: Supabase environment variables are missing");
    return { response: json({ error: "The generation service is misconfigured." }, 500) };
  }
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!userResponse.ok) return { response: json({ error: "Authentication required." }, 401) };
  const user = (await userResponse.json()) as { id?: string };
  if (!user?.id) return { response: json({ error: "Authentication required." }, 401) };

  const writerResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/can_write_project`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: authorization, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!writerResponse.ok) {
    console.error("generateOutreachDraft: write-access check failed", writerResponse.status);
    return { response: json({ error: "Could not verify workspace access." }, 500) };
  }
  const canWrite = await writerResponse.json();
  if (canWrite !== true) return { response: json({ error: "You need write access to generate a draft." }, 403) };

  return { context: { userId: user.id, supabaseUrl, anonKey, authorization } };
}

async function rest(
  context: AuthContext,
  path: string,
  init: RequestInit = {},
): Promise<{ response: Response; body: unknown }> {
  const response = await fetch(`${context.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: context.anonKey,
      Authorization: context.authorization,
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }
  return { response, body };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function list(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function money(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    notation: "compact",
  }).format(parsed);
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  const cleaned = content.replace(/^\s*```(?:json)?/i, "").replace(/```\s*$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function financialTokens(value: string): string[] {
  const matches =
    value.match(/\$?\s?\d[\d,.]*\s?(?:m|k|b|million|billion)\b|\$\s?\d[\d,.]*|\d+(?:\.\d+)?\s?%/gi) ?? [];
  return matches.map((item) => item.replace(/\s+/g, "").toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const authResult = await authenticate(req);
    if (!authResult.context) return authResult.response ?? json({ error: "Authentication required." }, 401);
    const auth = authResult.context;

    const payload = (await req.json().catch(() => null)) as { match_id?: string } | null;
    const matchId = typeof payload?.match_id === "string" ? payload.match_id : "";
    if (!matchId) return json({ error: "match_id is required." }, 400);

    const matchResult = await rest(
      auth,
      `deal_investor_matches?id=eq.${encodeURIComponent(matchId)}&select=deal_id,investor_id,match_status,introduction_strategy,missing_information,needs_research&limit=1`,
    );
    const match = (matchResult.body as Record<string, unknown>[] | null)?.[0];
    if (!match) return json({ error: "Match not found or not accessible." }, 404);
    const dealId = text(match.deal_id);
    const investorId = text(match.investor_id);

    const dealResult = await rest(
      auth,
      `deals?id=eq.${encodeURIComponent(dealId)}&select=company_name,summary,sector,stage,geography,cheque_sought,target_raise,thesis&limit=1`,
    );
    const deal = (dealResult.body as Record<string, unknown>[] | null)?.[0];
    if (!deal) return json({ error: "Deal not found." }, 404);

    const investorResult = await rest(
      auth,
      `investors?id=eq.${encodeURIComponent(investorId)}&select=name,investor_type,thesis,sectors,stages,geography,minimum_check,maximum_check,relationship&limit=1`,
    );
    const investor = (investorResult.body as Record<string, unknown>[] | null)?.[0];
    if (!investor) return json({ error: "Investor not found." }, 404);

    const contactResult = await rest(
      auth,
      `investor_contacts?investor_id=eq.${encodeURIComponent(investorId)}&select=contact_name,title,email,relationship_owner,relationship_strength,outreach_permission_status,is_primary&order=is_primary.desc&limit=1`,
    );
    const contact = (contactResult.body as Record<string, unknown>[] | null)?.[0] ?? null;
    if (contact?.outreach_permission_status === "do_not_contact") {
      return json({ error: "This contact is marked do-not-contact. No draft was generated." }, 403);
    }

    const interactionsResult = await rest(
      auth,
      `investor_interactions?investor_id=eq.${encodeURIComponent(investorId)}&select=kind,summary,occurred_at&order=occurred_at.desc&limit=5`,
    );
    const interactions = (interactionsResult.body as Record<string, unknown>[] | null) ?? [];

    const claimsResult = await rest(
      auth,
      `deal_claims?deal_id=eq.${encodeURIComponent(dealId)}&review_status=eq.approved&verification_status=in.(founder_reported,corroborated)&select=claim_type,label,value_text,reporting_period,supporting_excerpt&limit=20`,
    );
    const claims = (claimsResult.body as Record<string, unknown>[] | null) ?? [];

    const memberResult = await rest(
      auth,
      `workspace_members?user_id=eq.${encodeURIComponent(auth.userId)}&select=display_name,email&limit=1`,
    );
    const member = (memberResult.body as Record<string, unknown>[] | null)?.[0] ?? null;
    const senderName = text(member?.display_name) || text(member?.email).split("@")[0] || "";

    const missing: string[] = [];
    const grounding: string[] = [];

    const company = text(deal.company_name) || "the company";
    const summary = text(deal.summary);
    const sector = text(deal.sector);
    const stage = text(deal.stage);
    const geography = text(deal.geography);
    const cheque = money(deal.cheque_sought) || money(deal.target_raise);
    const dealLine = [company, summary].filter(Boolean).join(" — ");
    grounding.push(`Deal: ${dealLine || company}`);
    if (sector || stage || geography) {
      grounding.push(
        `Round/positioning: ${[stage, sector, geography].filter(Boolean).join(", ")}${cheque ? `; funding sought ${cheque}` : ""}`,
      );
    } else {
      missing.push("Deal stage, sector and geography are not all recorded.");
    }
    if (!cheque) missing.push("Funding amount or cheque sought is not recorded.");
    if (!summary) missing.push("Deal summary is not recorded.");

    const investorSectors = list(investor.sectors);
    const investorStages = list(investor.stages);
    const investorGeos = list(investor.geography);
    if (investorSectors.length || investorStages.length || investorGeos.length) {
      grounding.push(
        `Investor mandate: ${[
          investorStages.length ? `stages ${investorStages.join(", ")}` : "",
          investorSectors.length ? `sectors ${investorSectors.join(", ")}` : "",
          investorGeos.length ? `geography ${investorGeos.join(", ")}` : "",
          investor.minimum_check || investor.maximum_check
            ? `cheque ${money(investor.minimum_check) || "?"}–${money(investor.maximum_check) || "?"}`
            : "",
        ]
          .filter(Boolean)
          .join("; ")}`,
      );
    } else {
      missing.push("Investor stage, sector and geography preferences are not recorded.");
    }

    const contactName = text(contact?.contact_name);
    if (contactName) {
      grounding.push(`Contact: ${contactName}${text(contact?.title) ? `, ${text(contact?.title)}` : ""}`);
    } else {
      missing.push("No named investor contact is recorded.");
    }
    if (!contact?.email) missing.push("No contact email is recorded.");

    if (text(contact?.relationship_strength) || text(investor.relationship)) {
      grounding.push(
        `Relationship: ${text(investor.relationship) || "unknown"} investor rollup; contact strength ${
          text(contact?.relationship_strength) || "unknown"
        }.`,
      );
    }
    if (interactions.length > 0) {
      const latest = interactions[0];
      grounding.push(
        `Prior interaction: ${text(latest.kind)} on ${text(latest.occurred_at).slice(0, 10)} — ${text(latest.summary)}`,
      );
    } else {
      missing.push("No prior interaction is recorded with this investor.");
    }

    for (const claim of claims.slice(0, 4)) {
      const label = text(claim.label);
      const value = text(claim.value_text);
      const period = text(claim.reporting_period);
      if (!label || !value) continue;
      grounding.push(
        `Approved company claim: ${label} — ${value}${period ? ` (${period})` : ""} [founder-reported/corroborated]`,
      );
    }
    if (!claims.some((claim) => text(claim.value_text))) {
      missing.push("No approved founder-reported or corroborated claims are on file.");
    }
    if (!text(deal.thesis) && !summary) missing.push("No deal thesis is recorded.");

    const allowedNumbers = new Set(grounding.flatMap((fact) => financialTokens(fact)));
    const allowedEmails = new Set(
      [text(contact?.email), text(member?.email)].filter(Boolean).map((value) => value.toLowerCase()),
    );

    const aiToken = Deno.env.get("AI_API_TOKEN_6f92e2693b09");
    if (!aiToken) {
      return json({
        configured: false,
        reason: "Outreach generation is not configured for this project. Write the draft manually.",
        grounding,
        missingInformation: missing,
      });
    }

    const systemPrompt = [
      "You write a short, specific introductory email on behalf of Talok Capital, an early-stage venture investor.",
      "Return ONLY a JSON object with keys \"subject\" and \"body\".",
      "Use ONLY the facts supplied in the user message. Never invent a name, contact, email address, metric, date, funding amount, commitment or outcome.",
      "Never claim the investor is interested, excited, warm, or already aligned beyond the recorded relationship line.",
      "Never claim a conversation happened unless a prior interaction is supplied.",
      "Never mention matching scores, algorithms, or that the investor was shortlisted.",
      "If the contact name is supplied, you may address them by that name. Otherwise start with 'Hello,' and do not invent a person.",
      "Do not include an email address or a calendar link.",
      "Do not promise investment, a term sheet, allocation, returns or any next step beyond offering a short introductory call.",
      "Use at most two approved company claims, and include the reporting period when supplied.",
      "Keep it under 170 words, plain and professional. Sign off with the supplied sender name if present, otherwise 'Talok Capital'.",
      "Omit anything not grounded in the facts.",
    ].join("\n");

    const userPrompt = [
      "Stored facts:",
      ...grounding.map((fact) => `- ${fact}`),
      "",
      `Known missing information (do not fill it in): ${missing.join(" ")}`,
      senderName ? `Sender name (only if recorded): ${senderName}` : "Sender name: not recorded; sign as Talok Capital.",
      contactName ? `Contact name (only if recorded): ${contactName}` : "No contact name is recorded; use 'Hello,' with no name.",
      "Write the JSON now.",
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
          { role: "user", content: userPrompt },
        ],
        stream: false,
        temperature: 0.4,
        max_tokens: 700,
      }),
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error("generateOutreachDraft: AI gateway error", upstream.status);
      let message = "The generation service is temporarily unavailable. Write the draft manually.";
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep the generic message
      }
      return json({ error: message }, 502);
    }

    let content = "";
    try {
      const parsed = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
      content = parsed.choices?.[0]?.message?.content ?? "";
    } catch {
      // handled below
    }
    const object = content ? parseJsonObject(content) : null;
    if (!object) {
      return json({ error: "The generation service returned an unreadable draft. Write it manually." }, 502);
    }

    const subject = text(object.subject).slice(0, 240);
    const body = text(object.body).slice(0, 6000);
    if (!subject || !body) {
      return json({ error: "The generation service returned an empty draft. Write it manually." }, 502);
    }

    const foundEmails = body.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
    if (foundEmails.some((email) => !allowedEmails.has(email.toLowerCase()))) {
      return json({ error: "Generation produced an unknown email address. Nothing was returned; write the draft manually." }, 502);
    }
    if (!contactName) {
      const greeting = body.split("\n")[0] ?? "";
      const namedGreeting = greeting.match(/^(hi|hello|dear)\s+([A-Z][a-z]+)/);
      if (namedGreeting && !/^(there)$/i.test(namedGreeting[2])) {
        return json({ error: "No named contact is recorded, so a named greeting was rejected. Write the draft manually." }, 502);
      }
    }
    const prohibited = /\b(guarantee|guaranteed|will invest|commit to invest|term sheet|allocation guaranteed|assured returns)\b/i;
    if (prohibited.test(body)) {
      return json({ error: "Generation produced language that could imply a commitment. Nothing was returned." }, 502);
    }
    if (/\b(you (?:are|were|seem|have expressed)|your (?:interest|excitement)|excited to partner)\b/i.test(body) && interactions.length === 0) {
      return json({ error: "Generation implied investor interest without a recorded interaction. Nothing was returned." }, 502);
    }
    const bodyNumbers = financialTokens(body);
    const inventedNumbers = bodyNumbers.filter((number) => !allowedNumbers.has(number));
    if (inventedNumbers.length > 0) {
      return json({ error: "Generation introduced an ungrounded number. Nothing was returned; write the draft manually." }, 502);
    }

    return json({
      configured: true,
      subject,
      body,
      grounding,
      missingInformation: missing,
      model: AI_MODEL,
    });
  } catch (error) {
    console.error("generateOutreachDraft failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The generation service failed. Write the draft manually." }, 500);
  }
});

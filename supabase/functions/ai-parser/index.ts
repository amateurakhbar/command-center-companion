// ai-parser: Convert natural language into structured task objects.
// Called server-to-server (from telegram-webhook). Requires INTERNAL_FUNCTION_SECRET
// header OR a valid JWT. For now we share the SUPABASE_SERVICE_ROLE_KEY pattern via a
// dedicated header so frontend can never reach it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { aiConfigured, callAI } from "../_shared/ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const PARSER_VERSION = "ai_parser_v1";

const TASK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    needs_clarification: { type: "boolean" },
    clarification_question: { type: ["string", "null"] },
    confidence: { type: "number" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          category: {
            type: "string",
            enum: ["job_application", "networking", "follow_up", "meeting", "interview_prep", "admin", "personal"],
          },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          due_at: { type: ["string", "null"] },
          person_name: { type: ["string", "null"] },
          company_name: { type: ["string", "null"] },
          job_title: { type: ["string", "null"] },
          next_action: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          confidence: { type: "number" },
        },
        required: ["title", "category", "priority", "due_at", "confidence"],
      },
    },
  },
  required: ["needs_clarification", "clarification_question", "confidence", "tasks"],
};

function buildSystemPrompt(tz: string, nowIso: string): string {
  return [
    "You are a task extraction engine for a job-search command center.",
    "Convert messy natural language into structured task objects.",
    "",
    `User timezone: ${tz}`,
    `Current time (ISO): ${nowIso}`,
    "",
    "RULES:",
    "1. Output ONLY via the extract_tasks tool call. No prose.",
    "2. A single message may contain multiple distinct tasks — split them.",
    "3. due_at must be ISO timestamptz in the user's timezone offset, or null.",
    "4. 'tomorrow morning' = tomorrow 09:00 in user's tz.",
    "5. 'tonight' = today 20:00.",
    "6. 'by Friday' = upcoming Friday 18:00.",
    "7. If no due date is mentioned, due_at = null.",
    "8. Keep titles short and action-oriented (under ~80 chars).",
    "9. Categories: job_application, networking, follow_up, meeting, interview_prep, admin, personal.",
    "10. Priority defaults to medium. Use high only if clearly urgent.",
    "11. If pronouns are ambiguous (him/her/them with no name), set needs_clarification=true and ask a single short clarification_question. Return tasks=[] in that case.",
    "12. If confidence < 0.5 for a task, set needs_clarification=true and ask one clarifying question.",
    "13. Extract person_name, company_name, job_title when mentioned (do not invent).",
    "14. Do not create jobs or people records — that is downstream.",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: corsHeaders });
  }

  // Internal-only auth: require either the service role key or our internal secret.
  // The telegram-webhook calls this with the service role key (already in its env).
  const authHeader = req.headers.get("authorization") ?? "";
  const internal = req.headers.get("x-internal-secret") ?? "";
  const tokenOk =
    (SERVICE_ROLE && authHeader === `Bearer ${SERVICE_ROLE}`) ||
    (SERVICE_ROLE && internal === SERVICE_ROLE);
  if (!tokenOk) {
    return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try { body = await req.json(); } catch {
    return jsonResp(400, { success: false, error: "invalid_json" });
  }

  const userId: string | undefined = body?.user_id;
  const text: string | undefined = body?.text;
  const tz: string = body?.timezone || "Europe/London";
  const nowIso: string = body?.current_time_iso || new Date().toISOString();
  const source: string = body?.source || "ai_parser";

  if (!userId || !text || !text.trim()) {
    return jsonResp(400, { success: false, error: "missing user_id or text" });
  }

  if (!aiConfigured()) {
    return jsonResp(200, {
      success: false,
      parser_version: PARSER_VERSION,
      error: "ai_not_configured",
      needs_clarification: false,
      clarification_question: null,
      confidence: 0,
      tasks: [],
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const aiResult = await callAI({
    messages: [
      { role: "system", content: buildSystemPrompt(tz, nowIso) },
      { role: "user", content: text },
    ],
    tool: {
      name: "extract_tasks",
      description: "Return structured tasks extracted from the user's natural language input.",
      parameters: TASK_SCHEMA,
    },
    temperature: 0.2,
  });

  if (!aiResult.ok) {
    // Persist the failed input
    await supabase.from("raw_inputs").insert({
      user_id: userId,
      source,
      content: text,
      parsed_json: { error: aiResult.error, status: aiResult.status },
      parser_version: PARSER_VERSION,
    });
    return jsonResp(200, {
      success: false,
      parser_version: PARSER_VERSION,
      error: aiResult.error,
      needs_clarification: false,
      clarification_question: null,
      confidence: 0,
      tasks: [],
    });
  }

  const args = aiResult.toolArgs;
  if (!args || typeof args !== "object" || !Array.isArray(args.tasks)) {
    await supabase.from("raw_inputs").insert({
      user_id: userId,
      source,
      content: text,
      parsed_json: { error: "malformed_ai_output", raw_text: aiResult.text },
      parser_version: PARSER_VERSION,
    });
    return jsonResp(200, {
      success: false,
      parser_version: PARSER_VERSION,
      error: "malformed_ai_output",
      needs_clarification: false,
      clarification_question: null,
      confidence: 0,
      tasks: [],
    });
  }

  const result = {
    success: true,
    parser_version: PARSER_VERSION,
    needs_clarification: Boolean(args.needs_clarification),
    clarification_question: args.clarification_question ?? null,
    confidence: typeof args.confidence === "number" ? args.confidence : 0.5,
    tasks: args.tasks,
  };

  // Log raw input + parsed result
  const { data: rawRow } = await supabase
    .from("raw_inputs")
    .insert({
      user_id: userId,
      source,
      content: text,
      parsed_json: result,
      parser_version: PARSER_VERSION,
    })
    .select("id")
    .single();

  return jsonResp(200, { ...result, raw_input_id: rawRow?.id ?? null });
});

function jsonResp(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

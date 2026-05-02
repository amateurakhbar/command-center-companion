// Shared AI helper. Routes through the Lovable AI Gateway using LOVABLE_API_KEY.
// Never call directly from the frontend. Never log the key.
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const DEFAULT_MODEL = "google/gemini-2.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export function aiConfigured(): boolean {
  return Boolean(LOVABLE_API_KEY);
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AICallOptions = {
  model?: string;
  messages: ChatMessage[];
  // If provided, force a JSON tool call with this schema.
  tool?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  temperature?: number;
};

export type AICallResult =
  | { ok: true; text: string | null; toolArgs: any | null; raw: any }
  | { ok: false; status: number; error: string };

export async function callAI(opts: AICallOptions): Promise<AICallResult> {
  if (!LOVABLE_API_KEY) return { ok: false, status: 0, error: "ai_not_configured" };

  const body: any = {
    model: opts.model ?? DEFAULT_MODEL,
    messages: opts.messages,
  };
  if (typeof opts.temperature === "number") body.temperature = opts.temperature;
  if (opts.tool) {
    body.tools = [
      {
        type: "function",
        function: {
          name: opts.tool.name,
          description: opts.tool.description,
          parameters: opts.tool.parameters,
        },
      },
    ];
    body.tool_choice = { type: "function", function: { name: opts.tool.name } };
  }

  let resp: Response;
  try {
    resp = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, error: `network_error: ${e instanceof Error ? e.message : String(e)}` };
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("AI gateway error", resp.status, txt.slice(0, 500));
    return { ok: false, status: resp.status, error: `gateway_${resp.status}` };
  }

  let data: any;
  try {
    data = await resp.json();
  } catch (e) {
    return { ok: false, status: resp.status, error: "invalid_json_response" };
  }

  const choice = data?.choices?.[0];
  const message = choice?.message;
  let toolArgs: any = null;
  const toolCall = message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    toolArgs = safeJsonParse(toolCall.function.arguments);
  }
  return { ok: true, text: message?.content ?? null, toolArgs, raw: data };
}

export function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    // attempt one repair: strip code fences / leading prose
    const m = s.match(/\{[\s\S]*\}$/);
    if (m) {
      try { return JSON.parse(m[0]); } catch { /* fall through */ }
    }
    return null;
  }
}

import { config } from "../config.js";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface LLMClient {
  /** Sends messages, asks the model for a raw JSON object back as a string. */
  chatJSON(messages: ChatMessage[], opts?: { model?: string; temperature?: number }): Promise<string>;
}

class GroqClient implements LLMClient {
  private client: Promise<import("groq-sdk").default>;

  constructor(private apiKey: string) {
    this.client = import("groq-sdk").then((m) => new m.default({ apiKey: this.apiKey }));
  }

  async chatJSON(messages: ChatMessage[], opts?: { model?: string; temperature?: number }): Promise<string> {
    const groq = await this.client;
    const completion = await groq.chat.completions.create({
      model: opts?.model ?? config.llm.groq.reasoningModel,
      messages,
      temperature: opts?.temperature ?? 0.2,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content) throw new Error("Groq returned an empty response");
    return content;
  }
}

class OllamaClient implements LLMClient {
  constructor(private baseUrl: string, private defaultModel: string) {}

  async chatJSON(messages: ChatMessage[], opts?: { model?: string; temperature?: number }): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: opts?.model ?? this.defaultModel,
        messages,
        format: "json",
        stream: false,
        options: { temperature: opts?.temperature ?? 0.2 },
      }),
    });
    if (!res.ok) throw new Error(`Ollama request failed: ${res.status} ${res.statusText}`);
    const data = (await res.json()) as { message?: { content?: string } };
    if (!data.message?.content) throw new Error("Ollama returned an empty response");
    return data.message.content;
  }
}

let cached: LLMClient | undefined;

export function getLLMClient(): LLMClient {
  if (cached) return cached;

  if (config.llm.provider === "ollama") {
    cached = new OllamaClient(config.llm.ollama.baseUrl, config.llm.ollama.model);
    return cached;
  }

  if (!config.llm.groq.apiKey) {
    throw new Error(
      "LLM_PROVIDER=groq but GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys, or set LLM_PROVIDER=ollama for a fully local run."
    );
  }
  cached = new GroqClient(config.llm.groq.apiKey);
  return cached;
}

/** Calls the LLM and parses+validates the JSON response with a zod schema, retrying once on failure. */
export async function chatStructured<T>(
  messages: ChatMessage[],
  parse: (raw: unknown) => T,
  opts?: { model?: string; temperature?: number }
): Promise<T> {
  const client = getLLMClient();
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await client.chatJSON(messages, opts);
    try {
      return parse(JSON.parse(raw));
    } catch (err) {
      if (attempt === 1) {
        throw new Error(`LLM response failed schema validation after retry: ${err}\nRaw: ${raw.slice(0, 500)}`);
      }
      messages = [
        ...messages,
        { role: "user", content: "Your last response was not valid JSON matching the required schema. Reply again with ONLY corrected JSON, no prose." },
      ];
    }
  }
  throw new Error("unreachable");
}

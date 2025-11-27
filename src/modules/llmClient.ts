export type LLMProvider =
  | "openai"
  | "gemini"
  | "minimax"
  | "moonshot"
  | "zhipu"
  | "deepseek"
  | "qwen"
  | "custom";

export interface LLMOptions {
  provider: LLMProvider;
  apiKey: string;
  baseURL?: string;
  model?: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  log?: boolean;
}

export interface ContentPayload {
  meta: Record<string, any>;
  textChunks?: string[];
  highlights?: string[];
}

export interface LLMResult {
  text: string;
  raw: any;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const PROVIDER_DEFAULTS: Record<
  LLMProvider,
  { baseURL: string; model: string; models: string[]; path?: string }
> = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4.1",
    models: ["gpt-4.1", "gpt-4.1-mini", "o4-mini"],
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com",
    model: "gemini-2.5-flash",
    models: ["gemini-3-pro-preview", "gemini-2.5-flash", "gemini-2.5-pro"],
    path: "v1beta/models/{model}:generateContent",
  },
  minimax: {
    baseURL: "https://api.minimax.chat/v1",
    model: "MiniMax-M2",
    models: ["MiniMax-M2", "abab6.5s-chat", "abab6.5-chat"],
  },
  moonshot: {
    baseURL: "https://api.moonshot.cn/v1",
    model: "kimi-k2",
    models: ["kimi-k2", "kimi-latest", "moonshot-v1-128k"],
  },
  zhipu: {
    baseURL: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4.6",
    models: ["glm-4.6", "glm-4.5", "glm-z1-air"],
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner", "deepseek-coder"],
  },
  qwen: {
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen3-max",
    models: ["qwen3-max", "qwen3-plus", "qwen-plus"],
  },
  custom: { baseURL: "", model: "", models: [] },
};

export function getProviderModels(provider: LLMProvider): string[] {
  return PROVIDER_DEFAULTS[provider]?.models || [];
}

export function getProviderDefaultURL(provider: LLMProvider): string {
  return PROVIDER_DEFAULTS[provider]?.baseURL || "";
}

export function getProviderDefaultModel(provider: LLMProvider): string {
  return PROVIDER_DEFAULTS[provider]?.model || "";
}

function resolvedBaseURL(options: LLMOptions) {
  const base = options.baseURL?.trim();
  if (base) return base.replace(/\/+$/, "");
  return PROVIDER_DEFAULTS[options.provider].baseURL.replace(/\/+$/, "");
}

function resolvedModel(options: LLMOptions) {
  return options.model?.trim() || PROVIDER_DEFAULTS[options.provider].model;
}

function logDebug(options: LLMOptions, ...args: any[]) {
  if (options.log) {
    ztoolkit.log("[LLM]", ...args);
  }
}

function buildOpenAIRequest(
  messages: Array<{ role: string; content: string }>,
  options: LLMOptions,
) {
  const base = resolvedBaseURL(options);
  const url = `${base}/chat/completions`;
  const body: any = {
    model: resolvedModel(options),
    messages,
  };
  if (options.maxTokens) body.max_tokens = options.maxTokens;
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.stream !== undefined) body.stream = options.stream;
  return {
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.apiKey}`,
    },
    body,
  };
}

function buildGeminiRequest(
  messages: Array<{ role: string; content: string }>,
  options: LLMOptions,
) {
  const base = resolvedBaseURL(options);
  const model = resolvedModel(options);
  const path =
    PROVIDER_DEFAULTS.gemini.path || "v1beta/models/{model}:generateContent";
  const url = `${base}/${path.replace("{model}", model)}?key=${encodeURIComponent(
    options.apiKey,
  )}`;
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const body: any = {
    contents,
  };
  if (options.maxTokens) body.generationConfig = { maxOutputTokens: options.maxTokens };
  if (options.temperature !== undefined) {
    body.generationConfig = body.generationConfig || {};
    body.generationConfig.temperature = options.temperature;
  }
  return {
    url,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  };
}

function buildRequest(
  messages: Array<{ role: string; content: string }>,
  options: LLMOptions,
) {
  if (options.provider === "gemini") {
    return buildGeminiRequest(messages, options);
  }
  return buildOpenAIRequest(messages, options);
}

function parseResponse(provider: LLMProvider, raw: any): string {
  if (provider === "gemini") {
    const cand = raw?.candidates?.[0];
    const part = cand?.content?.parts?.[0];
    return part?.text || "";
  }
  const choice = raw?.choices?.[0];
  return choice?.message?.content || choice?.text || "";
}

async function httpPost(
  url: string,
  body: any,
  headers: Record<string, string>,
  timeoutMs?: number,
): Promise<any> {
  const resp = await Zotero.HTTP.request("POST", url, {
    headers,
    body: JSON.stringify(body),
    timeout: timeoutMs,
    responseType: "json",
  });
  if (resp.status >= 400) {
    throw new Error(
      `HTTP ${resp.status}: ${typeof resp.response === "string" ? resp.response : JSON.stringify(resp.response)}`,
    );
  }
  return resp.response;
}

function buildMessages(
  payload: ContentPayload,
  prompt: string,
): Array<{ role: string; content: string }> {
  const metaLines = Object.entries(payload.meta || {})
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);
  const highlights = (payload.highlights || []).join("\n\n");
  const text = (payload.textChunks || []).join("\n\n");
  const ctx = [metaLines.join("\n"), highlights, text]
    .filter(Boolean)
    .join("\n\n");
  return [
    {
      role: "system",
      content: prompt,
    },
    {
      role: "user",
      content: ctx || "No additional context.",
    },
  ];
}

export async function summarize(
  payload: ContentPayload,
  prompt: string,
  options: LLMOptions,
): Promise<LLMResult> {
  const messages = buildMessages(payload, prompt);
  const req = buildRequest(messages, options);
  logDebug(options, "summarize request", req.url);
  const raw = await httpPost(req.url, req.body, req.headers, options.timeoutMs);
  const text = parseResponse(options.provider, raw);
  return { text, raw };
}

export async function testConnection(
  options: Pick<LLMOptions, "provider" | "apiKey" | "baseURL" | "model" | "timeoutMs">,
): Promise<{ ok: boolean; message?: string }> {
  const req = buildRequest(
    [
      {
        role: "user",
        content: "ping",
      },
    ],
    {
      provider: options.provider,
      apiKey: options.apiKey,
      baseURL: options.baseURL,
      model: options.model,
      timeoutMs: options.timeoutMs ?? 10_000,
    } as LLMOptions,
  );
  try {
    await httpPost(req.url, req.body, req.headers, options.timeoutMs ?? 10000);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err?.message || String(err) };
  }
}

/**
 * 多轮对话接口
 */
export async function chat(
  messages: ChatMessage[],
  options: LLMOptions,
): Promise<LLMResult> {
  const req = buildRequest(messages, options);
  logDebug(options, "chat request", req.url);
  const raw = await httpPost(req.url, req.body, req.headers, options.timeoutMs);
  const text = parseResponse(options.provider, raw);
  return { text, raw };
}

// Provedores de LLM suportados pela extensão microedcode.ai.
// Implementa streaming de respostas para OpenAI, Anthropic, Ollama
// e qualquer API compatível com o formato da OpenAI.

export type ProviderType =
  | "openai"
  | "anthropic"
  | "deepseek"
  | "ollama"
  | "openai-compativel";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamConfig {
  providerType: ProviderType;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature?: number;
  messages: ChatMessage[];
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}

/** Retorna a URL base padrão de cada provedor. */
export function urlBasePadrao(tipo: ProviderType): string {
  switch (tipo) {
    case "openai":
      return "https://api.openai.com/v1";
    case "anthropic":
      return "https://api.anthropic.com";
    case "deepseek":
      return "https://api.deepseek.com";
    case "ollama":
      return "http://localhost:11434";
    default:
      return "";
  }
}

/** Indica se o provedor exige uma chave de API. */
export function exigeChave(tipo: ProviderType): boolean {
  return tipo === "openai" || tipo === "anthropic" || tipo === "deepseek";
}

function normalizarBase(base: string): string {
  return base.replace(/\/+$/, "");
}

/** Ponto de entrada: encaminha o pedido de streaming para o provedor correto. */
export async function streamChat(cfg: StreamConfig): Promise<void> {
  const base = normalizarBase(cfg.baseUrl?.trim() || urlBasePadrao(cfg.providerType));

  if (cfg.providerType === "anthropic") {
    await streamAnthropic(cfg, base);
  } else if (cfg.providerType === "ollama") {
    await streamOllama(cfg, base);
  } else {
    // openai, deepseek e openai-compativel usam o mesmo formato (ChatCompletions).
    await streamOpenAI(cfg, base);
  }
}

/** Lê o corpo da resposta linha a linha, chamando o handler para cada linha. */
async function lerLinhas(
  resp: Response,
  onLinha: (linha: string) => void
): Promise<void> {
  if (!resp.body) {
    throw new Error("A resposta da API não contém corpo para leitura.");
  }
  const reader = (resp.body as any).getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const linha = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      onLinha(linha);
    }
  }
  if (buffer.trim().length > 0) {
    onLinha(buffer.trim());
  }
}

async function verificarResposta(resp: Response): Promise<void> {
  if (resp.ok) {
    return;
  }
  let detalhe = "";
  try {
    detalhe = await resp.text();
  } catch {
    // ignora
  }
  throw new Error(
    `A API retornou erro ${resp.status} (${resp.statusText}).` +
      (detalhe ? `\n${detalhe.slice(0, 800)}` : "")
  );
}

// ----------------------- OpenAI / compatível -----------------------

async function streamOpenAI(cfg: StreamConfig, base: string): Promise<void> {
  if (!base) {
    throw new Error(
      "Para provedores compatíveis com OpenAI é necessário informar a URL base."
    );
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.apiKey) {
    headers["Authorization"] = `Bearer ${cfg.apiKey}`;
  }

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: cfg.model,
      messages: cfg.messages,
      temperature: cfg.temperature ?? 0.7,
      stream: true,
    }),
    signal: cfg.signal,
  });

  await verificarResposta(resp);

  await lerLinhas(resp, (linha) => {
    if (!linha.startsWith("data:")) {
      return;
    }
    const dados = linha.slice(5).trim();
    if (dados === "[DONE]" || dados === "") {
      return;
    }
    try {
      const json = JSON.parse(dados);
      const texto = json.choices?.[0]?.delta?.content;
      if (typeof texto === "string" && texto.length > 0) {
        cfg.onChunk(texto);
      }
    } catch {
      // linha parcial ou comentário SSE: ignora
    }
  });
}

// ----------------------- Anthropic -----------------------

async function streamAnthropic(cfg: StreamConfig, base: string): Promise<void> {
  if (!cfg.apiKey) {
    throw new Error("A Anthropic exige uma chave de API (x-api-key).");
  }

  const system = cfg.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");

  const messages = cfg.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const resp = await fetch(`${base}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": cfg.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 4096,
      temperature: cfg.temperature ?? 0.7,
      system: system || undefined,
      messages,
      stream: true,
    }),
    signal: cfg.signal,
  });

  await verificarResposta(resp);

  await lerLinhas(resp, (linha) => {
    if (!linha.startsWith("data:")) {
      return;
    }
    const dados = linha.slice(5).trim();
    if (dados === "" || dados === "[DONE]") {
      return;
    }
    try {
      const json = JSON.parse(dados);
      if (
        json.type === "content_block_delta" &&
        json.delta?.type === "text_delta" &&
        typeof json.delta.text === "string"
      ) {
        cfg.onChunk(json.delta.text);
      }
    } catch {
      // ignora
    }
  });
}

// ----------------------- Ollama -----------------------

async function streamOllama(cfg: StreamConfig, base: string): Promise<void> {
  const resp = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.model,
      messages: cfg.messages,
      stream: true,
      options: { temperature: cfg.temperature ?? 0.7 },
    }),
    signal: cfg.signal,
  });

  await verificarResposta(resp);

  await lerLinhas(resp, (linha) => {
    const dados = linha.trim();
    if (dados === "") {
      return;
    }
    try {
      const json = JSON.parse(dados);
      const texto = json.message?.content;
      if (typeof texto === "string" && texto.length > 0) {
        cfg.onChunk(texto);
      }
    } catch {
      // ignora
    }
  });
}

/**
 * Serviço de modelos — fonte primária: media/modelos.json (embutido na extensão).
 *
 * - No startup, carrega de media/modelos.json (não precisa de chave).
 * - Ao clicar ↻, recarrega de media/modelos.json + opcionalmente busca online.
 * - O cache local (.microedcodeai/modelos.json) persiste entre sessões.
 * - As listas são ordenadas do mais recente para o mais antigo.
 */
import * as vscode from "vscode";
import { ProviderType, urlBasePadrao } from "./providers";

const ARQUIVO_CACHE = "modelos.json";
const URL_MODELOS_PUBLICOS = "https://microed.com.br/microedcodeai/modelos.json";

type CacheModelos = Partial<Record<ProviderType, string[]>>;

// ── Fallback fixo (último recurso) ──
export const MODELOS_FALLBACK: Record<ProviderType, string[]> = {
  openai: ["gpt-5.4-mini", "gpt-5.2"],
  anthropic: ["claude-sonnet-4-6", "claude-haiku-4-5"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
  ollama: [],
  "openai-compativel": [],
};

// ─────────────────────────────────────────────────────────
// Leitura do modelo embutido (media/modelos.json)
// ─────────────────────────────────────────────────────────

/**
 * Lê o arquivo media/modelos.json do bundle da extensão.
 * Esta é a fonte primária — mantida pelo desenvolvedor e distribuída no .vsix.
 */
async function lerModelosEmbutidos(uriExtensao: vscode.Uri): Promise<CacheModelos | null> {
  try {
    const uri = vscode.Uri.joinPath(uriExtensao, "media", ARQUIVO_CACHE);
    const dados = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(dados).toString("utf8")) as CacheModelos;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Acesso ao cache local (projeto ou global)
// ─────────────────────────────────────────────────────────

function uriCache(): vscode.Uri | undefined {
  const storages = vscode.workspace.workspaceFolders;
  if (storages && storages.length > 0) {
    return vscode.Uri.joinPath(storages[0].uri, ".microedcodeai", ARQUIVO_CACHE);
  }
  return undefined;
}

async function lerCacheLocal(): Promise<CacheModelos | null> {
  const uri = uriCache();
  if (!uri) return null;
  try {
    const dados = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(dados).toString("utf8")) as CacheModelos;
  } catch {
    return null;
  }
}

async function gravarCacheLocal(modelos: CacheModelos): Promise<void> {
  const uri = uriCache();
  if (!uri) return;
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, ".."));
  } catch { /* já existe */ }
  try {
    const json = JSON.stringify(modelos, null, 2);
    await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf8"));
  } catch { /* sem permissão */ }
}

// ─────────────────────────────────────────────────────────
// Montagem do cache completo
// ─────────────────────────────────────────────────────────

function completarComFallback(cache: CacheModelos): Record<ProviderType, string[]> {
  const provedores: ProviderType[] = ["openai", "anthropic", "deepseek", "ollama", "openai-compativel"];
  const resultado: Record<string, string[]> = {};
  for (const tipo of provedores) {
    const modelos = cache[tipo];
    resultado[tipo] = (modelos && modelos.length > 0) ? modelos : [...(MODELOS_FALLBACK[tipo] || [])];
  }
  return resultado as Record<ProviderType, string[]>;
}

// ─────────────────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────────────────

/**
 * Carrega o cache completo:
 * 1. Cache local (.microedcodeai/modelos.json)
 * 2. Embutido na extensão (media/modelos.json)
 * 3. MODELOS_FALLBACK
 */
export async function cacheCompleto(uriExtensao: vscode.Uri): Promise<Record<ProviderType, string[]>> {
  // cache local salvo pelo usuário (↻ anterior)
  const local = await lerCacheLocal();
  if (local) {
    const temAlgum = (Object.keys(local) as (keyof CacheModelos)[]).some(k => (local[k]?.length || 0) > 0);
    if (temAlgum) {
      return completarComFallback(local);
    }
  }
  // embutido na extensão (vem no .vsix)
  const embutidos = await lerModelosEmbutidos(uriExtensao);
  if (embutidos) {
    return completarComFallback(embutidos);
  }
  return completarComFallback({});
}

/**
 * Atualiza os modelos:
 * 1. Busca do JSON público (microed.com.br/microedcodeai/modelos.json) — sem chave
 *    O JSON contém TODOS os provedores → salvamos tudo de uma vez.
 * 2. Busca online da API do provedor (com chave, se disponível)
 * 3. Recarrega do media/modelos.json embutido na extensão
 */
export async function atualizarModelosProvider(
  uriExtensao: vscode.Uri,
  tipo: ProviderType,
  apiKey?: string,
  baseUrl?: string
): Promise<{ modelos: Record<ProviderType, string[]>; status: "ok" | "offline" | "erro" }> {
  // 1) JSON público do site — carrega TODOS os provedores de uma vez
  const publicos = await buscarModelosPublicos();
  if (publicos) {
    // Salva o cache completo (todos os provedores) no JSON local
    await gravarCacheLocal(publicos);
    return { modelos: completarComFallback(publicos), status: "ok" };
  }

  // 2) Tenta online com a chave configurada (só o provedor atual)
  const online = await buscarModelosOnline(tipo, apiKey, baseUrl);
  if (online && online.length > 0) {
    const atual = (await lerCacheLocal()) || {};
    atual[tipo] = online;
    await gravarCacheLocal(atual);
    return { modelos: completarComFallback(atual), status: "ok" };
  }

  // 3) Fallback: recarrega do JSON embutido na extensão
  const embutidos = await lerModelosEmbutidos(uriExtensao);
  if (embutidos && embutidos[tipo] && embutidos[tipo]!.length > 0) {
    const atual = (await lerCacheLocal()) || {};
    atual[tipo] = embutidos[tipo];
    await gravarCacheLocal(atual);
    return { modelos: completarComFallback(atual), status: "ok" };
  }

  // 4) Nada funcionou
  const atual = (await lerCacheLocal()) || {};
  return { modelos: completarComFallback(atual), status: "erro" };
}

// ─────────────────────────────────────────────────────────
// Busca online (API direta do provedor)
// ─────────────────────────────────────────────────────────

function ordenarDesc(modelos: string[]): string[] {
  return [...modelos].sort((a, b) => b.localeCompare(a));
}

function filtrarRelevantesOpenAI(modelos: string[]): string[] {
  return modelos.filter((m) => /^(gpt|o[13])/i.test(m));
}

function filtrarRelevantesClaude(modelos: string[]): string[] {
  return modelos.filter((m) => m.startsWith("claude"));
}

function filtrarRelevantesDeepSeek(modelos: string[]): string[] {
  return modelos.filter((m) => m.startsWith("deepseek"));
}

/** Busca um JSON via HTTPS (implementação manual com Node, sem depender de fetch).
 * O host de extensão do VS Code roda em Node.js — CORS não se aplica aqui. */
function httpsGetJson(url: string, timeoutMs: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = URL.parse(url);
    if (!parsed || parsed.protocol !== "https:") {
      return reject(new Error("URL inválida ou não HTTPS"));
    }
    const mod = require("https") as typeof import("https");
    const req = mod.get(
      url,
      { headers: { "Accept": "application/json", "User-Agent": "microedcodeai/1.0" }, timeout: timeoutMs },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk: string) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }
    );
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
    req.on("error", reject);
  });
}

/** Faz um fetch com timeout manual (usado para APIs dos provedores). */
async function fetchComTimeout(url: string, opts: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Busca o JSON público em microed.com.br — retorna o objeto completo com todos os provedores. */
async function buscarModelosPublicos(): Promise<CacheModelos | null> {
  try {
    console.log(`[microedcodeai] Buscando modelos públicos de ${URL_MODELOS_PUBLICOS}`);
    const json: any = await httpsGetJson(URL_MODELOS_PUBLICOS, 8000);
    // Valida que é um objeto com pelo menos um array de modelos
    if (json && typeof json === "object" && !Array.isArray(json)) {
      const temAlgum = Object.values(json).some((v: any) => Array.isArray(v) && v.length > 0);
      if (temAlgum) {
        console.log(`[microedcodeai] JSON público carregado com sucesso (${Object.keys(json).length} provedores)`);
        return json as CacheModelos;
      }
    }
    console.log(`[microedcodeai] JSON público vazio ou inválido`);
    return null;
  } catch (e: any) {
    console.error(`[microedcodeai] Erro ao buscar modelos públicos: ${e?.message || e}`);
    return null;
  }
}

async function buscarOpenAI(base: string, apiKey?: string): Promise<string[] | null> {
  if (!apiKey) return null;
  const resp = await fetchComTimeout(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, 10000);
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const nomes: string[] = (json.data ?? []).map((m: any) => String(m.id ?? ""));
  return ordenarDesc(filtrarRelevantesOpenAI(nomes));
}

async function buscarAnthropic(base: string, apiKey?: string): Promise<string[] | null> {
  if (!apiKey) return null;
  const resp = await fetchComTimeout(`${base}/v1/models`, {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
  }, 10000);
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const nomes: string[] = (json.data ?? []).map((m: any) => String(m.id ?? ""));
  return ordenarDesc(filtrarRelevantesClaude(nomes));
}

async function buscarDeepSeek(base: string, apiKey?: string): Promise<string[] | null> {
  if (!apiKey) return null;
  const resp = await fetchComTimeout(`${base}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  }, 10000);
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const nomes: string[] = (json.data ?? []).map((m: any) => String(m.id ?? ""));
  return ordenarDesc(filtrarRelevantesDeepSeek(nomes));
}

async function buscarOllama(base: string): Promise<string[] | null> {
  const resp = await fetchComTimeout(`${base}/api/tags`, {}, 6000);
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const nomes: string[] = (json.models ?? []).map((m: any) => String(m.name ?? ""));
  return ordenarDesc(nomes);
}

async function buscarOpenAICompativel(base: string, apiKey?: string): Promise<string[] | null> {
  if (!base) return null;
  const headers: Record<string, string> = {};
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const resp = await fetchComTimeout(`${base}/models`, { headers }, 10000);
  if (!resp.ok) return null;
  const json: any = await resp.json();
  const nomes: string[] = (json.data ?? []).map((m: any) => String(m.id ?? ""));
  return ordenarDesc(nomes);
}

async function buscarModelosOnline(
  providerType: ProviderType,
  apiKey?: string,
  baseUrlPersonalizada?: string
): Promise<string[] | null> {
  try {
    const base = baseUrlPersonalizada?.trim() || urlBasePadrao(providerType);
    switch (providerType) {
      case "openai":        return await buscarOpenAI(base, apiKey);
      case "anthropic":     return await buscarAnthropic(base, apiKey);
      case "deepseek":      return await buscarDeepSeek(base, apiKey);
      case "ollama":        return await buscarOllama(base);
      case "openai-compativel": return await buscarOpenAICompativel(base, apiKey);
    }
  } catch { /* offline */ }
  return null;
}

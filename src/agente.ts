// Núcleo do "modo agente" do Microed CodeAI.
// Define o protocolo de ações (baseado em texto, compatível com qualquer
// provedor), o parser dessas ações e o executor das ações de leitura/análise
// sobre o workspace do VS Code.

import * as vscode from "vscode";
import { t } from "./i18n";

export type TipoAcao =
  | "listar"
  | "ler"
  | "buscar"
  | "diagnosticos"
  | "escrever";

export interface Acao {
  acao: TipoAcao;
  caminho?: string;
  glob?: string;
  consulta?: string;
  conteudo?: string;
  descricao?: string;
}

/** Resultado de uma ação de leitura, devolvido ao modelo no loop do agente. */
export interface ResultadoAcao {
  acao: TipoAcao;
  caminho?: string;
  ok: boolean;
  saida: string;
}

const MARCA_INICIO = "```forge:acao";
const LIMITE_BYTES_ARQUIVO = 60_000;
const LIMITE_RESULTADOS_BUSCA = 40;

/** Instrução de sistema que ensina o modelo a agir como agente de código. */
export function promptAgente(): string {
  return [
    t("agentYouAre"),
    t("agentCapabilities"),
    "",
    t("agentEmit"),
    "```forge:acao",
    '{"acao": "<nome>", ...parâmetros}',
    "```",
    "",
    t("agentReadActions"),
    t("agentActionListar"),
    t("agentActionLer"),
    t("agentActionBuscar"),
    t("agentActionDiagnosticos"),
    "",
    t("agentActionEscrever"),
    t("agentActionEscreverExample"),
    "",
    t("agentRules"),
    t("agentRuleReadFirst"),
    t("agentRuleOneAtTime"),
    t("agentRuleComplete"),
    t("agentRuleExplain"),
    t("agentRuleFinish"),
  ].join("\n");
}

/** Extrai todas as ações presentes no texto de uma resposta do modelo. */
export function extrairAcoes(texto: string): Acao[] {
  const acoes: Acao[] = [];
  const regex = /```forge:acao\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(texto)) !== null) {
    const bruto = m[1].trim();
    try {
      const obj = JSON.parse(bruto);
      if (obj && typeof obj.acao === "string") {
        acoes.push(obj as Acao);
      }
    } catch {
      // bloco malformado: ignora
    }
  }
  return acoes;
}

/** Remove os blocos de ação do texto, deixando apenas a parte legível. */
export function removerBlocosAcao(texto: string): string {
  return texto.replace(/```forge:acao\s*[\s\S]*?```/g, "").trim();
}

export function temMarcaAcao(texto: string): boolean {
  return texto.includes(MARCA_INICIO);
}

function uriDoCaminho(caminho: string): vscode.Uri | undefined {
  const pastas = vscode.workspace.workspaceFolders;
  if (!pastas || pastas.length === 0) {
    return undefined;
  }
  return vscode.Uri.joinPath(pastas[0].uri, caminho);
}

function caminhoRelativo(uri: vscode.Uri): string {
  return vscode.workspace.asRelativePath(uri, false);
}

/** Executa uma ação de leitura/análise e devolve o resultado em texto. */
export async function executarAcaoLeitura(acao: Acao): Promise<ResultadoAcao> {
  try {
    switch (acao.acao) {
      case "listar":
        return await acaoListar(acao);
      case "ler":
        return await acaoLer(acao);
      case "buscar":
        return await acaoBuscar(acao);
      case "diagnosticos":
        return acaoDiagnosticos(acao);
      default:
        return {
          acao: acao.acao,
          ok: false,
          saida: t("errorNotReadAction", acao.acao),
        };
    }
  } catch (e: any) {
    return {
      acao: acao.acao,
      caminho: acao.caminho,
      ok: false,
      saida: t("errorActionFailed", e?.message ?? String(e)),
    };
  }
}

async function acaoListar(acao: Acao): Promise<ResultadoAcao> {
  const glob = acao.glob && acao.glob.trim() ? acao.glob : "**/*";
  const uris = await vscode.workspace.findFiles(
    glob,
    "**/{node_modules,.git,out,dist,.angular}/**",
    400
  );
  const lista = uris.map((u) => caminhoRelativo(u)).sort();
  const saida =
    lista.length === 0
      ? t("errorNoFilesFound")
      : lista.join("\n") + `\n\n(${lista.length} ${IdiomaArquivos(lista.length)})`;
  return { acao: "listar", ok: true, saida };
}

function IdiomaArquivos(n: number): string {
  return n === 1 ? "arquivo" : "arquivos";
}

async function acaoLer(acao: Acao): Promise<ResultadoAcao> {
  if (!acao.caminho) {
    return { acao: "ler", ok: false, saida: t("errorMissingPath") };
  }
  const uri = uriDoCaminho(acao.caminho);
  if (!uri) {
    return { acao: "ler", caminho: acao.caminho, ok: false, saida: t("errorNoWorkspaceAgent") };
  }
  const dados = await vscode.workspace.fs.readFile(uri);
  let texto = Buffer.from(dados).toString("utf8");
  let aviso = "";
  if (texto.length > LIMITE_BYTES_ARQUIVO) {
    texto = texto.slice(0, LIMITE_BYTES_ARQUIVO);
    aviso = t("errorTruncatedFile");
  }
  return {
    acao: "ler",
    caminho: acao.caminho,
    ok: true,
    saida: texto + aviso,
  };
}

async function acaoBuscar(acao: Acao): Promise<ResultadoAcao> {
  const consulta = (acao.consulta ?? "").trim();
  if (!consulta) {
    return { acao: "buscar", ok: false, saida: t("errorMissingQuery") };
  }
  const glob = acao.glob && acao.glob.trim() ? acao.glob : "**/*";
  const uris = await vscode.workspace.findFiles(
    glob,
    "**/{node_modules,.git,out,dist,.angular}/**",
    200
  );
  const linhas: string[] = [];
  for (const uri of uris) {
    if (linhas.length >= LIMITE_RESULTADOS_BUSCA) {
      break;
    }
    try {
      const dados = await vscode.workspace.fs.readFile(uri);
      const conteudo = Buffer.from(dados).toString("utf8");
      const partes = conteudo.split(/\r?\n/);
      for (let i = 0; i < partes.length; i++) {
        if (partes[i].includes(consulta)) {
          linhas.push(`${caminhoRelativo(uri)}:${i + 1}: ${partes[i].trim()}`);
          if (linhas.length >= LIMITE_RESULTADOS_BUSCA) {
            break;
          }
        }
      }
    } catch {
      // ignora arquivos binários/ilegíveis
    }
  }
  const saida =
    linhas.length === 0
      ? t("errorNoOccurrences", consulta)
      : linhas.join("\n");
  return { acao: "buscar", ok: true, saida };
}

function acaoDiagnosticos(acao: Acao): ResultadoAcao {
  const niveis = [t("diagError"), t("diagWarning"), t("diagInfo"), t("diagHint")];
  const formatar = (uri: vscode.Uri, ds: readonly vscode.Diagnostic[]) =>
    ds
      .map(
        (d) =>
          `${caminhoRelativo(uri)}:${d.range.start.line + 1}: [${
            niveis[d.severity] ?? "?"
          }] ${d.message}`
      )
      .join("\n");

  if (acao.caminho) {
    const uri = uriDoCaminho(acao.caminho);
    if (!uri) {
      return { acao: "diagnosticos", ok: false, saida: t("errorNoWorkspaceAgent") };
    }
    const ds = vscode.languages.getDiagnostics(uri);
    return {
      acao: "diagnosticos",
      caminho: acao.caminho,
      ok: true,
      saida: ds.length ? formatar(uri, ds) : t("errorNoDiagnosticsFile"),
    };
  }

  const todos = vscode.languages.getDiagnostics();
  const blocos: string[] = [];
  for (const [uri, ds] of todos) {
    if (ds.length > 0) {
      blocos.push(formatar(uri, ds));
    }
  }
  return {
    acao: "diagnosticos",
    ok: true,
    saida: blocos.length ? blocos.join("\n") : t("errorNoDiagnosticsProject"),
  };
}

/** Aplica a escrita de um arquivo (criando-o se necessário) via WorkspaceEdit. */
export async function aplicarEscrita(
  caminho: string,
  conteudo: string
): Promise<void> {
  const uri = uriDoCaminho(caminho);
  if (!uri) {
    throw new Error(t("errorNoWorkspace"));
  }
  const dados = Buffer.from(conteudo, "utf8");
  await vscode.workspace.fs.writeFile(uri, dados);
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false,
    viewColumn: vscode.ViewColumn.Active,
  });
}

/** Lê o conteúdo atual de um arquivo (ou "" se não existir). */
export async function lerConteudoAtual(caminho: string): Promise<string> {
  const uri = uriDoCaminho(caminho);
  if (!uri) {
    return "";
  }
  try {
    const dados = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(dados).toString("utf8");
  } catch {
    return "";
  }
}

/** Monta um bloco de contexto com o arquivo ativo e a seleção do editor. */
export function contextoEditor(): string {
  const ed = vscode.window.activeTextEditor;
  if (!ed) {
    return "";
  }
  const caminho = caminhoRelativo(ed.document.uri);
  const linguagem = ed.document.languageId;
  const selecao = ed.document.getText(ed.selection);
  const partes: string[] = [
    `Arquivo ativo no editor: ${caminho} (${linguagem}).`,
  ];
  if (selecao && selecao.trim().length > 0) {
    partes.push(t("unitTestSelectedSnippet"));
    partes.push("```");
    partes.push(selecao.slice(0, 8000));
    partes.push("```");
  }
  return partes.join("\n");
}

// ----------------------- Histórico de conversas -----------------------
// O histórico é gravado DENTRO do projeto, em ".microedcodeai/historico.json",
// ficando assim naturalmente separado por projeto.
// Formato: array de conversas, cada uma com id, título, data e mensagens.

const PASTA_HISTORICO = ".microedcodeai";
const ARQUIVO_HISTORICO = "historico.json";

export interface MensagemHistorico {
  horario: string;
  papel: "usuario" | "assistente";
  conteudo: string;
}

export interface ConversaHistorico {
  id: string;
  titulo: string;
  data: string;
  mensagens: MensagemHistorico[];
}

/** URI do arquivo de histórico dentro do projeto (ou undefined sem workspace). */
export function uriHistorico(): vscode.Uri | undefined {
  const pastas = vscode.workspace.workspaceFolders;
  if (!pastas || pastas.length === 0) {
    return undefined;
  }
  return vscode.Uri.joinPath(pastas[0].uri, PASTA_HISTORICO, ARQUIVO_HISTORICO);
}

/** Lê todas as conversas salvas no projeto. */
export async function lerHistoricoSalvo(): Promise<ConversaHistorico[]> {
  const uri = uriHistorico();
  if (!uri) return [];
  try {
    const dados = await vscode.workspace.fs.readFile(uri);
    const obj = JSON.parse(Buffer.from(dados).toString("utf8"));
    if (Array.isArray(obj)) {
      // Suporta formato antigo (EntradaHistorico[]) — converte para o novo
      if (obj.length > 0 && !("mensagens" in (obj[0] || {}))) {
        return converterFormatoAntigo(obj);
      }
      return obj as ConversaHistorico[];
    }
    return [];
  } catch {
    return [];
  }
}

/** Converte o formato antigo (array plano) para o novo formato (conversas agrupadas). */
function converterFormatoAntigo(entradas: any[]): ConversaHistorico[] {
  if (entradas.length === 0) return [];
  return [{
    id: gerarIdConversa(),
    titulo: entradas[0]?.conteudo?.substring(0, 60) || "Conversa antiga",
    data: entradas[0]?.horario || new Date().toISOString(),
    mensagens: entradas.map((e: any) => ({
      horario: e.horario,
      papel: e.papel,
      conteudo: e.conteudo,
    })),
  }];
}

function gerarIdConversa(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Salva o array completo de conversas em disco. */
async function salvarHistorico(conversas: ConversaHistorico[]): Promise<void> {
  const uri = uriHistorico();
  if (!uri) return;
  const pastas = vscode.workspace.workspaceFolders!;
  const pastaUri = vscode.Uri.joinPath(pastas[0].uri, PASTA_HISTORICO);
  await vscode.workspace.fs.createDirectory(pastaUri);
  const json = JSON.stringify(conversas, null, 2);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf8"));
}

/**
 * Anexa uma mensagem à conversa atual (cria uma nova se id não existir).
 * Retorna o id da conversa.
 */
export async function anexarMensagemHistorico(
  idConversa: string | undefined,
  papel: "usuario" | "assistente",
  conteudo: string
): Promise<string> {
  const texto = conteudo.trim();
  if (texto.length === 0) return idConversa || "";
  const conversas = await lerHistoricoSalvo();
  let conv: ConversaHistorico;

  if (idConversa) {
    conv = conversas.find(c => c.id === idConversa) || conversas[conversas.length - 1];
    if (!conv) {
      conv = { id: idConversa, titulo: texto.substring(0, 60), data: new Date().toISOString(), mensagens: [] };
      conversas.push(conv);
    }
  } else {
    // Nova conversa
    const novoId = gerarIdConversa();
    conv = { id: novoId, titulo: texto.substring(0, 60), data: new Date().toISOString(), mensagens: [] };
    conversas.push(conv);
  }

  conv.mensagens.push({ horario: new Date().toISOString(), papel, conteudo: texto });
  await salvarHistorico(conversas);
  return conv.id;
}

/** Retorna a conversa mais recente (undefined se não houver). */
export async function lerUltimaConversa(): Promise<ConversaHistorico | undefined> {
  const conversas = await lerHistoricoSalvo();
  return conversas[conversas.length - 1];
}

/** Retorna uma conversa específica pelo id. */
export async function carregarConversa(id: string): Promise<ConversaHistorico | undefined> {
  const conversas = await lerHistoricoSalvo();
  return conversas.find(c => c.id === id);
}

/** Apaga todas as conversas. */
export async function apagarHistorico(): Promise<void> {
  const uri = uriHistorico();
  if (uri) {
    await salvarHistorico([]);
  }
}

// Núcleo do "modo agente" do microedcode.ai.
// Define o protocolo de ações (baseado em texto, compatível com qualquer
// provedor), o parser dessas ações e o executor das ações de leitura/análise
// sobre o workspace do VS Code.

import * as vscode from "vscode";

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
    "Você é o microedcode.ai, um agente de programação dentro do VS Code. Responda sempre em português do Brasil.",
    "Você pode analisar a lógica do projeto, criar e atualizar arquivos e corrigir bugs no código existente.",
    "",
    "Para interagir com o projeto, emita AÇÕES em blocos no formato exato:",
    "```forge:acao",
    '{"acao": "<nome>", ...parâmetros}',
    "```",
    "",
    "Ações de LEITURA/ANÁLISE (eu executo e devolvo o resultado para você continuar):",
    '- {"acao": "listar", "glob": "**/*.ts"}  → lista arquivos do projeto (glob opcional).',
    '- {"acao": "ler", "caminho": "src/app.ts"}  → devolve o conteúdo do arquivo.',
    '- {"acao": "buscar", "consulta": "minhaFuncao", "glob": "**/*.ts"}  → busca texto no projeto.',
    '- {"acao": "diagnosticos", "caminho": "src/app.ts"}  → erros/avisos do editor (omita caminho para todos).',
    "",
    "Ação de ESCRITA (cria/atualiza o arquivo; por padrão é aplicada automaticamente, salvo se o usuário tiver ativado a revisão manual):",
    '- {"acao": "escrever", "caminho": "src/app.ts", "conteudo": "<conteúdo COMPLETO do arquivo>", "descricao": "o que muda e por quê"}',
    "",
    "Regras importantes:",
    "- Antes de propor mudanças, LEIA os arquivos relevantes para entender a lógica atual.",
    "- Use um bloco de ação por vez quando precisar do resultado para decidir o próximo passo; pode emitir várias ações de leitura juntas.",
    "- Em 'escrever', sempre forneça o conteúdo COMPLETO e final do arquivo (não trechos parciais nem '...').",
    "- Explique seu raciocínio em texto normal antes das ações.",
    "- Quando terminar e não precisar de mais nada, responda apenas com texto, sem blocos de ação.",
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
          saida: `Ação "${acao.acao}" não é de leitura.`,
        };
    }
  } catch (e: any) {
    return {
      acao: acao.acao,
      caminho: acao.caminho,
      ok: false,
      saida: `Falha ao executar a ação: ${e?.message ?? e}`,
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
      ? "Nenhum arquivo encontrado."
      : lista.join("\n") + `\n\n(${lista.length} arquivo(s))`;
  return { acao: "listar", ok: true, saida };
}

async function acaoLer(acao: Acao): Promise<ResultadoAcao> {
  if (!acao.caminho) {
    return { acao: "ler", ok: false, saida: "Parâmetro 'caminho' ausente." };
  }
  const uri = uriDoCaminho(acao.caminho);
  if (!uri) {
    return { acao: "ler", caminho: acao.caminho, ok: false, saida: "Nenhum workspace aberto." };
  }
  const dados = await vscode.workspace.fs.readFile(uri);
  let texto = Buffer.from(dados).toString("utf8");
  let aviso = "";
  if (texto.length > LIMITE_BYTES_ARQUIVO) {
    texto = texto.slice(0, LIMITE_BYTES_ARQUIVO);
    aviso = "\n\n[...arquivo truncado...]";
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
    return { acao: "buscar", ok: false, saida: "Parâmetro 'consulta' ausente." };
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
      ? `Nenhuma ocorrência de "${consulta}".`
      : linhas.join("\n");
  return { acao: "buscar", ok: true, saida };
}

function acaoDiagnosticos(acao: Acao): ResultadoAcao {
  const niveis = ["Erro", "Aviso", "Info", "Dica"];
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
      return { acao: "diagnosticos", ok: false, saida: "Nenhum workspace aberto." };
    }
    const ds = vscode.languages.getDiagnostics(uri);
    return {
      acao: "diagnosticos",
      caminho: acao.caminho,
      ok: true,
      saida: ds.length ? formatar(uri, ds) : "Nenhum diagnóstico para o arquivo.",
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
    saida: blocos.length ? blocos.join("\n") : "Nenhum diagnóstico no projeto.",
  };
}

/** Aplica a escrita de um arquivo (criando-o se necessário) via WorkspaceEdit. */
export async function aplicarEscrita(
  caminho: string,
  conteudo: string
): Promise<void> {
  const uri = uriDoCaminho(caminho);
  if (!uri) {
    throw new Error("Nenhum workspace aberto para aplicar a alteração.");
  }
  const dados = Buffer.from(conteudo, "utf8");
  await vscode.workspace.fs.writeFile(uri, dados);
  const doc = await vscode.workspace.openTextDocument(uri);
  // Abre o arquivo já com FOCO no editor (preserveFocus: false), para que o
  // usuário veja imediatamente o arquivo que acabou de ser criado/atualizado.
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
    partes.push("Trecho selecionado pelo usuário:");
    partes.push("```");
    partes.push(selecao.slice(0, 8000));
    partes.push("```");
  }
  return partes.join("\n");
}

// ----------------------- Histórico de conversas -----------------------
// O histórico é gravado DENTRO do projeto, em ".microedcodeai/historico.json",
// ficando assim naturalmente separado por projeto.

const PASTA_HISTORICO = ".microedcodeai";
const ARQUIVO_HISTORICO = "historico.json";

export interface EntradaHistorico {
  /** Data/hora em ISO 8601. */
  horario: string;
  /** Quem produziu a mensagem. */
  papel: "usuario" | "assistente";
  /** Texto da solicitação ou da resposta. */
  conteudo: string;
}

/** URI do arquivo de histórico dentro do projeto (ou undefined sem workspace). */
export function uriHistorico(): vscode.Uri | undefined {
  const pastas = vscode.workspace.workspaceFolders;
  if (!pastas || pastas.length === 0) {
    return undefined;
  }
  return vscode.Uri.joinPath(pastas[0].uri, PASTA_HISTORICO, ARQUIVO_HISTORICO);
}

/** Lê as entradas de histórico salvas no projeto (vazio se não existir). */
export async function lerHistoricoSalvo(): Promise<EntradaHistorico[]> {
  const uri = uriHistorico();
  if (!uri) {
    return [];
  }
  try {
    const dados = await vscode.workspace.fs.readFile(uri);
    const obj = JSON.parse(Buffer.from(dados).toString("utf8"));
    return Array.isArray(obj) ? (obj as EntradaHistorico[]) : [];
  } catch {
    return [];
  }
}

/** Anexa uma entrada ao histórico do projeto, criando a pasta/arquivo se preciso. */
export async function anexarHistorico(
  papel: EntradaHistorico["papel"],
  conteudo: string
): Promise<void> {
  const texto = conteudo.trim();
  if (texto.length === 0) {
    return;
  }
  const uri = uriHistorico();
  if (!uri) {
    return; // sem workspace aberto: nada a gravar
  }
  const entradas = await lerHistoricoSalvo();
  entradas.push({ horario: new Date().toISOString(), papel, conteudo: texto });
  const pastas = vscode.workspace.workspaceFolders!;
  const pastaUri = vscode.Uri.joinPath(pastas[0].uri, PASTA_HISTORICO);
  await vscode.workspace.fs.createDirectory(pastaUri);
  const json = JSON.stringify(entradas, null, 2);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf8"));
}


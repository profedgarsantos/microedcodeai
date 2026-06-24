/**
 * Sistema de internacionalização (i18n) da extensão Microed CodeAI.
 *
 * O idioma padrão acompanha o idioma da interface do VS Code:
 * - "pt" ou "pt-br": português do Brasil
 * - qualquer outro: inglês
 *
 * O usuário pode sobrescrever via configuração `microedcodeai.idioma`.
 */
import * as vscode from "vscode";

export type Idioma = "pt" | "en";

/** Mensagens traduzidas. Use `t()` para acessar. */
export const MENSAGENS = {
  // ── Títulos e marca ──
  appName: { pt: "Microed CodeAI", en: "Microed CodeAI" },
  appTitleWebview: { pt: "Microed CodeAI", en: "Microed CodeAI" },

  // ── Barra lateral e comandos ──
  sidebarTitle: { pt: "Microed CodeAI", en: "Microed CodeAI" },
  cmdNewChat: { pt: "Microed CodeAI: Nova conversa", en: "Microed CodeAI: New chat" },
  cmdOpenSettings: { pt: "Microed CodeAI: Configurar provedor de IA", en: "Microed CodeAI: Configure AI provider" },
  cmdClearKeys: { pt: "Microed CodeAI: Limpar chaves de API salvas", en: "Microed CodeAI: Clear saved API keys" },
  cmdAbout: { pt: "Microed CodeAI: Sobre", en: "Microed CodeAI: About" },
  cmdUnitTest: { pt: "Criar ou atualizar teste unitário", en: "Create or update unit test" },
  cmdHistory: { pt: "Microed CodeAI: Histórico de conversas", en: "Microed CodeAI: Chat history" },

  // ── Mensagens do sistema (notificações) ──
  keysCleared: { pt: "microedcode.ai: chaves de API salvas foram removidas.", en: "microedcode.ai: saved API keys have been removed." },
  aboutMessage: { pt: "microedcode.ai — extensão criada por Microed Sistemas.", en: "microedcode.ai — extension created by Microed Sistemas." },
  aboutVisitSite: { pt: "Visitar site (microed.com.br/microedcodeai)", en: "Visit website (microed.com.br/microedcodeai)" },
  historyNoWorkspace: { pt: "microedcode.ai: abra uma pasta de projeto para ver o histórico.", en: "microedcode.ai: open a project folder to view history." },
  historyEmpty: { pt: "microedcode.ai: ainda não há histórico salvo neste projeto.", en: "microedcode.ai: no history saved in this project yet." },
  unitTestNoFile: { pt: "microedcode.ai: abra um arquivo de código para gerar testes unitários.", en: "microedcode.ai: open a source code file to generate unit tests." },

  // ── Configuração do provedor (painel) ──
  configTitle: { pt: "Configuração do provedor", en: "Provider configuration" },
  configLanguage: { pt: "Idioma", en: "Language" },
  configProvider: { pt: "Provedor de IA", en: "AI Provider" },
  configModel: { pt: "Modelo", en: "Model" },
  defaultSystemPrompt: { pt: "Você é um assistente de programação prestativo. Responda sempre em português do Brasil.", en: "You are a helpful programming assistant. Always respond in English." },
  configModelPlaceholder: { pt: "digite o nome do modelo", en: "type the model name" },
  configBaseUrl: { pt: "URL base", en: "Base URL" },
  configBaseUrlOptional: { pt: "(opcional)", en: "(optional)" },
  configBaseUrlPlaceholder: { pt: "usar padrão do provedor", en: "use provider default" },
  configApiKey: { pt: "Chave de API", en: "API Key" },
  configApiKeyPlaceholder: { pt: "cole sua chave aqui", en: "paste your key here" },
  configApiKeyStatusSaved: { pt: "✔ Chave salva no SecretStorage", en: "✔ Key saved in SecretStorage" },
  configGetApiKey: { pt: "Obter chave de API", en: "Get API key" },
  configTemperature: { pt: "Temperatura", en: "Temperature" },
  configSystemPrompt: { pt: "Instrução de sistema", en: "System prompt" },
  configApplyAuto: { pt: "Aplicar alterações automaticamente nos arquivos", en: "Apply changes to files automatically" },
  configApplyAutoTooltip: { pt: "Quando ativado, a IA altera os arquivos imediatamente. Desative para revisar e aprovar cada mudança antes de aplicar.", en: "When enabled, AI changes files immediately. Disable to review and approve each change before applying." },
  configSave: { pt: "Salvar", en: "Save" },
  configCancel: { pt: "Cancelar", en: "Cancel" },
  configSaved: { pt: "Configuração salva com sucesso.", en: "Configuration saved successfully." },

  // ── Modelo "Outro" ──
  modelOther: { pt: "Outro (digitar manualmente)", en: "Other (type manually)" },
  modelBaseUrlPlaceholder: { pt: "padrão: ", en: "default: " },
  modelBaseUrlPlaceholderRequired: { pt: "informe a URL base (obrigatório)", en: "enter the base URL (required)" },

  // ── Chat ──
  chatWelcomeTitle: { pt: "Bem-vindo ao Microed CodeAI", en: "Welcome to Microed CodeAI" },
  chatWelcomeText1: { pt: 'Converse com a IA diretamente no VS Code. Com o <strong>Modo Agente</strong> ativado, a IA pode analisar a lógica do projeto, ler arquivos, propor a criação/atualização de código e ajudar a corrigir bugs.', en: 'Chat with AI directly in VS Code. With <strong>Agent Mode</strong> enabled, the AI can analyze project logic, read files, propose code creation/updates and help fix bugs.' },
  chatWelcomeText2: { pt: "Clique na engrenagem para escolher o provedor, o modelo e informar sua chave de API.", en: "Click the gear icon to choose the provider, model and enter your API key." },
  chatAgentToggle: { pt: "Modo Agente", en: "Agent Mode" },
  chatAgentTooltip: { pt: "No modo agente, a IA lê arquivos e propõe alterações no código", en: "In agent mode, AI reads files and proposes code changes" },
  chatPlaceholder: { pt: "Pergunte algo... (Enter para enviar, Shift+Enter para nova linha)", en: "Ask something... (Enter to send, Shift+Enter for new line)" },
  chatSend: { pt: "Enviar", en: "Send" },
  chatStop: { pt: "Parar", en: "Stop" },

  // ── Propaganda ──
  promoTitle: { pt: "Conheça o Microed CodeAI", en: "Discover Microed CodeAI" },
  promoText: { pt: "<strong>Microed CodeAI</strong> · soluções em IA por Microed Sistemas", en: "<strong>Microed CodeAI</strong> · AI solutions by Microed Sistemas" },
  promoCta: { pt: "Saiba mais →", en: "Learn more →" },

  // ── Sobre ──
  aboutText: { pt: "Sobre: extensão criada por <strong>Microed Sistemas</strong>", en: "About: extension created by <strong>Microed Sistemas</strong>" },

  // ── Propostas ──
  proposalApply: { pt: "Aplicar", en: "Apply" },
  proposalDiff: { pt: "Ver diff", en: "View diff" },
  proposalReject: { pt: "Rejeitar", en: "Reject" },
  proposalCreateFile: { pt: "Criar arquivo: ", en: "Create file: " },
  proposalUpdateFile: { pt: "Atualizar arquivo: ", en: "Update file: " },
  proposalFileCreated: { pt: "Arquivo criado: ", en: "File created: " },
  proposalFileUpdated: { pt: "Arquivo atualizado: ", en: "File updated: " },
  proposalApplied: { pt: "Alteração aplicada.", en: "Change applied." },
  proposalError: { pt: "Falha ao aplicar a alteração em ", en: "Failed to apply change to " },

  // ── Ações do agente ──
  agentListing: { pt: "Listando arquivos", en: "Listing files" },
  agentReading: { pt: "Lendo %s", en: "Reading %s" },
  agentSearching: { pt: 'Buscando "%s"', en: 'Searching "%s"' },
  agentDiagnostics: { pt: "Analisando diagnósticos", en: "Analyzing diagnostics" },
  agentDiagnosticsOf: { pt: "Analisando diagnósticos de %s", en: "Analyzing diagnostics of %s" },
  agentExecuting: { pt: "Executando %s", en: "Executing %s" },
  agentMaxSteps: { pt: "Limite de passos do agente atingido.", en: "Agent step limit reached." },

  // ── Histórico de conversas ──
  historyUserApplied: { pt: "[O usuário APLICOU a alteração no arquivo %s.]", en: "[The user APPLIED the change to file %s.]" },
  historyFileCreated: { pt: "[O arquivo %s foi criado automaticamente com o conteúdo proposto.]", en: "[File %s was automatically created with the proposed content.]" },
  historyFileUpdated: { pt: "[O arquivo %s foi atualizado automaticamente com o conteúdo proposto.]", en: "[File %s was automatically updated with the proposed content.]" },

  // ── Gerador de testes ──
  unitTestTaskSelected: { pt: "o trecho de código selecionado em %s", en: "the selected code snippet in %s" },
  unitTestTaskFile: { pt: "o arquivo %s", en: "the file %s" },
  unitTestUserMessage: { pt: "Criar ou atualizar teste unitário para %s.", en: "Create or update unit test for %s." },
  unitTestPromptTask: { pt: "Tarefa: criar ou atualizar os testes unitários para %s (linguagem: %s).", en: "Task: create or update unit tests for %s (language: %s)." },
  unitTestGuidelines: { pt: "Diretrizes:", en: "Guidelines:" },
  unitTestGuideRead: { pt: "- Leia o arquivo alvo e, se necessário, arquivos relacionados para entender a lógica.", en: "- Read the target file and, if necessary, related files to understand the logic." },
  unitTestGuideDetect: { pt: "- Detecte o framework de testes já usado no projeto (ex.: Jasmine/Karma, Jest, Vitest, Mocha, pytest, JUnit, etc.). Se não houver, escolha o mais adequado à linguagem/stack.", en: "- Detect the test framework already used in the project (e.g. Jasmine/Karma, Jest, Vitest, Mocha, pytest, JUnit, etc.). If none exists, choose the most appropriate one for the language/stack." },
  unitTestGuideUpdate: { pt: "- Se já existir um arquivo de teste para o alvo, ATUALIZE-o cobrindo os casos novos; caso contrário, CRIE um novo arquivo de teste seguindo a convenção de nomes do projeto.", en: "- If a test file already exists for the target, UPDATE it covering new cases; otherwise, CREATE a new test file following the project naming convention." },
  unitTestGuideCoverage: { pt: "- Cubra casos de sucesso, de borda e de erro.", en: "- Cover success, edge and error cases." },
  unitTestGuideLanguage: { pt: "- Escreva os testes e comentários em português do Brasil.", en: "- Write tests and comments in English." },
  unitTestSelectedSnippet: { pt: "Trecho selecionado:", en: "Selected snippet:" },

  // ── Agente (instrução do sistema) ──
  agentYouAre: {
    pt: "Você é o microedcode.ai, um agente de programação dentro do VS Code. Responda sempre em português do Brasil.",
    en: "You are microedcode.ai, a programming agent inside VS Code. Always respond in English.",
  },
  agentCapabilities: {
    pt: "Você pode analisar a lógica do projeto, criar e atualizar arquivos e corrigir bugs no código existente.",
    en: "You can analyze project logic, create and update files and fix bugs in existing code.",
  },
  agentEmit: {
    pt: 'Para interagir com o projeto, emita AÇÕES em blocos no formato exato:',
    en: 'To interact with the project, issue ACTIONS in blocks using the exact format:',
  },
  agentReadActions: {
    pt: "Ações de LEITURA/ANÁLISE (eu executo e devolvo o resultado para você continuar):",
    en: "READ/ANALYSIS actions (I execute them and return the result for you to continue):",
  },
  agentActionListar: {
    pt: '- {"acao": "listar", "glob": "**/*.ts"}  → lista arquivos do projeto (glob opcional).',
    en: '- {"acao": "listar", "glob": "**/*.ts"}  → lists project files (glob optional).',
  },
  agentActionLer: {
    pt: '- {"acao": "ler", "caminho": "src/app.ts"}  → devolve o conteúdo do arquivo.',
    en: '- {"acao": "ler", "caminho": "src/app.ts"}  → returns file content.',
  },
  agentActionBuscar: {
    pt: '- {"acao": "buscar", "consulta": "minhaFuncao", "glob": "**/*.ts"}  → busca texto no projeto.',
    en: '- {"acao": "buscar", "consulta": "myFunction", "glob": "**/*.ts"}  → searches text in the project.',
  },
  agentActionDiagnosticos: {
    pt: '- {"acao": "diagnosticos", "caminho": "src/app.ts"}  → erros/avisos do editor (omita caminho para todos).',
    en: '- {"acao": "diagnosticos", "caminho": "src/app.ts"}  → editor errors/warnings (omit path for all).',
  },
  agentActionEscrever: {
    pt: 'Ação de ESCRITA (cria/atualiza o arquivo; por padrão é aplicada automaticamente, salvo se o usuário tiver ativado a revisão manual):',
    en: 'WRITE action (creates/updates the file; by default applied automatically, unless the user has enabled manual review):',
  },
  agentActionEscreverExample: {
    pt: '- {"acao": "escrever", "caminho": "src/app.ts", "conteudo": "<conteúdo COMPLETO do arquivo>", "descricao": "o que muda e por quê"}',
    en: '- {"acao": "escrever", "caminho": "src/app.ts", "conteudo": "<COMPLETE file content>", "descricao": "what changes and why"}',
  },
  agentRules: {
    pt: "Regras importantes:",
    en: "Important rules:",
  },
  agentRuleReadFirst: {
    pt: "- Antes de propor mudanças, LEIA os arquivos relevantes para entender a lógica atual.",
    en: "- Before proposing changes, READ the relevant files to understand the current logic.",
  },
  agentRuleOneAtTime: {
    pt: "- Use um bloco de ação por vez quando precisar do resultado para decidir o próximo passo; pode emitir várias ações de leitura juntas.",
    en: "- Use one action block at a time when you need the result to decide the next step; you can issue multiple read actions together.",
  },
  agentRuleComplete: {
    pt: "- Em 'escrever', sempre forneça o conteúdo COMPLETO e final do arquivo (não trechos parciais nem '...').",
    en: "- In 'escrever', always provide the COMPLETE and final file content (not partial snippets or '...').",
  },
  agentRuleExplain: {
    pt: "- Explique seu raciocínio em texto normal antes das ações.",
    en: "- Explain your reasoning in normal text before the actions.",
  },
  agentRuleFinish: {
    pt: "- Quando terminar e não precisar de mais nada, responda apenas com texto, sem blocos de ação.",
    en: "- When done and nothing else is needed, respond with text only, no action blocks.",
  },

  // ── Erros / validação ──
  errorNoApiKey: {
    pt: "Nenhuma chave de API configurada para este provedor. Abra as configurações (ícone de engrenagem) e informe a chave.",
    en: "No API key configured for this provider. Open settings (gear icon) and enter the key.",
  },
  errorNoModel: {
    pt: "Nenhum modelo definido. Configure o modelo antes de conversar.",
    en: "No model defined. Configure the model before chatting.",
  },
  errorIaUnknown: { pt: "Erro desconhecido ao consultar a IA.", en: "Unknown error while querying AI." },
  errorApply: { pt: "Falha ao aplicar a alteração em %s: %s", en: "Failed to apply change to %s: %s" },
  errorNoWorkspace: { pt: "Nenhum workspace aberto para aplicar a alteração.", en: "No workspace open to apply the change." },
  errorNotReadAction: { pt: 'Ação "%s" não é de leitura.', en: 'Action "%s" is not a read action.' },
  errorActionFailed: { pt: "Falha ao executar a ação: %s", en: "Failed to execute action: %s" },
  errorNoFilesFound: { pt: "Nenhum arquivo encontrado.", en: "No files found." },
  errorMissingPath: { pt: "Parâmetro 'caminho' ausente.", en: "Parameter 'caminho' missing." },
  errorNoWorkspaceAgent: { pt: "Nenhum workspace aberto.", en: "No workspace open." },
  errorMissingQuery: { pt: "Parâmetro 'consulta' ausente.", en: "Parameter 'consulta' missing." },
  errorNoOccurrences: { pt: 'Nenhuma ocorrência de "%s".', en: 'No occurrences of "%s".' },
  errorNoDiagnosticsFile: { pt: "Nenhum diagnóstico para o arquivo.", en: "No diagnostics for the file." },
  errorNoDiagnosticsProject: { pt: "Nenhum diagnóstico no projeto.", en: "No diagnostics in the project." },
  errorTruncatedFile: { pt: "\n\n[...arquivo truncado...]", en: "\n\n[...file truncated...]" },

  // ── Ações (backend) ──
  backendResult: { pt: "### Resultado de %s", en: "### Result of %s" },
  backendContinue: { pt: "Resultados das ações solicitadas:\n\n%s\n\nContinue a tarefa com base nesses resultados.", en: "Results of the requested actions:\n\n%s\n\nContinue the task based on these results." },
  backendContextEditor: { pt: "[Contexto do editor]", en: "[Editor context]" },

  // ── Webview (main.js) ──
  wvYou: { pt: "Você", en: "You" },
  wvCopiar: { pt: "Copiar", en: "Copy" },
  wvCopiado: { pt: "Copiado!", en: "Copied!" },
  wvDiffTitle: { pt: "%s (antes ↔ depois)", en: "%s (before ↔ after)" },

  // ── Nomes de provedores (select) ──
  providerOpenai: { pt: "OpenAI", en: "OpenAI" },
  providerAnthropic: { pt: "Anthropic (Claude)", en: "Anthropic (Claude)" },
  providerDeepseek: { pt: "DeepSeek", en: "DeepSeek" },
  providerOllama: { pt: "Ollama (local)", en: "Ollama (local)" },
  providerCompativel: { pt: "Compatível com OpenAI", en: "OpenAI compatible" },

  // ── Severidades de diagnóstico ──
  diagError: { pt: "Erro", en: "Error" },
  diagWarning: { pt: "Aviso", en: "Warning" },
  diagInfo: { pt: "Info", en: "Info" },
  diagHint: { pt: "Dica", en: "Hint" },

  // ── Submenu ──
  submenuLabel: { pt: "Microed CodeAI", en: "Microed CodeAI" },

  // ── Chat / geração ──
  generationInterrupted: { pt: "(geração interrompida)", en: "(generation interrupted)" },

  // ── Refresh de modelos ──
  refreshModels: { pt: "↻", en: "↻" },
  refreshModelsTooltip: { pt: "Atualizar lista de modelos do provedor", en: "Refresh provider model list" },
  modelsUpdateOk: { pt: "✔ Modelos atualizados com sucesso", en: "✔ Models updated successfully" },
  modelsUpdateFailed: { pt: "⚠ Não foi possível atualizar modelos (sem internet ou chave ausente)", en: "⚠ Could not update models (offline or missing key)" },

  // ── Histórico ──
  historyTitle: { pt: "Histórico de conversas", en: "Chat history" },
  historyToggle: { pt: "Histórico", en: "History" },
  historyToggleTooltip: { pt: "Mostrar/ocultar histórico de conversas", en: "Show/hide chat history" },
  historyEmptyList: { pt: "Nenhuma conversa salva neste projeto.", en: "No conversations saved in this project." },
  historyBack: { pt: "← Voltar ao chat", en: "← Back to chat" },
  historyYou: { pt: "Você", en: "You" },
  historyAssistant: { pt: "Assistente", en: "Assistant" },
  historyDeleteConfirm: { pt: "Tem certeza que deseja apagar todo o histórico?", en: "Are you sure you want to delete all history?" },
  historyDelete: { pt: "Apagar histórico", en: "Delete history" },

  // ── About / Informações ──
  aboutTitle: { pt: "Sobre o Microed CodeAI", en: "About Microed CodeAI" },
  aboutVersion: { pt: "Versão", en: "Version" },
  aboutPublisher: { pt: "Publicado por", en: "Published by" },
  aboutDescription: { pt: "Chat com IA integrado ao VS Code, com Modo Agente que lê, analisa e escreve código por você. Suporte a OpenAI, Anthropic, DeepSeek, Ollama e APIs compatíveis.", en: "AI chat integrated into VS Code, with Agent Mode that reads, analyzes and writes code for you. Supports OpenAI, Anthropic, DeepSeek, Ollama and compatible APIs." },
  aboutLinks: { pt: "Links", en: "Links" },
  aboutBack: { pt: "← Voltar", en: "← Back" },
} as const;

// ────────────────────────────────────────────────────────────
// Funções de uso
// ────────────────────────────────────────────────────────────

/** Detecta o idioma preferido com base em: config manual → escolha visual salva → idioma do VS Code. */
export function detectarIdioma(contexto?: vscode.ExtensionContext): Idioma {
  const cfg = vscode.workspace.getConfiguration("microedcodeai");
  const sobrescrito = cfg.get<string>("idioma", "auto");
  if (sobrescrito === "pt" || sobrescrito === "en") {
    return sobrescrito as Idioma;
  }
  if (contexto) {
    const salvo = contexto.globalState.get<string>("microedcodeai.idiomaVisual");
    if (salvo === "pt" || salvo === "en") {
      return salvo as Idioma;
    }
  }
  const locale = (vscode.env.language ?? "").toLowerCase();
  if (locale === "pt" || locale === "pt-br" || locale.startsWith("pt")) {
    return "pt";
  }
  return "en";
}

let _idioma: Idioma | null = null;

/** Define/redefine o idioma ativo e persiste no globalState. */
export function definirIdioma(idioma: Idioma, contexto?: vscode.ExtensionContext): void {
  _idioma = idioma;
  if (contexto) {
    contexto.globalState.update("microedcodeai.idiomaVisual", idioma);
  }
}

/** Inicializa o idioma com base na detecção/config. Chame no activate(). */
export function inicializarIdioma(contexto: vscode.ExtensionContext): Idioma {
  _idioma = detectarIdioma(contexto);
  return _idioma;
}

/** Retorna o idioma ativo (detecta automaticamente se ainda não definido). */
export function idiomaAtivo(): Idioma {
  if (!_idioma) {
    _idioma = detectarIdioma();
  }
  return _idioma;
}

type MensagensKeys = keyof typeof MENSAGENS;

/**
 * Traduz uma chave. Suporta placeholders `%s` substituídos pelos argumentos
 * excedentes passados após a chave.
 *
 * Exemplo: t("errorApply", "src/app.ts", "permission denied")
 */
export function t(chave: MensagensKeys, ...args: string[]): string {
  const msg = MENSAGENS[chave];
  let texto: string = msg[idiomaAtivo()] ?? msg.pt;
  for (const arg of args) {
    texto = texto.replace("%s", arg);
  }
  return texto;
}

/**
 * Retorna um objeto chave-valor com TODAS as traduções para o idioma atual.
 * Útil para enviar ao webview (onde não temos acesso direto ao i18n).
 */
export function traducoesWebview(): Record<string, string> {
  const idm = idiomaAtivo();
  const result: Record<string, string> = {};
  for (const chave of Object.keys(MENSAGENS) as MensagensKeys[]) {
    result[chave] = MENSAGENS[chave][idm] ?? MENSAGENS[chave].pt;
  }
  return result;
}

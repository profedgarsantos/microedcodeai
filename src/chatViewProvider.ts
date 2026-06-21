import * as vscode from "vscode";
import {
  ChatMessage,
  ProviderType,
  streamChat,
  urlBasePadrao,
  exigeChave,
} from "./providers";
import {
  Acao,
  anexarHistorico,
  aplicarEscrita,
  contextoEditor,
  executarAcaoLeitura,
  extrairAcoes,
  lerConteudoAtual,
  promptAgente,
  removerBlocosAcao,
} from "./agente";

interface ConfiguracaoAtual {
  providerType: ProviderType;
  model: string;
  baseUrl: string;
  temperature: number;
  systemPrompt: string;
  modoAgente: boolean;
  aplicarAutomaticamente: boolean;
  chaveDefinida: boolean;
}

// Limite de iterações do loop do agente, para evitar laços infinitos.
const MAX_ITERACOES_AGENTE = 8;

/** Provedor da view de chat exibida no painel lateral do VS Code. */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "microedcodeai.chatView";

  private view?: vscode.WebviewView;
  private historico: ChatMessage[] = [];
  private controladorAtual?: AbortController;
  // Propostas de escrita aguardando decisão do usuário (id -> ação).
  private propostas = new Map<string, Acao>();
  // Conteúdo anterior de cada proposta, para o "Ver diff" funcionar mesmo após aplicar.
  private anteriores = new Map<string, string>();
  private contadorProposta = 0;

  constructor(
    private readonly contexto: vscode.ExtensionContext,
    private readonly uriExtensao: vscode.Uri
  ) {}

  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.uriExtensao, "media")],
    };

    webviewView.webview.html = this.gerarHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((msg) => this.tratarMensagem(msg));
  }

  /** Abre o painel e foca o campo de configuração. */
  public abrirConfiguracoes(): void {
    this.view?.show?.(true);
    this.view?.webview.postMessage({ tipo: "abrirConfiguracoes" });
  }

  /** Inicia uma nova conversa, limpando o histórico. */
  public novaConversa(): void {
    this.historico = [];
    this.propostas.clear();
    this.anteriores.clear();
    this.view?.webview.postMessage({ tipo: "limparTela" });
  }

  // ----------------------- Tratamento de mensagens -----------------------

  private async tratarMensagem(msg: any): Promise<void> {
    switch (msg?.tipo) {
      case "webviewPronto":
        await this.enviarConfig();
        break;
      case "salvarConfig":
        await this.salvarConfig(msg.dados);
        break;
      case "enviar":
        await this.enviarMensagem(String(msg.texto ?? ""));
        break;
      case "parar":
        this.controladorAtual?.abort();
        break;
      case "alternarModoAgente":
        await vscode.workspace
          .getConfiguration("microedcodeai")
          .update("modoAgente", !!msg.valor, vscode.ConfigurationTarget.Global);
        await this.enviarConfig();
        break;
      case "aplicarProposta":
        await this.aplicarProposta(String(msg.id ?? ""));
        break;
      case "rejeitarProposta":
        this.propostas.delete(String(msg.id ?? ""));
        break;
      case "verDiff":
        await this.verDiff(String(msg.id ?? ""));
        break;
      case "abrirLink":
        if (typeof msg.url === "string" && /^https?:\/\//.test(msg.url)) {
          vscode.env.openExternal(vscode.Uri.parse(msg.url));
        }
        break;
      case "limpar":
        this.novaConversa();
        break;
    }
  }

  // ----------------------- Propostas de escrita -----------------------

  private async aplicarProposta(id: string): Promise<void> {
    const acao = this.propostas.get(id);
    if (!acao || !acao.caminho) {
      return;
    }
    try {
      await aplicarEscrita(acao.caminho, acao.conteudo ?? "");
      this.propostas.delete(id);
      this.anteriores.delete(id);
      this.view?.webview.postMessage({
        tipo: "propostaAplicada",
        id,
        caminho: acao.caminho,
      });
      this.historico.push({
        role: "user",
        content: `[O usuário APLICOU a alteração no arquivo ${acao.caminho}.]`,
      });
    } catch (e: any) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto: `Falha ao aplicar a alteração em ${acao.caminho}: ${e?.message ?? e}`,
      });
    }
  }

  private async verDiff(id: string): Promise<void> {
    const acao = this.propostas.get(id);
    if (!acao || !acao.caminho) {
      return;
    }
    // Usa o conteúdo anterior salvo (útil quando a alteração já foi aplicada);
    // se não houver, lê o conteúdo atual do arquivo.
    const anterior = this.anteriores.has(id)
      ? this.anteriores.get(id)!
      : await lerConteudoAtual(acao.caminho);
    const docAtual = await vscode.workspace.openTextDocument({
      content: anterior,
      language: "plaintext",
    });
    const docNovo = await vscode.workspace.openTextDocument({
      content: acao.conteudo ?? "",
      language: "plaintext",
    });
    await vscode.commands.executeCommand(
      "vscode.diff",
      docAtual.uri,
      docNovo.uri,
      `microedcode.ai · ${acao.caminho} (antes ↔ depois)`
    );
  }

  private chaveSecreta(tipo: ProviderType): string {
    return `microedcodeai.apiKey.${tipo}`;
  }

  private async lerConfig(): Promise<ConfiguracaoAtual> {
    const cfg = vscode.workspace.getConfiguration("microedcodeai");
    const providerType = cfg.get<ProviderType>("providerType", "openai");
    const chave = await this.contexto.secrets.get(this.chaveSecreta(providerType));
    return {
      providerType,
      model: cfg.get<string>("model", "gpt-5.4-mini"),
      baseUrl: cfg.get<string>("baseUrl", ""),
      temperature: cfg.get<number>("temperature", 0.7),
      systemPrompt: cfg.get<string>("systemPrompt", ""),
      modoAgente: cfg.get<boolean>("modoAgente", true),
      aplicarAutomaticamente: cfg.get<boolean>("aplicarAutomaticamente", true),
      chaveDefinida: !!chave,
    };
  }

  private async enviarConfig(): Promise<void> {
    const config = await this.lerConfig();
    this.view?.webview.postMessage({
      tipo: "config",
      dados: {
        ...config,
        baseUrlPadrao: urlBasePadrao(config.providerType),
      },
    });
  }

  private async salvarConfig(dados: any): Promise<void> {
    const cfg = vscode.workspace.getConfiguration("microedcodeai");
    const tipo = dados.providerType as ProviderType;

    await cfg.update("providerType", tipo, vscode.ConfigurationTarget.Global);
    await cfg.update("model", String(dados.model ?? "").trim(), vscode.ConfigurationTarget.Global);
    await cfg.update("baseUrl", String(dados.baseUrl ?? "").trim(), vscode.ConfigurationTarget.Global);
    if (typeof dados.temperature === "number") {
      await cfg.update("temperature", dados.temperature, vscode.ConfigurationTarget.Global);
    }
    if (typeof dados.systemPrompt === "string") {
      await cfg.update("systemPrompt", dados.systemPrompt, vscode.ConfigurationTarget.Global);
    }
    if (typeof dados.aplicarAutomaticamente === "boolean") {
      await cfg.update(
        "aplicarAutomaticamente",
        dados.aplicarAutomaticamente,
        vscode.ConfigurationTarget.Global
      );
    }

    const chave = typeof dados.apiKey === "string" ? dados.apiKey.trim() : "";
    if (chave.length > 0) {
      await this.contexto.secrets.store(this.chaveSecreta(tipo), chave);
    }

    await this.enviarConfig();
    this.view?.webview.postMessage({
      tipo: "info",
      texto: "Configuração salva com sucesso.",
    });
  }

  private async enviarMensagem(texto: string): Promise<void> {
    const conteudo = texto.trim();
    if (conteudo.length === 0) {
      return;
    }

    const config = await this.lerConfig();
    const apiKey = await this.validarEObterChave(config);
    if (apiKey === null) {
      return;
    }

    // Registra a solicitação do usuário no histórico do projeto.
    await anexarHistorico("usuario", conteudo);

    // No modo agente, anexa o contexto do editor (arquivo ativo + seleção).
    let entrada = conteudo;
    if (config.modoAgente) {
      const ctx = contextoEditor();
      if (ctx) {
        entrada = `${conteudo}\n\n[Contexto do editor]\n${ctx}`;
      }
    }

    await this.rodarPipeline(config, apiKey, entrada);
  }

  /**
   * Gera (ou atualiza) testes unitários para o arquivo ativo no editor,
   * usando o trecho selecionado quando houver. Acionado pelo menu de contexto.
   */
  public async gerarTesteUnitario(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(
        "microedcode.ai: abra um arquivo de código para gerar testes unitários."
      );
      return;
    }

    const caminho = vscode.workspace.asRelativePath(editor.document.uri, false);
    const linguagem = editor.document.languageId;
    const selecao = editor.document.getText(editor.selection);
    const temSelecao = selecao.trim().length > 0;
    const alvo = temSelecao
      ? `o trecho de código selecionado em ${caminho}`
      : `o arquivo ${caminho}`;

    await this.garantirView();

    const exibicao = `Criar ou atualizar teste unitário para ${alvo}.`;
    this.view?.webview.postMessage({ tipo: "mensagemUsuario", texto: exibicao });
    await anexarHistorico("usuario", exibicao);

    const partes: string[] = [
      `Tarefa: criar ou atualizar os testes unitários para ${alvo} (linguagem: ${linguagem}).`,
      "",
      "Diretrizes:",
      "- Leia o arquivo alvo e, se necessário, arquivos relacionados para entender a lógica.",
      "- Detecte o framework de testes já usado no projeto (ex.: Jasmine/Karma, Jest, Vitest, Mocha, pytest, JUnit, etc.). Se não houver, escolha o mais adequado à linguagem/stack.",
      "- Se já existir um arquivo de teste para o alvo, ATUALIZE-o cobrindo os casos novos; caso contrário, CRIE um novo arquivo de teste seguindo a convenção de nomes do projeto.",
      "- Cubra casos de sucesso, de borda e de erro.",
      "- Escreva os testes e comentários em português do Brasil.",
    ];
    if (temSelecao) {
      partes.push("", "Trecho selecionado:", "```", selecao.slice(0, 8000), "```");
    }

    const config = await this.lerConfig();
    const apiKey = await this.validarEObterChave(config);
    if (apiKey === null) {
      return;
    }
    await this.rodarPipeline(config, apiKey, partes.join("\n"));
  }

  /**
   * Valida pré-requisitos (chave/modelo) e devolve a chave de API.
   * Retorna null (e notifica o usuário) se algo estiver faltando.
   */
  private async validarEObterChave(
    config: ConfiguracaoAtual
  ): Promise<string | undefined | null> {
    const apiKey = await this.contexto.secrets.get(
      this.chaveSecreta(config.providerType)
    );
    if (exigeChave(config.providerType) && !apiKey) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto:
          "Nenhuma chave de API configurada para este provedor. Abra as configurações (ícone de engrenagem) e informe a chave.",
      });
      return null;
    }
    if (!config.model || config.model.trim().length === 0) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto: "Nenhum modelo definido. Configure o modelo antes de conversar.",
      });
      return null;
    }
    return apiKey ?? undefined;
  }

  /** Empurra a entrada no histórico e roda o loop do agente. */
  private async rodarPipeline(
    config: ConfiguracaoAtual,
    apiKey: string | undefined,
    entrada: string
  ): Promise<void> {
    this.historico.push({ role: "user", content: entrada });
    this.controladorAtual = new AbortController();
    try {
      await this.executarConversa(config, apiKey);
    } finally {
      this.controladorAtual = undefined;
    }
  }

  /** Garante que o painel de chat esteja visível e com o webview pronto. */
  private async garantirView(): Promise<void> {
    if (!this.view) {
      await vscode.commands.executeCommand("microedcodeai.chatView.focus");
      // Aguarda a resolução do webview (até ~3s).
      for (let i = 0; i < 30 && !this.view; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    } else {
      this.view.show?.(true);
    }
  }

  /**
   * Loop principal: conversa com o modelo e, no modo agente, executa as ações
   * de leitura solicitadas, realimentando o modelo até ele concluir.
   */
  private async executarConversa(
    config: ConfiguracaoAtual,
    apiKey: string | undefined
  ): Promise<void> {
    for (let iter = 0; iter < MAX_ITERACOES_AGENTE; iter++) {
      const mensagens: ChatMessage[] = [];
      const sistema = config.modoAgente
        ? promptAgente()
        : config.systemPrompt;
      if (sistema && sistema.trim().length > 0) {
        mensagens.push({ role: "system", content: sistema });
      }
      mensagens.push(...this.historico);

      const resposta = await this.streamarResposta(config, apiKey, mensagens);
      if (resposta === undefined) {
        return; // interrompido ou erro (já notificado ao webview)
      }
      this.historico.push({ role: "assistant", content: resposta });
      // Registra a parte legível da resposta no histórico do projeto
      // (turnos só com blocos de ação ficam vazios e são ignorados).
      await anexarHistorico("assistente", removerBlocosAcao(resposta));

      if (!config.modoAgente) {
        return;
      }

      const acoes = extrairAcoes(resposta);
      if (acoes.length === 0) {
        return; // o modelo concluiu
      }

      const escritas = acoes.filter((a) => a.acao === "escrever");
      const leituras = acoes.filter((a) => a.acao !== "escrever");

      for (const escrita of escritas) {
        await this.registrarProposta(escrita, config.aplicarAutomaticamente);
      }

      // Sem ações de leitura: encerra o turno. As alterações já foram aplicadas
      // automaticamente ou estão como propostas aguardando o usuário.
      if (leituras.length === 0) {
        return;
      }

      // Executa as leituras e realimenta o modelo.
      const partes: string[] = [];
      for (const leitura of leituras) {
        this.view?.webview.postMessage({
          tipo: "acao",
          texto: this.rotuloAcao(leitura),
        });
        const r = await executarAcaoLeitura(leitura);
        const cabecalho = r.caminho ? `${r.acao} (${r.caminho})` : r.acao;
        partes.push(
          `### Resultado de ${cabecalho}\n${r.ok ? "" : "[ERRO] "}${r.saida}`
        );
      }
      this.historico.push({
        role: "user",
        content:
          "Resultados das ações solicitadas:\n\n" +
          partes.join("\n\n") +
          "\n\nContinue a tarefa com base nesses resultados.",
      });
    }

    this.view?.webview.postMessage({
      tipo: "info",
      texto: "Limite de passos do agente atingido.",
    });
  }

  private rotuloAcao(acao: Acao): string {
    switch (acao.acao) {
      case "listar":
        return `Listando arquivos${acao.glob ? " (" + acao.glob + ")" : ""}…`;
      case "ler":
        return `Lendo ${acao.caminho}…`;
      case "buscar":
        return `Buscando "${acao.consulta}"…`;
      case "diagnosticos":
        return `Analisando diagnósticos${acao.caminho ? " de " + acao.caminho : ""}…`;
      default:
        return `Executando ${acao.acao}…`;
    }
  }

  private async registrarProposta(
    acao: Acao,
    aplicarAuto: boolean
  ): Promise<void> {
    if (!acao.caminho || typeof acao.conteudo !== "string") {
      return;
    }
    const id = `p${++this.contadorProposta}`;
    this.propostas.set(id, acao);
    const atual = await lerConteudoAtual(acao.caminho);
    this.anteriores.set(id, atual);
    const novo = atual.length === 0;

    if (aplicarAuto) {
      // Modo padrão: aplica a alteração imediatamente no arquivo.
      try {
        await aplicarEscrita(acao.caminho, acao.conteudo);
        this.propostas.delete(id);
        this.view?.webview.postMessage({
          tipo: "proposta",
          id,
          caminho: acao.caminho,
          descricao: acao.descricao ?? "",
          novo,
          aplicada: true,
        });
        this.historico.push({
          role: "user",
          content: `[O arquivo ${acao.caminho} foi ${
            novo ? "criado" : "atualizado"
          } automaticamente com o conteúdo proposto.]`,
        });
      } catch (e: any) {
        this.view?.webview.postMessage({
          tipo: "erro",
          texto: `Falha ao aplicar a alteração em ${acao.caminho}: ${e?.message ?? e}`,
        });
      }
      return;
    }

    // Modo aprovação manual: vira uma proposta com botões Aplicar/Ver diff/Rejeitar.
    this.view?.webview.postMessage({
      tipo: "proposta",
      id,
      caminho: acao.caminho,
      descricao: acao.descricao ?? "",
      novo,
      aplicada: false,
    });
  }

  /** Faz uma única rodada de streaming, atualizando a UI. Retorna o texto, ou undefined se interrompido/erro. */
  private async streamarResposta(
    config: ConfiguracaoAtual,
    apiKey: string | undefined,
    mensagens: ChatMessage[]
  ): Promise<string | undefined> {
    this.view?.webview.postMessage({ tipo: "inicioResposta" });
    let respostaCompleta = "";
    try {
      await streamChat({
        providerType: config.providerType,
        model: config.model,
        baseUrl: config.baseUrl,
        apiKey,
        temperature: config.temperature,
        messages: mensagens,
        signal: this.controladorAtual?.signal,
        onChunk: (pedaco) => {
          respostaCompleta += pedaco;
          this.view?.webview.postMessage({ tipo: "pedaco", texto: pedaco });
        },
      });
      this.view?.webview.postMessage({ tipo: "fimResposta" });
      return respostaCompleta;
    } catch (erro: any) {
      if (erro?.name === "AbortError") {
        if (respostaCompleta.length > 0) {
          this.historico.push({ role: "assistant", content: respostaCompleta });
        }
        this.view?.webview.postMessage({ tipo: "fimResposta", interrompido: true });
      } else {
        if (this.historico[this.historico.length - 1]?.role === "user") {
          this.historico.pop();
        }
        this.view?.webview.postMessage({
          tipo: "erro",
          texto: erro?.message ?? "Erro desconhecido ao consultar a IA.",
        });
      }
      return undefined;
    }
  }

  // ----------------------- HTML -----------------------

  private gerarHtml(webview: vscode.Webview): string {
    const uriScript = webview.asWebviewUri(
      vscode.Uri.joinPath(this.uriExtensao, "media", "main.js")
    );
    const uriEstilo = webview.asWebviewUri(
      vscode.Uri.joinPath(this.uriExtensao, "media", "style.css")
    );
    const uriLogo = webview.asWebviewUri(
      vscode.Uri.joinPath(this.uriExtensao, "media", "logo.png")
    );
    const nonce = gerarNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${uriEstilo}" rel="stylesheet" />
  <title>microedcode.ai</title>
</head>
<body>
  <div id="painel-config" class="painel-config oculto">
    <h2>Configuração do provedor</h2>

    <label for="cfg-provider">Provedor de IA</label>
    <select id="cfg-provider">
      <option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic (Claude)</option>
      <option value="deepseek">DeepSeek</option>
      <option value="ollama">Ollama (local)</option>
      <option value="openai-compativel">Compatível com OpenAI</option>
    </select>

    <label for="cfg-modelo-select">Modelo</label>
    <select id="cfg-modelo-select"></select>
    <input id="cfg-modelo" class="oculto" placeholder="digite o nome do modelo" />

    <label for="cfg-baseurl">URL base <span class="dica">(opcional)</span></label>
    <input id="cfg-baseurl" placeholder="usar padrão do provedor" />

    <label for="cfg-apikey">Chave de API</label>
    <input id="cfg-apikey" type="password" placeholder="cole sua chave aqui" />
    <span id="cfg-status-chave" class="dica"></span>
    <a id="cfg-link-chave" class="link-chave oculto" href="#">Obter chave de API</a>

    <label for="cfg-temp">Temperatura: <span id="cfg-temp-valor">0.7</span></label>
    <input id="cfg-temp" type="range" min="0" max="2" step="0.1" value="0.7" />

    <label for="cfg-system">Instrução de sistema</label>
    <textarea id="cfg-system" rows="3"></textarea>

    <label class="check-config" title="Quando ativado, a IA altera os arquivos imediatamente. Desative para revisar e aprovar cada mudança antes de aplicar.">
      <input id="cfg-aplicar-auto" type="checkbox" />
      <span>Aplicar alterações automaticamente nos arquivos</span>
    </label>

    <div class="acoes-config">
      <button id="btn-salvar" class="primario">Salvar</button>
      <button id="btn-cancelar" class="secundario">Cancelar</button>
    </div>

    <div class="sobre">
      <span>Sobre: extensão criada por <strong>Microed Sistemas</strong></span>
      <a id="cfg-link-sobre" class="link-chave" href="#" data-url="https://microed.com.br/microedcodeai">https://microed.com.br/microedcodeai</a>
    </div>
  </div>

  <div id="painel-chat" class="painel-chat">
    <a id="propaganda" class="propaganda" href="#" data-url="https://microed.com.br/microedcodeai" title="Conheça o microedcode.ai">
      <img class="propaganda-logo" src="${uriLogo}" alt="microedcode.ai" />
      <span class="propaganda-texto"><strong>microedcode.ai</strong> · soluções em IA por Microed Sistemas</span>
      <span class="propaganda-cta">Saiba mais &rarr;</span>
    </a>
    <div id="mensagens" class="mensagens">
      <div class="boas-vindas">
        <h3>Bem-vindo ao microedcode.ai</h3>
        <p>Converse com a IA diretamente no VS Code. Com o <strong>Modo Agente</strong> ativado, a IA pode analisar a lógica do projeto, ler arquivos, propor a criação/atualização de código e ajudar a corrigir bugs.</p>
        <p>Clique na engrenagem para escolher o provedor, o modelo e informar sua chave de API.</p>
      </div>
    </div>

    <div class="barra-status">
      <span id="status-modelo" class="status-modelo"></span>
      <label class="toggle-agente" title="No modo agente, a IA lê arquivos e propõe alterações no código">
        <input id="chk-agente" type="checkbox" />
        <span>Modo Agente</span>
      </label>
    </div>

    <div class="area-entrada">
      <textarea id="entrada" rows="1" placeholder="Pergunte algo... (Enter para enviar, Shift+Enter para nova linha)"></textarea>
      <button id="btn-enviar" class="primario" title="Enviar">Enviar</button>
      <button id="btn-parar" class="secundario oculto" title="Parar geração">Parar</button>
    </div>
  </div>

  <script nonce="${nonce}" src="${uriScript}"></script>
</body>
</html>`;
  }
}

function gerarNonce(): string {
  let texto = "";
  const possiveis =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    texto += possiveis.charAt(Math.floor(Math.random() * possiveis.length));
  }
  return texto;
}

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
  anexarMensagemHistorico,
  aplicarEscrita,
  contextoEditor,
  executarAcaoLeitura,
  extrairAcoes,
  lerConteudoAtual,
  lerHistoricoSalvo,
  lerUltimaConversa,
  carregarConversa,
  apagarHistorico,
  promptAgente,
  removerBlocosAcao,
  ConversaHistorico,
} from "./agente";
import { t, traducoesWebview, idiomaAtivo, definirIdioma, Idioma } from "./i18n";
import { cacheCompleto, atualizarModelosProvider } from "./modelos";

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
  private idConversaAtual: string | undefined;
  private controladorAtual?: AbortController;
  private propostas = new Map<string, Acao>();
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

  public abrirConfiguracoes(): void {
    this.view?.show?.(true);
    this.view?.webview.postMessage({ tipo: "abrirConfiguracoes" });
  }

  public novaConversa(): void {
    this.historico = [];
    this.idConversaAtual = undefined;
    this.propostas.clear();
    this.anteriores.clear();
    this.view?.webview.postMessage({ tipo: "limparTela" });
  }

  /** Exibe o painel About com informações da extensão. */
  public mostrarAbout(): void {
    this.view?.show?.(true);
    let versao = "?";
    try {
      // No VSIX instalado: out/chatViewProvider.js → ../package.json
      // No dev (tsc):        out/chatViewProvider.js → ../package.json
      versao = require("../package.json").version || "?";
    } catch { /* ignora */ }
    this.view?.webview.postMessage({
      tipo: "mostrarAbout",
      versao,
    });
  }

  /** Exibe o painel de histórico no chat. */
  public async mostrarHistorico(): Promise<void> {
    this.view?.show?.(true);
    const conversas = await lerHistoricoSalvo();
    const resumo = conversas.map(c => ({
      id: c.id,
      titulo: c.titulo,
      data: c.data,
      resumo: c.mensagens.length > 0 ? c.mensagens[0].conteudo.substring(0, 120) : "",
    }));
    this.view?.webview.postMessage({
      tipo: "historicoCarregado",
      conversas: resumo,
    });
  }

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
      case "alterarIdioma": {
        const novoIdioma = String(msg.idioma ?? "pt") as Idioma;
        definirIdioma(novoIdioma, this.contexto);
        // Envia o system prompt padrão traduzido diretamente (não via lerConfig)
        const systemPromptPadrao = t("defaultSystemPrompt");
        this.view?.webview.postMessage({
          tipo: "idiomaAlterado",
          idioma: novoIdioma,
          i18n: traducoesWebview(),
          systemPromptPadrao,
        });
        break;
      }
      case "atualizarModelos": {
        const cfg = await this.lerConfig();
        const chave = await this.contexto.secrets.get(this.chaveSecreta(cfg.providerType));
        const resultado = await atualizarModelosProvider(
          this.uriExtensao,
          cfg.providerType,
          chave ?? undefined,
          cfg.baseUrl
        );
        this.view?.webview.postMessage({
          tipo: "modelosAtualizados",
          modelos: resultado.modelos,
          status: resultado.status,
        });
        // Feedback visual na barra de status
        const msgStatus = resultado.status === "ok"
          ? t("modelsUpdateOk")
          : t("modelsUpdateFailed");
        this.view?.webview.postMessage({ tipo: "info", texto: msgStatus });
        break;
      }
      case "carregarHistorico": {
        const conversas = await lerHistoricoSalvo();
        // Envia lista de conversas (resumo) para o webview
        const resumo = conversas.map(c => ({
          id: c.id,
          titulo: c.titulo,
          data: c.data,
          resumo: c.mensagens.length > 0 ? c.mensagens[0].conteudo.substring(0, 120) : "",
        }));
        this.view?.webview.postMessage({
          tipo: "historicoCarregado",
          conversas: resumo,
        });
        break;
      }
      case "carregarConversaPorId": {
        const conv = await carregarConversa(String(msg.id ?? ""));
        if (conv) {
          this.idConversaAtual = conv.id;
          this.historico = conv.mensagens.map(m => ({
            role: m.papel === "usuario" ? "user" : "assistant",
            content: m.conteudo,
          }));
          this.view?.webview.postMessage({
            tipo: "carregarConversa",
            mensagens: this.historico.map(m => ({
              role: m.role,
              content: m.content,
              horario: "",
            })),
          });
        }
        break;
      }
      case "apagarHistorico": {
        await apagarHistorico();
        this.historico = [];
        this.idConversaAtual = undefined;
        this.view?.webview.postMessage({ tipo: "historicoCarregado", conversas: [] });
        break;
      }
      case "carregarAbout": {
        this.mostrarAbout();
        break;
      }
    }
  }

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
        content: t("historyUserApplied", acao.caminho),
      });
    } catch (e: any) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto: t("errorApply", acao.caminho, e?.message ?? String(e)),
      });
    }
  }

  private async verDiff(id: string): Promise<void> {
    const acao = this.propostas.get(id);
    if (!acao || !acao.caminho) {
      return;
    }
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
      t("wvDiffTitle", acao.caminho),
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
      systemPrompt: cfg.get<string>("systemPrompt", "") || t("defaultSystemPrompt"),
      modoAgente: cfg.get<boolean>("modoAgente", true),
      aplicarAutomaticamente: cfg.get<boolean>("aplicarAutomaticamente", true),
      chaveDefinida: !!chave,
    };
  }

  private async enviarConfig(): Promise<void> {
    const config = await this.lerConfig();
    const modelos = await cacheCompleto(this.uriExtensao);
    this.view?.webview.postMessage({
      tipo: "config",
      dados: {
        ...config,
        baseUrlPadrao: urlBasePadrao(config.providerType),
        modelos,
        i18n: traducoesWebview(),
        idioma: idiomaAtivo(),
      },
    });
    // Carrega a última conversa automaticamente (se houver)
    this.carregarUltimaConversa();
    // Em background: tenta buscar do JSON público para atualizar a lista
    this.atualizarModelosEmBackground(config.providerType);
  }

  /** Carrega a última conversa salva e a exibe no chat. */
  private async carregarUltimaConversa(): Promise<void> {
    const ultima = await lerUltimaConversa();
    if (ultima && ultima.mensagens.length > 0) {
      this.idConversaAtual = ultima.id;
      this.historico = ultima.mensagens.map(m => ({
        role: m.papel === "usuario" ? "user" : "assistant",
        content: m.conteudo,
      }));
      // Envia as mensagens para o webview
      this.view?.webview.postMessage({
        tipo: "carregarConversa",
        mensagens: this.historico.map(m => ({
          role: m.role,
          content: m.content,
          horario: "",
        })),
      });
    }
  }

  /** Dispara a atualização de modelos em background (sem bloquear a UI). */
  private async atualizarModelosEmBackground(tipo: ProviderType): Promise<void> {
    try {
      console.log(`[microedcodeai] Iniciando atualização de modelos em background para ${tipo}`);
      const chave = await this.contexto.secrets.get(this.chaveSecreta(tipo));
      const resultado = await atualizarModelosProvider(
        this.uriExtensao,
        tipo,
        chave ?? undefined,
        ""  // usa URL padrão do provedor
      );
      console.log(`[microedcodeai] Resultado da atualização: status=${resultado.status}, provedores=${Object.keys(resultado.modelos).length}`);
      if (resultado.status === "ok") {
        this.view?.webview.postMessage({
          tipo: "modelosAtualizados",
          modelos: resultado.modelos,
        });
      }
    } catch (e: any) {
      console.error(`[microedcodeai] Erro em atualizarModelosEmBackground: ${e?.message || e}`);
    }
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
      // Não persiste o system prompt se for igual ao padrão (permite troca de idioma)
      const padraoPt = "Você é um assistente de programação prestativo. Responda sempre em português do Brasil.";
      const padraoEn = "You are a helpful programming assistant. Always respond in English.";
      const enviado = dados.systemPrompt.trim();
      if (enviado === padraoPt || enviado === padraoEn) {
        await cfg.update("systemPrompt", "", vscode.ConfigurationTarget.Global);
      } else {
        await cfg.update("systemPrompt", enviado, vscode.ConfigurationTarget.Global);
      }
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
      texto: t("configSaved"),
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

    this.idConversaAtual = await anexarMensagemHistorico(this.idConversaAtual, "usuario", conteudo);

    let entrada = conteudo;
    if (config.modoAgente) {
      const ctx = contextoEditor();
      if (ctx) {
        entrada = `${conteudo}\n\n${t("backendContextEditor")}\n${ctx}`;
      }
    }

    await this.rodarPipeline(config, apiKey, entrada);
  }

  public async gerarTesteUnitario(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage(t("unitTestNoFile"));
      return;
    }

    const caminho = vscode.workspace.asRelativePath(editor.document.uri, false);
    const linguagem = editor.document.languageId;
    const selecao = editor.document.getText(editor.selection);
    const temSelecao = selecao.trim().length > 0;
    const alvo = temSelecao
      ? t("unitTestTaskSelected", caminho)
      : t("unitTestTaskFile", caminho);

    await this.garantirView();

    const exibicao = t("unitTestUserMessage", alvo);
    this.view?.webview.postMessage({ tipo: "mensagemUsuario", texto: exibicao });
    this.idConversaAtual = await anexarMensagemHistorico(this.idConversaAtual, "usuario", exibicao);


    const partes: string[] = [
      t("unitTestPromptTask", alvo, linguagem),
      "",
      t("unitTestGuidelines"),
      t("unitTestGuideRead"),
      t("unitTestGuideDetect"),
      t("unitTestGuideUpdate"),
      t("unitTestGuideCoverage"),
      t("unitTestGuideLanguage"),
    ];
    if (temSelecao) {
      partes.push("", t("unitTestSelectedSnippet"), "```", selecao.slice(0, 8000), "```");
    }

    const config = await this.lerConfig();
    const apiKey = await this.validarEObterChave(config);
    if (apiKey === null) {
      return;
    }
    await this.rodarPipeline(config, apiKey, partes.join("\n"));
  }

  private async validarEObterChave(
    config: ConfiguracaoAtual
  ): Promise<string | undefined | null> {
    const apiKey = await this.contexto.secrets.get(
      this.chaveSecreta(config.providerType)
    );
    if (exigeChave(config.providerType) && !apiKey) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto: t("errorNoApiKey"),
      });
      return null;
    }
    if (!config.model || config.model.trim().length === 0) {
      this.view?.webview.postMessage({
        tipo: "erro",
        texto: t("errorNoModel"),
      });
      return null;
    }
    return apiKey ?? undefined;
  }

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

  private async garantirView(): Promise<void> {
    if (!this.view) {
      await vscode.commands.executeCommand("microedcodeai.chatView.focus");
      for (let i = 0; i < 30 && !this.view; i++) {
        await new Promise((r) => setTimeout(r, 100));
      }
    } else {
      this.view.show?.(true);
    }
  }

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
        return;
      }
      this.historico.push({ role: "assistant", content: resposta });
      await anexarMensagemHistorico(this.idConversaAtual, "assistente", removerBlocosAcao(resposta));

      if (!config.modoAgente) {
        return;
      }

      const acoes = extrairAcoes(resposta);
      if (acoes.length === 0) {
        return;
      }

      const escritas = acoes.filter((a) => a.acao === "escrever");
      const leituras = acoes.filter((a) => a.acao !== "escrever");

      for (const escrita of escritas) {
        await this.registrarProposta(escrita, config.aplicarAutomaticamente);
      }

      if (leituras.length === 0) {
        return;
      }

      const partes: string[] = [];
      for (const leitura of leituras) {
        this.view?.webview.postMessage({
          tipo: "acao",
          texto: this.rotuloAcao(leitura),
        });
        const r = await executarAcaoLeitura(leitura);
        const cabecalho = r.caminho ? `${r.acao} (${r.caminho})` : r.acao;
        partes.push(
          t("backendResult", cabecalho) + "\n" + (r.ok ? "" : "[ERRO] ") + r.saida
        );
      }
      this.historico.push({
        role: "user",
        content: t("backendContinue", partes.join("\n\n")),
      });
    }

    this.view?.webview.postMessage({
      tipo: "info",
      texto: t("agentMaxSteps"),
    });
  }

  private rotuloAcao(acao: Acao): string {
    switch (acao.acao) {
      case "listar":
        return t("agentListing") + (acao.glob ? " (" + acao.glob + ")" : "") + "\u2026";
      case "ler":
        return t("agentReading", acao.caminho ?? "") + "\u2026";
      case "buscar":
        return t("agentSearching", acao.consulta ?? "") + "\u2026";
      case "diagnosticos":
        return acao.caminho
          ? t("agentDiagnosticsOf", acao.caminho) + "\u2026"
          : t("agentDiagnostics") + "\u2026";
      default:
        return t("agentExecuting", acao.acao) + "\u2026";
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
          content: novo
            ? t("historyFileCreated", acao.caminho)
            : t("historyFileUpdated", acao.caminho),
        });
      } catch (e: any) {
        this.view?.webview.postMessage({
          tipo: "erro",
          texto: t("errorApply", acao.caminho, e?.message ?? String(e)),
        });
      }
      return;
    }

    this.view?.webview.postMessage({
      tipo: "proposta",
      id,
      caminho: acao.caminho,
      descricao: acao.descricao ?? "",
      novo,
      aplicada: false,
    });
  }

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
          texto: erro?.message ?? t("errorIaUnknown"),
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
      vscode.Uri.joinPath(this.uriExtensao, "media", "logof.png")
    );
    const nonce = gerarNonce();
    const lang = idiomaAtivo() === "pt" ? "pt-BR" : "en";

    return /* html */ `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${uriEstilo}" rel="stylesheet" />
  <title data-i18n="appTitleWebview">${t("appTitleWebview")}</title>
</head>
<body>
  <div id="painel-config" class="painel-config oculto">
    <h2 data-i18n="configTitle">${t("configTitle")}</h2>

    <label for="sel-idioma" data-i18n="configLanguage">${t("configLanguage")}</label>
    <select id="sel-idioma" class="sel-idioma-config">
      <option value="pt">Português</option>
      <option value="en">English</option>
    </select>

    <label for="cfg-provider" data-i18n="configProvider">${t("configProvider")}</label>
    <select id="cfg-provider">
      <option value="openai" data-i18n="providerOpenai">${t("providerOpenai")}</option>
      <option value="anthropic" data-i18n="providerAnthropic">${t("providerAnthropic")}</option>
      <option value="deepseek" data-i18n="providerDeepseek">${t("providerDeepseek")}</option>
      <option value="ollama" data-i18n="providerOllama">${t("providerOllama")}</option>
      <option value="openai-compativel" data-i18n="providerCompativel">${t("providerCompativel")}</option>
    </select>

    <label for="cfg-modelo-select" data-i18n="configModel">${t("configModel")}</label>
    <div class="modelo-linha">
      <select id="cfg-modelo-select"></select>
      <button id="btn-atualizar-modelos" class="btn-atualizar-modelos" title="${t("refreshModelsTooltip")}" data-i18n-title="refreshModelsTooltip" data-i18n="refreshModels">${t("refreshModels")}</button>
    </div>

    <label for="cfg-baseurl"><span data-i18n="configBaseUrl">${t("configBaseUrl")}</span> <span class="dica" data-i18n="configBaseUrlOptional">${t("configBaseUrlOptional")}</span></label>
    <input id="cfg-baseurl" placeholder="${t("configBaseUrlPlaceholder")}" data-i18n-placeholder="configBaseUrlPlaceholder" />

    <label for="cfg-apikey" data-i18n="configApiKey">${t("configApiKey")}</label>
    <input id="cfg-apikey" type="password" placeholder="${t("configApiKeyPlaceholder")}" data-i18n-placeholder="configApiKeyPlaceholder" />
    <span id="cfg-status-chave" class="dica"></span>
    <a id="cfg-link-chave" class="link-chave oculto" href="#" data-i18n="configGetApiKey">${t("configGetApiKey")}</a>

    <label for="cfg-temp"><span data-i18n="configTemperature">${t("configTemperature")}</span>: <span id="cfg-temp-valor">0.7</span></label>
    <input id="cfg-temp" type="range" min="0" max="2" step="0.1" value="0.7" />

    <label for="cfg-system" data-i18n="configSystemPrompt">${t("configSystemPrompt")}</label>
    <textarea id="cfg-system" rows="3"></textarea>

    <label class="check-config" title="${t("configApplyAutoTooltip")}" data-i18n-title="configApplyAutoTooltip">
      <input id="cfg-aplicar-auto" type="checkbox" />
      <span data-i18n="configApplyAuto">${t("configApplyAuto")}</span>
    </label>

    <div class="acoes-config">
      <button id="btn-salvar" class="primario" data-i18n="configSave">${t("configSave")}</button>
      <button id="btn-cancelar" class="secundario" data-i18n="configCancel">${t("configCancel")}</button>
    </div>

    <div class="sobre">
      <span data-i18n="aboutText">${t("aboutText")}</span>
      <a id="cfg-link-sobre" class="link-chave" href="#" data-url="https://microed.com.br/microedcodeai">https://microed.com.br/microedcodeai</a>
    </div>
  </div>

  <div id="painel-chat" class="painel-chat">
    <a id="propaganda" class="propaganda" href="#" data-url="https://microed.com.br/microedcodeai" title="${t("promoTitle")}" data-i18n-title="promoTitle">
      <img class="propaganda-logo" src="${uriLogo}" alt="Microed CodeAI" />
      <span class="propaganda-texto" data-i18n="promoText">${t("promoText")}</span>
      <span class="propaganda-cta" data-i18n="promoCta">${t("promoCta")}</span>
    </a>

    <!-- Painel de histórico -->
    <div id="painel-historico" class="painel-historico oculto">
      <div class="historico-cabecalho">
        <span class="historico-titulo" data-i18n="historyTitle">${t("historyTitle")}</span>
        <button id="btn-fechar-historico" class="btn-fechar-historico" data-i18n="historyBack">${t("historyBack")}</button>
      </div>
      <div id="lista-historico" class="lista-historico"></div>
      <div class="historico-rodape">
        <button id="btn-apagar-historico" class="btn-apagar-historico" data-i18n="historyDelete">${t("historyDelete")}</button>
      </div>
    </div>

    <!-- Painel About -->
    <div id="painel-about" class="painel-about oculto">
      <div class="historico-cabecalho">
        <span class="historico-titulo" data-i18n="aboutTitle">${t("aboutTitle")}</span>
        <button id="btn-fechar-about" class="btn-fechar-historico" data-i18n="aboutBack">${t("aboutBack")}</button>
      </div>
      <div class="about-conteudo">
        <div class="about-logo"><img src="${uriLogo}" alt="Microed CodeAI" width="64" height="64" /></div>
        <p class="about-desc" data-i18n="aboutDescription">${t("aboutDescription")}</p>
        <div class="about-info">
          <span class="about-label" data-i18n="aboutVersion">${t("aboutVersion")}</span>: <strong id="about-versao">—</strong>
        </div>
        <div class="about-info">
          <span class="about-label" data-i18n="aboutPublisher">${t("aboutPublisher")}</span>: <strong>Microed Sistemas</strong>
        </div>
        <div class="about-links">
          <span class="about-label" data-i18n="aboutLinks">${t("aboutLinks")}</span>:
          <a href="#" data-url="https://microed.com.br/microedcodeai">microed.com.br/microedcodeai</a>
          <a href="#" data-url="https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai">VS Code Marketplace</a>
        </div>
      </div>
    </div>

    <div id="mensagens" class="mensagens">
      <div class="boas-vindas">
        <h3 data-i18n="chatWelcomeTitle">${t("chatWelcomeTitle")}</h3>
        <p data-i18n="chatWelcomeText1">${t("chatWelcomeText1")}</p>
        <p data-i18n="chatWelcomeText2">${t("chatWelcomeText2")}</p>
      </div>
    </div>

    <div class="barra-status">
      <span id="status-modelo" class="status-modelo"></span>
      <div class="barra-status-direita">
        <button id="btn-historico" class="btn-status" title="${t("historyToggleTooltip")}" data-i18n-title="historyToggleTooltip">📋</button>
        <button id="btn-about" class="btn-status" title="Sobre / About">ℹ</button>
        <label class="toggle-agente" title="${t("chatAgentTooltip")}" data-i18n-title="chatAgentTooltip">
          <input id="chk-agente" type="checkbox" />
          <span data-i18n="chatAgentToggle">${t("chatAgentToggle")}</span>
        </label>
      </div>
    </div>

    <div class="area-entrada">
      <textarea id="entrada" rows="1" placeholder="${t("chatPlaceholder")}" data-i18n-placeholder="chatPlaceholder"></textarea>
      <button id="btn-enviar" class="primario" title="${t("chatSend")}" data-i18n-title="chatSend" data-i18n="chatSend">${t("chatSend")}</button>
      <button id="btn-parar" class="secundario oculto" title="${t("chatStop")}" data-i18n-title="chatStop" data-i18n="chatStop">${t("chatStop")}</button>
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

// Lógica da interface do webview do microedcode.ai (executa no contexto do webview).
(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // Modelos são fornecidos pelo backend (src/modelos.ts) e chegam via msg.config.
  var modelosAtuais = {};

  const BASE_PADRAO = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com",
    deepseek: "https://api.deepseek.com",
    ollama: "http://localhost:11434",
    "openai-compativel": "",
  };

  // Página para criar/gerenciar a chave de API de cada provedor.
  const LINK_CHAVE = {
    openai: "https://platform.openai.com/api-keys",
    anthropic: "https://console.anthropic.com/settings/keys",
    deepseek: "https://platform.deepseek.com/api_keys",
    ollama: "",
    "openai-compativel": "",
  };

  // Elementos.
  const el = {
    painelConfig: document.getElementById("painel-config"),
    painelChat: document.getElementById("painel-chat"),
    mensagens: document.getElementById("mensagens"),
    entrada: document.getElementById("entrada"),
    btnEnviar: document.getElementById("btn-enviar"),
    btnParar: document.getElementById("btn-parar"),
    statusModelo: document.getElementById("status-modelo"),
    chkAgente: document.getElementById("chk-agente"),
    // config
    provider: document.getElementById("cfg-provider"),
    modeloSelect: document.getElementById("cfg-modelo-select"),
    baseUrl: document.getElementById("cfg-baseurl"),
    apiKey: document.getElementById("cfg-apikey"),
    statusChave: document.getElementById("cfg-status-chave"),
    linkChave: document.getElementById("cfg-link-chave"),
    temp: document.getElementById("cfg-temp"),
    tempValor: document.getElementById("cfg-temp-valor"),
    system: document.getElementById("cfg-system"),
    aplicarAuto: document.getElementById("cfg-aplicar-auto"),
    linkSobre: document.getElementById("cfg-link-sobre"),
    propaganda: document.getElementById("propaganda"),
    btnAtualizarModelos: document.getElementById("btn-atualizar-modelos"),
    btnSalvar: document.getElementById("btn-salvar"),
    btnCancelar: document.getElementById("btn-cancelar"),
    selIdioma: document.getElementById("sel-idioma"),
    // historico e about
    painelHistorico: document.getElementById("painel-historico"),
    painelAbout: document.getElementById("painel-about"),
    listaHistorico: document.getElementById("lista-historico"),
    btnFecharHistorico: document.getElementById("btn-fechar-historico"),
    btnFecharAbout: document.getElementById("btn-fechar-about"),
    btnApagarHistorico: document.getElementById("btn-apagar-historico"),
    aboutVersao: document.getElementById("about-versao"),
    btnHistorico: document.getElementById("btn-historico"),
    btnAbout: document.getElementById("btn-about"),
  };

  let configAtual = {};
  let i18n = {};
  let gerando = false;

  // Traduz uma chave (substitui %s pelos argumentos extras).
  function _t(chave, a1, a2) {
    var t = i18n[chave] || chave;
    if (typeof a1 !== "undefined") { t = t.replace("%s", a1); }
    if (typeof a2 !== "undefined") { t = t.replace("%s", a2); }
    return t;
  }

  /** Aplica o i18n a todos os elementos com data-i18n, data-i18n-title e data-i18n-placeholder. */
  function aplicarI18n() {
    // data-i18n (textContent para texto puro, innerHTML para html)
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var chave = el.getAttribute("data-i18n");
      var texto = i18n[chave] || chave;
      // Se o texto original contém HTML, usa innerHTML; senão textContent
      if (/<[a-z][\s\S]*>/i.test(texto)) {
        el.innerHTML = texto;
      } else {
        el.textContent = texto;
      }
    });
    // data-i18n-title
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var chave = el.getAttribute("data-i18n-title");
      el.title = i18n[chave] || chave;
    });
    // data-i18n-placeholder
    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var chave = el.getAttribute("data-i18n-placeholder");
      el.placeholder = i18n[chave] || chave;
    });
  }
  let bolhaAtual = null; // elemento .conteudo da resposta em andamento
  let textoAtual = ""; // texto bruto acumulado da resposta

  // ----------------------- Utilidades ----------------------- //

  function escaparHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderInline(s) {
    s = escaparHtml(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\n/g, "<br>");
    return s;
  }

  function renderMarkdown(texto) {
    const partes = texto.split("```");
    let html = "";
    for (let i = 0; i < partes.length; i++) {
      if (i % 2 === 1) {
        let bloco = partes[i];
        const quebra = bloco.indexOf("\n");
        if (quebra >= 0) {
          bloco = bloco.slice(quebra + 1);
        }
        html += "<pre><code>" + escaparHtml(bloco) + "</code></pre>";
      } else {
        html += renderInline(partes[i]);
      }
    }
    return html;
  }

  function adicionarBotoesCopia(container) {
    const pres = container.querySelectorAll("pre");
    pres.forEach(function (pre) {
      if (pre.querySelector(".btn-copiar")) {
        return;
      }
      const btn = document.createElement("button");
      btn.className = "btn-copiar";
      btn.textContent = _t("wvCopiar");
      btn.addEventListener("click", function () {
        const codigo = pre.querySelector("code");
        const texto = codigo ? codigo.innerText : pre.innerText;
        navigator.clipboard.writeText(texto).then(function () {
          btn.textContent = _t("wvCopiado");
          setTimeout(function () {
            btn.textContent = _t("wvCopiar");
          }, 1500);
        });
      });
      pre.appendChild(btn);
    });
  }

  function rolarParaBaixo() {
    el.mensagens.scrollTop = el.mensagens.scrollHeight;
  }

  function limparBoasVindas() {
    const bv = el.mensagens.querySelector(".boas-vindas");
    if (bv) {
      bv.remove();
    }
  }

  function criarBolha(papel, classe) {
    limparBoasVindas();
    const bolha = document.createElement("div");
    bolha.className = "bolha " + classe;
    const cab = document.createElement("div");
    cab.className = "papel";
    cab.textContent = papel;
    const conteudo = document.createElement("div");
    conteudo.className = "conteudo";
    bolha.appendChild(cab);
    bolha.appendChild(conteudo);
    el.mensagens.appendChild(bolha);
    rolarParaBaixo();
    return conteudo;
  }

  // Exibe uma linha informando uma ação do agente (ex.: "Lendo arquivo...").
  function mostrarAcao(texto) {
    limparBoasVindas();
    const linha = document.createElement("div");
    linha.className = "acao-agente";
    linha.textContent = "\u2699 " + texto;
    el.mensagens.appendChild(linha);
    rolarParaBaixo();
  }

  // Exibe um cartão de proposta de criação/atualização de arquivo.
  // Se msg.aplicada for true, a alteração já foi feita no arquivo (modo automático).
  function mostrarProposta(msg) {
    limparBoasVindas();
    const card = document.createElement("div");
    card.className = "proposta";
    card.dataset.id = msg.id;

    const titulo = document.createElement("div");
    titulo.className = "proposta-titulo";
    var verbo = msg.aplicada
      ? msg.novo
        ? _t("proposalFileCreated")
        : _t("proposalFileUpdated")
      : msg.novo
      ? _t("proposalCreateFile")
      : _t("proposalUpdateFile");
    titulo.textContent = verbo + msg.caminho;
    card.appendChild(titulo);

    if (msg.descricao) {
      const desc = document.createElement("div");
      desc.className = "proposta-desc";
      desc.innerHTML = renderInline(msg.descricao);
      card.appendChild(desc);
    }

    const acoes = document.createElement("div");
    acoes.className = "proposta-acoes";

    if (!msg.aplicada) {
      const btnAplicar = document.createElement("button");
      btnAplicar.className = "primario";
      btnAplicar.textContent = _t("proposalApply");
      btnAplicar.addEventListener("click", function () {
        vscode.postMessage({ tipo: "aplicarProposta", id: msg.id });
      });
      acoes.appendChild(btnAplicar);
    }

    const btnDiff = document.createElement("button");
    btnDiff.className = "secundario";
    btnDiff.textContent = _t("proposalDiff");
    btnDiff.addEventListener("click", function () {
      vscode.postMessage({ tipo: "verDiff", id: msg.id });
    });
    acoes.appendChild(btnDiff);

    if (!msg.aplicada) {
      const btnRejeitar = document.createElement("button");
      btnRejeitar.className = "secundario";
      btnRejeitar.textContent = _t("proposalReject");
      btnRejeitar.addEventListener("click", function () {
        vscode.postMessage({ tipo: "rejeitarProposta", id: msg.id });
        acoes.remove();
        const st = document.createElement("div");
        st.className = "proposta-status";
        st.textContent = _t("proposalReject");
        card.appendChild(st);
      });
      acoes.appendChild(btnRejeitar);
    }

    card.appendChild(acoes);

    if (msg.aplicada) {
      card.classList.add("proposta-aplicada");
      const st = document.createElement("div");
      st.className = "proposta-status";
      st.textContent = _t("proposalApplied");
      card.appendChild(st);
    }

    el.mensagens.appendChild(card);
    rolarParaBaixo();
  }

  function marcarPropostaAplicada(id) {
    const card = el.mensagens.querySelector('.proposta[data-id="' + id + '"]');
    if (!card) {
      return;
    }
    const acoes = card.querySelector(".proposta-acoes");
    if (acoes) {
      acoes.remove();
    }
    card.classList.add("proposta-aplicada");
    const st = document.createElement("div");
    st.className = "proposta-status";
    st.textContent = "Alteração aplicada ao arquivo.";
    card.appendChild(st);
  }

  // ----------------------- Envio ----------------------- //

  function enviar() {
    if (gerando) {
      return;
    }
    esconderPaineis();
    const texto = el.entrada.value.trim();
    if (texto.length === 0) {
      return;
    }
    const alvo = criarBolha(_t("wvYou"), "usuario");
    alvo.innerHTML = renderInline(texto);
    el.entrada.value = "";
    ajustarAltura();
    vscode.postMessage({ tipo: "enviar", texto: texto });
  }

  function definirGerando(estado) {
    gerando = estado;
    el.btnEnviar.classList.toggle("oculto", estado);
    el.btnParar.classList.toggle("oculto", !estado);
    el.entrada.disabled = estado;
  }

  // ----------------------- Histórico ----------------------- //

  function abrirHistorico() {
    esconderPaineis();
    if (el.painelHistorico) el.painelHistorico.classList.remove("oculto");
    if (el.mensagens) el.mensagens.classList.add("oculto");
    var bv = el.mensagens.querySelector(".boas-vindas");
    if (bv) bv.remove();
  }

  function fecharHistorico() {
    if (el.painelHistorico) el.painelHistorico.classList.add("oculto");
    if (el.mensagens) el.mensagens.classList.remove("oculto");
  }

  function renderHistorico(conversas) {
    if (!el.listaHistorico) return;
    el.listaHistorico.innerHTML = "";
    if (!conversas || conversas.length === 0) {
      var vazia = document.createElement("div");
      vazia.className = "item-historico";
      vazia.style.fontStyle = "italic";
      vazia.textContent = _t("historyEmptyList");
      el.listaHistorico.appendChild(vazia);
      return;
    }

    // Ordena da mais recente para mais antiga
    var ordenadas = conversas.slice().sort(function (a, b) {
      return new Date(b.data) - new Date(a.data);
    });

    for (var j = 0; j < ordenadas.length; j++) {
      var c = ordenadas[j];
      var item = document.createElement("div");
      item.className = "item-historico";
      item.dataset.id = c.id;

      var dataEl = document.createElement("div");
      dataEl.className = "item-historico-data";
      var d = new Date(c.data);
      dataEl.textContent = d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

      var titulo = document.createElement("div");
      titulo.className = "item-historico-resumo";
      titulo.textContent = c.titulo || c.resumo || "";

      item.appendChild(dataEl);
      item.appendChild(titulo);
      item.addEventListener("click", function () {
        vscode.postMessage({ tipo: "carregarConversaPorId", id: this.dataset.id });
      });
      el.listaHistorico.appendChild(item);
    }
  }

  // ----------------------- About ----------------------- //

  function abrirAbout(versao) {
    esconderPaineis();
    if (el.painelAbout) el.painelAbout.classList.remove("oculto");
    if (el.mensagens) el.mensagens.classList.add("oculto");
    if (el.aboutVersao) el.aboutVersao.textContent = versao || "?";
    var bv = el.mensagens.querySelector(".boas-vindas");
    if (bv) bv.remove();
  }

  function fecharAbout() {
    if (el.painelAbout) el.painelAbout.classList.add("oculto");
    if (el.mensagens) el.mensagens.classList.remove("oculto");
  }

  function esconderPaineis() {
    if (el.painelHistorico) el.painelHistorico.classList.add("oculto");
    if (el.painelAbout) el.painelAbout.classList.add("oculto");
  }

  function ajustarAltura() {
    el.entrada.style.height = "auto";
    el.entrada.style.height = Math.min(el.entrada.scrollHeight, 180) + "px";
  }

  // ----------------------- Configuração ----------------------- //

  function atualizarListaModelos(tipo, modeloAtual) {
    el.modeloSelect.innerHTML = "";
    const lista = (modelosAtuais[tipo] || []).slice();

    lista.forEach(function (m) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      el.modeloSelect.appendChild(opt);
    });

    // Pré-seleciona o modelo atual.
    if (modeloAtual && lista.indexOf(modeloAtual) !== -1) {
      el.modeloSelect.value = modeloAtual;
    } else {
      el.modeloSelect.selectedIndex = 0;
    }

    el.baseUrl.placeholder = BASE_PADRAO[tipo]
      ? _t("modelBaseUrlPlaceholder") + BASE_PADRAO[tipo]
      : _t("modelBaseUrlPlaceholderRequired");

    atualizarLinkChave(tipo);
  }

  // Mostra/oculta o link para criar a chave de API conforme o provedor.
  function atualizarLinkChave(tipo) {
    const url = LINK_CHAVE[tipo] || "";
    if (url) {
      el.linkChave.dataset.url = url;
      el.linkChave.classList.remove("oculto");
    } else {
      el.linkChave.dataset.url = "";
      el.linkChave.classList.add("oculto");
    }
  }

  // Retorna o modelo escolhido no select.
  function modeloSelecionado() {
    return el.modeloSelect.value;
  }

  function abrirConfig() {
    el.provider.value = configAtual.providerType || "openai";
    el.baseUrl.value = configAtual.baseUrl || "";
    el.apiKey.value = "";
    el.temp.value = configAtual.temperature != null ? configAtual.temperature : 0.7;
    el.tempValor.textContent = el.temp.value;
    el.system.value = configAtual.systemPrompt || "";
    el.aplicarAuto.checked = configAtual.aplicarAutomaticamente !== false;
    el.statusChave.textContent = configAtual.chaveDefinida
      ? _t("configApiKeyStatusSaved")
      : "";
    atualizarListaModelos(el.provider.value, configAtual.model || "");
    el.painelConfig.classList.remove("oculto");
  }

  function fecharConfig() {
    el.painelConfig.classList.add("oculto");
  }

  function salvarConfig() {
    const dados = {
      providerType: el.provider.value,
      model: modeloSelecionado(),
      baseUrl: el.baseUrl.value.trim(),
      apiKey: el.apiKey.value,
      temperature: parseFloat(el.temp.value),
      systemPrompt: el.system.value,
      aplicarAutomaticamente: el.aplicarAuto.checked,
    };
    vscode.postMessage({ tipo: "salvarConfig", dados: dados });
    fecharConfig();
  }

  function atualizarBarraStatus() {
    const tipo = configAtual.providerType || "openai";
    var nomes = {};
    nomes["openai"] = _t("providerOpenai");
    nomes["anthropic"] = _t("providerAnthropic");
    nomes["deepseek"] = _t("providerDeepseek");
    nomes["ollama"] = _t("providerOllama");
    nomes["openai-compativel"] = _t("providerCompativel");
    el.statusModelo.textContent =
      (nomes[tipo] || tipo) + " \u00b7 " + (configAtual.model || _t("errorNoModel"));
  }

  // ----------------------- Eventos ----------------------- //

  el.btnEnviar.addEventListener("click", enviar);
  el.btnParar.addEventListener("click", function () {
    vscode.postMessage({ tipo: "parar" });
  });

  el.entrada.addEventListener("input", ajustarAltura);
  el.entrada.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });

  el.provider.addEventListener("change", function () {
    atualizarListaModelos(el.provider.value, "");
  });
  el.linkChave.addEventListener("click", function (e) {
    e.preventDefault();
    const url = el.linkChave.dataset.url;
    if (url) {
      vscode.postMessage({ tipo: "abrirLink", url: url });
    }
  });
  el.linkSobre.addEventListener("click", function (e) {
    e.preventDefault();
    const url = el.linkSobre.dataset.url;
    if (url) {
      vscode.postMessage({ tipo: "abrirLink", url: url });
    }
  });
  if (el.propaganda) {
    el.propaganda.addEventListener("click", function (e) {
      e.preventDefault();
      const url = el.propaganda.dataset.url;
      if (url) {
        vscode.postMessage({ tipo: "abrirLink", url: url });
      }
    });
  }
  el.temp.addEventListener("input", function () {
    el.tempValor.textContent = el.temp.value;
  });
  el.btnSalvar.addEventListener("click", salvarConfig);
  el.btnCancelar.addEventListener("click", fecharConfig);
  if (el.btnAtualizarModelos) {
    el.btnAtualizarModelos.addEventListener("click", function () {
      vscode.postMessage({ tipo: "atualizarModelos" });
      // Efeito visual de giro
      el.btnAtualizarModelos.classList.add("girando");
      setTimeout(function () {
        el.btnAtualizarModelos.classList.remove("girando");
      }, 300);
    });
  }
  el.chkAgente.addEventListener("change", function () {
    vscode.postMessage({ tipo: "alternarModoAgente", valor: el.chkAgente.checked });
  });
  if (el.selIdioma) {
    el.selIdioma.addEventListener("change", function () {
      vscode.postMessage({ tipo: "alterarIdioma", idioma: el.selIdioma.value });
    });
  }

  // Histórico
  if (el.btnHistorico) {
    el.btnHistorico.addEventListener("click", function () {
      vscode.postMessage({ tipo: "carregarHistorico" });
    });
  }
  if (el.btnFecharHistorico) {
    el.btnFecharHistorico.addEventListener("click", fecharHistorico);
  }
  if (el.btnApagarHistorico) {
    el.btnApagarHistorico.addEventListener("click", function () {
      if (confirm(_t("historyDeleteConfirm"))) {
        vscode.postMessage({ tipo: "apagarHistorico" });
      }
    });
  }

  // About
  if (el.btnAbout) {
    el.btnAbout.addEventListener("click", function () {
      vscode.postMessage({ tipo: "carregarAbout" });
    });
  }
  if (el.btnFecharAbout) {
    el.btnFecharAbout.addEventListener("click", fecharAbout);
  }

  // Links no painel about
  document.addEventListener("click", function (e) {
    var link = e.target.closest("[data-url]");
    if (link) {
      e.preventDefault();
      vscode.postMessage({ tipo: "abrirLink", url: link.dataset.url });
    }
  });

  // ----------------------- Mensagens do backend ----------------------- //

  window.addEventListener("message", function (evento) {
    const msg = evento.data;
    switch (msg.tipo) {
      case "config":
        configAtual = msg.dados;
        i18n = msg.dados.i18n || {};
        modelosAtuais = msg.dados.modelos || {};
        el.chkAgente.checked = !!msg.dados.modoAgente;
        if (el.selIdioma && msg.dados.idioma) {
          el.selIdioma.value = msg.dados.idioma;
        }
        aplicarI18n();
        atualizarBarraStatus();
        break;

      case "acao":
        mostrarAcao(msg.texto || "");
        break;

      case "mensagemUsuario": {
        var alvoUsuario = criarBolha(_t("wvYou"), "usuario");
        alvoUsuario.innerHTML = renderInline(msg.texto || "");
        break;
      }

      case "proposta":
        mostrarProposta(msg);
        break;

      case "propostaAplicada":
        marcarPropostaAplicada(msg.id);
        break;

      case "abrirConfiguracoes":
        esconderPaineis();
        abrirConfig();
        break;

      case "limparTela":
        fecharHistorico();
        fecharAbout();
        el.mensagens.innerHTML =
          '<div class="boas-vindas"><h3>' + _t("chatWelcomeTitle") + '</h3><p>' + _t("chatWelcomeText1") + '</p><p>' + _t("chatWelcomeText2") + '</p></div>';
        break;

      case "inicioResposta":
        definirGerando(true);
        textoAtual = "";
        bolhaAtual = criarBolha(_t("appName"), "assistente");
        bolhaAtual.classList.add("cursor-digitando");
        break;

      case "pedaco":
        if (bolhaAtual) {
          textoAtual += msg.texto;
          bolhaAtual.innerHTML = renderMarkdown(textoAtual);
          rolarParaBaixo();
        }
        break;

      case "fimResposta":
        if (bolhaAtual) {
          bolhaAtual.classList.remove("cursor-digitando");
          if (msg.interrompido) {
            const aviso = document.createElement("div");
            aviso.className = "papel";
            aviso.textContent = _t("generationInterrupted");
            bolhaAtual.appendChild(aviso);
          }
          adicionarBotoesCopia(bolhaAtual);
        }
        bolhaAtual = null;
        definirGerando(false);
        el.entrada.focus();
        break;

      case "erro":
        definirGerando(false);
        bolhaAtual = null;
        var bolhaErro = criarBolha(_t("diagError"), "erro");
        bolhaErro.innerHTML = renderInline(msg.texto || _t("errorIaUnknown"));
        break;

      case "info":
        el.statusModelo.textContent = msg.texto;
        setTimeout(atualizarBarraStatus, 2500);
        break;

      case "modelosAtualizados":
        modelosAtuais = msg.modelos || {};
        atualizarListaModelos(el.provider.value, configAtual.model || "");
        break;

      case "idiomaAlterado":
        i18n = msg.i18n || {};
        if (el.selIdioma) el.selIdioma.value = msg.idioma || "pt";
        aplicarI18n();
        break;

      case "historicoCarregado":
        renderHistorico(msg.conversas);
        abrirHistorico();
        break;

      case "carregarConversa":
        // Carrega as mensagens de uma conversa no chat
        limparBoasVindas();
        el.mensagens.innerHTML = "";
        var msgs = msg.mensagens || [];
        for (var i = 0; i < msgs.length; i++) {
          var m = msgs[i];
          var bolha = document.createElement("div");
          bolha.className = "bolha " + (m.role === "user" ? "usuario" : "assistente");
          var cab = document.createElement("div");
          cab.className = "papel";
          cab.textContent = m.role === "user" ? _t("wvYou") : _t("appName");
          var conteudo = document.createElement("div");
          conteudo.className = "conteudo";
          conteudo.innerHTML = renderMarkdown(m.content);
          bolha.appendChild(cab);
          bolha.appendChild(conteudo);
          el.mensagens.appendChild(bolha);
        }
        fecharHistorico();
        fecharAbout();
        rolarParaBaixo();
        break;

      case "mostrarAbout":
        abrirAbout(msg.versao || "—");
        // Carrega a versão se já tiver no config
        if (configAtual && configAtual.versao) {
          if (el.aboutVersao) el.aboutVersao.textContent = configAtual.versao;
        }
        break;
    }
  });

  // Inicialização.
  ajustarAltura();
  vscode.postMessage({ tipo: "webviewPronto" });
})();

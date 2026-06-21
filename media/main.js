// Lógica da interface do webview do microedcode.ai (executa no contexto do webview).
(function () {
  "use strict";

  const vscode = acquireVsCodeApi();

  // Sugestões de modelos por provedor.
  const MODELOS = {
    openai: [
      "gpt-5.5",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.3",
      "gpt-5.2",
    ],
    anthropic: [
      "claude-fable-5",
      "claude-opus-4-7",
      "claude-opus-4-6",
      "claude-sonnet-4-6",
      "claude-haiku-4-5",
    ],
    deepseek: [
      "deepseek-v4-flash",
      "deepseek-v4-pro",
      "deepseek-chat",
      "deepseek-reasoner",
    ],
    ollama: [
      "llama3.3",
      "qwen3",
      "deepseek-r1",
      "gemma3",
      "mistral-small",
      "qwen2.5-coder",
      "phi4",
    ],
    "openai-compativel": [],
  };

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
    modelo: document.getElementById("cfg-modelo"),
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
    btnSalvar: document.getElementById("btn-salvar"),
    btnCancelar: document.getElementById("btn-cancelar"),
  };

  let configAtual = {};
  let gerando = false;
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
      btn.textContent = "Copiar";
      btn.addEventListener("click", function () {
        const codigo = pre.querySelector("code");
        const texto = codigo ? codigo.innerText : pre.innerText;
        navigator.clipboard.writeText(texto).then(function () {
          btn.textContent = "Copiado!";
          setTimeout(function () {
            btn.textContent = "Copiar";
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
        ? "Arquivo criado: "
        : "Arquivo atualizado: "
      : msg.novo
      ? "Criar arquivo: "
      : "Atualizar arquivo: ";
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
      btnAplicar.textContent = "Aplicar";
      btnAplicar.addEventListener("click", function () {
        vscode.postMessage({ tipo: "aplicarProposta", id: msg.id });
      });
      acoes.appendChild(btnAplicar);
    }

    const btnDiff = document.createElement("button");
    btnDiff.className = "secundario";
    btnDiff.textContent = "Ver diff";
    btnDiff.addEventListener("click", function () {
      vscode.postMessage({ tipo: "verDiff", id: msg.id });
    });
    acoes.appendChild(btnDiff);

    if (!msg.aplicada) {
      const btnRejeitar = document.createElement("button");
      btnRejeitar.className = "secundario";
      btnRejeitar.textContent = "Rejeitar";
      btnRejeitar.addEventListener("click", function () {
        vscode.postMessage({ tipo: "rejeitarProposta", id: msg.id });
        acoes.remove();
        const st = document.createElement("div");
        st.className = "proposta-status";
        st.textContent = "Rejeitada.";
        card.appendChild(st);
      });
      acoes.appendChild(btnRejeitar);
    }

    card.appendChild(acoes);

    if (msg.aplicada) {
      card.classList.add("proposta-aplicada");
      const st = document.createElement("div");
      st.className = "proposta-status";
      st.textContent = "Alteração aplicada ao arquivo.";
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
    const texto = el.entrada.value.trim();
    if (texto.length === 0) {
      return;
    }
    const alvo = criarBolha("Você", "usuario");
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

  function ajustarAltura() {
    el.entrada.style.height = "auto";
    el.entrada.style.height = Math.min(el.entrada.scrollHeight, 180) + "px";
  }

  // ----------------------- Configuração ----------------------- //

  // Valor especial usado quando o usuário quer digitar o nome do modelo manualmente.
  const MODELO_OUTRO = "__outro__";

  function sincronizarInputModelo() {
    const manual = el.modeloSelect.value === MODELO_OUTRO;
    el.modelo.classList.toggle("oculto", !manual);
    if (manual) {
      el.modelo.focus();
    }
  }

  function atualizarListaModelos(tipo, modeloAtual) {
    el.modeloSelect.innerHTML = "";
    const lista = MODELOS[tipo] || [];

    lista.forEach(function (m) {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      el.modeloSelect.appendChild(opt);
    });

    const optOutro = document.createElement("option");
    optOutro.value = MODELO_OUTRO;
    optOutro.textContent = "Outro (digitar manualmente)";
    el.modeloSelect.appendChild(optOutro);

    // Pré-seleciona o modelo atual. Se não estiver na lista, usa o modo manual.
    if (modeloAtual && lista.indexOf(modeloAtual) === -1) {
      el.modeloSelect.value = MODELO_OUTRO;
      el.modelo.value = modeloAtual;
    } else if (modeloAtual) {
      el.modeloSelect.value = modeloAtual;
      el.modelo.value = "";
    } else {
      el.modeloSelect.selectedIndex = 0;
      el.modelo.value = "";
    }
    sincronizarInputModelo();

    el.baseUrl.placeholder = BASE_PADRAO[tipo]
      ? "padrão: " + BASE_PADRAO[tipo]
      : "informe a URL base (obrigatório)";

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

  // Retorna o modelo escolhido: o do select, ou o digitado no modo manual.
  function modeloSelecionado() {
    if (el.modeloSelect.value === MODELO_OUTRO) {
      return el.modelo.value.trim();
    }
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
      ? "Já existe uma chave salva para este provedor (deixe em branco para mantê-la)."
      : "Nenhuma chave salva para este provedor.";
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
    const nomes = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      deepseek: "DeepSeek",
      ollama: "Ollama",
      "openai-compativel": "Compatível",
    };
    el.statusModelo.textContent =
      (nomes[tipo] || tipo) + " · " + (configAtual.model || "(sem modelo)");
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
    // Ao trocar o provedor, lista os modelos dele e seleciona o primeiro.
    atualizarListaModelos(el.provider.value, "");
  });
  el.modeloSelect.addEventListener("change", sincronizarInputModelo);
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
  el.chkAgente.addEventListener("change", function () {
    vscode.postMessage({ tipo: "alternarModoAgente", valor: el.chkAgente.checked });
  });

  // ----------------------- Mensagens do backend ----------------------- //

  window.addEventListener("message", function (evento) {
    const msg = evento.data;
    switch (msg.tipo) {
      case "config":
        configAtual = msg.dados;
        el.chkAgente.checked = !!msg.dados.modoAgente;
        atualizarBarraStatus();
        break;

      case "acao":
        mostrarAcao(msg.texto || "");
        break;

      case "mensagemUsuario": {
        var alvoUsuario = criarBolha("Você", "usuario");
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
        abrirConfig();
        break;

      case "limparTela":
        el.mensagens.innerHTML =
          '<div class="boas-vindas"><h3>Nova conversa</h3><p>Histórico limpo. Pode começar uma nova conversa.</p></div>';
        break;

      case "inicioResposta":
        definirGerando(true);
        textoAtual = "";
        bolhaAtual = criarBolha("microedcode.ai", "assistente");
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
            aviso.textContent = "(geração interrompida)";
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
        var bolhaErro = criarBolha("Erro", "erro");
        bolhaErro.innerHTML = renderInline(msg.texto || "Erro desconhecido.");
        break;

      case "info":
        el.statusModelo.textContent = msg.texto;
        setTimeout(atualizarBarraStatus, 2500);
        break;
    }
  });

  // Inicialização.
  ajustarAltura();
  vscode.postMessage({ tipo: "webviewPronto" });
})();

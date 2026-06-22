<div align="center">

<img src="logof.png" alt="Microed CodeAI" width="96" />

# Microed CodeAI

**A inteligência artificial que programa com você, dentro do seu editor.**

[![Versão no Marketplace](https://img.shields.io/visual-studio-marketplace/v/microedsistemas.microedcode-ai?style=flat-square&label=Marketplace&color=5b8cff)](https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai)
[![Instalações](https://img.shields.io/visual-studio-marketplace/i/microedsistemas.microedcode-ai?style=flat-square&label=Instala%C3%A7%C3%B5es&color=7c5cff)](https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/microedsistemas.microedcode-ai?style=flat-square&label=Downloads&color=34d399)](https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai)
[![Avaliação](https://img.shields.io/visual-studio-marketplace/r/microedsistemas.microedcode-ai?style=flat-square&label=Avalia%C3%A7%C3%A3o)](https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai&ssr=false#review-details)

Chat com IA integrado ao Visual Studio Code, com painel lateral e **Modo Agente** que lê, analisa e escreve código por você — com suporte a **OpenAI**, **Anthropic/Claude**, **DeepSeek**, **Ollama** e qualquer API **compatível com OpenAI**, totalmente em **português do Brasil**.

`VS Code 1.85+` · `Grátis` · `Leve (~256 KB)` · `Suas chaves ficam seguras no seu computador`

</div>

---

O **Microed CodeAI** traz um copiloto de IA direto para o painel lateral do VS Code. Converse, peça análises e deixe o **Modo Agente** ler, entender e escrever código por você — escolhendo o provedor e o modelo que preferir, sem sair do editor.

## Sumário

- [Recursos](#-recursos)
- [Modo Agente](#-modo-agente)
- [Provedores compatíveis](#-provedores-compatíveis)
- [Privacidade e segurança](#-privacidade-e-segurança)
- [Instalação](#-instalação)
- [Como usar](#-como-usar)
- [Configurações](#-configurações)
- [Geração de testes unitários](#-geração-de-testes-unitários)
- [Perguntas frequentes](#-perguntas-frequentes)
- [Sobre](#sobre)

## ✨ Recursos

| | Recurso | Descrição |
|---|---|---|
| 💬 | **Chat no painel lateral** | Converse com a IA enquanto programa, com respostas em tempo real (streaming), renderização de markdown e botão para copiar blocos de código. |
| 🤖 | **Modo Agente** | A IA lê arquivos, busca no código, consulta erros do editor e propõe a criação ou atualização de arquivos inteiros. |
| ✅ | **Você no controle** | Cada alteração pode virar uma proposta: revise com “Ver diff” e confirme com “Aplicar”. Nada muda sem a sua aprovação. |
| 🧪 | **Testes em um clique** | Selecione um trecho ou arquivo e gere (ou atualize) testes unitários cobrindo casos de sucesso, de borda e de erro. |
| 🔌 | **Sua IA, sua escolha** | OpenAI, Anthropic/Claude, DeepSeek, Ollama (local) ou qualquer API compatível com OpenAI. Troque de modelo quando quiser. |
| 🔒 | **Privacidade em primeiro lugar** | As chaves de API ficam guardadas com segurança no SecretStorage do VS Code, no seu próprio computador. |

## 🤖 Modo Agente

Com o **Modo Agente** ativado (interruptor na barra inferior do painel), o Microed CodeAI trabalha em passos: investiga a base de código, junta o contexto necessário e raciocina até propor a melhor solução — como um par de programação que nunca dorme.

- **Analisa a lógica do projeto** — lista e lê arquivos, busca trechos no código
- **Diagnostica bugs** — consulta erros e avisos do editor
- **Cria e atualiza código** — propõe o conteúdo completo de arquivos novos ou existentes
- **Usa o contexto do editor** — considera automaticamente o arquivo ativo e o trecho selecionado

A IA trabalha em passos: pede para ler arquivos, recebe o conteúdo e continua o raciocínio até propor a solução. As alterações aparecem como cartões com **Aplicar**, **Ver diff** e **Rejeitar**.

> **Você decide o nível de automação.** Por padrão, as alterações são aplicadas automaticamente. Desative *"Aplicar alterações automaticamente"* nas configurações para revisar e aprovar cada mudança antes que ela toque nos seus arquivos.

## 🔌 Provedores compatíveis

Escolha o provedor e o modelo no painel de configuração, ou digite o nome do modelo manualmente.

- 🟢 **OpenAI**
- 🟣 **Anthropic / Claude**
- 🔵 **DeepSeek**
- 🦙 **Ollama** (local)
- ⚙️ **Compatível com OpenAI** — LM Studio, Groq, OpenRouter e outros serviços que seguem o formato da OpenAI

Com o **Ollama**, rode modelos 100% localmente — sem precisar de chave de API e, se quiser, totalmente offline.

## 🔒 Privacidade e segurança

- As chaves de API são guardadas no **SecretStorage do VS Code**, armazenado de forma segura no seu próprio computador — nunca em arquivos do projeto.
- Nada é enviado a servidores além do provedor de IA que **você** configurar.
- No modo de aprovação manual, **nenhum arquivo é alterado sem a sua confirmação**.

## 🚀 Instalação

**Pela página do Marketplace:** acesse [**Microed CodeAI no VS Code Marketplace**](https://marketplace.visualstudio.com/items?itemName=microedsistemas.microedcode-ai) e clique em **Install**.

**Pelo VS Code:** abra a aba **Extensões** (`Ctrl+Shift+X`), pesquise por **Microed CodeAI** e clique em **Instalar**.

**Pelo terminal:**

```bash
code --install-extension microedsistemas.microedcode-ai
```

## ▶️ Como usar

1. Clique no ícone do **Microed CodeAI** na barra lateral de atividades.
2. Clique na engrenagem para configurar o provedor, o modelo e a chave de API.
3. Comece a conversar.

Para o Ollama, basta ter o servidor local em execução (`http://localhost:11434`); não é necessária chave de API.

## ⚙️ Configurações

Disponíveis em `Configurações → Extensões → Microed CodeAI` (ou direto no painel da extensão):

| Configuração | Padrão | Descrição |
|---|---|---|
| `microedcodeai.providerType` | `openai` | Provedor de IA usado por padrão (OpenAI, Anthropic, DeepSeek, Ollama ou compatível com OpenAI). |
| `microedcodeai.model` | `gpt-5.4-mini` | Nome do modelo a ser utilizado (ex.: `gpt-5.4-mini`, `claude-sonnet-4-6`, `deepseek-v4-flash`, `llama3.3`). |
| `microedcodeai.baseUrl` | *(vazio)* | URL base da API. Em branco usa o padrão do provedor selecionado. |
| `microedcodeai.systemPrompt` | *(padrão PT-BR)* | Instrução de sistema enviada ao modelo no início de cada conversa. |
| `microedcodeai.temperature` | `0.7` | Temperatura de amostragem (criatividade) do modelo, de `0` a `2`. |
| `microedcodeai.modoAgente` | `true` | Permite que a IA leia arquivos, analise a lógica e proponha a criação/atualização de código. |
| `microedcodeai.aplicarAutomaticamente` | `true` | Aplica as alterações imediatamente. Desative para revisar e aprovar cada mudança antes de aplicar. |

## 🧪 Geração de testes unitários

Clique com o botão direito em um arquivo (ou em um trecho selecionado) e escolha **"Criar ou atualizar teste unitário"**. O Microed CodeAI detecta o framework de testes do projeto, cria ou atualiza o arquivo de teste seguindo a convenção do projeto e cobre casos de sucesso, de borda e de erro.

## ❓ Perguntas frequentes

**O Microed CodeAI é gratuito?**
Sim. A extensão é gratuita. Você só precisa de uma chave de API do provedor de IA que escolher (ou usar o Ollama, que roda localmente sem chave).

**Minhas chaves de API ficam seguras?**
Sim. As chaves são guardadas no SecretStorage do VS Code, armazenado de forma segura no seu próprio computador — nunca em arquivos do projeto.

**A IA altera meus arquivos sem permissão?**
Você decide. No modo de aprovação manual, cada mudança vira uma proposta com os botões “Aplicar”, “Ver diff” e “Rejeitar”. Nada é alterado sem a sua confirmação.

**Quais modelos de IA são suportados?**
OpenAI, Anthropic/Claude, DeepSeek, Ollama (local) e qualquer API compatível com OpenAI, como LM Studio, Groq e OpenRouter.

**Preciso de internet?**
Para provedores em nuvem, sim. Com o Ollama você roda modelos localmente e pode trabalhar de forma totalmente offline.

## Sobre

Extensão criada por **Microed Sistemas**.
🔗 [microed.com.br/microedcodeai](https://microed.com.br/microedcodeai)

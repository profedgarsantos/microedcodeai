# microedcode.ai

Chat com IA integrado ao VS Code, com painel lateral e suporte a LLMs customizados
(**OpenAI**, **Anthropic/Claude**, **DeepSeek**, **Ollama** e qualquer API **compatível com OpenAI**),
totalmente em português do Brasil.

## Recursos

- Painel lateral dedicado para conversar com a IA
- **Modo Agente**: a IA analisa a lógica do projeto, lê arquivos, busca no código, consulta diagnósticos (bugs) e propõe a criação/atualização de arquivos
- Toda alteração de código é uma **proposta**: revise com "Ver diff" e confirme com "Aplicar" (nada é alterado sem sua aprovação)
- Escolha do provedor e do modelo, ou digite o nome do modelo manualmente
- Configuração de provedor, modelo, URL base, chave de API, temperatura e instrução de sistema
- Respostas em streaming, renderização de markdown e botão para copiar blocos de código
- Chaves de API guardadas com segurança no SecretStorage do VS Code

## Modo Agente

Com o **Modo Agente** ativado (interruptor na barra inferior do painel), a IA pode:

- **Analisar a lógica do projeto** — listar e ler arquivos, buscar trechos no código
- **Diagnosticar bugs** — consultar erros e avisos do editor
- **Criar e atualizar código** — propor o conteúdo completo de arquivos novos ou existentes
- **Usar o contexto do editor** — considera automaticamente o arquivo ativo e o trecho selecionado

A IA trabalha em passos: pede para ler arquivos, recebe o conteúdo e continua o raciocínio até propor a solução. As alterações aparecem como cartões com **Aplicar**, **Ver diff** e **Rejeitar**.

## Instalação

### Opção 1 — Script automático (Windows / PowerShell)

```powershell
./instalar.ps1
```

O script instala as dependências, compila, gera o pacote `microedcodeai.vsix` e o instala no VS Code.

### Opção 2 — Manual

```bash
npm install
npm run install-ext
```

### Opção 3 — Instalar um .vsix existente

Pela interface do VS Code: `Extensões` → menu `...` → **Instalar a partir do VSIX...** e selecione `microedcodeai.vsix`.

Ou pelo terminal:

```bash
code --install-extension microedcodeai.vsix --force
```

## Uso

1. Clique no ícone do **microedcode.ai** na barra lateral de atividades
2. Clique na engrenagem para configurar o provedor, o modelo e a chave de API
3. Comece a conversar

Para o Ollama, basta ter o servidor local em execução (`http://localhost:11434`); não é necessária chave de API.

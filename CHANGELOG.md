# Changelog

Todas as mudanças relevantes do **microedcode.ai** serão documentadas neste arquivo.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
e o projeto adota o [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.1.0] - 2026-06-21

### Adicionado
- Painel lateral de chat com IA integrado ao VS Code, com respostas em streaming, renderização de markdown e botão para copiar blocos de código.
- **Modo Agente**: a IA lê arquivos, busca no código, consulta diagnósticos (bugs) e propõe a criação/atualização de arquivos.
- Propostas de alteração com **Aplicar**, **Ver diff** e **Rejeitar**, além da opção de aplicar automaticamente.
- Geração e atualização de testes unitários pelo menu de contexto do editor.
- Suporte a múltiplos provedores: OpenAI, Anthropic/Claude, DeepSeek, Ollama (local) e qualquer API compatível com OpenAI.
- Armazenamento seguro das chaves de API no SecretStorage do VS Code.
- Histórico de conversas por projeto.
- Interface totalmente em português do Brasil.

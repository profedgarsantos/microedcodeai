import * as vscode from "vscode";
import { ChatViewProvider } from "./chatViewProvider";
import { ProviderType } from "./providers";
import { uriHistorico } from "./agente";

const TIPOS_PROVEDOR: ProviderType[] = [
  "openai",
  "anthropic",
  "deepseek",
  "ollama",
  "openai-compativel",
];

export function activate(contexto: vscode.ExtensionContext): void {
  const provider = new ChatViewProvider(contexto, contexto.extensionUri);

  contexto.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  contexto.subscriptions.push(
    vscode.commands.registerCommand("microedcodeai.newChat", () => {
      provider.novaConversa();
    }),
    vscode.commands.registerCommand("microedcodeai.openSettings", () => {
      provider.abrirConfiguracoes();
    }),
    vscode.commands.registerCommand("microedcodeai.clearKeys", async () => {
      for (const tipo of TIPOS_PROVEDOR) {
        await contexto.secrets.delete(`microedcodeai.apiKey.${tipo}`);
      }
      vscode.window.showInformationMessage(
        "microedcode.ai: chaves de API salvas foram removidas."
      );
    }),
    vscode.commands.registerCommand("microedcodeai.about", async () => {
      const opcao = await vscode.window.showInformationMessage(
        "microedcode.ai — extensão criada por Microed Sistemas.",
        "Visitar site (microed.com.br/microedcodeai)"
      );
      if (opcao) {
        vscode.env.openExternal(
          vscode.Uri.parse("https://microed.com.br/microedcodeai")
        );
      }
    }),
    vscode.commands.registerCommand("microedcodeai.gerarTesteUnitario", () => {
      provider.gerarTesteUnitario();
    }),
    vscode.commands.registerCommand("microedcodeai.historico", async () => {
      const uri = uriHistorico();
      if (!uri) {
        vscode.window.showWarningMessage(
          "microedcode.ai: abra uma pasta de projeto para ver o histórico."
        );
        return;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(doc, { preview: false });
      } catch {
        vscode.window.showInformationMessage(
          "microedcode.ai: ainda não há histórico salvo neste projeto."
        );
      }
    })
  );
}

export function deactivate(): void {
  // Nada a limpar.
}

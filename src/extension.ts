import * as vscode from "vscode";
import { ChatViewProvider } from "./chatViewProvider";
import { ProviderType } from "./providers";
import { t, inicializarIdioma } from "./i18n";

const TIPOS_PROVEDOR: ProviderType[] = [
  "openai",
  "anthropic",
  "deepseek",
  "ollama",
  "openai-compativel",
];

export function activate(contexto: vscode.ExtensionContext): void {
  inicializarIdioma(contexto);
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
      vscode.window.showInformationMessage(t("keysCleared"));
    }),
    vscode.commands.registerCommand("microedcodeai.about", () => {
      provider.mostrarAbout();
    }),
    vscode.commands.registerCommand("microedcodeai.gerarTesteUnitario", () => {
      provider.gerarTesteUnitario();
    }),
    vscode.commands.registerCommand("microedcodeai.historico", () => {
      provider.mostrarHistorico();
    })
  );
}

export function deactivate(): void {
  // Nada a limpar.
}

import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {

  vscode.window.showInformationMessage("Test");
  const disposable = vscode.commands.registerCommand(
    "bun-vscode-extension.helloworld",
    () => {
      vscode.window.showInformationMessage("Hello World!");
    }
  );

  context.subscriptions.push(disposable);
};

export const deactivate = () => { };

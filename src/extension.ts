import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  console.log("Extension MacroTex is now active!");
  // Get the configuration for your extension
  const config = vscode.workspace.getConfiguration('latexMacros');

  // Get the list of macros
  const macrosList: { signature: string, extensions: string[] }[] | undefined = config.get('macrosList');
  if (!macrosList || macrosList.length === 0) {
    vscode.window.showErrorMessage("No macros defined");
  } else console.log("Macros loaded", macrosList);

  const disposable = vscode.languages.registerCompletionItemProvider(
    "latex",
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        const line = document.lineAt(position).text;
        let completionItems: vscode.CompletionItem[] = [];

        if (macrosList) {
          const promises = macrosList.map(async (macro) => {
            // macro signatutre remove all between [ ]
            // \fg[asdasdasd]{PATH}{}{}

            const macroSettingsPart = macro.signature.split("PATH");
            let linePrefix = line.substring(0, position.character)
              .trim()
              .replace(/\[.*?\]/g, '[]')
              .replace(/\{.*?\}/g, '{}');
            console.log(`${linePrefix} === ${macroSettingsPart[0]} -> ${linePrefix === macroSettingsPart[0]}`);
            if (linePrefix === macroSettingsPart[0]) {
              for (const extension of macro.extensions) {
                const uris = await vscode.workspace.findFiles(`**/*.${extension}`);
                for (let uri of uris) {
                  const relativePath = vscode.workspace.asRelativePath(uri.fsPath);
                  completionItems.push(new vscode.CompletionItem(relativePath));
                }
              }
            }
          });
          await Promise.all(promises);
          return completionItems;
        }

        return completionItems;
      },
    });
  context.subscriptions.push(disposable);
};

export const deactivate = () => { };

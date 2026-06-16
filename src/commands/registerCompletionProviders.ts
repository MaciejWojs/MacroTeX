import * as vscode from "vscode";
import MacroSignatureHelpProvider from "../providers/MacroSignatureHelpProvider";
import { MacroNameCompletionProvider } from "../providers/MacroNavigationProviders";
import { MacroIndex } from "../utils/MacroIndex";
import { findClosestMainLaTeXFile, isImageFile } from "../utils/fileUtils";
import { getConfiguredMacros, getPreviewImageString, normalizeMacroLine, processMacroSignature } from "../utils/macroUtils";
import { getRelativePathToMain, replaceWindowsPath } from "../utils/pathUtils";

export function registerCompletionProviders(
  context: vscode.ExtensionContext,
  macroIndex: MacroIndex,
  channel: vscode.OutputChannel
): void {
  const macroNameCompletionDisposable = vscode.languages.registerCompletionItemProvider(
    { language: "latex" },
    new MacroNameCompletionProvider(macroIndex),
    "\\"
  );

  const signatureHelpDisposable = vscode.languages.registerSignatureHelpProvider(
    { language: "latex" },
    new MacroSignatureHelpProvider(),
    "{",
    "[",
    ","
  );

  const registerCompletionItemProvider = vscode.languages.registerCompletionItemProvider("latex", {
    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
      const mainLaTeXFile = await findClosestMainLaTeXFile();
      channel.appendLine(`Main LaTeX file: ${mainLaTeXFile}`);
      const config = vscode.workspace.getConfiguration("latexMacros");
      const macrosList = getConfiguredMacros();
      if (!config || !mainLaTeXFile || !macrosList) return [];

      let skipSnippets = false;
      const validMacros = macrosList.filter((macro) => macro.signature.includes("PATH"));
      if (validMacros.length === 0) return [];

      const line = document.lineAt(position).text;
      const linePrefix = normalizeMacroLine(line.substring(0, position.character));
      const completionItems: vscode.CompletionItem[] = [];
      const useFolders = config.get("pathSuggestionsFolderBased") || false;

      const promises = validMacros.map(async (macro) => {
        const macroFirstPart = normalizeMacroLine(macro.signature.split("PATH")[0]);
        if (!linePrefix.includes(macroFirstPart)) return;
        skipSnippets = true;

        let typedPath = linePrefix.replace(macroFirstPart, "");
        if (typedPath.endsWith("/")) typedPath = typedPath.slice(0, -1);

        const extensionsGlob = macro.extensions.map((ext: string) => ext.toLowerCase()).join(",");
        const searchPattern = !typedPath
          ? `**/*.{${extensionsGlob}}`
          : `**/${typedPath}/**/*.{${extensionsGlob}}`;
        channel.appendLine(`Searching for files with pattern: ${searchPattern}`);
        const uris = await vscode.workspace.findFiles(searchPattern);

        const completionItemsForMacro = uris.sort().map((uri) => {
          const fsPath = replaceWindowsPath(uri.fsPath);
          const relativePath = getRelativePathToMain(fsPath, mainLaTeXFile);
          let finalPath = typedPath === "" ? relativePath : relativePath.replace(`${typedPath}/`, "");
          if (useFolders === true) {
            finalPath = finalPath.replace(/\/.*$/, "/");
          }

          const kind = isImageFile(finalPath)
            ? vscode.CompletionItemKind.File
            : vscode.CompletionItemKind.Folder;
          const sortText = !finalPath.startsWith("../") ? "A" : "B";
          const completionItem = new vscode.CompletionItem(replaceWindowsPath(finalPath), kind);
          completionItem.sortText = sortText;

          if (kind === vscode.CompletionItemKind.File) {
            completionItem.documentation = getPreviewImageString(uri, macro.signature);
          }
          return completionItem;
        });

        if (completionItemsForMacro.length > 0) {
          const itemsToAdd = useFolders
            ? completionItemsForMacro.filter(
                (item, index, self) => index === self.findIndex((candidate) => candidate.label === item.label)
              )
            : completionItemsForMacro;
          completionItems.push(...itemsToAdd);
        }
      });

      await Promise.all(promises);
      if (skipSnippets) return completionItems;

      for (const macro of validMacros) {
        const completionItem = new vscode.CompletionItem(
          macro.signature,
          vscode.CompletionItemKind.Snippet
        );
        const parts = linePrefix.endsWith("\\") ? macro.signature.substring(1) : macro.signature;
        const processedSignature = processMacroSignature(parts);

        completionItem.insertText = new vscode.SnippetString(processedSignature);
        completionItem.documentation = new vscode.MarkdownString(
          `macro: ${macro.signature}\n\nPATH is the path to the file eg. rys/rys1.png`
        );
        completionItems.push(completionItem);
      }

      return completionItems;
    },
  });

  context.subscriptions.push(
    macroNameCompletionDisposable,
    signatureHelpDisposable,
    registerCompletionItemProvider
  );
}

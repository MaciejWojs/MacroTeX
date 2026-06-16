import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { TableGeneratorBarProvider } from "./TableGeneratorBarProvider";
import { MacroFinderProvider } from "./MacroFinderProvider";
import { csvAsTableCommand } from "./commands/csvToTable";
import { registerCompletionProviders } from "./commands/registerCompletionProviders";
import { registerFileEventHandlers } from "./commands/registerFileEventHandlers";
import { registerHoverProvider } from "./commands/registerHoverProvider";
import { registerMacroCommands } from "./commands/registerMacroCommands";
import { registerNavigationProviders } from "./commands/registerNavigationProviders";
import { findAllMainLaTeXFiles, findClosestMainLaTeXFile } from "./utils/fileUtils";
import { validateAndNormalizeLatexPaths } from "./utils/latexValidation";
import { getConfiguredMacros, processMacroSignature } from "./utils/macroUtils";
import type { MacroConfig } from "./utils/macroUtils";
import { MacroIndex } from "./utils/MacroIndex";
import { getRelativePathToMain, replaceWindowsPath } from "./utils/pathUtils";

export { findAllMainLaTeXFiles, findClosestMainLaTeXFile };

function registerWebviewProviders(context: vscode.ExtensionContext): void {
  const sidebarProvider = new TableGeneratorBarProvider(context.extensionUri);
  const macroFinderProvider = new MacroFinderProvider(context.extensionUri);
  const sidebarViewProvider = vscode.window.registerWebviewViewProvider(
    TableGeneratorBarProvider.viewType,
    sidebarProvider
  );
  const macroFinderDisposable = vscode.window.registerWebviewViewProvider(
    MacroFinderProvider.viewType,
    macroFinderProvider
  );
  const focusSidebarCommand = vscode.commands.registerCommand("marcotex.sidebarView.focus", () => {
    vscode.commands.executeCommand("workbench.view.extension.marcotex");
  });
  const showPanelCommand = vscode.commands.registerCommand("marcotex.showPanel", async () => {
    await vscode.commands.executeCommand("marcotex.sidebarView.focus");
  });
  const showMacroFinderCommand = vscode.commands.registerCommand("marcotex.showMacroFinder", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.marcotex");
    await vscode.commands.executeCommand("marcotex.macroFinder.focus");
  });

  context.subscriptions.push(
    sidebarViewProvider,
    macroFinderDisposable,
    focusSidebarCommand,
    showPanelCommand,
    showMacroFinderCommand
  );
}

function registerInsertToActiveDocumentCommand(
  context: vscode.ExtensionContext,
  channel: vscode.OutputChannel
): void {
  const insertToActiveDocumentCommand = vscode.commands.registerCommand(
    "marcotex.insertToActiveDocument",
    async (_contextSelection: vscode.Uri, uris: vscode.Uri[]) => {
      const mainLaTeXFile = await findClosestMainLaTeXFile();
      const config = vscode.workspace.getConfiguration("latexMacros");
      const macrosList = getConfiguredMacros();
      const editor = vscode.window.activeTextEditor;
      const options = macrosList.map((macro: MacroConfig) => macro.signature).filter((sig) => sig.includes("PATH"));

      if (!config || !editor || !options || !mainLaTeXFile) return;
      const insertClearPage = config.get("insertClearpageInBulk");
      const position = editor.selection.active;
      if (!position) return;

      let fileExtensionsToUse: string[] = [];
      if (uris.length === 1 && fs.statSync(uris[0].fsPath).isDirectory()) {
        const filesInDir = await vscode.workspace.findFiles(new vscode.RelativePattern(uris[0].fsPath, "**/*"));
        const extensions = [...new Set(filesInDir.map((uri) => path.extname(uri.fsPath).slice(1).toLowerCase()))];
        if (extensions.length === 1) {
          fileExtensionsToUse = extensions;
        }
      } else if (uris.length > 0 && fs.statSync(uris[0].fsPath).isFile()) {
        fileExtensionsToUse = [path.extname(uris[0].fsPath).slice(1).toLowerCase()];
      }

      const validMacros =
        fileExtensionsToUse.length > 0
          ? macrosList.filter((macro: MacroConfig) =>
              macro.extensions.some((ext: string) => fileExtensionsToUse.includes(ext))
            )
          : macrosList;
      const macroOptions = validMacros
        .map((macro: MacroConfig) => macro.signature)
        .filter((sig: string) => sig.includes("PATH"));

      if (macroOptions.length === 0) {
        vscode.window.showErrorMessage(
          "No valid macros found for the selected files. Please check the configuration."
        );
        return;
      }

      const selectedOption =
        macroOptions.length === 1
          ? macroOptions[0]
          : await vscode.window.showQuickPick(macroOptions, {
              placeHolder: "Select a macro to insert",
            });

      const fileExtensions = macrosList.find((macro: MacroConfig) => macro.signature === selectedOption)?.extensions;
      if (!fileExtensions) return;
      const uriArray = Array.isArray(uris) ? uris : [uris];

      const urisArray = await Promise.all(
        uriArray.map(async (uri) => {
          if (fs.statSync(uri.fsPath).isDirectory()) {
            const extensionsGlob = fileExtensions.join(",");
            const pattern = `**/*.{${extensionsGlob}}`;
            channel.appendLine(`Searching for files with pattern: ${pattern}`);
            const results = await vscode.workspace.findFiles(new vscode.RelativePattern(uri.fsPath, pattern));
            return results;
          }
          return [uri];
        })
      );

      const allUris = urisArray.flat();
      const foldersPaths = [...new Set(allUris.map((uri) => path.dirname(uri.fsPath)))];
      const sortedImages = await Promise.all(
        foldersPaths.map(async (folder) => {
          const folderUris = allUris.filter((uri) => path.dirname(uri.fsPath) === folder);
          const allNumeric = folderUris.every((uri) =>
            /^\d+$/.test(path.basename(uri.fsPath, path.extname(uri.fsPath)))
          );
          if (allNumeric && folderUris.length > 1) {
            folderUris.sort((a, b) => {
              const aNum = parseInt(path.basename(a.fsPath, path.extname(a.fsPath)));
              const bNum = parseInt(path.basename(b.fsPath, path.extname(b.fsPath)));
              return aNum - bNum;
            });
          }
          return folderUris;
        })
      );

      const flatSortedImages = sortedImages.flat();
      const extensionFilteredUris = flatSortedImages.filter((uri) =>
        fileExtensions.includes(path.extname(uri.fsPath).slice(1).toLowerCase())
      );

      if (extensionFilteredUris.length === 0) {
        const message = `Error runing macro: ${selectedOption}\nNo files selected or selected files are not of the correct type: ${fileExtensions.join(
          ", "
        )}`;
        vscode.window.showErrorMessage(message);
        return;
      }

      const validLatexUris = await validateAndNormalizeLatexPaths(extensionFilteredUris, mainLaTeXFile);
      if (!validLatexUris || validLatexUris.length === 0) return;

      if (selectedOption) {
        let finalMacros = "";
        let counter = 0;
        for (const uri of validLatexUris) {
          ++counter;
          const relativePathToMain = getRelativePathToMain(uri.fsPath, mainLaTeXFile);
          const folderBasename = replaceWindowsPath(path.basename(path.dirname(uri.fsPath)));
          const basename = replaceWindowsPath(path.basename(uri.fsPath).split(".")[0]);
          const caption = basename;
          const identifier = `${folderBasename}-${basename}`.replaceAll(" ", "-");

          const macro = "\n" + selectedOption
            .replace("PATH", relativePathToMain)
            .replace("Identifier", identifier)
            .replace("Caption", caption);

          channel.appendLine(`relativePathToMain: ${relativePathToMain}`);
          finalMacros += macro;
          if (insertClearPage && counter % 2 === 0) finalMacros += "\n\\clearpage\n";
        }

        if (!finalMacros) return;
        if (validLatexUris.length === 1) finalMacros = processMacroSignature(finalMacros);
        const snippet = new vscode.SnippetString(finalMacros);
        editor.insertSnippet(snippet, position);
        vscode.window.showInformationMessage(`Inserted ${counter} macros`);
      }
    }
  );

  context.subscriptions.push(insertToActiveDocumentCommand);
}

export const activate = async (context: vscode.ExtensionContext) => {
  const channel = vscode.window.createOutputChannel("MacroTex");
  channel.appendLine("MacroTex is now active!");

  const macroIndex = MacroIndex.getInstance();
  macroIndex.initialize(context, () => findClosestMainLaTeXFile());

  registerWebviewProviders(context);
  registerNavigationProviders(context, macroIndex);
  registerCompletionProviders(context, macroIndex, channel);
  registerMacroCommands(context, macroIndex);
  registerFileEventHandlers(context, macroIndex, channel, findAllMainLaTeXFiles);
  registerHoverProvider(context, macroIndex);
  registerInsertToActiveDocumentCommand(context, channel);

  const insertCsvAsTableCommand = vscode.commands.registerCommand("marcotex.insertCsvAsTable", csvAsTableCommand);
  context.subscriptions.push(insertCsvAsTableCommand);
};

export const deactivate = () => {};

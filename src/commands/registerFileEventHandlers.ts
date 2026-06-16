import * as path from "path";
import * as vscode from "vscode";
import { MacroIndex } from "../utils/MacroIndex";
import { findClosestMainLaTeXFile } from "../utils/fileUtils";
import { normalizeMacroLine } from "../utils/macroUtils";
import { getRelativePathToMain, replaceWindowsPath } from "../utils/pathUtils";

export function registerFileEventHandlers(
  context: vscode.ExtensionContext,
  macroIndex: MacroIndex,
  channel: vscode.OutputChannel,
  findAllMainLaTeXFiles: () => Promise<string[]>
): void {
  const onDidDeleteFiles = vscode.workspace.onDidDeleteFiles(async (event) => {
    macroIndex.markWorkspaceDirty();
    const mainLaTeXFiles = await findAllMainLaTeXFiles();
    if (mainLaTeXFiles.length === 0) return;

    const config = vscode.workspace.getConfiguration("latexMacros");
    const macrosList: { signature: string; extensions: string[] }[] | undefined = config.get("macrosList");
    if (!macrosList || macrosList.length === 0) return;

    const files = event.files.filter((uri) => !uri.fsPath.endsWith(".tex"));
    const scopes = new Set(
      (await Promise.all(files.map((uri) => findClosestMainLaTeXFile(uri.fsPath, mainLaTeXFiles)))).filter(
        (scope): scope is string => scope !== null
      )
    );
    const scopeBaseDirs = new Set([...scopes].map((scope) => replaceWindowsPath(path.dirname(scope))));

    for (const baseDir of scopeBaseDirs) {
      const mainFile = [...scopes].find((scope) => scope.startsWith(baseDir));
      const deletedFiles = files.filter((uri) => replaceWindowsPath(uri.fsPath).startsWith(baseDir));
      if (!mainFile || deletedFiles.length === 0) continue;

      const texFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(baseDir, "**/*.tex"));
      channel.appendLine(`Main file: ${mainFile}`);
      channel.appendLine(`Deleted files:\n ${deletedFiles.join("\n")}`);

      for (const texFile of texFiles) {
        try {
          const content = await vscode.workspace.fs.readFile(texFile);
          const buffer = Buffer.from(content).toString("utf-8");
          const lines = buffer.split("\n");

          const updatedLines = lines.map((line) => {
            if (line.trim().startsWith("%")) return line;
            const shouldComment = deletedFiles.some((file) => {
              const relativePath = getRelativePathToMain(file.fsPath, mainFile);
              return (
                line.includes(relativePath) &&
                macrosList.some((macro) =>
                  normalizeMacroLine(line).includes(normalizeMacroLine(macro.signature.split("PATH")[0]))
                )
              );
            });
            return shouldComment ? `%${line}` : line;
          });

          const updatedContent = updatedLines.join("\n");
          if (updatedContent !== buffer) {
            const doc = await vscode.workspace.openTextDocument(texFile);
            const fullRange = new vscode.Range(doc.positionAt(0), doc.lineAt(doc.lineCount - 1).range.end);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (error) {
          console.error("Error processing file:", error);
        }
      }
    }
  });

  const onDidRenameFiles = vscode.workspace.onDidRenameFiles(async (event) => {
    macroIndex.markWorkspaceDirty();
    const mainLaTeXFiles = await findAllMainLaTeXFiles();
    if (mainLaTeXFiles.length === 0) return;
    const config = vscode.workspace.getConfiguration("latexMacros");
    const macrosList: { signature: string; extensions: string[] }[] | undefined = config.get("macrosList");
    if (!macrosList || macrosList.length === 0) return;

    const renamedFiles = event.files.filter((file) => !file.oldUri.fsPath.endsWith(".tex"));
    const scopes = new Set(
      (await Promise.all(
        renamedFiles.map((file) => findClosestMainLaTeXFile(file.oldUri.fsPath, mainLaTeXFiles))
      )).filter((scope): scope is string => scope !== null)
    );
    const scopeBaseDirs = new Set([...scopes].map((scope) => replaceWindowsPath(path.dirname(scope))));

    const isMacroInLine = (line: string): boolean => {
      return macrosList.some((macro) =>
        normalizeMacroLine(line).includes(normalizeMacroLine(macro.signature.split("PATH")[0]))
      );
    };

    for (const baseDir of scopeBaseDirs) {
      const mainFile = [...scopes].find((scope) => scope.startsWith(baseDir));
      const filesInBaseDir = renamedFiles.filter((file) =>
        replaceWindowsPath(file.oldUri.fsPath).startsWith(baseDir)
      );
      if (!mainFile || filesInBaseDir.length === 0) continue;

      const texFiles = await vscode.workspace.findFiles(new vscode.RelativePattern(baseDir, "**/*.tex"));
      channel.appendLine(`Main file: ${mainFile}`);
      channel.appendLine(`Renamed files:\n ${filesInBaseDir.map((file) => file.oldUri.fsPath).join("\n")}`);

      for (const texFile of texFiles) {
        try {
          const content = await vscode.workspace.fs.readFile(texFile);
          const buffer = Buffer.from(content).toString("utf-8");
          const lines = buffer.split("\n");

          const updatedLines = lines.map((line) => {
            let updatedLine = line;
            for (const file of filesInBaseDir) {
              const oldPath = getRelativePathToMain(file.oldUri.fsPath, mainFile);
              const newPath = getRelativePathToMain(file.newUri.fsPath, mainFile);
              if (line.includes(oldPath) && isMacroInLine(line)) {
                updatedLine = line.replace(oldPath, newPath);
              }
            }
            return updatedLine;
          });

          const updatedContent = updatedLines.join("\n");
          if (updatedContent !== buffer) {
            const doc = await vscode.workspace.openTextDocument(texFile);
            const fullRange = new vscode.Range(doc.positionAt(0), doc.lineAt(doc.lineCount - 1).range.end);
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (error) {
          console.error("Error processing file:", error);
        }
      }
    }
  });

  context.subscriptions.push(onDidDeleteFiles, onDidRenameFiles);
}

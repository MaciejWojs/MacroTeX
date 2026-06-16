import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { MacroIndex } from "../utils/MacroIndex";
import { findClosestMainLaTeXFile, isImageFile } from "../utils/fileUtils";
import { getPreviewImageString, getPreviewMdString } from "../utils/macroUtils";

export function registerHoverProvider(context: vscode.ExtensionContext, macroIndex: MacroIndex): void {
  const hoverProvider = vscode.languages.registerHoverProvider("latex", {
    async provideHover(document: vscode.TextDocument, position: vscode.Position) {
      const macroRange = document.getWordRangeAtPosition(position, /\\[A-Za-z@]+/);
      if (macroRange) {
        const word = document.getText(macroRange);
        const macroName = word.replace(/^\\/, "");
        try {
          const def = await macroIndex.getMacroDefinition(macroName);
          if (def) {
            let header = "";
            if (
              def.type === "newcommand" ||
              def.type === "newcommand*" ||
              def.type === "renewcommand" ||
              def.type === "renewcommand*"
            ) {
              const params = def.parameters > 0 ? ` [${def.parameters}]` : "";
              const defVal = def.defaultValue ? ` [${def.defaultValue}]` : "";
              header = `\\${def.type.replace("*", "\\*")} {\\${def.name}}${params}${defVal}`;
            } else if (def.type === "def") {
              const params = def.parameters > 0 ? ` (#1..#${def.parameters})` : "";
              header = `\\def \\${def.name}${params}`;
            }

            const linkArgs = encodeURIComponent(JSON.stringify([def.location.file, def.location.line]));
            const clickableLink = `[here](command:marcotex.openMacroDefinition?${linkArgs})`;
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.supportHtml = true;
            const code = `${header}{\n${def.definition}\n}`;
            md.appendMarkdown(`Defined ${clickableLink}`);
            md.appendCodeblock(code, "latex");
            return new vscode.Hover(md, macroRange);
          }
        } catch {
          return undefined;
        }
      }

      const mainLaTeXFile = await findClosestMainLaTeXFile();
      const braceRange = document.getWordRangeAtPosition(position, /\{[^}]*\}/);
      if (!mainLaTeXFile || !braceRange) return undefined;

      const hoverText = document.getText(braceRange).replace(/[\{\}]/g, "");
      if (!isImageFile(hoverText)) return undefined;

      const fullPath = path.resolve(path.dirname(mainLaTeXFile), hoverText);
      const uri = vscode.Uri.file(fullPath);
      const md = fs.existsSync(fullPath)
        ? getPreviewImageString(uri)
        : getPreviewMdString("<h1>File not found in filesystem!</h1>");

      return new vscode.Hover(md, braceRange);
    },
  });

  context.subscriptions.push(hoverProvider);
}

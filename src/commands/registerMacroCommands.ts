import * as vscode from "vscode";
import { MacroConverter } from "../utils/MacroConverter";
import { MacroIndex } from "../utils/MacroIndex";

export function registerMacroCommands(context: vscode.ExtensionContext, macroIndex: MacroIndex): void {
  const expandMacroCommand = vscode.commands.registerCommand(
    "marcotex.expandMacroToDefinition",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor found");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage("Please select a macro usage to expand");
        return;
      }

      const selectedText = editor.document.getText(selection);
      const usage = MacroConverter.parseUsageFromSelection(selectedText);
      if (!usage) {
        vscode.window.showWarningMessage("Selected text is not a valid macro usage");
        return;
      }

      const config = vscode.workspace.getConfiguration("latexMacros");
      const macrosList = config.get("macrosList", []);
      const isConfiguredMacro = macrosList.some((macro: any) => {
        const macroNameMatch = macro.signature.match(/\\(\w+)/);
        return macroNameMatch && macroNameMatch[1] === usage.name;
      });

      if (!isConfiguredMacro) {
        vscode.window.showWarningMessage(
          `Macro \\${usage.name} is not defined in configuration. Please add it to latexMacros.macrosList setting.`
        );
        return;
      }

      try {
        const expandedDefinition = await MacroConverter.convertUsageToDefinitionFromConfig(usage);
        if (!expandedDefinition) {
          vscode.window.showWarningMessage(`Could not generate definition for macro \\${usage.name}`);
          return;
        }

        await editor.edit((editBuilder) => {
          editBuilder.replace(selection, expandedDefinition);
        });
        vscode.window.showInformationMessage(`Expanded macro \\${usage.name} to its definition`);
      } catch (error) {
        vscode.window.showErrorMessage(`Error expanding macro: ${error}`);
      }
    }
  );

  const collapseMacroCommand = vscode.commands.registerCommand(
    "marcotex.collapseMacroToUsage",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("No active editor found");
        return;
      }

      const selection = editor.selection;
      if (selection.isEmpty) {
        vscode.window.showWarningMessage("Please select a definition to collapse");
        return;
      }

      const selectedText = editor.document.getText(selection);
      try {
        const matchingSignature = await MacroConverter.findMatchingSignatureForDefinition(selectedText);
        if (!matchingSignature) {
          vscode.window.showWarningMessage(
            "No matching macro signature found in configuration for this definition"
          );
          return;
        }

        const collapsedUsage = MacroConverter.convertDefinitionToUsageWithSignature(
          selectedText,
          matchingSignature
        );
        if (!collapsedUsage) {
          vscode.window.showWarningMessage("Could not convert definition to macro usage");
          return;
        }

        await editor.edit((editBuilder) => {
          editBuilder.replace(selection, collapsedUsage);
        });
        vscode.window.showInformationMessage(`Collapsed definition to macro usage: ${collapsedUsage}`);
      } catch (error) {
        vscode.window.showErrorMessage(`Error collapsing to macro: ${error}`);
      }
    }
  );

  const showMacroReferencesCommand = vscode.commands.registerCommand(
    "marcotex.showMacroReferences",
    async (uri: vscode.Uri, position: vscode.Position, macroName: string) => {
      const references = await macroIndex.findReferences(macroName);
      await vscode.commands.executeCommand("editor.action.showReferences", uri, position, references);
    }
  );

  const openMacroDefinitionCommand = vscode.commands.registerCommand(
    "marcotex.openMacroDefinition",
    async (filePath: string, line?: number) => {
      try {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        if (typeof line === "number") {
          const targetLine = Math.max(0, line - 1);
          const pos = new vscode.Position(targetLine, 0);
          const sel = new vscode.Selection(pos, pos);
          editor.selection = sel;
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Cannot open macro definition: ${err}`);
      }
    }
  );

  context.subscriptions.push(
    expandMacroCommand,
    collapseMacroCommand,
    showMacroReferencesCommand,
    openMacroDefinitionCommand
  );
}

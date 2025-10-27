import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { MacroParser, type MacroDefinition } from './utils/MacroParser';
import { MacroGrouper, type MacroGroup } from './utils/MacroGrouper';
import { MacroSignatureUtils } from './utils/MacroSignatureUtils';
import { findClosestMainLaTeXFile } from './extension';

export class MacroFinderProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'marcotex.macroFinder';

  private _view?: vscode.WebviewView;
  private _macroGroups: MacroGroup[] = [];
  private _allMacroGroups: MacroGroup[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'node_modules', '@vscode-elements')),
        vscode.Uri.file(path.join(this._extensionUri.fsPath, 'node_modules', '@vscode')),
        this._extensionUri
      ]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async data => {
      switch (data.type) {
        case 'refreshMacros':
          await this.refreshMacros();
          break;
        case 'goToMacro':
          await this.goToMacro(data.macro);
          break;
        case 'deleteMacro':
          await this.deleteMacro(data.macro);
          break;
        case 'insertMacro':
          await this.insertMacro(data.macro);
          break;
        case 'filterChanged':
          this.filterMacros(data.filter);
          break;
        case 'saveMacro':
          await this.saveMacro(data.macro);
          break;
      }
    });

    vscode.window.onDidChangeActiveTextEditor(() => {
      this.refreshMacros();
    });

    this.refreshMacros();
  }

  private async refreshMacros() {
    const mainFile = await findClosestMainLaTeXFile();
    if (!mainFile) {
      this._allMacroGroups = [];
      this._macroGroups = [];
      this._updateWebview();
      return;
    }

    const allMacros = await MacroParser.findAllMacrosInProject(mainFile);
    this._allMacroGroups = MacroGrouper.groupMacrosByType(allMacros);

    // Apply default filter (newcommand*)
    this.filterMacros('newcommand*');
  }

  private filterMacros(filterType: string) {
    if (filterType === 'all') {
      this._macroGroups = this._allMacroGroups;
    } else {
      this._macroGroups = this._allMacroGroups.filter(group => group.type === filterType);
    }
    this._updateWebview();
  }

  private async goToMacro(macro: MacroDefinition) {
    const uri = vscode.Uri.file(macro.location.file);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    const position = new vscode.Position(macro.location.line - 1, macro.location.column);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
  }

  private async deleteMacro(macro: MacroDefinition) {
    const result = await vscode.window.showWarningMessage(
      `Are you sure you want to delete macro \\${macro.name}?`,
      'Yes', 'No'
    );

    if (result === 'Yes') {
      await this.removeMacroFromFile(macro);
      await this.refreshMacros();
    }
  }

  private async saveMacro(macro: MacroDefinition) {
    const signature = MacroSignatureUtils.convertToSignature(macro);
    if (!signature) {
      vscode.window.showWarningMessage(`Macro \\${macro.name} cannot be converted to a file-based signature`);
      return;
    }

    // Pokaż podgląd konwersji
    const example = MacroSignatureUtils.generateUsageExample(macro, signature.signature);
    const result = await vscode.window.showInformationMessage(
      `Convert macro \\${macro.name} to signature:\n${signature.signature}\n\nExample: ${example}`,
      'Save & Edit', 'Save Only', 'Cancel'
    );

    if (result === 'Cancel') return;

    const saved = await MacroSignatureUtils.saveMacroToConfiguration(signature);
    if (saved) {

      if (result === 'Save & Edit') {
        await MacroSignatureUtils.editMacroConfiguration(signature);
      } else {
        vscode.window.showInformationMessage(
          `Macro ${macro.name} saved to configuration!`,
          'Open Settings'
        ).then(action => {
          if (action === 'Open Settings') {
            vscode.commands.executeCommand('workbench.action.openSettings', 'latexMacros.macrosList');
          }
        });
      }
    } else {
      vscode.window.showErrorMessage(`Failed to save macro \\${macro.name}`);
    }
  }

  private async insertMacro(macro: MacroDefinition) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const macroUsage = MacroGrouper.getMacroUsageExample(macro);
    const snippet = new vscode.SnippetString(macroUsage);
    await editor.insertSnippet(snippet);
    vscode.window.showInformationMessage(`Inserted macro: ${macroUsage}`);
  }

  private async removeMacroFromFile(macro: MacroDefinition) {
    try {
      const uri = vscode.Uri.file(macro.location.file);
      const document = await vscode.workspace.openTextDocument(uri);

      // Znajdź pełną definicję makra (może być wieloliniowa)
      const fullText = document.getText();
      const lines = fullText.split('\n');

      // Znajdź linię rozpoczynającą definicję
      const startLine = macro.location.line - 1;
      let endLine = startLine;

      // Dla wieloliniowych definicji, znajdź koniec
      const definitionText = lines[startLine];
      if (definitionText.includes(macro.type)) {
        // Sprawdź czy definicja jest zamknięta w tej samej linii
        let braceCount = 0;
        let foundStart = false;

        for (let i = 0; i < definitionText.length; i++) {
          if (definitionText[i] === '{' && !foundStart) {
            // Znajdź pierwszy nawias po nazwie makra
            if (definitionText.substring(0, i).includes(`\\${macro.name}`)) {
              foundStart = true;
            }
          }
          if (foundStart) {
            if (definitionText[i] === '{') braceCount++;
            else if (definitionText[i] === '}') braceCount--;
          }
        }

        // Jeśli definicja nie jest zamknięta, szukaj dalej
        if (braceCount > 0) {
          for (let lineIdx = startLine + 1; lineIdx < lines.length && braceCount > 0; lineIdx++) {
            const line = lines[lineIdx];
            for (let i = 0; i < line.length; i++) {
              if (line[i] === '{') braceCount++;
              else if (line[i] === '}') braceCount--;
            }
            endLine = lineIdx;
            if (braceCount === 0) break;
          }
        }
      }

      const edit = new vscode.WorkspaceEdit();
      const range = new vscode.Range(startLine, 0, endLine + 1, 0);
      edit.delete(uri, range);

      const success = await vscode.workspace.applyEdit(edit);
      if (success) {
        vscode.window.showInformationMessage(`Deleted macro: \\${macro.name}`);
      } else {
        vscode.window.showErrorMessage(`Failed to delete macro: \\${macro.name}`);
      }
    } catch (error) {
      console.error('Error removing macro:', error);
      vscode.window.showErrorMessage(`Error deleting macro: ${error}`);
    }
  }

  private _updateWebview() {
    if (this._view) {
      this._view.webview.postMessage({
        type: 'updateMacroGroups',
        groups: this._macroGroups,
        allGroups: this._allMacroGroups
      });
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const elementsMainPath = path.join(this._extensionUri.fsPath, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js');
    const elementsFallbackPath = path.join(this._extensionUri.fsPath, 'dist', 'toolkit.js');
    const useMainPath = fs.existsSync(elementsMainPath);
    const elementsPath = useMainPath
      ? webview.asWebviewUri(vscode.Uri.file(path.dirname(elementsMainPath)))
      : webview.asWebviewUri(vscode.Uri.file(path.dirname(elementsFallbackPath)));
    const elementsScript = useMainPath ? 'bundled.js' : 'toolkit.js';

    const macroFinderJs = path.join(this._extensionUri.fsPath, 'dist', 'table-generator.js');
    const macroFinderPath = webview.asWebviewUri(vscode.Uri.file(path.dirname(macroFinderJs)));


    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LaTeX Macro Finder</title>
    <script type="module" src="${elementsPath}/${elementsScript}"></script>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 10px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .header h3 {
            margin: 0;
            font-size: 16px;
        }
        
        .filter-container {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding: 10px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        
        .filter-label {
            font-weight: bold;
            font-size: 12px;
            color: var(--vscode-foreground);
        }
        
        .macro-groups {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .group-section {
            margin-bottom: 20px;
        }
        
        .group-header {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: bold;
            margin-bottom: 10px;
            padding: 8px;
            background: var(--vscode-editor-selectionBackground);
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
        }
        
        .macro-item {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
            padding: 8px;
            margin: 5px 0;
            background: var(--vscode-editor-background);
        }
        
        .macro-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 5px;
        }
        
        .macro-name {
            font-weight: bold;
            color: var(--vscode-symbolIcon-functionForeground);
            font-family: monospace;
            font-size: 13px;
        }
        
        .macro-usage {
            font-family: monospace;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin: 3px 0;
        }
        
        .macro-definition {
            font-family: monospace;
            background: var(--vscode-textCodeBlock-background);
            padding: 5px 8px;
            border-radius: 3px;
            margin: 5px 0;
            font-size: 11px;
            word-break: break-all;
            max-height: 100px;
            overflow-y: auto;
        }
        
        .macro-location {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 8px;
        }
        
        .macro-actions {
            display: flex;
            gap: 5px;
            flex-wrap: wrap;
        }
        
        .parameters {
            font-size: 10px;
            color: var(--vscode-symbolIcon-numberForeground);
            background: var(--vscode-badge-background);
            padding: 2px 5px;
            border-radius: 3px;
        }
        
        .no-macros {
            text-align: center;
            color: var(--vscode-descriptionForeground);
            padding: 20px;
            font-style: italic;
        }

        vscode-button[appearance="secondary"] {
            --button-background: var(--vscode-button-secondaryBackground);
            --button-foreground: var(--vscode-button-secondaryForeground);
        }

        vscode-button[appearance="primary"] {
            --button-background: var(--vscode-button-background);
            --button-foreground: var(--vscode-button-foreground);
        }

        .delete-btn {
            --button-background: var(--vscode-errorForeground);
            --button-foreground: white;
        }

        .save-btn {
            --button-background: var(--vscode-button-background);
            --button-foreground: var(--vscode-button-foreground);
        }

        vscode-single-select {
            flex: 1;
            min-width: 150px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>LaTeX Macros</h3>
        <vscode-button id="refreshBtn" appearance="secondary">🔄 Refresh</vscode-button>
    </div>
    
    <div class="filter-container">
        <span class="filter-label">Filter:</span>
        <vscode-single-select id="macroTypeFilter">
            <vscode-option value="all">All types</vscode-option>
            <vscode-option value="newcommand">\\newcommand</vscode-option>
            <vscode-option value="newcommand*" selected>\\newcommand*</vscode-option>
            <vscode-option value="renewcommand">\\renewcommand</vscode-option>
            <vscode-option value="renewcommand*">\\renewcommand*</vscode-option>
            <vscode-option value="def">\\def</vscode-option>
        </vscode-single-select>
    </div>
    
    <div id="macroGroups" class="macro-groups">
        <div class="no-macros">Loading macros...</div>
    </div>

    <script src="${macroFinderPath}/macro-finder.js" type="module" defer></script>
</body>
</html>`;
  }
}
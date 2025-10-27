import * as vscode from "vscode";
import * as path from 'path';
import * as fs from 'fs';

const IS_LOGGING_ENABLED = false;

export class TableGeneratorBarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'marcotex.sidebarView';

  constructor(private readonly extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.extensionUri.fsPath, 'node_modules', '@vscode-elements')),
        vscode.Uri.file(path.join(this.extensionUri.fsPath, 'node_modules', '@vscode')),
        this.extensionUri
      ]
    };

    const channel = vscode.window.createOutputChannel("Table Generator");

    // Get paths to resources with fallback logic
    const elementsMainPath = path.join(this.extensionUri.fsPath, 'node_modules', '@vscode-elements', 'elements', 'dist', 'bundled.js');
    const elementsFallbackPath = path.join(this.extensionUri.fsPath, 'dist', 'toolkit.js');

    const tableGeneratorJs = path.join(this.extensionUri.fsPath, 'dist', 'table-generator.js');

    if (IS_LOGGING_ENABLED) {
      channel.appendLine("Retrieving Elements Path...");
      channel.appendLine(`Checking main path: ${elementsMainPath}`);
      channel.appendLine(`Main path exists: ${fs.existsSync(elementsMainPath)}`);
      channel.appendLine(`Checking fallback path: ${elementsFallbackPath}`);
      channel.appendLine(`Fallback path exists: ${fs.existsSync(elementsFallbackPath)}`);
    }


    const useMainPath = fs.existsSync(elementsMainPath);
    if (IS_LOGGING_ENABLED) channel.append(`Use Main Path: ${useMainPath}`);
    const elementsPath = useMainPath
      ? webviewView.webview.asWebviewUri(vscode.Uri.file(path.dirname(elementsMainPath)))
      : webviewView.webview.asWebviewUri(vscode.Uri.file(path.dirname(elementsFallbackPath)));

    const tableGeneratorPath = webviewView.webview.asWebviewUri(vscode.Uri.file(path.dirname(tableGeneratorJs)));

    channel.appendLine("Table Generator JS Path:");
    channel.appendLine(tableGeneratorPath.toString());
    channel.show(true);

    const elementsScript = useMainPath ? 'bundled.js' : 'toolkit.js';

    const codiconsMainPath = path.join(this.extensionUri.fsPath, 'node_modules', '@vscode', 'codicons', 'dist');
    const codiconsFallbackPath = path.join(this.extensionUri.fsPath, 'media');

    const codiconsPath = fs.existsSync(codiconsMainPath)
      ? webviewView.webview.asWebviewUri(vscode.Uri.file(codiconsMainPath))
      : webviewView.webview.asWebviewUri(vscode.Uri.file(codiconsFallbackPath));

    if (IS_LOGGING_ENABLED) {

      channel.appendLine("Table Generator Webview Initialized");

      console.log("Extension URI:", this.extensionUri.fsPath);
      console.log("Elements Path:", elementsPath.toString());
      console.log("Elements Script:", elementsScript);
      console.log("Codicons Path:", codiconsPath.toString());

      channel.appendLine(`Extension URI: ${this.extensionUri.fsPath}`);
      channel.appendLine(`Elements Path: ${elementsPath.toString()}`);
      channel.appendLine(`Elements Script: ${elementsScript}`);
      channel.appendLine(`Codicons Path: ${codiconsPath.toString()}`);
      channel.show(true);
    }

    webviewView.webview.html = /* html */`
      <!DOCTYPE html>
      <html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaTeX Table Generator</title>
  
  <!-- Load VS Code Elements -->
  <script type="module" src="${elementsPath}/${elementsScript}"></script>
  
  <style>
    :root {
      --border-radius: 6px;
      --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      --transition: all 0.3s ease;
    }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      padding: 10px;
      margin: 0;
      text-align: center;
      background-color: var(--vscode-editor-background);
    }

    .tooltip {
      position: relative;
      display: inline-block;
      width: 100%;
    }

    .tooltip .tooltiptext {
      visibility: hidden;
      width: 200px;
      background-color: var(--vscode-editor-background);
      color: var(--vscode-foreground);
      text-align: center;
      border-radius: var(--border-radius);
      padding: 8px 10px;
      bottom: 125%;
      left: 50%;
      margin-left: -100px;
      box-shadow: var(--box-shadow);
      border: 1px solid var(--vscode-panel-border);
      
      position: absolute;
      z-index: 1;
      opacity: 0;
      transition: opacity 0.3s, visibility 0.3s;
    }

    .tooltip .tooltiptext::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: var(--vscode-panel-border) transparent transparent transparent;
    }

    .tooltip:hover .tooltiptext {
      visibility: visible;
      opacity: 1;
    }
    
    .table-container {
      max-width: 100%;
      overflow-x: auto;
      margin: 0 auto 20px auto;
      padding: 15px;
      border-radius: var(--border-radius);
      background-color: var(--vscode-editor-background);
      box-shadow: var(--box-shadow);
      border: 1px solid var(--vscode-panel-border);
      transition: var(--transition);
    }

    .controls-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin: 0 auto 16px auto;
      max-width: 500px;
      align-items: center;
    }
    
    .button-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    pre {
      background-color: var(--vscode-editor-background);
      padding: 15px;
      border-radius: var(--border-radius);
      overflow-x: auto;
      white-space: pre-wrap;
      font-family: var(--vscode-editor-font-family);
      border: 1px solid var(--vscode-panel-border);
      text-align: left;
      font-size: 12px;
      line-height: 1.4;
      margin-top: 10px;
    }

    .header {
      margin: 0 auto 15px auto;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
      text-align: center;
    }
    
    .header h2 {
      margin: 0;
      font-size: 16px;
      color: var(--vscode-foreground);
    }

    @media (max-width: 500px) {
      .controls-container {
        flex-direction: column;
      }
      
      .button-group {
        width: 100%;
        justify-content: center;
      }
    }

    .icon {
      font-size: 14px;
      margin-right: 4px;
    }

    vscode-table {
      width: 100%;
      display: block;
    }

    vscode-table-cell[contenteditable="true"]:focus,
    vscode-table-header-cell[contenteditable="true"]:focus {
      background-color: var(--vscode-editor-selectionBackground) !important;
      outline: 1px solid var(--vscode-focusBorder);
    }

    .settings-container {
      display: flex;
      justify-content: center;
      margin: 10px 0;
    }

    /* Force table to recalculate layout */
    .table-refresh {
      display: none;
    }
    .table-refresh.show {
      display: block;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>LaTeX Table Generator</h2>
  </div>
  
  <div class="controls-container">
    <vscode-single-select id="tableTypeSelector">
      <vscode-option value="table">table (default)</vscode-option>
      <vscode-option value="longtable">longtable (multi-page)</vscode-option>
      <vscode-option value="tabularx">tabularx (auto width)</vscode-option>
      <vscode-option value="tabulary">tabulary (content fitting)</vscode-option>
    </vscode-single-select>
    
    <div class="button-group">
      <vscode-button id="addRowBtn" appearance="primary">
        <span class="icon">+</span>Add Row
      </vscode-button>
      <vscode-button id="addColumnBtn" appearance="primary">
        <span class="icon">+</span>Add Column
      </vscode-button>
    </div>
    
    <div class="button-group">
      <vscode-button id="removeRowBtn" appearance="secondary">
        <span class="icon">−</span>Remove Row
      </vscode-button>
      <vscode-button id="removeColumnBtn" appearance="secondary">
        <span class="icon">−</span>Remove Column
      </vscode-button>
      <vscode-button id="resetBtn" appearance="secondary">
        <span class="icon">↺</span>Reset
      </vscode-button>
    </div>
  </div>

  <div class="settings-container">
    <vscode-checkbox id="boldHeadersCheckbox" label="Bold headers" checked></vscode-checkbox>
  </div>
  
  <div class="tooltip" style="text-align: center;">
    <vscode-button id="convertBtn" appearance="primary">
      <span class="icon">📋</span>Insert LaTeX Table
    </vscode-button>
    <span class="tooltiptext">Insert the LaTeX table into your document</span>
  </div>
  
  <div id="table-container" class="table-container">
    <vscode-table id="myTable" zebra bordered-rows resizable>
      <vscode-table-header slot="header">
        <vscode-table-header-cell>Column 1</vscode-table-header-cell>
        <vscode-table-header-cell>Column 2</vscode-table-header-cell>
        <vscode-table-header-cell>Column 3</vscode-table-header-cell>
      </vscode-table-header>
      <vscode-table-body slot="body">
        <vscode-table-row>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
        </vscode-table-row>
        <vscode-table-row>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
        </vscode-table-row>
        <vscode-table-row>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
          <vscode-table-cell>Sample text</vscode-table-cell>
        </vscode-table-row>
      </vscode-table-body>
    </vscode-table>
  </div>

  <div class="header" style="margin-top: 20px;">
    <h3>LaTeX Preview</h3>
  </div>
  
  <div id="latex-preview" class="table-container">
    <pre id="latexCode"></pre>
  </div>

  <script src="${tableGeneratorPath}/table-generator.js" type="module" defer></sript>
</body>
</html>
`;

    const messageListener = webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'insertTable') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage("No active editor");
          return;
        }
        if (!message.macro) {
          vscode.window.showErrorMessage("Invalid LaTeX content");
          return;
        }

        try {
          const snippet = new vscode.SnippetString(message.macro);
          await editor.insertSnippet(snippet);
          vscode.window.showInformationMessage("LaTeX table inserted!");
        } catch (error) {
          console.error(error);
          vscode.window.showErrorMessage("Failed to insert table");
        }
      }
    });

    webviewView.onDidDispose(() => { messageListener.dispose(); });
  }
}

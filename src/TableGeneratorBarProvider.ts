import * as vscode from "vscode";
import * as path from 'path';

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
        vscode.Uri.file(path.join(this.extensionUri.fsPath, 'media')),
        this.extensionUri
      ]
    };

    // Get paths to resources
    const elementsPath = webviewView.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'node_modules', '@vscode-elements', 'elements', 'dist'))
    );
    
    const codiconsPath = webviewView.webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'node_modules', '@vscode', 'codicons', 'dist'))
    );

    console.log("Extension URI:", this.extensionUri.fsPath);
    console.log("Elements Path:", elementsPath.toString());
    console.log("Codicons Path:", codiconsPath.toString());

    webviewView.webview.html = /* html */`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LaTeX Table Generator</title>
  
  <!-- Load VS Code Elements -->
  <script type="module" src="${elementsPath}/bundled.js"></script>
  
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
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 0 auto;
      background-color: var(--vscode-editor-background);
    }
    
    th, td {
      border: 1px solid var(--vscode-panel-border);
      padding: 10px 12px;
      text-align: center;
      font-size: 14px;
      transition: var(--transition);
    }
    
    th {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      font-weight: 600;
    }
    
    td[contenteditable="true"]:focus {
      outline: 2px solid var(--vscode-focusBorder);
      background-color: var(--vscode-input-background) !important;
    }
    
    tr:hover td {
      background-color: var(--vscode-list-hoverBackground);
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

    tr:first-child td {
      font-weight: bold;
      background-color: var(--vscode-editor-lineHighlightBackground);
    }

    td[contenteditable="true"] {
      transition: background-color 0.2s;
    }

    .icon {
      font-size: 14px;
      margin-right: 4px;
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
  
  <div class="tooltip" style="text-align: center;">
    <vscode-button id="convertBtn" appearance="primary">
      <span class="icon">📋</span>Convert to LaTeX
    </vscode-button>
    <span class="tooltiptext">Create and insert a LaTeX table into your document</span>
  </div>
  
  <div id="table-container" class="table-container">
    <table id="myTable">
      <tr>
        <td>Sample text</td>
        <td>Sample text</td>
        <td>Sample text</td>
      </tr>
      <tr>
        <td>Sample text</td>
        <td>Sample text</td>
        <td>Sample text</td>
      </tr>
      <tr>
        <td>Sample text</td>
        <td>Sample text</td>
        <td>Sample text</td>
      </tr>
    </table>
  </div>

  <script type="module">
    const vscode = acquireVsCodeApi();
    let table = document.getElementById("myTable");

    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('addRowBtn').addEventListener('click', addRow);
      document.getElementById('addColumnBtn').addEventListener('click', addColumn);
      document.getElementById('removeRowBtn').addEventListener('click', removeRow);
      document.getElementById('removeColumnBtn').addEventListener('click', removeColumn);
      document.getElementById('resetBtn').addEventListener('click', resetTable);
      document.getElementById('convertBtn').addEventListener('click', convertToLatex);
    });

    function addEditableFeature(cell) {
      cell.setAttribute('contenteditable', true);
      cell.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
          event.preventDefault();
          return false;
        }
      });
      cell.addEventListener('paste', event => {
        event.preventDefault();
        const pastedText = (event.clipboardData || window.clipboardData).getData('text');
        const cleanText = pastedText.replace(/\\r\\n|\\r|\\n/g, ' ');
        cell.innerHTML = cleanText;
      });
      cell.addEventListener('focus', () => {
        cell.style.backgroundColor = 'var(--vscode-editor-selectionBackground)';
      });
      cell.addEventListener('blur', () => {
        cell.style.backgroundColor = '';
        cell.textContent = cell.textContent.replace(/\\r\\n|\\r|\\n/g, ' ');
      });
    }

    document.querySelectorAll('td').forEach(cell => {
      addEditableFeature(cell);
    });

    function addRow() {
      const rowCount = table.rows.length;
      const colCount = table.rows[0].cells.length;
      const newRow = table.insertRow(rowCount);
      for (let i = 0; i < colCount; i++) {
        const newCell = newRow.insertCell(i);
        newCell.textContent = "Sample text";
        addEditableFeature(newCell);
      }
    }

    function addColumn() {
      const rowCount = table.rows.length;
      for (let i = 0; i < rowCount; i++) {
        const newCell = table.rows[i].insertCell();
        newCell.textContent = "Sample text";
        addEditableFeature(newCell);
      }
    }

    function removeRow() {
      if (table.rows.length > 1) {
        table.deleteRow(table.rows.length - 1);
      }
    }

    function removeColumn() {
      if (table.rows[0].cells.length > 1) {
        for (let i = 0; i < table.rows.length; i++) {
          table.rows[i].deleteCell(table.rows[i].cells.length - 1);
        }
      }
    }

    function resetTable() {
      document.querySelector('.table-container').innerHTML = \`
        <table id="myTable">
          <tr>
            <td>Sample text</td>
            <td>Sample text</td>
            <td>Sample text</td>
          </tr>
          <tr>
            <td>Sample text</td>
            <td>Sample text</td>
            <td>Sample text</td>
          </tr>
          <tr>
            <td>Sample text</td>
            <td>Sample text</td>
            <td>Sample text</td>
          </tr>
        </table>\`;
      table = document.getElementById("myTable");
      document.querySelectorAll('#myTable td').forEach(cell => {
        addEditableFeature(cell);
      });
    }

    function convertToLatex() {
      const rowCount = table.rows.length;
      const colCount = table.rows[0].cells.length;
      const tableType = document.getElementById("tableTypeSelector").value;
      let columnAlignment = '';
      let latexCode = '';
      
      if (tableType === 'tabularx') {
        columnAlignment = 'X'.repeat(colCount);
      } else if (tableType === 'tabulary') {
        columnAlignment = 'C'.repeat(colCount);
      } else {
        columnAlignment = 'c'.repeat(colCount);
      }
      
      switch (tableType) {
        case 'table':
          latexCode = '\\\\begin{table}[htbp]\\n';
          latexCode += '  \\\\centering\\n';
          latexCode += '  \\\\begin{tabular}{|' + columnAlignment.split('').join('|') + '|}\\n';
          break;
        case 'longtable':
          latexCode = '% Wymaga: \\\\usepackage{longtable}\\n';
          latexCode += '\\\\begin{longtable}{|' + columnAlignment.split('').join('|') + '|}\\n';
          break;
        case 'tabularx':
          latexCode = '% Wymaga: \\\\usepackage{tabularx}\\n';
          latexCode += '\\\\begin{table}[htbp]\\n';
          latexCode += '  \\\\centering\\n';
          latexCode += '  \\\\begin{tabularx}{\\\\textwidth}{|' + columnAlignment.split('').join('|') + '|}\\n';
          break;
        case 'tabulary':
          latexCode = '% Wymaga: \\\\usepackage{tabulary}\\n';
          latexCode += '\\\\begin{table}[htbp]\\n';
          latexCode += '  \\\\centering\\n';
          latexCode += '  \\\\begin{tabulary}{\\\\textwidth}{|' + columnAlignment.split('').join('|') + '|}\\n';
          break;
      }
      
      latexCode += '  \\\\hline\\n';
      
      for (let i = 0; i < rowCount; i++) {
        const row = table.rows[i];
        const rowData = [];
        
        for (let j = 0; j < colCount; j++) {
          const cellContent = row.cells[j].textContent
            .replace(/\\r\\n|\\r|\\n/g, ' ')
            .replace(/\\\\/g, '\\\\textbackslash{ }')
            .replace(/&/g, '\\\\&')
            .replace(/%/g, '\\\\%')
            .replace(/\\$/g, '\\\\\\\\$')
            .replace(/#/g, '\\\\#')
            .replace(/_/g, '\\\\_')
            .replace(/\\{/g, '\\\\{')
            .replace(/\\}/g, '\\\\}')
            .replace(/~/g, '\\\\textasciitilde{}')
            .replace(/\\^/g, '\\\\textasciicircum{}');
          rowData.push('    ' + cellContent);
        }
        
        latexCode += rowData.join(' & ') + ' \\\\\\\\\\\\\\\ \\n';
      }
      latexCode += '  \\\\hline\\n';

      switch (tableType) {
        case 'table':
          latexCode += '  \\\\end{tabular}\\n';
          latexCode += '  \\\\caption{\${1}}\\n';
          latexCode += '  \\\\label{tab:\${2}}\\n';
          latexCode += '\\\\end{table}';
          break;
        case 'longtable':
          latexCode += '  \\\\caption{\${1}}\\n';
          latexCode += '  \\\\label{tab:\${2}}\\n';
          latexCode += '\\\\end{longtable}';
          break;
        case 'tabularx':
          latexCode += '  \\\\end{tabularx}\\n';
          latexCode += '  \\\\caption{\${1}}\\n';
          latexCode += '  \\\\label{tab:\${2}}\\n';
          latexCode += '\\\\end{table}';
          break;
        case 'tabulary':
          latexCode += '  \\\\end{tabulary}\\n';
          latexCode += '  \\\\caption{\${1}}\\n';
          latexCode += '  \\\\label{tab:\${2}}\\n';
          latexCode += '\\\\end{table}';
          break;
      }

      document.querySelector('.table-container').innerHTML = '<pre>' + latexCode + '</pre>';

      vscode.postMessage({
        command: 'insertTable',
        macro: latexCode
      });
    }
  </script>
</body>
</html>
`;

    const messageListener = webviewView.webview.onDidReceiveMessage(async message => {
      if (message.command === 'insertTable') {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return vscode.window.showErrorMessage("No active editor");
        if (!message.macro) return vscode.window.showErrorMessage("Invalid LaTeX content");

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

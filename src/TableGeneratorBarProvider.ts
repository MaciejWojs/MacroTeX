import * as vscode from "vscode";
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
        // Opcjonalnie ogranicz dostęp do lokalnych zasobów
      };
      console.log("resolveWebviewView invoked");
    //   vscode.window.showInformationMessage("resolveWebviewView invoked");
  
      webviewView.webview.html = `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
        :root {
        --primary-color: #4CAF50;
        --primary-hover: #45a049;
        --danger-color: #f44336;
        --danger-hover: #d32f2f;
        --info-color: #2196F3;
        --info-hover: #1976D2;
        --border-radius: 6px;
        --box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        --transition: all 0.3s ease;
        }
        
        body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
        color: var(--vscode-foreground);
        padding: 10px;
        margin: 0;
        text-align: center;
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
        
        /* Position the tooltip */
        position: absolute;
        z-index: 1;
        
        /* Animation */
        opacity: 0;
        transition: opacity 0.3s, visibility 0.3s;
        }
  
        /* Tooltip arrow */
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
        
        /* Table container styles */
        .table-container {
        max-width: 100%;
        overflow-x: auto;
        margin: 0 auto 20px auto;
        padding: 15px;
        border-radius: var(--border-radius);
        background-color: var(--vscode-editor-background);
        box-shadow: var(--box-shadow);
        border: 1px solid var(--vscode-panel-border);
        }
        
        /* Table styles */
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
        background-color: var(--primary-color);
        color: white;
        font-weight: 600;
        }
        
        td[contenteditable="true"]:focus {
        outline: 2px solid var(--info-color);
        background-color: var(--vscode-input-background) !important;
        }
        
        tr:hover td {
        background-color: var(--vscode-list-hoverBackground);
        }
        
        /* Button styles */
        .buttons-container {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;
        margin: 0 auto 16px auto;
        max-width: 400px;
        }
        
        .button-group {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        }
        
        button {
        color: white;
        padding: 8px 12px;
        font-size: 13px;
        border: none;
        border-radius: var(--border-radius);
        cursor: pointer;
        transition: var(--transition);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        min-width: 80px;
        font-weight: 500;
        }
        
        button:hover {
        transform: translateY(-2px);
        box-shadow: var(--box-shadow);
        }
        
        button:active {
        transform: translateY(0);
        }
        
        .btn-add { 
        background-color: var(--primary-color);
        }
        
        .btn-add:hover { 
        background-color: var(--primary-hover);
        }
        
        .btn-remove { 
        background-color: var(--danger-color);
        }
        
        .btn-remove:hover { 
        background-color: var(--danger-hover);
        }
        
        .btn-convert { 
        background-color: var(--info-color); 
        width: 100%;
        max-width: 300px;
        margin: 10px auto;
        padding: 10px;
        font-size: 14px;
        }
        
        .btn-convert:hover { 
        background-color: var(--info-hover);
        }
  
        /* Icon styles */
        .icon {
        font-size: 14px;
        font-weight: bold;
        }
        
        pre {
        background-color: var(--vscode-editor-background);
        padding: 15px;
        border-radius: var(--border-radius);
        overflow-x: auto;
        white-space: pre-wrap;
        font-family: 'Courier New', Courier, monospace;
        border: 1px solid var(--vscode-panel-border);
        text-align: left;
        }
        
        /* Header */
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
  
        /* Responsive adjustments */
        @media (max-width: 400px) {
        .buttons-container {
        flex-direction: column;
        }
        
        .button-group {
        width: 100%;
        }
        
        button {
        flex: 1;
        }
        }
        </style>
      </head>
      <body>
        <div class="header">
        <h2>LaTeX Table Generator</h2>
        </div>
        
        <div class="buttons-container">
        <div class="button-group">
        <button class="btn-add" onclick="addRow()"><span class="icon">+</span> Row</button>
        <button class="btn-add" onclick="addColumn()"><span class="icon">+</span> Column</button>
        </div>
        <div class="button-group">
        <button class="btn-remove" onclick="removeRow()"><span class="icon">−</span> Row</button>
        <button class="btn-remove" onclick="removeColumn()"><span class="icon">−</span> Column</button>
        <button class="btn-remove" onclick="resetTable()"><span class="icon">↺</span> Reset</button>
        </div>
        </div>
        <div class="tooltip" style="text-align: center;">
        <button class="btn-convert" onclick="convertToLatex()">
          <span class="icon">📋</span> Convert to LaTeX
        </button>
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
        
  
        <script>
        const vscode = acquireVsCodeApi();
        let table = document.getElementById("myTable");
  
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
        document.execCommand('insertText', false, cleanText);
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
        const columnAlignment = 'c'.repeat(colCount);
  
        let latexCode = '\\\\begin{table}[htbp]\\n';
        latexCode += '  \\\\centering\\n';
        latexCode += '  \\\\begin{tabular}{| ' + columnAlignment.split('').join('|') + '|}\\n';
        latexCode += '\t\\\\hline\\n';
  
        for (let i = 0; i < rowCount; i++) {
        const row = table.rows[i];
        const rowData = [];
        for (let j = 0; j < colCount; j++) {
        const cellContent = row.cells[j].textContent
          .replace(/\\r\\n|\\r|\\n/g, ' ')
          .replace(/\\\\/g, '\\\\textbackslash{ }')
          .replace(/&/g, '\\\\&')
          .replace(/%/g, '\\\\%')
          .replace(/\\$/g, '\\\\$')
          .replace(/#/g, '\\\\#')
          .replace(/_/g, '\\\\_')
          .replace(/\\{/g, '\\\\{')
          .replace(/\\}/g, '\\\\}')
          .replace(/~/g, '\\\\textasciitilde{}')
          .replace(/\\^/g, '\\\\textasciicircum{}');
        rowData.push('\t' + cellContent);
        }
        latexCode += rowData.join(' & ') + ' \\\\\\\\\\\\\\n\t\\\\hline\\n';
        }
  
        latexCode += '  \\\\end{tabular}\\n';
        latexCode += '  \\\\caption{${1}}\\n';
        latexCode += '  \\\\label{tab:${2}}\\n';
        latexCode += '\\\\end{table}';
  
        // Update the view with the LaTeX code
        document.querySelector('.table-container').innerHTML = '<pre>' + latexCode + '</pre>';
  
        // Send the message to VS Code extension
        vscode.postMessage({
        command: 'insertTable',
        macro: latexCode
        });
        }
        </script>
      </body>
      </html>`;
      // Store the disposable to properly clean up event listener
      const messageListener = webviewView.webview.onDidReceiveMessage(async message => {
        if (message.command === 'insertTable') {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showErrorMessage("No active text editor found");
            return;
          }
  
          if (!message.macro) {
            vscode.window.showErrorMessage("Invalid LaTeX content received");
            return;
          }
  
          try {
            const snippet = new vscode.SnippetString(message.macro);
            await editor.insertSnippet(snippet);
            vscode.window.showInformationMessage("LaTeX table inserted successfully");
          } catch (error) {
            console.error("Error inserting LaTeX table:", error);
            vscode.window.showErrorMessage("Failed to insert LaTeX table");
          }
        }
      });
  
      // Make sure to dispose the event listener when the webview is disposed
      webviewView.onDidDispose(() => {
        messageListener.dispose();
      });
    }
  }
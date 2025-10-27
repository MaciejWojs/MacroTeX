const vscode = acquireVsCodeApi();
let table = document.getElementById("myTable");
let currentLatexCode = '';

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('addRowBtn').addEventListener('click', addRow);
  document.getElementById('addColumnBtn').addEventListener('click', addColumn);
  document.getElementById('removeRowBtn').addEventListener('click', removeRow);
  document.getElementById('removeColumnBtn').addEventListener('click', removeColumn);
  document.getElementById('resetBtn').addEventListener('click', resetTable);
  document.getElementById('convertBtn').addEventListener('click', insertLatexTable);

  // Add listeners for live preview updates
  document.getElementById('tableTypeSelector').addEventListener('change', updateLatexPreview);
  document.getElementById('boldHeadersCheckbox').addEventListener('change', updateLatexPreview);

  initializeTable();
});

function updateTableReference() {
  table = document.getElementById("myTable");
  console.log('Table reference updated:', table);
}

function initializeTable() {
  updateTableReference();
  document.querySelectorAll('vscode-table-cell').forEach(cell => makeCellEditable(cell));
  document.querySelectorAll('vscode-table-header-cell').forEach(cell => makeHeaderCellEditable(cell));
  updateLatexPreview();
}

function getTableData() {
  const header = table.querySelector('vscode-table-header');
  const body = table.querySelector('vscode-table-body');

  const headerData = [];
  header.querySelectorAll('vscode-table-header-cell').forEach(cell => {
    headerData.push(cell.textContent.trim());
  });

  const bodyData = [];
  body.querySelectorAll('vscode-table-row').forEach(row => {
    const rowData = [];
    row.querySelectorAll('vscode-table-cell').forEach(cell => {
      rowData.push(cell.textContent.trim());
    });
    bodyData.push(rowData);
  });

  return { headers: headerData, rows: bodyData };
}

function rebuildTable(headers, rows) {
  const container = document.querySelector('.table-container');

  let headerHTML = '';
  headers.forEach(header => {
    headerHTML += `<vscode-table-header-cell>${header}</vscode-table-header-cell>`;
  });

  let bodyHTML = '';
  rows.forEach(row => {
    bodyHTML += '<vscode-table-row>';
    row.forEach(cell => {
      bodyHTML += `<vscode-table-cell>${cell}</vscode-table-cell>`;
    });
    bodyHTML += '</vscode-table-row>';
  });

  container.innerHTML = `
    <vscode-table id="myTable" zebra bordered-rows resizable>
      <vscode-table-header slot="header">
        ${headerHTML}
      </vscode-table-header>
      <vscode-table-body slot="body">
        ${bodyHTML}
      </vscode-table-body>
    </vscode-table>
  `;

  // Reinitialize after rebuild
  setTimeout(() => {
    initializeTable();
    console.log('Table rebuilt and reinitialized');
  }, 100);
}

function makeCellEditable(cell) {
  cell.setAttribute('contenteditable', true);

  cell.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      cell.blur();
    }
  });

  cell.addEventListener('paste', event => {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    cell.textContent = pastedText.replace(/\r\n|\r|\n/g, ' ');
    updateLatexPreview();
  });

  cell.addEventListener('focus', () => {
    cell.style.backgroundColor = 'var(--vscode-editor-selectionBackground)';
  });

  cell.addEventListener('blur', () => {
    cell.style.backgroundColor = '';
    cell.textContent = cell.textContent.replace(/\r\n|\r|\n/g, ' ');
    updateLatexPreview();
  });

  cell.addEventListener('input', () => {
    updateLatexPreview();
  });
}

function makeHeaderCellEditable(cell) {
  cell.setAttribute('contenteditable', true);

  cell.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      cell.blur();
    }
  });

  cell.addEventListener('paste', event => {
    event.preventDefault();
    const pastedText = (event.clipboardData || window.clipboardData).getData('text');
    cell.textContent = pastedText.replace(/\r\n|\r|\n/g, ' ');
    updateLatexPreview();
  });

  cell.addEventListener('focus', () => {
    cell.style.backgroundColor = 'var(--vscode-editor-selectionBackground)';
  });

  cell.addEventListener('blur', () => {
    cell.style.backgroundColor = '';
    cell.textContent = cell.textContent.replace(/\r\n|\r|\n/g, ' ');
    updateLatexPreview();
  });

  cell.addEventListener('input', () => {
    updateLatexPreview();
  });
}

function addRow() {
  try {
    updateTableReference();
    const tableData = getTableData();

    // Add new row with empty cells
    const newRow = new Array(tableData.headers.length).fill('Sample text');
    tableData.rows.push(newRow);

    rebuildTable(tableData.headers, tableData.rows);

  } catch (error) {
    console.error('Error adding row:', error);
  }
}

function addColumn() {
  try {
    updateTableReference();
    const tableData = getTableData();

    // Add new header
    const newColumnNumber = tableData.headers.length + 1;
    tableData.headers.push(`Column ${newColumnNumber}`);

    // Add new cell to each row
    tableData.rows.forEach(row => {
      row.push('Sample text');
    });

    rebuildTable(tableData.headers, tableData.rows);
    console.log('Column added and table rebuilt');

  } catch (error) {
    console.error('Error adding column:', error);
  }
}

function removeRow() {
  try {
    updateTableReference();
    const tableData = getTableData();

    if (tableData.rows.length <= 1) {
      console.log('Cannot remove row - minimum rows reached');
      return;
    }

    // Remove last row
    tableData.rows.pop();

    rebuildTable(tableData.headers, tableData.rows);

  } catch (error) {
    console.error('Error removing row:', error);
  }
}

function removeColumn() {
  try {
    updateTableReference();
    const tableData = getTableData();

    if (tableData.headers.length <= 1) {
      console.log('Cannot remove column - minimum columns reached');
      return;
    }

    // Remove last header
    tableData.headers.pop();

    // Remove last cell from each row
    tableData.rows.forEach(row => {
      row.pop();
    });

    rebuildTable(tableData.headers, tableData.rows);
    console.log('Column removed and table rebuilt');

  } catch (error) {
    console.error('Error removing column:', error);
  }
}

function resetTable() {
  try {
    const defaultHeaders = ['Column 1', 'Column 2', 'Column 3'];
    const defaultRows = [
      ['Sample text', 'Sample text', 'Sample text'],
      ['Sample text', 'Sample text', 'Sample text'],
      ['Sample text', 'Sample text', 'Sample text']
    ];

    rebuildTable(defaultHeaders, defaultRows);
    console.log('Table reset');

  } catch (error) {
    console.error('Error resetting table:', error);
  }
}

function updateLatexPreview() {
  setTimeout(() => {
    try {
      updateTableReference();
      const header = table.querySelector('vscode-table-header');
      const body = table.querySelector('vscode-table-body');

      if (!header || !body) {
        console.log('Table not ready for preview update');
        return;
      }

      const tableType = document.getElementById("tableTypeSelector").value;
      const boldHeaders = document.getElementById("boldHeadersCheckbox").checked;

      const colCount = header.children.length;
      let columnAlignment = (tableType === 'tabularx') ? 'X'.repeat(colCount) :
                            (tableType === 'tabulary') ? 'C'.repeat(colCount) : 'c'.repeat(colCount);
      let latexCode = '';

      // Header
      switch (tableType) {
        case 'table':
          latexCode = '\\begin{table}[htbp]\n  \\centering\n  \\begin{tabular}{|' + columnAlignment.split('').join('|') + '|}\n';
          break;
        case 'longtable':
          latexCode = '% Requires: \\usepackage{longtable}\n\\begin{longtable}{|' + columnAlignment.split('').join('|') + '|}\n';
          break;
        case 'tabularx':
          latexCode = '% Requires: \\usepackage{tabularx}\n\\begin{table}[htbp]\n  \\centering\n  \\begin{tabularx}{\\textwidth}{|' + columnAlignment.split('').join('|') + '|}\n';
          break;
        case 'tabulary':
          latexCode = '% Requires: \\usepackage{tabulary}\n\\begin{table}[htbp]\n  \\centering\n  \\begin{tabulary}{\\textwidth}{|' + columnAlignment.split('').join('|') + '|}\n';
          break;
      }

      latexCode += '  \\hline\n';

      // Header cells
      const headerData = [];
      header.querySelectorAll('vscode-table-header-cell').forEach(cell => {
        let text = sanitizeLatex(cell.textContent);
        headerData.push(boldHeaders ? `    \\textbf{${text}}` : `    ${text}`);
      });
      latexCode += headerData.join(' & ') + ' \\\\\n  \\hline\n';

      // Body rows
      body.querySelectorAll('vscode-table-row').forEach(row => {
        const rowData = [];
        row.querySelectorAll('vscode-table-cell').forEach(cell => {
          rowData.push('    ' + sanitizeLatex(cell.textContent));
        });
        latexCode += rowData.join(' & ') + ' \\\\\n';
      });

      latexCode += '  \\hline\n';

      // Footer
      switch (tableType) {
        case 'table':
          latexCode += '  \\end{tabular}\n  \\caption{${1}}\n  \\label{tab:${2}}\n\\end{table}';
          break;
        case 'longtable':
          latexCode += '  \\caption{${1}}\n  \\label{tab:${2}}\n\\end{longtable}';
          break;
        case 'tabularx':
          latexCode += '  \\end{tabularx}\n  \\caption{${1}}\n  \\label{tab:${2}}\n\\end{table}';
          break;
        case 'tabulary':
          latexCode += '  \\end{tabulary}\n  \\caption{${1}}\n  \\label{tab:${2}}\n\\end{table}';
          break;
      }

      document.getElementById('latexCode').textContent = latexCode;
      currentLatexCode = latexCode;

    } catch (error) {
      console.error('Error updating LaTeX preview:', error);
    }
  }, 50);
}

function sanitizeLatex(text) {
  return text
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/\\/g, '\\textbackslash{ }')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

function insertLatexTable() {
  if (!currentLatexCode) {
    updateLatexPreview();
    setTimeout(() => {
      if (currentLatexCode) {
        vscode.postMessage({
          command: 'insertTable',
          macro: currentLatexCode
        });
      }
    }, 100);
  } else {
    vscode.postMessage({
      command: 'insertTable',
      macro: currentLatexCode
    });
  }
}

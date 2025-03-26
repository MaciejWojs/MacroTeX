import csvParser from 'csv-parser';
import { Readable } from 'stream';

/**
 * Converts CSV string data to a LaTeX table format.
 * 
 * This function parses the CSV data and transforms it into a LaTeX table structure,
 * complete with proper LaTeX formatting, table environment, caption, and label.
 * All columns are centered by default.
 * 
 * @param csv - The CSV string to convert to LaTeX format
 * @returns A Promise that resolves to the LaTeX table as a string
 * @throws Will throw an error if the CSV parsing fails
 * 
 * @example
 * ```typescript
 * const csvData = 'name,age,city\nJohn,30,New York\nJane,25,San Francisco';
 * const latexTable = await csvToLatex(csvData);
 * ```
 */
export async function csvToLatex(csv: string): Promise<string> {
    const rows: Record<string, string>[] = [];

    await new Promise<void>((resolve) => {
        const readableStream = Readable.from([csv]);
        readableStream
            .pipe(csvParser())
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                resolve();
            });
    });

    if (rows.length === 0) {
        return '';
    }

    // Get headers (column names)
    const headers = Object.keys(rows[0]);
    
    // Create column alignment (all centered by default)
    const columnAlignment = 'c'.repeat(headers.length);
    
    // Start LaTeX table with full environment
    let latex = '\\begin{table}[htbp]\n';
    latex += '  \\centering\n';
    latex += '  \\begin{tabular}{|' + columnAlignment.split('').join('|') + '|}\n';
    latex += '\t\\hline\n';

    // Add header row
    latex += '\t' + headers.map(header => escapeLatex(header)).join(' & ') + ' \\\\\\\n\t\\hline\n';

    // Add data rows
    for (const row of rows) {
        latex += '\t' + headers.map(header => escapeLatex(row[header] || '')).join(' & ') + ' \\\\\\\n';
    }

    // End LaTeX table with caption and label
    latex+= '\t\\hline\n';
    latex += '  \\end{tabular}\n';
    latex += '  \\caption{${1}}\n';
    latex += '  \\label{tab:${2}}\n';
    latex += '\\end{table}';

    return latex;
}

// Helper function to escape LaTeX special characters
function escapeLatex(text: string): string {
    return text.replace(/([&%$#_{}])/g, '\\$1');
}

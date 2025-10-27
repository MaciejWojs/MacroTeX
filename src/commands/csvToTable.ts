import * as vscode from "vscode";
import { findClosestMainLaTeXFile } from "../extension";
import { csvToLatex } from "../utils/csvToLatex";
import * as fs from 'fs';

/**
 * Converts a CSV file to a LaTeX table and inserts it at the current cursor position
 * in the active editor.
 * 
 * @param contextSelection - The URI of the selected CSV file
 * @param uris - Additional URI information provided by VS Code when invoking command
 * @returns {Promise<void>} - A promise that resolves when the command execution is complete
 * 
 * @throws Will show an error message if no active editor is found
 * @throws Will show an error message if no main LaTeX file is found
 * @throws Will show an error message if the CSV file has no data
 * @throws Will show an error message if insertion fails
 */
export const csvAsTableCommand = async (contextSelection: vscode.Uri, _uris: vscode.Uri) => {
    if (!contextSelection.fsPath.endsWith('.csv')) {
        vscode.window.showErrorMessage("Selected file is not a CSV file");
        return;
    }
    const mainLaTeXFile = await findClosestMainLaTeXFile();
    const editor = vscode.window.activeTextEditor;


    if (!editor) {
        console.log("no active editor");
        vscode.window.showErrorMessage("no active editor");
        return;
    }

    if (!mainLaTeXFile) {
        console.log("no mainLaTeXFile");
        vscode.window.showErrorMessage("no mainLaTeXFile");
        return;
    }

    const latexTable = await csvToLatex(fs.readFileSync(contextSelection.fsPath, 'utf8'));

    if (!latexTable) {
        vscode.window.showErrorMessage("No data in CSV file");
        return;
    }

    try {
        const snippet = new vscode.SnippetString(latexTable);
        await editor.insertSnippet(snippet);
        vscode.window.showInformationMessage("LaTeX table inserted successfully");
    } catch (error) {
        console.error("Error inserting LaTeX table:", error);
        vscode.window.showErrorMessage("Failed to insert LaTeX table");
    }
}
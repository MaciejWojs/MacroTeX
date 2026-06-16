import * as vscode from "vscode";

export type MacroConfig = { signature: string; extensions: string[] };

export function processMacroSignature(signature: string): string {
  let i = 1;
  return signature
    .replace(/\{/g, () => `{$\{${i++}:`)
    .replace(/\[/g, () => `[$\{${i++}:`)
    .replaceAll("}", "}}")
    .replace("]", "}]");
}

export function normalizeMacroLine(line: string): string {
  return line.trim().replace(/\[.*?\]/g, "[]").replace(/\{.*?\}/g, "{}");
}

export function getPreviewMdString(str: string = "img"): vscode.MarkdownString {
  const md = new vscode.MarkdownString(str);
  md.supportHtml = true;
  md.isTrusted = true;
  return md;
}

export function getPreviewImageString(
  uri: vscode.Uri,
  alt: string = "img",
  width: number = 500
): vscode.MarkdownString {
  const imgString = `![${alt}](${uri.toString()}|width=${width})`;
  return getPreviewMdString(imgString);
}

export function getConfiguredMacros(): MacroConfig[] {
  const config = vscode.workspace.getConfiguration("latexMacros");
  return config.get<MacroConfig[]>("macrosList", []);
}

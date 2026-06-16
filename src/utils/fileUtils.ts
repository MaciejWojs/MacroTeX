import * as vscode from "vscode";
import * as path from "path";
import { replaceWindowsPath } from "./pathUtils";

export function isImageFile(file: string): boolean {
  const imageExtensions = [".png", ".jpg", ".jpeg"];
  return imageExtensions.some((ext) => file.toLowerCase().endsWith(ext));
}

export async function findAllMainLaTeXFiles(): Promise<string[]> {
  try {
    const texFiles = await vscode.workspace.findFiles("**/*.tex");

    const mainFiles = await Promise.all(
      texFiles.map(async (file) => {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString("utf-8");
        return text.includes("\\documentclass") ? replaceWindowsPath(file.fsPath) : null;
      })
    );

    return mainFiles.filter((filePath): filePath is string => filePath !== null);
  } catch (error) {
    console.error("Error finding main LaTeX files:", error);
    return [];
  }
}

export async function findClosestMainLaTeXFile(
  fsPath?: string,
  mainLaTeXFiles?: string[]
): Promise<string | null> {
  const activeFile = !fsPath ? vscode.window.activeTextEditor?.document.uri.fsPath : fsPath;
  if (!activeFile) return null;

  const files = mainLaTeXFiles || (await findAllMainLaTeXFiles());
  if (files.length === 0) return null;

  return files.reduce((closest, file) => {
    const relativePath = replaceWindowsPath(path.relative(file, activeFile));
    const relativeClosest = replaceWindowsPath(path.relative(closest, activeFile));
    const relativePathDepth = relativePath.split("../").length - 1;
    const closestPathDepth = closest ? relativeClosest.split("../").length - 1 : Infinity;
    return relativePathDepth < closestPathDepth ? file : closest;
  });
}

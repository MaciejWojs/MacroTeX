import * as path from "path";
import * as vscode from "vscode";
import lescape from "escape-latex";
import { getRelativePathToMain } from "./pathUtils";

type InvalidItem = { uri: vscode.Uri; name: string; fileInvalid: boolean; inFolder: boolean };

async function openInvalidsList(items: { uri: vscode.Uri; name?: string; inFolder?: boolean }[]) {
  const lines = ["Files or folders with names incompatible with LaTeX (original -> escaped):", ""];
  for (const it of items) {
    const name = it.name ?? path.basename(it.uri.fsPath);
    const escaped = lescape(name);
    const note = it.inFolder ? " (problem in parent folder)" : "";
    lines.push(`- ${it.uri.fsPath}${note}`);
    lines.push(`  escaped: ${escaped}`);
    lines.push("");
  }

  const content = lines.join("\n");
  try {
    const doc = await vscode.workspace.openTextDocument({ content, language: "text" });
    await vscode.window.showTextDocument(doc, { preview: false });
    vscode.window.showWarningMessage(
      "Opened a list of invalid file/folder names in a new editor. Please fix names or accept rename and try again."
    );
  } catch (err) {
    vscode.window.showErrorMessage(`Cannot open list of invalid file names: ${err}`);
  }
}

async function checkInvalids(uris: vscode.Uri[], mainLaTeXFile: string): Promise<InvalidItem[]> {
  const invalids: InvalidItem[] = [];

  for (const uri of uris) {
    const relativePath = getRelativePathToMain(uri.fsPath, mainLaTeXFile);
    const parts = relativePath.split(path.sep);
    const fileName = parts.pop() || "";

    const fileInvalid = lescape(fileName) !== fileName;
    const folderInvalid = parts.some((part) => lescape(part) !== part);

    if (fileInvalid || folderInvalid) {
      invalids.push({ uri, name: fileName, fileInvalid, inFolder: folderInvalid });
    }
  }

  return invalids;
}

export async function validateAndNormalizeLatexPaths(
  uris: vscode.Uri[],
  mainLaTeXFile: string
): Promise<vscode.Uri[] | null> {
  const uriArrayCleaned = [...uris];
  const invalids = await checkInvalids(uriArrayCleaned, mainLaTeXFile);

  if (invalids.length === 0) return uriArrayCleaned;

  if (invalids.some((item) => item.inFolder)) {
    vscode.window.showErrorMessage(
      "One or more parent folders contain characters not allowed in LaTeX. Insertion aborted."
    );
    await openInvalidsList(invalids.filter((item) => item.inFolder));
    return null;
  }

  if (invalids.length === 1) {
    const { uri: badUri, name } = invalids[0];
    const escaped = lescape(name);
    const onlyUnderscoresEscaped = escaped === name.replace(/_/g, "\\_");

    if (!onlyUnderscoresEscaped) {
      await openInvalidsList(invalids);
      return null;
    }

    const answer = await vscode.window.showInformationMessage(
      `File name '${name}' contains '_' which may cause LaTeX compilation errors. Replace all '_' with '-' on disk?`,
      "Yes",
      "No"
    );

    if (answer !== "Yes") {
      await openInvalidsList(invalids);
      return null;
    }

    const newName = name.replace(/_/g, "-");
    const newFsPath = path.join(path.dirname(badUri.fsPath), newName);
    const newUri = vscode.Uri.file(newFsPath);

    try {
      await vscode.workspace.fs.rename(badUri, newUri);
      const idx = uriArrayCleaned.findIndex((u) => u.fsPath === badUri.fsPath);
      if (idx >= 0) uriArrayCleaned[idx] = newUri;
      vscode.window.showInformationMessage(`Renamed file to '${newName}'. Continuing insertion.`);
      return uriArrayCleaned;
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to rename file: ${err}`);
      await openInvalidsList(invalids);
      return null;
    }
  }

  await openInvalidsList(invalids);
  return null;
}

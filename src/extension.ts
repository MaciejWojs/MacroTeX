import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

async function findMainLaTeXFile(): Promise<string | null> {
  try {
    const files = await vscode.workspace.findFiles('**/*.tex');

    for (const file of files) {
      const content = await vscode.workspace.fs.readFile(file);
      const text = Buffer.from(content).toString('utf-8');

      if (text.includes('\\documentclass')) {
        return replaceWindowsPath(file.fsPath);
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding main LaTeX file:', error);
    return null;
  }
}

// Helper function to process macro signatures
function processMacroSignature(signature: string) {
  let i = 1;
  return signature
    .replace(/\{/g, () => `{$\{${i++}:`)  // Handle required arguments
    .replace(/\[/g, () => `[$\{${i++}:`)  // Handle optional arguments
    .replaceAll('}', "}}")
    .replace(']', '}]');
}

function replaceWindowsPath(_path: string) {
  return _path.replaceAll(path.sep, path.posix.sep);
}

function isImageFile(file: string) {
  file = file.toLowerCase();
  return file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg');
}

let mainLaTeXFile: string | null = null;

export const activate = async (context: vscode.ExtensionContext) => {
  const channel = vscode.window.createOutputChannel("MacroTex");
  channel.appendLine("MacroTex is now active!");
  console.log("Extension MacroTex is now active!");
  mainLaTeXFile = await findMainLaTeXFile();

  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles((e) => {
      for (const file of e.files) {
        if (file.oldUri.fsPath === mainLaTeXFile) {
          const oldMainLaTeXFile = mainLaTeXFile;
          mainLaTeXFile = file.newUri.fsPath;
          console.log(`Main LaTeX file changed from ${oldMainLaTeXFile} to ${mainLaTeXFile}`);
          channel.appendLine(`Main LaTeX file changed from ${oldMainLaTeXFile} to ${mainLaTeXFile}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidDeleteFiles(async (e) => {
      for (const file of e.files) {
        if (file.fsPath === mainLaTeXFile) {
          mainLaTeXFile = await findMainLaTeXFile();
          console.log(`Main LaTeX file deleted, new main LaTeX file: ${mainLaTeXFile}`);
          channel.appendLine(`Main LaTeX file deleted, new main LaTeX file: ${mainLaTeXFile}`);
        }
      }
    })
  )

  // Get the configuration for your extension
  const config = vscode.workspace.getConfiguration('latexMacros');

  // Get the list of macros
  const macrosList: { signature: string, extensions: string[] }[] | undefined = config.get('macrosList');
  if (!macrosList || macrosList.length === 0) {
    vscode.window.showErrorMessage("No macros defined");
    return;
  }

  console.log("Macros loaded", macrosList);
  console.log(mainLaTeXFile);
  channel.appendLine(`MarcoTex: Found ${macrosList.length} macros`);
  channel.appendLine(`MarcoTex: Main LaTeX file: ${mainLaTeXFile}`);
  vscode.window.showInformationMessage(`MarcoTex: Found ${macrosList.length} macros`);

  const normalizeMacroLine = (line: string) => {
    return line
      .trim()
      .replace(/\[.*?\]/g, '[]')
      .replace(/\{.*?\}/g, '{}');
  }

  const disposable = vscode.languages.registerCompletionItemProvider(
    "latex",
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        if (!mainLaTeXFile || !macrosList) return [];  // Early return if data is missing
        let skipSnippets = false
        // Filter macros with "PATH" in the signature only once
        const validMacros = macrosList.filter(macro => macro.signature.includes("PATH"));
        if (validMacros.length === 0) return []; // Early return if no valid macros

        const line = document.lineAt(position).text;
        const linePrefix = normalizeMacroLine(line.substring(0, position.character));
        let completionItems: vscode.CompletionItem[] = [];

        const config = vscode.workspace.getConfiguration('latexMacros');
        if (!config) return [];
        const useFolders = config.get("pathSuggestionsFolderBased") || false
        console.log("useFolderBaseAproach", useFolders)

        // Process each valid macro
        const promises = validMacros.map(async (macro) => {
          const macroFirstPart = normalizeMacroLine(macro.signature.split("PATH")[0]);
          console.log(`${linePrefix} === ${macroFirstPart} -> ${linePrefix === macroFirstPart}`);


          // Only process if the prefix matches
          if (!linePrefix.includes(macroFirstPart)) return;
          else skipSnippets = true

          let typedPath = linePrefix.replace(macroFirstPart, "")
          if (typedPath.endsWith("/")) typedPath = typedPath.slice(0, -1)
          const tempString = `typedPath: ${typedPath}`
          console.log(tempString)
          // channel.appendLine(tempString)

          const extensionsGlob = macro.extensions
            .map(ext => ext.toLowerCase())
            .filter(ext => ["jpg", "jpeg", "png"].includes(ext))
            .join(",");

          const filePromises = [(async () => {
            const searchPattern = !typedPath
            ? `**/*.{${extensionsGlob}}`
            : `**/${typedPath}/**/*.{${extensionsGlob}}`;
            channel.appendLine(`Searching for files with pattern: ${searchPattern}`);
            const uris = await vscode.workspace.findFiles(searchPattern);

            return uris.sort().map(uri => {
              const fsPath = replaceWindowsPath(uri.fsPath)
              const relativePath = replaceWindowsPath(path.relative(path.dirname(mainLaTeXFile!!), fsPath))
              let finalPath = (typedPath === "") ? relativePath : relativePath.replace(typedPath + "/", "")
              if (useFolders === true) {
                finalPath = finalPath.replace(/\/.*$/, "/")
              }

              const kind = isImageFile(finalPath)
                ? vscode.CompletionItemKind.File
                : vscode.CompletionItemKind.Folder;

              const completionItem = new vscode.CompletionItem(replaceWindowsPath(finalPath), kind);

              if (kind === vscode.CompletionItemKind.File) {
                const md = new vscode.MarkdownString(`![${macro.signature}](${uri.toString()}|width=500)`);
                md.supportHtml = true;
                md.isTrusted = true;
                completionItem.documentation = md;
              }

              return completionItem;
            });
          })()];


          // Wait for all filePromises to finish and flatten the result
          const completionItemsForMacro = (await Promise.all(filePromises)).flat();
          if (completionItemsForMacro.length > 0) {
            const itemsToAdd = useFolders
              ? completionItemsForMacro.filter((item, index, self) => index === self.findIndex(t => t.label === item.label))
              : completionItemsForMacro;

            completionItems.push(...itemsToAdd);
          }
        });

        // Wait for all promises to finish before proceeding
        await Promise.all(promises);

        if (skipSnippets) return completionItems

        // Add macro snippets to the completion items
        for (const macro of validMacros) {
          const completionItem = new vscode.CompletionItem(macro.signature, vscode.CompletionItemKind.Method);
          const parts = linePrefix.endsWith('\\') ? macro.signature.substring(1) : macro.signature;
          const processedSignature = processMacroSignature(parts); // Helper function to process the signature

          console.log(processedSignature);
          completionItem.insertText = new vscode.SnippetString(processedSignature);
          completionItem.documentation = new vscode.MarkdownString(
            `macro: ${macro.signature}\n\nPATH is the path to the file eg. rys/rys1.png`
          );

          completionItems.push(completionItem);
        }

        return completionItems;
      },
    });

  context.subscriptions.push(disposable);

  vscode.commands.registerCommand("marcotex.insetToActiveDocument", async (contextSelection: vscode.Uri, uris: vscode.Uri[]) => {
    const config = vscode.workspace.getConfiguration('latexMacros');
    const options = macrosList?.map(macro => macro.signature).filter(macro => macro.includes("PATH"));
    const editor = vscode.window.activeTextEditor;

    if (!config || !editor || !options || !mainLaTeXFile) {
      return;
    }

    const insertClearPage = config.get('insertClearpageInBulk');
    console.log("insertClearPage", insertClearPage);

    const position = editor.selection.active;
    if (!position) return;


    const selectedOption = await vscode.window.showQuickPick(options, {
      placeHolder: 'Select a macro to insert',
    });

    const fileExtensions = macrosList?.find(macro => macro.signature === selectedOption)?.extensions;
    if (!fileExtensions) return;
    const uriArray = Array.isArray(uris) ? uris : [uris];

    // Process URIs: find files in directories or return the URI itself
    const urisArray = await Promise.all(uriArray.map(async (uri) => {
      if (fs.statSync(uri.fsPath).isDirectory()) {
      const extensionsGlob = fileExtensions.join(',');
      const pattern = `**/*.{${extensionsGlob}}`;
      channel.appendLine(`Searching for files with pattern: ${pattern}`);
      const results = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri.fsPath, pattern)
      );
      return results;
      }
      return [uri];
    }));

    // Flatten results and get unique folder paths
    const allUris = urisArray.flat();
    const foldersPaths = [...new Set(allUris.map(uri => path.dirname(uri.fsPath)))];

    // Sort images in each folder
    const sortedImages = await Promise.all(foldersPaths.map(async (folder) => {
      const folderUris = allUris.filter(uri => path.dirname(uri.fsPath) === folder);
      const allNumeric = folderUris.every(uri => /^\d+$/.test(path.basename(uri.fsPath, path.extname(uri.fsPath))));

      if (allNumeric && folderUris.length > 1) {
        folderUris.sort((a, b) => {
          const aNum = parseInt(path.basename(a.fsPath, path.extname(a.fsPath)));
          const bNum = parseInt(path.basename(b.fsPath, path.extname(b.fsPath)));
          return aNum - bNum;
        });
      }

      return folderUris;
    }));

    // Flatten the results after sorting
    const flatSortedImages = sortedImages.flat();

    console.log('sortedImages', flatSortedImages);

    // Filter by valid extensions
    const uriArrayCleaned = flatSortedImages.filter(uri =>
      fileExtensions.includes(path.extname(uri.fsPath).slice(1).toLowerCase())
    );

    console.log('sortedImages', sortedImages);

    console.log(uriArrayCleaned);
    console.log("length", uriArrayCleaned.length);
    if (uriArrayCleaned.length === 0) {
      const message = `Error runing macro: ${selectedOption}\nNo files selected or selected files are not of the correct type: ${fileExtensions.join(', ')}`;
      console.log(message);
      vscode.window.showErrorMessage(message);
      return;
    }

    if (selectedOption) {
      let finalMacros = "";
      let counter = 0;
      for (const uri of uriArrayCleaned) {
        ++counter;

        const relativePathToMain = replaceWindowsPath(path.relative(path.dirname(mainLaTeXFile), uri.fsPath));
        const folderBasename = replaceWindowsPath(path.basename(path.dirname(uri.fsPath)));
        const basename = replaceWindowsPath(path.basename(uri.fsPath).split('.')[0]);

        const captionAndIdentifier = `${folderBasename}-${basename}`;
        const macro = '\n' + selectedOption
          .replace("PATH", relativePathToMain)
          .replace("Identifier", captionAndIdentifier)
          .replace("Caption", captionAndIdentifier)

        finalMacros += macro;
        if (insertClearPage && counter % 2 === 0) finalMacros += '\n\\clearpage\n';
      }
      if (!finalMacros) return;
      if (uriArrayCleaned.length === 1) finalMacros = processMacroSignature(finalMacros)
      const snippet = new vscode.SnippetString(finalMacros);
      editor.insertSnippet(snippet, position);
      vscode.window.showInformationMessage(`Inserted ${counter} macros`);
      console.log(`Inserted ${counter} macros`);
      console.log(uriArrayCleaned.length);
    }
  });


  const hover = vscode.languages.registerHoverProvider('latex', {
    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
      if (!mainLaTeXFile) return undefined;

      const range = document.getWordRangeAtPosition(position, /\{[^}]*\}/);
      if (!range) return undefined;

      const hoverText = document.getText(range).replace(/[\{\}]/g, '');

      if (isImageFile(hoverText)) {
        const fullPath = path.resolve(path.dirname(mainLaTeXFile), hoverText);
        const uri = vscode.Uri.file(fullPath);
        const md = (fs.existsSync(fullPath)) ? `![img](${uri.toString()}|width=500)` : "<h1>File not found in filesystem!</h1>";

        console.log(md);
        const mdString = new vscode.MarkdownString(md);
        mdString.supportHtml = true;
        mdString.isTrusted = true;
        return new vscode.Hover(mdString);
      }
      return undefined;  // Return undefined if there's no hover information
    }
  });

  context.subscriptions.push(hover);

};

export const deactivate = () => { };

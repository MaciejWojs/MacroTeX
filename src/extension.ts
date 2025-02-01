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
        return file.fsPath;
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding main LaTeX file:', error);
    return null;
  }
}

let mainLaTeXFile: string | null = null;

export const activate = async (context: vscode.ExtensionContext) => {
  console.log("Extension MacroTex is now active!");
  mainLaTeXFile = await findMainLaTeXFile();

  context.subscriptions.push(
    vscode.workspace.onDidRenameFiles((e) => {
      for (const file of e.files) {
        if (file.oldUri.fsPath === mainLaTeXFile) {
          const oldMainLaTeXFile = mainLaTeXFile;
          mainLaTeXFile = file.newUri.fsPath;
          console.log(`Main LaTeX file changed from ${oldMainLaTeXFile} to ${mainLaTeXFile}`);
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
        if (!mainLaTeXFile) return [];
        if (!macrosList) return [];

        const line = document.lineAt(position).text;
        let completionItems: vscode.CompletionItem[] = [];
        let linePrefix = normalizeMacroLine(line.substring(0, position.character))

        if (macrosList) {
          let skipSnippet = false;
          const promises = macrosList.map(async (macro) => {
            if (!macro.signature.includes("PATH")) return;
            const macroFirstPart = normalizeMacroLine(macro.signature.split("PATH")[0]);
            // const signature = normalizeMacroLine(macro.signature);
            console.log(`${linePrefix} === ${macroFirstPart} -> ${linePrefix === macroFirstPart}`);
            if (linePrefix === macroFirstPart) {
              skipSnippet = true;
              for (const fileExtension of macro.extensions.map(ext => ext.toLowerCase())) {
                const uris = await vscode.workspace.findFiles(`**/*.${fileExtension}`);
                for (let uri of uris) {
                  const relativePathToMain = path.relative(path.dirname(mainLaTeXFile!!), uri.fsPath);
                  let completionItem = new vscode.CompletionItem(relativePathToMain, vscode.CompletionItemKind.File);
                  if (!["jpg", "jpeg", "png"].includes(fileExtension)) continue;
                  const md = new vscode.MarkdownString(`![${macro.signature}](${uri.toString()}|width=500)`);
                  md.supportHtml = true;
                  md.isTrusted = true
                  console.log(md)
                  completionItem.documentation = md;
                  completionItems.push(completionItem);
                }
              }
            }
          });
          await Promise.all(promises);
          for (const macro of macrosList) {
            if (skipSnippet) break;
            if (!macro.signature.includes("PATH")) continue;

            const completionItem = new vscode.CompletionItem(macro.signature, vscode.CompletionItemKind.Method);
            const parts = (linePrefix.endsWith('\\')) ? macro.signature.substring(1) : macro.signature;

            let i = 1;
            //! Methods chaing order matters
            //* input: \macro[optional]{required} -> output: \macro[${1:optional}]{${2:required}}
            //* edge case: \macro{} -> \macro{${1:}} [Works but ugly] 
            const processedSignature = parts
              .replace(/\{/g, () => `{$\{${i++}:`)
              .replace(/\[/g, () => `[$\{${i++}:`)
              .replaceAll('}', "}}")
              .replace(']', '}]')

            console.log(processedSignature);
            completionItem.insertText = new vscode.SnippetString(processedSignature);
            completionItem.documentation = new vscode.MarkdownString(
              `macro: ${macro.signature}\n\nPATH is the path to the file eg. rys/rys1.png`
            );
            completionItems.push(completionItem);
          }
          return completionItems;
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
        const results = await Promise.all(fileExtensions.map(ext =>
          vscode.workspace.findFiles(new vscode.RelativePattern(uri.fsPath, `**/*.${ext}`))
        ));
        return results.flat();
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

        const relativePathToMain = path.relative(path.dirname(mainLaTeXFile), uri.fsPath);
        const folderBasename = path.basename(path.dirname(uri.fsPath));
        const basename = path.basename(uri.fsPath).split('.')[0];

        const captionAndIdentifier = `${folderBasename}-${basename}`;
        const macro = '\n' + selectedOption
          .replace("PATH", relativePathToMain)
          .replace("Identifier", captionAndIdentifier)
          .replace("Caption", captionAndIdentifier)

        finalMacros += macro;
        if (insertClearPage && counter % 2 === 0) finalMacros += '\n\\clearpage\n';
      }
      if (finalMacros === "") return;
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

      if (hoverText.endsWith('.png') || hoverText.endsWith('.jpg') || hoverText.endsWith('.jpeg')) {
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

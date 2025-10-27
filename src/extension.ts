import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { TableGeneratorBarProvider } from "./TableGeneratorBarProvider";
import { csvAsTableCommand } from "./commands/csvToTable";
import { MacroFinderProvider } from './MacroFinderProvider';
import { MacroConverter } from './utils/MacroConverter';
import { MacroIndex } from './utils/MacroIndex';
import {
  MacroDefinitionProvider,
  MacroImplementationProvider,
  MacroReferenceProvider,
  MacroReferenceCodeLensProvider,
  MacroNameCompletionProvider
} from './providers/MacroNavigationProviders';
import lescape from 'escape-latex';
/**
 * Searches the current workspace for all .tex files and returns a list of file paths that are likely
 * to be main LaTeX files (i.e., files containing a '\documentclass' declaration).
 *
 * The function performs the following steps:
 * 1. Finds all files ending with the .tex extension.
 * 2. Reads the contents of each file and checks for the presence of '\documentclass'.
 * 3. Converts qualifying file paths using a Windows-specific formatting function.
 * 4. Returns a promise that resolves with an array of formatted file paths for main LaTeX files.
 *
 * @returns {Promise<string[]>} A promise that resolves with an array of file paths for the main LaTeX files.
 *
 * @throws Logs an error to the console and returns an empty array if an exception occurs during the search or file processing.
 */
export async function findAllMainLaTeXFiles(): Promise<string[]> {
  try {
    const texFiles = await vscode.workspace.findFiles('**/*.tex');

    // Uproszczone mapowanie i filtrowanie
    const mainFiles = await Promise.all(
      texFiles.map(async file => {
        const content = await vscode.workspace.fs.readFile(file);
        const text = Buffer.from(content).toString('utf-8');
        return text.includes('\\documentclass') ? replaceWindowsPath(file.fsPath) : null;
      })
    );

    return mainFiles.filter((path): path is string => path !== null);
  } catch (error) {
    console.error('Error finding main LaTeX files:', error);
    return [];
  }
}

/**
 * Finds the main LaTeX file that is closest to the current active file.
 *
 * This function determines the active file either from the provided file system path or the active text editor.
 * It then retrieves a list of main LaTeX files—either from the provided array or by dynamically searching for them.
 * The function computes the relative path depth of each main LaTeX file with respect to the active file and returns
 * the file with the smallest depth (i.e., the one closest in terms of directory traversal).
 *
 * @param fsPath - An optional file system path to use instead of the active text editor's file.
 * @param mainLaTeXFiles - An optional array of paths to main LaTeX files.
 * @returns The path of the closest main LaTeX file, or null if no suitable file is found.
 */
export async function findClosestMainLaTeXFile(fsPath?: string, mainLaTeXFiles?: string[]) {
  const activeFile = (!fsPath) ? vscode.window.activeTextEditor?.document.uri.fsPath : fsPath;
  if (!activeFile) return null;

  const files = mainLaTeXFiles || await findAllMainLaTeXFiles();
  if (files.length === 0) return null;

  return files.reduce((closest, file) => {
    const relativePath = replaceWindowsPath(path.relative(file, activeFile));
    const relativeClosest = replaceWindowsPath(path.relative(closest, activeFile));
    const relativePathDepth = relativePath.split('../').length - 1;
    const closestPathDepth = closest ? relativeClosest.split('../').length - 1 : Infinity;
    return relativePathDepth < closestPathDepth ? file : closest;
  });
}

/**
 * Gets the relative path from a file to the main LaTeX file.
 * 
 * @param file - The file to get the relative path to the main LaTeX file
 * @param mainLaTeXFile - The main LaTeX file to get the relative path to
 * @returns The relative path from the file to the main LaTeX file
 */
function getRelativePathToMain(file: string, mainLaTeXFile: string): string;
function getRelativePathToMain(file: string): Promise<string>;

function getRelativePathToMain(file: string, mainLaTeXFile?: string): Promise<string> | string {
  if (mainLaTeXFile) {
    return replaceWindowsPath(path.relative(path.dirname(mainLaTeXFile), file));
  } else {
    const mainFile = findClosestMainLaTeXFile().then(mainFile => {
      if (!mainFile) return "";
      return getRelativePathToMain(file, mainFile);
    });
    return mainFile;
  }
}


/**
 * Transforms a LaTeX macro signature into a VS Code snippet format.
 * 
 * @param signature - The LaTeX macro signature to process (e.g. "\includegraphics[width=\textwidth]{PATH}")
 * @returns A string formatted as a VS Code snippet with placeholders for arguments
 * 
 * @example
 * processMacroSignature("\includegraphics[width=\textwidth]{PATH}")
 * Returns: "\includegraphics[${1:width=\textwidth}]{${2:PATH}}"
 * 
 * The function:
 * - Converts {...} into {${n:...}}
 * - Converts [...] into [${n:...}]
 * - Increments n for each placeholder
 */
function processMacroSignature(signature: string): string {
  let i = 1;
  return signature
    .replace(/\{/g, () => `{$\{${i++}:`)  // Handle required arguments
    .replace(/\[/g, () => `[$\{${i++}:`)  // Handle optional arguments
    .replaceAll('}', "}}")
    .replace(']', '}]');
}

/**
 * Replaces Windows path separators with POSIX path separators.
 * 
 * @param _path - The path to process
 * @returns The path with all Windows path separators replaced with POSIX path separators
 */
function replaceWindowsPath(_path: string): string {
  return _path.replaceAll(path.sep, path.posix.sep);
}

/**
 * Checks if a file is an image file based on its extension.
 * 
 * @param file - The file to check
 * @returns True if the file is an image file, false otherwise
 */
function isImageFile(file: string): boolean {
  const imageExtensions = ['.png', '.jpg', '.jpeg'];
  return imageExtensions.some(ext => file.toLowerCase().endsWith(ext));
}

/**
 * Generates a MarkdownString with an image preview.
 * 
 * @param uri - The URI of the image to preview
 * @param alt - The alt text of the image
 * @param width - The width of the image
 * @returns A MarkdownString with an image preview
 */
function getPreviewImageString(uri: vscode.Uri, alt: string = "img", width: number = 500): vscode.MarkdownString {
  const imgString: string = `![${alt}](${uri.toString()}|width=${width})`;
  return getPreviewMdString(imgString)
}


/**
 * Generates a MarkdownString with the provided string.
 * 
 * @param str - The string to display
 * @returns A MarkdownString with the provided string
 */
function getPreviewMdString(str: string = "img"): vscode.MarkdownString {
  const md = new vscode.MarkdownString(str);
  md.supportHtml = true;
  md.isTrusted = true;
  return md;
}

type MacroConfig = { signature: string; extensions: string[] };

function getConfiguredMacros(): MacroConfig[] {
  const config = vscode.workspace.getConfiguration('latexMacros');
  return config.get<MacroConfig[]>('macrosList', []);
}

// let mainLaTeXFile: string | null = null;

export const activate = async (context: vscode.ExtensionContext) => {
  const channel = vscode.window.createOutputChannel("MacroTex");
  channel.appendLine("MacroTex is now active!");
  console.log("Extension MacroTex is now active!");

  const macroIndex = MacroIndex.getInstance();
  macroIndex.initialize(context, () => findClosestMainLaTeXFile());

  const sidebarProvider = new TableGeneratorBarProvider(context.extensionUri);
  const macroFinderProvider = new MacroFinderProvider(context.extensionUri);

  const dsp2 = vscode.window.registerWebviewViewProvider(TableGeneratorBarProvider.viewType, sidebarProvider);
  const macroFinderDisposable = vscode.window.registerWebviewViewProvider(
    MacroFinderProvider.viewType,
    macroFinderProvider
  );

  const dsp1 = vscode.commands.registerCommand('marcotex.sidebarView.focus', () => {
    vscode.commands.executeCommand('workbench.view.extension.marcotex');
  });

  const dsp3 = vscode.commands.registerCommand("marcotex.showPanel", async () => {
    await vscode.commands.executeCommand('marcotex.sidebarView.focus');
  });

  const showMacroFinderCommand = vscode.commands.registerCommand("marcotex.showMacroFinder", async () => {
    await vscode.commands.executeCommand('workbench.view.extension.marcotex');
    await vscode.commands.executeCommand('marcotex.macroFinder.focus');
  });

  // Komenda do rozwijania makra na definicję
  const expandMacroCommand = vscode.commands.registerCommand("marcotex.expandMacroToDefinition", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage('Please select a macro usage to expand');
      return;
    }

    const selectedText = editor.document.getText(selection);
    const usage = MacroConverter.parseUsageFromSelection(selectedText);

    if (!usage) {
      vscode.window.showWarningMessage('Selected text is not a valid macro usage');
      return;
    }

    // Sprawdź czy makro jest zdefiniowane w konfiguracji
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList = config.get('macrosList', []);

    const isConfiguredMacro = macrosList.some((macro: any) => {
      const macroNameMatch = macro.signature.match(/\\(\w+)/);
      return macroNameMatch && macroNameMatch[1] === usage.name;
    });

    if (!isConfiguredMacro) {
      vscode.window.showWarningMessage(`Macro \\${usage.name} is not defined in configuration. Please add it to latexMacros.macrosList setting.`);
      return;
    }

    try {
      // Użyj konfiguracji do wygenerowania definicji
      const expandedDefinition = await MacroConverter.convertUsageToDefinitionFromConfig(usage);

      if (!expandedDefinition) {
        vscode.window.showWarningMessage(`Could not generate definition for macro \\${usage.name}`);
        return;
      }

      // Zastąp zaznaczony tekst rozwiniętą definicją
      await editor.edit(editBuilder => {
        editBuilder.replace(selection, expandedDefinition);
      });

      vscode.window.showInformationMessage(`Expanded macro \\${usage.name} to its definition`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error expanding macro: ${error}`);
    }
  });

  // Komenda do zwijania definicji na użycie makra
  const collapseMacroCommand = vscode.commands.registerCommand("marcotex.collapseMacroToUsage", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor found');
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      vscode.window.showWarningMessage('Please select a definition to collapse');
      return;
    }

    const selectedText = editor.document.getText(selection);

    try {
      // Automatycznie znajdź pasującą sygnaturę z konfiguracji
      const matchingSignature = await MacroConverter.findMatchingSignatureForDefinition(selectedText);

      if (!matchingSignature) {
        vscode.window.showWarningMessage('No matching macro signature found in configuration for this definition');
        return;
      }

      const collapsedUsage = MacroConverter.convertDefinitionToUsageWithSignature(selectedText, matchingSignature);

      if (!collapsedUsage) {
        vscode.window.showWarningMessage('Could not convert definition to macro usage');
        return;
      }

      // Zastąp zaznaczony tekst użyciem makra
      await editor.edit(editBuilder => {
        editBuilder.replace(selection, collapsedUsage);
      });

      vscode.window.showInformationMessage(`Collapsed definition to macro usage: ${collapsedUsage}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Error collapsing to macro: ${error}`);
    }
  });

  context.subscriptions.push(
    dsp1,
    dsp2,
    dsp3,
    macroFinderDisposable,
    showMacroFinderCommand,
    expandMacroCommand,
    collapseMacroCommand
  );
  const definitionProviderDisposable = vscode.languages.registerDefinitionProvider(
    { language: 'latex' },
    new MacroDefinitionProvider(macroIndex)
  );
  const implementationProviderDisposable = vscode.languages.registerImplementationProvider(
    { language: 'latex' },
    new MacroImplementationProvider(macroIndex)
  );
  const referenceProviderDisposable = vscode.languages.registerReferenceProvider(
    { language: 'latex' },
    new MacroReferenceProvider(macroIndex)
  );
  const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    { language: 'latex' },
    new MacroReferenceCodeLensProvider(macroIndex)
  );
  const macroNameCompletionDisposable = vscode.languages.registerCompletionItemProvider(
    { language: 'latex' },
    new MacroNameCompletionProvider(macroIndex),
    '\\'
  );
  const showMacroReferencesCommand = vscode.commands.registerCommand(
    'marcotex.showMacroReferences',
    async (uri: vscode.Uri, position: vscode.Position, macroName: string) => {
      const references = await macroIndex.findReferences(macroName);
      await vscode.commands.executeCommand('editor.action.showReferences', uri, position, references);
    }
  );
  // Command to open macro definition location from hover link
  const openMacroDefinitionCommand = vscode.commands.registerCommand(
    'marcotex.openMacroDefinition',
    async (filePath: string, line?: number) => {
      try {
        const uri = vscode.Uri.file(filePath);
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, { preview: true });
        if (typeof line === 'number') {
          const targetLine = Math.max(0, line - 1);
          const pos = new vscode.Position(targetLine, 0);
          const sel = new vscode.Selection(pos, pos);
          editor.selection = sel;
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Cannot open macro definition: ${err}`);
      }
    }
  );
  context.subscriptions.push(
    definitionProviderDisposable,
    implementationProviderDisposable,
    referenceProviderDisposable,
    codeLensProviderDisposable,
    macroNameCompletionDisposable,
    showMacroReferencesCommand,
    openMacroDefinitionCommand
  );

  /**
   * Normalizes a macro line by removing specific content within brackets and braces
   * @param line - The input string to normalize
   * @returns A normalized string with bracket/brace contents replaced with empty pairs
   * @example
   * normalizeMacroLine("foo[bar]") // returns "foo[]"
   * normalizeMacroLine("baz{qux}") // returns "baz{}"
   */
  const normalizeMacroLine = (line: string): string => {
    return line
      .trim()
      .replace(/\[.*?\]/g, '[]')
      .replace(/\{.*?\}/g, '{}');
  }

  const registerCompletionItemProvider = vscode.languages.registerCompletionItemProvider(
    "latex",
    {
      async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        const mainLaTeXFile = await findClosestMainLaTeXFile();
        channel.appendLine(`Main LaTeX file: ${mainLaTeXFile}`);
        const config = vscode.workspace.getConfiguration('latexMacros');
        if (!config) return [];
        const macrosList = config.get<{ signature: string; extensions: string[] }[]>('macrosList', []);
        if (!mainLaTeXFile || !macrosList) return [];  // Early return if data is missing
        let skipSnippets = false
        // Filter macros with "PATH" in the signature only once
        const validMacros = macrosList.filter((macro: { signature: string; extensions: string[] }) => macro.signature.includes("PATH"));
        if (validMacros.length === 0) return []; // Early return if no valid macros

        const line = document.lineAt(position).text;
        const linePrefix = normalizeMacroLine(line.substring(0, position.character));
        let completionItems: vscode.CompletionItem[] = [];

        const useFolders = config.get("pathSuggestionsFolderBased") || false
        console.log("useFolderBaseAproach", useFolders)

        // Process each valid macro
        const promises = validMacros.map(async (macro: { signature: string; extensions: string[] }) => {
          const macroFirstPart = normalizeMacroLine(macro.signature.split("PATH")[0]);
          console.log(`${linePrefix} === ${macroFirstPart} -> ${linePrefix === macroFirstPart}`);

          // Only process if the prefix matches
          if (!linePrefix.includes(macroFirstPart)) return;
          else skipSnippets = true

          let typedPath = linePrefix.replace(macroFirstPart, "")
          if (typedPath.endsWith("/")) typedPath = typedPath.slice(0, -1)

          const extensionsGlob = macro.extensions
            .map((ext: string) => ext.toLowerCase())
            // .filter(ext => ["jpg", "jpeg", "png"].includes(ext))
            .join(",");

          const filePromises = [(async () => {
            const searchPattern = !typedPath
              ? `**/*.{${extensionsGlob}}`
              : `**/${typedPath}/**/*.{${extensionsGlob}}`;
            channel.appendLine(`Searching for files with pattern: ${searchPattern}`);
            const uris = await vscode.workspace.findFiles(searchPattern);

            return uris.sort().map(uri => {
              const fsPath = replaceWindowsPath(uri.fsPath)
              // const relativePath = replaceWindowsPath(path.relative(path.dirname(mainLaTeXFile!!), fsPath))
              const relativePath = getRelativePathToMain(fsPath, mainLaTeXFile)
              let finalPath = (typedPath === "") ? relativePath : relativePath.replace(typedPath + "/", "")
              if (useFolders === true) {
                finalPath = finalPath.replace(/\/.*$/, "/")
              }

              const kind = isImageFile(finalPath)
                ? vscode.CompletionItemKind.File
                : vscode.CompletionItemKind.Folder;

              // const filename = path.basename(finalPath, path.extname(finalPath))
              // channel.appendLine(`Found file: ${finalPath} with kind: ${kind} and filename: ${filename}`);

              const sortText = !finalPath.startsWith("../") ? "A" : "B";
              const completionItem = new vscode.CompletionItem(replaceWindowsPath(finalPath), kind);
              completionItem.sortText = sortText

              if (kind === vscode.CompletionItemKind.File) {
                completionItem.documentation = getPreviewImageString(uri, macro.signature);
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
          const completionItem = new vscode.CompletionItem(macro.signature, vscode.CompletionItemKind.Snippet);
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


  vscode.commands.registerCommand("marcotex.insetToActiveDocument", async (_contextSelection: vscode.Uri, uris: vscode.Uri[]) => {
    const mainLaTeXFile = await findClosestMainLaTeXFile();
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList = getConfiguredMacros();
    const options = macrosList?.map((macro: MacroConfig) => macro.signature).filter((sig: string) => sig.includes("PATH"));
    const editor = vscode.window.activeTextEditor;

    if (!config || !editor || !options || !mainLaTeXFile) {
      return;
    }

    const insertClearPage = config.get('insertClearpageInBulk');
    console.log("insertClearPage", insertClearPage);

    const position = editor.selection.active;
    if (!position) return;

    // Determine file extensions to use for filtering macros
    let fileExtensionsToUse: string[] = [];

    if (uris.length === 1 && fs.statSync(uris[0].fsPath).isDirectory()) {
      // If a single directory is selected, find all files inside
      const filesInDir = await vscode.workspace.findFiles(new vscode.RelativePattern(uris[0].fsPath, '**/*'));
      const extensions = [...new Set(filesInDir.map(uri => path.extname(uri.fsPath).slice(1).toLowerCase()))];

      // If all files have the same extension, use that
      if (extensions.length === 1) {
        fileExtensionsToUse = extensions;
      }
    } else if (uris.length > 0 && fs.statSync(uris[0].fsPath).isFile()) {
      // If files are selected directly, use the extension of the first file
      fileExtensionsToUse = [path.extname(uris[0].fsPath).slice(1).toLowerCase()];
    }

    // Filter macros based on file extensions
    const validMacros: MacroConfig[] = fileExtensionsToUse.length > 0
      ? macrosList.filter((macro: MacroConfig) => macro.extensions.some((ext: string) => fileExtensionsToUse.includes(ext)))
      : macrosList;

    // Extract macro signatures with PATH
    const macroOptions = validMacros?.map((macro: MacroConfig) => macro.signature).filter((sig: string) => sig.includes("PATH")) || [];

    if (macroOptions.length === 0) {
      vscode.window.showErrorMessage("No valid macros found for the selected files. Please check the configuration.");
      return;
    }

    // If only one option, use it directly; otherwise ask user to choose
    const selectedOption = macroOptions.length === 1
      ? macroOptions[0]
      : await vscode.window.showQuickPick(macroOptions, {
        placeHolder: 'Select a macro to insert',
      });

    const fileExtensions = macrosList.find((macro: MacroConfig) => macro.signature === selectedOption)?.extensions;
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

    // --- DODANA WALIDACJA NAZW PLIKÓW POD KĄTEM LaTeX ---
    // Helper: open untitled document listing problematic files
    const openInvalidsList = async (items: { uri: vscode.Uri; name?: string; inFolder?: boolean }[]) => {
      const lines = [
        'Files or folders with names incompatible with LaTeX (original -> escaped):',
        ''
      ];
      for (const it of items) {
        const name = it.name ?? path.basename(it.uri.fsPath);
        const escaped = lescape(name);
        const note = it.inFolder ? ' (problem in parent folder)' : '';
        lines.push(`- ${it.uri.fsPath}${note}`);
        lines.push(`  escaped: ${escaped}`);
        lines.push('');
      }
      const content = lines.join('\n');
      try {
        const doc = await vscode.workspace.openTextDocument({ content, language: 'text' });
        await vscode.window.showTextDocument(doc, { preview: false });
        vscode.window.showWarningMessage('Opened a list of invalid file/folder names in a new editor. Please fix names or accept rename and try again.');
      } catch (err) {
        vscode.window.showErrorMessage(`Cannot open list of invalid file names: ${err}`);
      }
    };

    // Check files and their parent folders using lescape
    const checkInvalids = async (uris: vscode.Uri[], mainLaTeXFile: string) => {
      const invalids: { uri: vscode.Uri; name: string; fileInvalid: boolean; inFolder: boolean }[] = [];

      for (const uri of uris) {
        const relativePath = getRelativePathToMain(uri.fsPath, mainLaTeXFile);
        const parts = relativePath.split(path.sep);
        const fileName = parts.pop()!; // ostatni segment to plik

        const fileInvalid = lescape(fileName) !== fileName;
        const folderInvalid = parts.some(part => lescape(part) !== part);

        if (fileInvalid || folderInvalid) {
          invalids.push({
            uri,
            name: fileName,
            fileInvalid,
            inFolder: folderInvalid
          });
        }
      }

      return invalids;
    };

    const invalids = await checkInvalids(uriArrayCleaned, mainLaTeXFile);

    if (invalids.length > 0) {
      // If any problem is in a parent folder -> abort and show list
      if (invalids.some(i => i.inFolder)) {
        vscode.window.showErrorMessage(
          "One or more parent folders contain characters not allowed in LaTeX. Insertion aborted."
        );
        await openInvalidsList(invalids.filter(i => i.inFolder));
        return;
      }

      // Now only single files with problems remain
      if (invalids.length === 1) {
        const { uri: badUri, name } = invalids[0];
        const escaped = lescape(name);
        const onlyUnderscoresEscaped = escaped === name.replace(/_/g, '\\_');

        if (onlyUnderscoresEscaped) {
          const answer = await vscode.window.showInformationMessage(
            `File name '${name}' contains '_' which may cause LaTeX compilation errors. Replace all '_' with '-' on disk?`,
            'Yes',
            'No'
          );

          if (answer === 'Yes') {
            const newName = name.replace(/_/g, '-');
            const newFsPath = path.join(path.dirname(badUri.fsPath), newName);
            const newUri = vscode.Uri.file(newFsPath);

            try {
              await vscode.workspace.fs.rename(badUri, newUri);

              // Update the list for further processing
              const idx = uriArrayCleaned.findIndex(u => u.fsPath === badUri.fsPath);
              if (idx >= 0) uriArrayCleaned[idx] = newUri;

              vscode.window.showInformationMessage(`Renamed file to '${newName}'. Continuing insertion.`);
            } catch (err) {
              vscode.window.showErrorMessage(`Failed to rename file: ${err}`);
              await openInvalidsList(invalids);
              return;
            }
          } else {
            await openInvalidsList(invalids);
            return;
          }
        } else {
          // single file with other invalid characters -> abort and show list
          await openInvalidsList(invalids);
          return;
        }
      } else {
        // multiple invalid files -> abort and show list
        await openInvalidsList(invalids);
        return;
      }
    }
    // --- KONIEC WALIDACJI ---

    if (selectedOption) {
      let finalMacros = "";
      let counter = 0;
      for (const uri of uriArrayCleaned) {
        ++counter;

        const relativePathToMain = getRelativePathToMain(uri.fsPath, mainLaTeXFile);
        const folderBasename = replaceWindowsPath(path.basename(path.dirname(uri.fsPath)));
        const basename = replaceWindowsPath(path.basename(uri.fsPath).split('.')[0]);

        const Caption = basename
        const Identifier = `${folderBasename}-${basename}`.replaceAll(" ", "-");
        const macro = '\n' + selectedOption
          .replace("PATH", relativePathToMain)
          .replace("Identifier", Identifier)
          .replace("Caption", Caption)

        channel.appendLine(`relativePathToMain: ${relativePathToMain}`);

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

  //! TODO: Add a functionality to detect changes in the file system and update the macros in current file scope accordingly

  const onDidDeleteFiles = vscode.workspace.onDidDeleteFiles(async (event) => {
    macroIndex.markWorkspaceDirty();
    const mainLaTeXFiles = await findAllMainLaTeXFiles();
    if (mainLaTeXFiles.length === 0) return;
    channel.appendLine(`Files deleted: ${event.files}`);
    // const mainLaTeXFile = await findClosestMainLaTeXFile();
    const config = vscode.workspace.getConfiguration('latexMacros');
    if (!config) {
      vscode.window.showErrorMessage("No configuration found");
      return;
    }

    const macrosList: { signature: string, extensions: string[] }[] | undefined = config.get('macrosList');
    if (!macrosList || macrosList.length === 0) {
      vscode.window.showErrorMessage("No macros defined");
      return;
    }
    const fileTypes = new Set(...macrosList.map(macro => macro.extensions));
    for (const fileType of fileTypes) {
      channel.appendLine(`Files types: ${fileType}`);
    }

    // Get all deleted non-tex files and find their corresponding LaTeX scopes
    const files = event.files.filter(uri => !uri.fsPath.endsWith('.tex'));
    const scopes = new Set(
      (await Promise.all(files.map(uri => findClosestMainLaTeXFile(uri.fsPath, mainLaTeXFiles))))
        .filter((scope): scope is string => scope !== null)
    );

    // Get base directories for each scope
    const scopeBaseDirs = new Set([...scopes].map(scope => replaceWindowsPath(path.dirname(scope))));

    // Process each base directory
    for (const baseDir of scopeBaseDirs) {
      const mainFile = [...scopes].find(scope => scope.startsWith(baseDir));
      const deletedFiles = files.filter(uri => replaceWindowsPath(uri.fsPath).startsWith(baseDir))
      if (!mainFile || deletedFiles.length === 0) continue;

      const texFiles = (await vscode.workspace.findFiles(new vscode.RelativePattern(baseDir, '**/*.tex')))
      channel.appendLine(`Main file: ${mainFile}`);
      channel.appendLine(`Deleted files:\n ${deletedFiles.join('\n')}`);

      // Process each tex file in the scope
      for (const texFile of texFiles) {
        try {
          const content = await vscode.workspace.fs.readFile(texFile);
          const buffer = Buffer.from(content).toString('utf-8');
          const lines = buffer.split('\n');

          // Comment out lines that reference deleted files
          const updatedLines = lines.map(line => {
            if (line.trim().startsWith('%')) return line;
            const shouldComment = deletedFiles.some(file => {
              const relativePath = getRelativePathToMain(file.fsPath, mainFile);
              return line.includes(relativePath) && macrosList.some(macro =>
                normalizeMacroLine(line).includes(normalizeMacroLine(macro.signature.split('PATH')[0]))
              );
            });
            return shouldComment ? `%${line}` : line;
          });


          const updatedContent = updatedLines.join('\n');
          if (updatedContent !== buffer) {
            // Instead of writing directly to disk, open the document and apply an edit
            const doc = await vscode.workspace.openTextDocument(texFile);
            const fullRange = new vscode.Range(
              doc.positionAt(0),
              doc.lineAt(doc.lineCount - 1).range.end
            );
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (error) {
          console.error('Error processing file:', error);
        }
      }
    }
  });

  const onDidRenameFiles = vscode.workspace.onDidRenameFiles(async (event) => {
    macroIndex.markWorkspaceDirty();
    const mainLaTeXFiles = await findAllMainLaTeXFiles();
    if (mainLaTeXFiles.length === 0) return;
    channel.appendLine(`Files renamed: ${event.files.map(f => f.oldUri.fsPath).join(', ')}`);

    const config = vscode.workspace.getConfiguration('latexMacros');
    if (!config) {
      vscode.window.showErrorMessage("No configuration found");
      return;
    }

    const macrosList: { signature: string, extensions: string[] }[] | undefined = config.get('macrosList');
    if (!macrosList || macrosList.length === 0) {
      vscode.window.showErrorMessage("No macros defined");
      return;
    }

    const fileTypes = new Set(...macrosList.map(macro => macro.extensions));
    for (const fileType of fileTypes) {
      channel.appendLine(`Files types: ${fileType}`);
    }

    // Get all renamed non-tex files and find their corresponding LaTeX scopes
    const renamedFiles = event.files.filter(f => !f.oldUri.fsPath.endsWith('.tex'));
    const scopes = new Set(
      (await Promise.all(renamedFiles.map(f => findClosestMainLaTeXFile(f.oldUri.fsPath, mainLaTeXFiles))))
        .filter((scope): scope is string => scope !== null)
    );

    // Get base directories for each scope
    const scopeBaseDirs = new Set([...scopes].map(scope => replaceWindowsPath(path.dirname(scope))));

    const isMacroInLine = (line: string): boolean => {
      return macrosList.some(macro =>
        normalizeMacroLine(line).includes(normalizeMacroLine(macro.signature.split('PATH')[0]))
      );
    }

    // Process each base directory
    for (const baseDir of scopeBaseDirs) {
      const mainFile = [...scopes].find(scope => scope.startsWith(baseDir));
      const filesInBaseDir = renamedFiles.filter(f => replaceWindowsPath(f.oldUri.fsPath).startsWith(baseDir));
      if (!mainFile || filesInBaseDir.length === 0) continue;

      const texFiles = (await vscode.workspace.findFiles(new vscode.RelativePattern(baseDir, '**/*.tex')));
      channel.appendLine(`Main file: ${mainFile}`);
      channel.appendLine(`Renamed files:\n ${filesInBaseDir.map(f => f.oldUri.fsPath).join('\n')}`);
      // Process each tex file in the scope
      for (const texFile of texFiles) {
        try {
          const content = await vscode.workspace.fs.readFile(texFile);
          const buffer = Buffer.from(content).toString('utf-8');
          const lines = buffer.split('\n');

          // Update lines that reference renamed files
          const updatedLines = lines.map(line => {
            let updatedLine = line;
            for (const file of filesInBaseDir) {
              const oldPath = getRelativePathToMain(file.oldUri.fsPath, mainFile);
              const newPath = getRelativePathToMain(file.newUri.fsPath, mainFile);
              if (line.includes(oldPath) && isMacroInLine(line)) {
                updatedLine = line.replace(oldPath, newPath);
              }
            }
            return updatedLine;
          });

          const updatedContent = updatedLines.join('\n');
          if (updatedContent !== buffer) {
            // Instead of writing directly to disk, open the document and apply an edit
            const doc = await vscode.workspace.openTextDocument(texFile);
            const fullRange = new vscode.Range(
              doc.positionAt(0),
              doc.lineAt(doc.lineCount - 1).range.end
            );
            const edit = new vscode.WorkspaceEdit();
            edit.replace(doc.uri, fullRange, updatedContent);
            await vscode.workspace.applyEdit(edit);
          }
        } catch (error) {
          console.error('Error processing file:', error);
        }
      }
    }
  });

  const registerHoverProvider = vscode.languages.registerHoverProvider('latex', {
    async provideHover(document: vscode.TextDocument, position: vscode.Position) {
      // 1) Hover over macro name (e.g., \fg) -> show its definition
      const macroRange = document.getWordRangeAtPosition(position, /\\[A-Za-z@]+/);
      if (macroRange) {
        const word = document.getText(macroRange);
        const macroName = word.replace(/^\\/, '');
        try {
          const def = await macroIndex.getMacroDefinition(macroName);
          if (def) {
            // Reconstruct a readable definition header
            let header = '';
            if (def.type === 'newcommand' || def.type === 'newcommand*' || def.type === 'renewcommand' || def.type === 'renewcommand*') {
              const params = def.parameters > 0 ? ` [${def.parameters}]` : '';
              const defVal = def.defaultValue ? ` [${def.defaultValue}]` : '';
              header = `\\${def.type.replace('*', '\\*')} {\\${def.name}}${params}${defVal}`;
            } else if (def.type === 'def') {
              // For \def we may not know exact parameter tokenization, show count only
              const params = def.parameters > 0 ? ` (#1..#${def.parameters})` : '';
              header = `\\def \\${def.name}${params}`;
            }

            const linkArgs = encodeURIComponent(JSON.stringify([def.location.file, def.location.line]));
            const clickableLink = `[here](command:marcotex.openMacroDefinition?${linkArgs})`;
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.supportHtml = true;
            const code = `${header}{\n${def.definition}\n}`;
            md.appendMarkdown(`Defined ${clickableLink}`);
            md.appendCodeblock(code, 'latex');
            return new vscode.Hover(md, macroRange);
          }
        } catch (e) {
          // ignore and fall through to other hovers
        }
      }

      // 2) Hover over path inside braces -> show image preview if it resolves to an image
      const mainLaTeXFile = await findClosestMainLaTeXFile();
      const braceRange = document.getWordRangeAtPosition(position, /\{[^}]*\}/);
      if (!mainLaTeXFile || !braceRange) return undefined;

      const hoverText = document.getText(braceRange).replace(/[\{\}]/g, '');

      if (isImageFile(hoverText)) {
        const fullPath = path.resolve(path.dirname(mainLaTeXFile), hoverText);
        const uri = vscode.Uri.file(fullPath);
        const md = (fs.existsSync(fullPath)) ?
          getPreviewImageString(uri) :
          getPreviewMdString("<h1>File not found in filesystem!</h1>");

        return new vscode.Hover(md, braceRange);
      }
      return undefined;  // Return undefined if there's no hover information
    }
  });


  // context.subscriptions.push(onDidDeleteFiles, onDidRenameFiles, registerHoverProvider, registerCompletionItemProvider);
  vscode.commands.registerCommand("marcotex.insertCsvAsTable", csvAsTableCommand);
  context.subscriptions.push(onDidDeleteFiles, onDidRenameFiles, registerHoverProvider, registerCompletionItemProvider);
  context.subscriptions.push(definitionProviderDisposable, implementationProviderDisposable, referenceProviderDisposable, codeLensProviderDisposable, macroNameCompletionDisposable, showMacroReferencesCommand);
};

export const deactivate = () => { }
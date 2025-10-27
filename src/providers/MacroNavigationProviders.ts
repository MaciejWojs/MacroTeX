import * as vscode from 'vscode';
import { MacroIndex } from '../utils/MacroIndex';
import { MacroParser } from '../utils/MacroParser';

interface MacroLookup {
  name: string;
  range: vscode.Range;
}

function extractMacroName(document: vscode.TextDocument, position: vscode.Position): MacroLookup | null {
  const directRange = document.getWordRangeAtPosition(position, /\\[A-Za-z@]+/);
  if (directRange) {
    const name = document.getText(directRange).slice(1);
    return { name, range: directRange };
  }

  if (position.character === 0) return null;
  const fallbackPos = position.translate(0, -1);
  const fallbackRange = document.getWordRangeAtPosition(fallbackPos, /\\[A-Za-z@]+/);
  if (fallbackRange && fallbackRange.end.isAfter(position)) {
    const name = document.getText(fallbackRange).slice(1);
    return { name, range: fallbackRange };
  }

  return null;
}

export class MacroDefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly index: MacroIndex) {}

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Definition | undefined> {
    const lookup = extractMacroName(document, position);
    if (!lookup) return undefined;

    const definitions = await this.index.getMacroDefinitions(lookup.name);
    if (definitions.length === 0) return undefined;

    return definitions.map(def => new vscode.Location(
      vscode.Uri.file(def.location.file),
      new vscode.Position(def.location.line - 1, def.location.column)
    ));
  }
}

export class MacroImplementationProvider implements vscode.ImplementationProvider {
  constructor(private readonly index: MacroIndex) {}

  async provideImplementation(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | undefined> {
    const lookup = extractMacroName(document, position);
    if (!lookup) return undefined;

    const definitions = await this.index.getMacroDefinitions(lookup.name);
    if (definitions.length === 0) return undefined;

    return definitions.map(def => new vscode.Location(
      vscode.Uri.file(def.location.file),
      new vscode.Position(def.location.line - 1, def.location.column)
    ));
  }
}

export class MacroReferenceProvider implements vscode.ReferenceProvider {
  constructor(private readonly index: MacroIndex) {}

  async provideReferences(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.ReferenceContext
  ): Promise<vscode.Location[] | undefined> {
    const lookup = extractMacroName(document, position);
    if (!lookup) return undefined;

    const references = await this.index.findReferences(lookup.name);
    if (context.includeDeclaration) return references;

    const definitions = await this.index.getMacroDefinitions(lookup.name);
    const definitionKeys = new Set(
      definitions.map(def => `${def.location.file}:${def.location.line - 1}:${def.location.column}`)
    );

    return references.filter(ref => {
      const key = `${ref.uri.fsPath}:${ref.range.start.line}:${ref.range.start.character}`;
      return !definitionKeys.has(key);
    });
  }
}

export class MacroReferenceCodeLensProvider implements vscode.CodeLensProvider {
  constructor(private readonly index: MacroIndex) {}

  async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
    if (document.languageId !== 'latex') return [];

    const macros = MacroParser
      .parseMacrosFromDocument(document)
      .filter(macro => macro.location.file === document.uri.fsPath);

    if (macros.length === 0) return [];

    const lenses: vscode.CodeLens[] = [];
    for (const macro of macros) {
      if (token.isCancellationRequested) break;

      const references = await this.index.findReferences(macro.name);
      const definitionKey = `${macro.location.file}:${macro.location.line - 1}:${macro.location.column}`;
      const count = references.filter(ref => {
        const key = `${ref.uri.fsPath}:${ref.range.start.line}:${ref.range.start.character}`;
        return key !== definitionKey;
      }).length;

      const title = count === 1 ? '1 reference' : `${count} references`;
      const range = new vscode.Range(
        new vscode.Position(macro.location.line - 1, 0),
        new vscode.Position(macro.location.line - 1, 0)
      );

      lenses.push(new vscode.CodeLens(range, {
        title,
        command: 'marcotex.showMacroReferences',
        arguments: [
          document.uri,
          new vscode.Position(macro.location.line - 1, macro.location.column),
          macro.name
        ]
      }));
    }

    return lenses;
  }
}

export class MacroNameCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly index: MacroIndex) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ): Promise<vscode.CompletionItem[] | undefined> {
    if (document.languageId !== 'latex') return undefined;

    const linePrefix = document.lineAt(position).text.slice(0, position.character);
    const lastSlash = linePrefix.lastIndexOf('\\');
    if (lastSlash === -1) return undefined;

    const typed = linePrefix.slice(lastSlash + 1);
    if (!/^[A-Za-z@]*$/.test(typed)) return undefined;

    const macros = await this.index.getAllMacros();
    if (macros.length === 0) return undefined;

    const seen = new Set<string>();
    const items: vscode.CompletionItem[] = [];

    for (const macro of macros) {
      if (seen.has(macro.name)) continue;
      seen.add(macro.name);

      const snippet = MacroNameCompletionProvider.buildSnippet(macro.parameters);
      const item = new vscode.CompletionItem(macro.name, vscode.CompletionItemKind.Function);
      item.insertText = new vscode.SnippetString(`${macro.name}${snippet}`);
      item.detail = `\\${macro.name}`;
      item.range = new vscode.Range(position.line, lastSlash + 1, position.line, position.character);
      item.filterText = `\\${macro.name}`;
      item.sortText = `0_${macro.name}`;

      if (macro.definition) {
        item.documentation = new vscode.MarkdownString(`\`\`\`latex\n${macro.definition}\n\`\`\``);
      }

      items.push(item);
    }

    return items;
  }

  private static buildSnippet(paramCount: number): string {
    if (paramCount <= 0) return '';
    const parts: string[] = [];
    for (let i = 1; i <= paramCount; i++) {
      parts.push(`{\${${i}:arg${i}}}`);
    }
    return parts.join('');
  }
}

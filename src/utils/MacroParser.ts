import * as vscode from 'vscode';
import * as path from 'path';

export interface MacroDefinition {
  name: string;
  definition: string;
  parameters: number;
  location: {
    file: string;
    line: number;
    column: number;
  };
  type: 'newcommand' | 'newcommand*' | 'renewcommand' | 'renewcommand*' | 'def';
  // If the macro declares an optional first argument (e.g. [\textwidth]) this contains its default
  defaultValue?: string | null;
}

export class MacroParser {

  static async findMacrosInFile(filePath: string): Promise<MacroDefinition[]> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString('utf-8');

      const macros: MacroDefinition[] = [];

      // Znajdź wszystkie makra używając zaawansowanego parsera
      macros.push(...this.parseNewCommands(text, filePath));
      macros.push(...this.parseRenewCommands(text, filePath));
      macros.push(...this.parseDefCommands(text, filePath));

      return macros;
    } catch (error) {
      console.error(`Error parsing macros in file ${filePath}:`, error);
      return [];
    }
  }

  private static parseNewCommands(text: string, filePath: string): MacroDefinition[] {
    const macros: MacroDefinition[] = [];

    // Pattern dla \newcommand i \newcommand* - bez sprawdzania co jest po {
    const pattern = /\\newcommand(\*?)\s*\{\s*\\([^}]+)\s*\}(?:\s*\[(\d+)\])?(?:\s*\[([^\]]*)\])?\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const isStarred = match[1] === '*';
      const macroName = match[2];
      const paramCount = parseInt(match[3] || '0');
      const defaultValue = match[4] || null; // Opcjonalna wartość domyślna
      const startPos = match.index;

      // Znajdź początek definicji (ostatni nawias otwierający w dopasowaniu)
      const matchText = match[0];
      const lastBraceIndex = matchText.lastIndexOf('{');
      const definitionStart = startPos + lastBraceIndex;

      const definition = this.extractBalancedBraces(text, definitionStart);

      if (definition !== null) {
        const location = this.getLocationFromPosition(text, startPos);

        macros.push({
          name: macroName,
          definition: definition.trim(),
          parameters: paramCount,
          location: {
            file: filePath,
            line: location.line,
            column: location.column
          },
          type: isStarred ? 'newcommand*' : 'newcommand',
          defaultValue
        });
      }
    }

    return macros;
  }

  private static parseRenewCommands(text: string, filePath: string): MacroDefinition[] {
    const macros: MacroDefinition[] = [];

    // Pattern dla \renewcommand i \renewcommand*
    const pattern = /\\renewcommand(\*?)\s*\{\s*\\([^}]+)\s*\}(?:\s*\[(\d+)\])?(?:\s*\[([^\]]*)\])?\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const isStarred = match[1] === '*';
      const macroName = match[2];
      const paramCount = parseInt(match[3] || '0');
      const defaultValue = match[4] || null;
      const startPos = match.index;

      // Znajdź początek definicji
      const matchText = match[0];
      const lastBraceIndex = matchText.lastIndexOf('{');
      const definitionStart = startPos + lastBraceIndex;

      const definition = this.extractBalancedBraces(text, definitionStart);

      if (definition !== null) {
        const location = this.getLocationFromPosition(text, startPos);

        macros.push({
          name: macroName,
          definition: definition.trim(),
          parameters: paramCount,
          location: {
            file: filePath,
            line: location.line,
            column: location.column
          },
          type: isStarred ? 'renewcommand*' : 'renewcommand',
          defaultValue
        });
      }
    }

    return macros;
  }

  private static parseDefCommands(text: string, filePath: string): MacroDefinition[] {
    const macros: MacroDefinition[] = [];

    // Pattern dla \def - obsługuje parametry w stylu #1#2#3
    const pattern = /\\def\s*\\([^{#\s]+)([^{]*?)\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const macroName = match[1];
      const params = match[2];
      const startPos = match.index;

      // Policz parametry na podstawie #1, #2, etc.
      const paramCount = this.countDefParameters(match[0] + ' dummy}'); // Dodaj dummy aby regex działał

      // Znajdź początek definicji
      const matchText = match[0];
      const lastBraceIndex = matchText.lastIndexOf('{');
      const definitionStart = startPos + lastBraceIndex;

      const definition = this.extractBalancedBraces(text, definitionStart);

      if (definition !== null) {
        const location = this.getLocationFromPosition(text, startPos);

        macros.push({
          name: macroName,
          definition: definition.trim(),
          parameters: paramCount,
          location: {
            file: filePath,
            line: location.line,
            column: location.column
          },
          type: 'def'
        });
      }
    }

    return macros;
  }

  private static extractBalancedBraces(text: string, start: number): string | null {
    if (start < 0 || start >= text.length || text[start] !== '{') {
      return null;
    }

    let braceCount = 1;
    let pos = start + 1;
    let escaped = false;

    while (pos < text.length && braceCount > 0) {
      const char = text[pos];

      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
      }

      pos++;
    }

    if (braceCount === 0) {
      return text.substring(start + 1, pos - 1);
    }

    return null;
  }

  private static countDefParameters(fullMatch: string): number {
    // Szukaj wzorców #1, #2, #3, etc. w całym dopasowaniu
    const matches = fullMatch.match(/#(\d+)/g);
    if (!matches) return 0;

    const numbers = matches.map(match => parseInt(match.substring(1)));
    return Math.max(...numbers, 0);
  }

  private static getLocationFromPosition(text: string, position: number): { line: number; column: number } {
    const beforePosition = text.substring(0, position);
    const lines = beforePosition.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length;

    return { line, column };
  }

  static async findAllMacrosInProject(mainFile: string): Promise<MacroDefinition[]> {
    const allMacros: MacroDefinition[] = [];
    const processedFiles = new Set<string>();

    // Find all .tex files in the project
    const baseDir = path.dirname(mainFile);
    const texFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(baseDir, '**/*.tex')
    );

    // Process each file
    for (const uri of texFiles) {
      if (!processedFiles.has(uri.fsPath)) {
        processedFiles.add(uri.fsPath);
        const macros = await this.findMacrosInFile(uri.fsPath);
        allMacros.push(...macros);
      }
    }

    return allMacros;
  }

  // Metoda pomocnicza do debugowania - ulepszona
  static async debugMacrosParsing(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const content = await vscode.workspace.fs.readFile(uri);
      const text = Buffer.from(content).toString('utf-8');

      console.log('=== MACRO PARSING DEBUG ===');
      console.log('File:', filePath);
      console.log('Content length:', text.length);
      console.log('Content preview:', text.substring(0, 200) + '...');

      // Test pattern dla newcommand*
      const newcommandPattern = /\\newcommand(\*?)\s*\{\s*\\([^}]+)\s*\}(?:\s*\[(\d+)\])?(?:\s*\[([^\]]*)\])?\s*\{/g;
      console.log('\n=== Testing newcommand pattern ===');
      let match;
      newcommandPattern.lastIndex = 0;
      while ((match = newcommandPattern.exec(text)) !== null) {
        console.log('Match found:');
        console.log('  Full match:', JSON.stringify(match[0]));
        console.log('  Star:', match[1]);
        console.log('  Name:', match[2]);
        console.log('  Params:', match[3]);
        console.log('  Default:', match[4]);
        console.log('  Position:', match.index);

        // Test ekstraktowania definicji
        const matchText = match[0];
        const lastBraceIndex = matchText.lastIndexOf('{');
        const definitionStart = match.index + lastBraceIndex;
        const definition = this.extractBalancedBraces(text, definitionStart);
        console.log('  Definition extracted:', definition ? 'YES' : 'NO');
        if (definition) {
          console.log('  Definition length:', definition.length);
          console.log('  Definition preview:', definition.substring(0, 100) + (definition.length > 100 ? '...' : ''));
        }
      }

      console.log('\n=== FINAL PARSED MACROS ===');
      const macros = await this.findMacrosInFile(filePath);
      console.log('Total macros found:', macros.length);
      macros.forEach((macro, index) => {
        console.log(`\n${index + 1}. ${macro.type}: \\${macro.name} [${macro.parameters} params]`);
        console.log(`   Location: line ${macro.location.line}, col ${macro.location.column}`);
        console.log(`   Definition: ${macro.definition.substring(0, 150)}${macro.definition.length > 150 ? '...' : ''}`);
      });

    } catch (error) {
      console.error('Debug error:', error);
    }
  }
}
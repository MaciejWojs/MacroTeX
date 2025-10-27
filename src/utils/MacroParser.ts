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
      const document = await vscode.workspace.openTextDocument(uri);
      
      return this.parseMacrosFromDocument(document);
    } catch (error) {
      console.error(`Error parsing macros in file ${filePath}:`, error);
      return [];
    }
  }

  static parseMacrosFromDocument(document: vscode.TextDocument): MacroDefinition[] {
    const text = document.getText();
    const filePath = document.uri.fsPath;
    const macros: MacroDefinition[] = [];

    macros.push(...this.parseCommandPattern(text, filePath, document, 'newcommand'));
    macros.push(...this.parseCommandPattern(text, filePath, document, 'renewcommand'));
    macros.push(...this.parseDefCommands(text, filePath, document));

    return macros;
  }

  static parseMacrosFromText(text: string, filePath: string): MacroDefinition[] {
    // Fallback for when we don't have a document
    const macros: MacroDefinition[] = [];

    macros.push(...this.parseCommandPatternLegacy(text, filePath, 'newcommand'));
    macros.push(...this.parseCommandPatternLegacy(text, filePath, 'renewcommand'));
    macros.push(...this.parseDefCommandsLegacy(text, filePath));

    return macros;
  }

  /**
   * Unified parser for \newcommand and \renewcommand (and their starred variants)
   */
  private static parseCommandPattern(
    text: string, 
    filePath: string, 
    document: vscode.TextDocument,
    commandType: 'newcommand' | 'renewcommand'
  ): MacroDefinition[] {
    const macros: MacroDefinition[] = [];
    const pattern = new RegExp(`\\\\${commandType}(\\*?)\\s*\\{\\s*\\\\([^}]+)\\s*\\}(?:\\s*\\[(\\d+)\\])?(?:\\s*\\[([^\\]]*)\\])?\\s*\\{`, 'g');
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const definition = this.extractBalancedBraces(text, match.index + match[0].lastIndexOf('{'));
      
      if (definition !== null) {
        const position = document.positionAt(match.index);
        const isStarred = match[1] === '*';

        macros.push({
          name: match[2],
          definition: definition.trim(),
          parameters: parseInt(match[3] || '0'),
          location: {
            file: filePath,
            line: position.line + 1,
            column: position.character
          },
          type: isStarred ? `${commandType}*` as const : commandType,
          defaultValue: match[4] || null
        });
      }
    }

    return macros;
  }

  /**
   * Legacy version for parsing without document (backward compatibility)
   */
  private static parseCommandPatternLegacy(
    text: string, 
    filePath: string,
    commandType: 'newcommand' | 'renewcommand'
  ): MacroDefinition[] {
    const macros: MacroDefinition[] = [];
    const pattern = new RegExp(`\\\\${commandType}(\\*?)\\s*\\{\\s*\\\\([^}]+)\\s*\\}(?:\\s*\\[(\\d+)\\])?(?:\\s*\\[([^\\]]*)\\])?\\s*\\{`, 'g');
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const definition = this.extractBalancedBraces(text, match.index + match[0].lastIndexOf('{'));
      
      if (definition !== null) {
        const location = this.getLocationFromPosition(text, match.index);
        const isStarred = match[1] === '*';

        macros.push({
          name: match[2],
          definition: definition.trim(),
          parameters: parseInt(match[3] || '0'),
          location: {
            file: filePath,
            line: location.line,
            column: location.column
          },
          type: isStarred ? `${commandType}*` as const : commandType,
          defaultValue: match[4] || null
        });
      }
    }

    return macros;
  }

  private static parseDefCommands(text: string, filePath: string, document: vscode.TextDocument): MacroDefinition[] {
    const macros: MacroDefinition[] = [];
    const pattern = /\\def\s*\\([^{#\s]+)([^{]*?)\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const definition = this.extractBalancedBraces(text, match.index + match[0].lastIndexOf('{'));

      if (definition !== null) {
        const position = document.positionAt(match.index);
        const paramCount = this.countDefParameters(match[0] + ' dummy}');

        macros.push({
          name: match[1],
          definition: definition.trim(),
          parameters: paramCount,
          location: {
            file: filePath,
            line: position.line + 1,
            column: position.character
          },
          type: 'def'
        });
      }
    }

    return macros;
  }

  private static parseDefCommandsLegacy(text: string, filePath: string): MacroDefinition[] {
    const macros: MacroDefinition[] = [];
    const pattern = /\\def\s*\\([^{#\s]+)([^{]*?)\s*\{/g;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const definition = this.extractBalancedBraces(text, match.index + match[0].lastIndexOf('{'));

      if (definition !== null) {
        const location = this.getLocationFromPosition(text, match.index);
        const paramCount = this.countDefParameters(match[0] + ' dummy}');

        macros.push({
          name: match[1],
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
    const baseDir = path.dirname(mainFile);
    
    // Find all .tex files in the project using glob pattern
    const texFiles = await vscode.workspace.findFiles(
      new vscode.RelativePattern(baseDir, '**/*.tex'),
      '**/node_modules/**' // exclude node_modules
    );

    // Process files in parallel for better performance
    const macroPromises = texFiles.map(uri => this.findMacrosInFile(uri.fsPath));
    const results = await Promise.all(macroPromises);
    
    // Flatten results
    for (const macros of results) {
      allMacros.push(...macros);
    }

    return allMacros;
  }

  // Metoda pomocnicza do debugowania - ulepszona
  static async debugMacrosParsing(filePath: string): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const text = document.getText();

      console.log('=== MACRO PARSING DEBUG ===');
      console.log('File:', filePath);
      console.log('Lines:', document.lineCount);
      console.log('Content length:', text.length);
      console.log('Content preview:', text.substring(0, 200) + '...');

      // Test pattern dla newcommand*
      const newcommandPattern = /\\newcommand(\*?)\s*\{\s*\\([^}]+)\s*\}(?:\s*\[(\d+)\])?(?:\s*\[([^\]]*)\])?\s*\{/g;
      console.log('\n=== Testing newcommand pattern ===');
      let match;
      newcommandPattern.lastIndex = 0;
      
      while ((match = newcommandPattern.exec(text)) !== null) {
        const position = document.positionAt(match.index);
        const matchText = match[0];
        const lastBraceIndex = matchText.lastIndexOf('{');
        const definitionStart = match.index + lastBraceIndex;
        const definition = this.extractBalancedBraces(text, definitionStart);
        
        console.log('Match found:');
        console.log('  Full match:', JSON.stringify(match[0]));
        console.log('  Star:', match[1]);
        console.log('  Name:', match[2]);
        console.log('  Params:', match[3]);
        console.log('  Default:', match[4]);
        console.log('  Position:', `Line ${position.line + 1}, Col ${position.character}`);
        console.log('  Definition extracted:', definition ? 'YES' : 'NO');
        
        if (definition) {
          console.log('  Definition length:', definition.length);
          console.log('  Definition preview:', definition.substring(0, 100) + (definition.length > 100 ? '...' : ''));
        }
      }

      console.log('\n=== FINAL PARSED MACROS ===');
      const macros = this.parseMacrosFromDocument(document);
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
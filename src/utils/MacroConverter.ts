import * as vscode from 'vscode';
import type { MacroDefinition } from './MacroParser';
import { MacroIndex } from './MacroIndex';

export interface MacroUsage {
  name: string;
  parameters: string[];
  optionalParam?: string;
  fullText: string;
  range: vscode.Range;
}

export interface MacroSignatureConfig {
  signature: string;
  extensions: string[];
  type?: 'figure' | 'table' | 'listing' | 'generic';
  // Prosty tryb pozycyjny - bierze parametry w kolejności występowania w definicji
  extractionMode?: 'positional' | 'smart'; // domyślnie 'smart'
}

export class MacroConverter {
  /**
   * Parsuje użycie makra z zaznaczonego tekstu
   */
  static parseUsageFromSelection(text: string): MacroUsage | null {
    // Pattern dla użycia makra: \macroname[optional]{param1}{param2}...
    const usagePattern = /\\([a-zA-Z]+)(?:\[([^\]]*)\])?(\{[^}]*\})*(\{[^}]*\})*/g;
    const match = usagePattern.exec(text.trim());
    
    if (!match) return null;

    const name = match[1];
    const fullText = match[0];
    
    // Wyciągnij parametry opcjonalne i obowiązkowe
    const parameters: string[] = [];
    
    // Znajdź opcjonalny parametr w nawiasach kwadratowych
    const optionalParamMatch = text.match(/\\[a-zA-Z]+\[([^\]]*)\]/);
    let optionalParam: string | undefined = undefined;
    if (optionalParamMatch) {
      optionalParam = optionalParamMatch[1];
    }
    
    // Znajdź wszystkie parametry w nawiasach klamrowych w poprawnej kolejności
    const textAfterOptional = optionalParam ? text.replace(/\[[^\]]*\]/, '') : text;
    const braceParamPattern = /\{([^}]*)\}/g;
    let paramMatch;
    
    while ((paramMatch = braceParamPattern.exec(textAfterOptional)) !== null) {
      parameters.push(paramMatch[1]);
    }

    return {
      name,
      parameters,
      optionalParam,
      fullText,
      range: new vscode.Range(0, 0, 0, fullText.length) // Zostanie zaktualizowane
    };
  }

  /**
   * Konwertuje użycie makra na jego pełną definicję na podstawie konfiguracji
   */
  static async convertUsageToDefinition(usage: MacroUsage, macroDefinition: MacroDefinition): Promise<string> {
    let definition = macroDefinition.definition;
    
    // Zastąp parametry (#1, #2, etc.) wartościami z użycia
    for (let i = 0; i < usage.parameters.length; i++) {
      const paramPlaceholder = `#${i + 1}`;
      const paramValue = usage.parameters[i];
      definition = definition.replace(new RegExp(`\\${paramPlaceholder}\\b`, 'g'), paramValue);
    }
    
    return definition;
  }

  /**
   * Konwertuje użycie makra z konfiguracji na pełną definicję
   */
  static async convertUsageToDefinitionFromConfig(usage: MacroUsage): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList: MacroSignatureConfig[] = config.get('macrosList') || [];
    
    // Znajdź pasującą sygnaturę w konfiguracji
    const matchingSignature = macrosList.find(signature => {
      const macroNameMatch = signature.signature.match(/\\(\w+)/);
      return macroNameMatch && macroNameMatch[1] === usage.name;
    });
    
    if (!matchingSignature) {
      return null;
    }
    
    // Znajdź rzeczywistą definicję makra w projekcie
    const macroDefinition = await this.findMacroDefinition(usage.name);
    
    if (!macroDefinition) {
      throw new Error(`Macro \\${usage.name} is defined in configuration but not found in project files. Please define this macro in your LaTeX files first.`);
    }
    
    // Mapuj parametry na podstawie sygnatury konfiguracji i rzeczywistej definicji (np. czy makro ma opcjonalny pierwszy argument)
    const parameterMapping = this.mapParametersFromSignature(matchingSignature.signature, usage.parameters, usage.optionalParam, macroDefinition);

    // Użyj rzeczywistej definicji jako szablonu
    return this.expandMacroDefinitionWithParameterMapping(macroDefinition.definition, parameterMapping);
  }

  /**
   * Mapuje parametry z użycia makra na podstawie sygnatury konfiguracji
   * 
   * @param signature - Sygnatura z konfiguracji np. "\\fg{PATH}{Caption}{Identifier}" lub "\\MojeMakro{#1}{#2}{#3}"
   * @param parameters - Parametry z użycia makra
   * @param optionalParam - Opcjonalny parametr z użycia makra
   * @returns Mapowanie pozycji parametrów w rzeczywistej definicji na wartości
   */
  private static mapParametersFromSignature(signature: string, parameters: string[], optionalParam: string | undefined, macroDefinition: MacroDefinition): Map<number, string> {
    const mapping = new Map<number, string>();

    // Sprawdź czy to notacja LaTeX ({#1}, {#2}, {#3})
    if (this.isLatexStyleSignature(signature)) {
      return this.mapParametersFromLatexSignature(signature, parameters, optionalParam, macroDefinition);
    }

    // Extract placeholders order from signature (e.g. PATH, Caption, Identifier)
    const placeholderPattern = /\{(\w+)\}|\[(\w+)\]/g;
    const placeholders: string[] = [];
    let match;
    while ((match = placeholderPattern.exec(signature)) !== null) {
      placeholders.push(match[1] || match[2]);
    }

    const hasOptionalInDefinition = !!(macroDefinition.defaultValue);

    // Build args array indexed by 1..n where index 1 may be the optional default
    const args: (string | undefined)[] = [];

    if (hasOptionalInDefinition) {
      // #1 is optional: prefer explicit optionalParam, fallback to macroDefinition.defaultValue
      args[1] = optionalParam || macroDefinition.defaultValue || undefined;
    }

    // Fill mandatory args in order according to placeholders
    for (let i = 0; i < placeholders.length; i++) {
      const targetIndex = (hasOptionalInDefinition ? 2 : 1) + i;
      args[targetIndex] = parameters[i];
    }

    // Convert to mapping Map<number,string>
    for (let i = 1; i < args.length; i++) {
      if (args[i] !== undefined) mapping.set(i, args[i] as string);
    }

    return mapping;
  }

  /**
   * Mapuje parametry dla notacji LaTeX ({#1}, {#2}, {#3})
   */
  private static mapParametersFromLatexSignature(signature: string, parameters: string[], optionalParam: string | undefined, macroDefinition: MacroDefinition): Map<number, string> {
    const mapping = new Map<number, string>();

    const hasOptionalInDefinition = !!(macroDefinition.defaultValue);

    // Obsłuż opcjonalny parametr jeśli makro go ma
    if (hasOptionalInDefinition) {
      // #1 to opcjonalny parametr
      const optionalValue = optionalParam || macroDefinition.defaultValue || '';
      mapping.set(1, optionalValue);
    }

    // Mapuj parametry 1:1 - pierwszy parametr użycia → #1 (lub #2 jeśli jest opcjonalny)
    const startPosition = hasOptionalInDefinition ? 2 : 1;
    for (let i = 0; i < parameters.length; i++) {
      const position = startPosition + i;
      mapping.set(position, parameters[i]);
    }

    return mapping;
  }

  /**
   * Rozwija definicję makra podstawiając parametry według mapowania
   */
  private static expandMacroDefinitionWithParameterMapping(definition: string, parameterMapping: Map<number, string>): string {
    let result = definition;

    // Replace in descending order to avoid partial collisions (#1 vs #10)
    const positions = Array.from(parameterMapping.keys()).sort((a, b) => b - a);
    for (const position of positions) {
      const value = parameterMapping.get(position)!;
      // Match literal #n not followed by a digit
      const re = new RegExp(`#${position}(?!\\d)`, 'g');
      result = result.replace(re, value);
    }

    return result;
  }

  /**
   * Rozwija definicję makra podstawiając rzeczywiste parametry (stara metoda - do usunięcia)
   */
  private static expandMacroDefinitionWithParameters(definition: string, parameters: string[], optionalParam?: string): string {
    let result = definition;
    
    // Zastąp parametry #1, #2, #3, etc.
    parameters.forEach((param, index) => {
      const placeholder = `#${index + 1}`;
      result = result.replace(new RegExp(`\\${placeholder}\\b`, 'g'), param);
    });
    
    // Obsłuż opcjonalne parametry - szukaj wzorców które mogą być opcjonalne
    if (optionalParam) {
      // Jeśli definicja zawiera width=\textwidth, zastąp go opcjonalnym parametrem
      result = result.replace(/width=\\textwidth/g, `width=${optionalParam}`);
      
      // Szukaj innych wzorców które mogą być opcjonalne
      result = result.replace(/\[\\textwidth\]/g, `[${optionalParam}]`);
    }
    
    return result;
  }

  /**
   * Generuje pełną definicję LaTeX na podstawie sygnatury i parametrów
   */
  private static generateDefinitionFromSignature(signature: MacroSignatureConfig, parameters: string[], optionalParam?: string): string {
    // Fallback na stary system dla kompatybilności wstecznej
    const macroNameMatch = signature.signature.match(/\\(\w+)/);
    if (!macroNameMatch) return '';
    
    // Wykryj typ makra na podstawie typu lub heurystyki
    const type = signature.type || this.detectMacroType(signature);
    
    switch (type) {
      case 'figure':
        return this.generateFigureDefinition(parameters, optionalParam);
      case 'table':
        return this.generateTableDefinition(parameters, optionalParam);
      default:
        return this.generateGenericDefinition(signature, parameters);
    }
  }

  /**
   * Wykrywa typ makra na podstawie heurystyki (fallback)
   */
  private static detectMacroType(signature: MacroSignatureConfig): 'figure' | 'table' | 'listing' | 'generic' {
    if (this.isFigureMacro(signature)) return 'figure';
    if (this.isTableMacro(signature)) return 'table';
    if (this.isListingMacro(signature)) return 'listing';
    return 'generic';
  }

  /**
   * Sprawdza czy makro jest typu figure
   */
  private static isFigureMacro(signature: MacroSignatureConfig): boolean {
    const imageExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'eps', 'svg'];
    return signature.extensions.some(ext => imageExtensions.includes(ext.toLowerCase()));
  }

  /**
   * Sprawdza czy makro jest typu table
   */
  private static isTableMacro(signature: MacroSignatureConfig): boolean {
    return signature.signature.toLowerCase().includes('tab') || 
           signature.signature.toLowerCase().includes('table');
  }

  /**
   * Sprawdza czy makro jest typu listing
   */
  private static isListingMacro(signature: MacroSignatureConfig): boolean {
    const codeExtensions = ['txt', 'c', 'cpp', 'h', 'hpp', 'py', 'js', 'ts', 'java', 'cs', 'm', 'mm'];
    return signature.extensions.some(ext => codeExtensions.includes(ext.toLowerCase())) ||
           signature.signature.toLowerCase().includes('listing') ||
           signature.signature.toLowerCase().includes('code');
  }

  /**
   * Generuje definicję figure
   */
  private static generateFigureDefinition(parameters: string[], optionalParam?: string): string {
    const [path, caption = 'Caption', label = 'figure'] = parameters;
    
    // Użyj opcjonalnego parametru jako szerokości, domyślnie \textwidth
    const width = optionalParam || '\\textwidth';
    
    return `\\begin{figure}[!htb]
    \\begin{center}
        \\includegraphics[width=${width}]{${path}}
        \\caption{${caption}}
        \\label{rys:${label}}
    \\end{center}
\\end{figure}`;
  }

  /**
   * Generuje definicję table
   */
  private static generateTableDefinition(parameters: string[], optionalParam?: string): string {
    const [content, caption = 'Table caption', label = 'table'] = parameters;
    
    return `\\begin{table}[!htb]
    \\begin{center}
        \\caption{${caption}}
        \\label{tab:${label}}
        ${content}
    \\end{center}
\\end{table}`;
  }

  /**
   * Generuje generyczną definicję makra
   */
  private static generateGenericDefinition(signature: MacroSignatureConfig, parameters: string[]): string {
    // Prosta implementacja - można rozszerzyć
    const paramList = parameters.map((param, index) => `Parameter ${index + 1}: ${param}`).join('\n');
    return `% Generated from ${signature.signature}\n${paramList}`;
  }

  /**
   * Konwertuje pełną definicję na użycie makra z konfiguracją
   */
  static convertDefinitionToUsage(definition: string, macroName: string): MacroUsage | null {
    // Dla prostych przypadków - wyciągnij parametry z definicji
    // To jest uproszczona wersja, można rozszerzyć
    
    // Znajdź elementy które wyglądają jak parametry
    const paramMatches = definition.match(/\{[^}]*\}/g) || [];
    const parameters = paramMatches.map(match => match.slice(1, -1)); // usuń nawiasy
    
    const fullText = `\\${macroName}` + paramMatches.join('');
    
    return {
      name: macroName,
      parameters,
      optionalParam: undefined,
      fullText,
      range: new vscode.Range(0, 0, 0, fullText.length)
    };
  }

  /**
   * Automatycznie wykrywa pasującą sygnaturę makra z konfiguracji dla danej definicji
   */
  static async findMatchingSignatureForDefinition(definition: string): Promise<MacroSignatureConfig | null> {
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList: MacroSignatureConfig[] = config.get('macrosList') || [];
    
    // Znajdź wszystkie makra z projektu
    const projectMacros = await this.getAllProjectMacros();
    
    // Sprawdź każdą sygnaturę czy pasuje do definicji
    for (const signature of macrosList) {
      const macroNameMatch = signature.signature.match(/\\(\w+)/);
      if (!macroNameMatch) continue;
      
      const macroName = macroNameMatch[1];
      
      // Znajdź odpowiadające makro w projekcie
      const projectMacro = projectMacros.find(macro => macro.name === macroName);
      if (!projectMacro) continue;
      
      // Sprawdź czy definicja pasuje do znalezionego makra
      if (this.definitionsMatch(definition, projectMacro.definition)) {
        return signature;
      }
    }
    
    return null;
  }

  /**
   * Pobiera wszystkie makra z projektu
   */
  private static async getAllProjectMacros(): Promise<MacroDefinition[]> {
    try {
      const { MacroParser } = await import('./MacroParser');
      const { findClosestMainLaTeXFile } = await import('../extension');
      
      const mainFile = await findClosestMainLaTeXFile();
      if (!mainFile) return [];
      
      return await MacroParser.findAllMacrosInProject(mainFile);
    } catch (error) {
      console.error('Error getting project macros:', error);
      return [];
    }
  }

  /**
   * Sprawdza czy dwie definicje reprezentują to samo makro (z uwzględnieniem podstawień parametrów)
   */
  private static definitionsMatch(definition1: string, definition2: string): boolean {
    // Usuń parametry z obu definicji aby porównać strukturę
    const normalize = (def: string) => {
      return def
        // Usuń parametry #1, #2, etc. i zastąp PLACEHOLDER
        .replace(/#\d+/g, 'PLACEHOLDER')
        // Usuń wartości w nawiasach klamrowych (podstawione parametry) i zastąp PLACEHOLDER
        .replace(/\{[^}]*\}/g, '{PLACEHOLDER}')
        // Usuń wartości po = w atrybutach i zastąp PLACEHOLDER
        .replace(/=\s*[^,\]\}\s]+/g, '=PLACEHOLDER')
        // Usuń wartości w cudzysłowach
        .replace(/"[^"]*"/g, '"PLACEHOLDER"')
        .replace(/'[^']*'/g, "'PLACEHOLDER")
        // Usuń białe znaki i newlines
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const normalized1 = normalize(definition1);
    const normalized2 = normalize(definition2);
    
    // Sprawdź czy struktury są podobne (przynajmniej 70% zgodności)
    const similarity = this.calculateSimilarity(normalized1, normalized2);
    
    const match = similarity > 0.7;
    
    return match;
  }

  /**
   * Oblicza podobieństwo między dwoma stringami (0-1)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Oblicza odległość Levenshteina między dwoma stringami
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Sprawdza czy definicja pasuje do sygnatury makra
   */
  private static definitionMatchesSignature(definition: string, signature: MacroSignatureConfig): boolean {
    // Sprawdź typ makra jeśli jest zdefiniowany
    if (signature.type) {
      return this.definitionMatchesType(definition, signature.type);
    }
    
    // Fallback na stary system dla kompatybilności wstecznej
    const definitionIndicators = [
      /\\includegraphics/i,
      /\\begin\{figure\}/i,
      /\\begin\{table\}/i,
      /\\caption/i,
      /\\label/i
    ];
    
    // Sprawdź rozszerzenia plików
    const hasMatchingExtensions = signature.extensions.some(ext => 
      definition.includes(`.${ext}`) || 
      new RegExp(`\\\\.(${ext})\\b`, 'i').test(definition)
    );
    
    // Sprawdź czy definicja zawiera wzorce typowe dla tego typu makra
    const hasRelevantContent = definitionIndicators.some(indicator => 
      indicator.test(definition)
    );
    
    return hasMatchingExtensions || hasRelevantContent;
  }

  /**
   * Sprawdza czy definicja pasuje do określonego typu
   */
  private static definitionMatchesType(definition: string, type: string): boolean {
    switch (type) {
      case 'figure':
        return /\\begin\{figure\}|\\includegraphics/i.test(definition);
      case 'table':
        return /\\begin\{table\}|\\begin\{tabular\}/i.test(definition);
      case 'generic':
      default:
        return true; // Generic może pasować do wszystkiego
    }
  }

  /**
   * Konwertuje definicję na użycie makra na podstawie sygnatury z konfiguracji
   */
  static convertDefinitionToUsageWithSignature(definition: string, signature: MacroSignatureConfig): string | null {
    // Wyciągnij nazwę makra z sygnatury
    const macroNameMatch = signature.signature.match(/\\(\w+)/);
    if (!macroNameMatch) return null;
    
    const macroName = macroNameMatch[1];
    
    // Wyciągnij parametry z definicji na podstawie sygnatury
    const parameters = this.extractParametersFromDefinitionUsingSignature(definition, signature);
    
    // Wyciągnij opcjonalny parametr (width) z definicji
    const optionalParam = this.extractOptionalParameterFromDefinition(definition);
    
    // Zbuduj użycie makra na podstawie sygnatury
    let usage = `\\${macroName}`;
    
    // Sprawdź czy sygnatura zawiera opcjonalny parametr
    const hasOptionalInSignature = signature.signature.includes('[');
    
    // Dodaj opcjonalny parametr jeśli istnieje w sygnaturze i nie jest domyślny
    if (hasOptionalInSignature && optionalParam && optionalParam !== '\\textwidth') {
      usage += `[${optionalParam}]`;
    }
    
    // Dodaj parametry obowiązkowe w kolejności z sygnatury
    for (const param of parameters) {
      if (param && param.trim()) {
        usage += `{${param.trim()}}`;
      }
    }
    
    return usage;
  }

  /**
   * Wyciąga parametry z definicji na podstawie sygnatury konfiguracji
   */
  private static extractParametersFromDefinitionUsingSignature(definition: string, signature: MacroSignatureConfig): string[] {
    // Sprawdź tryb ekstrakcji
    if (signature.extractionMode === 'positional') {
      return this.extractParametersPositionally(definition, signature);
    }
    
    // Sprawdź czy sygnatura używa notacji #1, #2, #3 (LaTeX style)
    if (this.isLatexStyleSignature(signature.signature)) {
      return this.extractParametersPositionally(definition, signature);
    }
    
    // Tryb smart - używaj standardowych wzorców
    const parameters: string[] = [];
    
    // Wyciągnij placeholdery z sygnatury (PATH, Caption, Identifier, width, etc.)
    const placeholderPattern = /\{(\w+)\}|\[(\w+)\]/g;
    const placeholders: string[] = [];
    let match;
    
    while ((match = placeholderPattern.exec(signature.signature)) !== null) {
      // match[1] dla {placeholder}, match[2] dla [placeholder] 
      placeholders.push(match[1] || match[2]);
    }
    
    // Wyciągnij konkretne wartości z definicji dla każdego placeholdera
    for (const placeholder of placeholders) {
      let extractedValue = '';
      
      // Używaj tylko standardowych wzorców
      switch (placeholder) {
        case 'PATH':
          extractedValue = this.extractPathFromDefinition(definition) || '';
          break;
        case 'Caption':
          extractedValue = this.extractCaptionFromDefinition(definition) || '';
          break;
        case 'Identifier':
          extractedValue = this.extractLabelFromDefinition(definition) || '';
          break;
        case 'width':
          // Opcjonalny parametr - pomijamy, bo jest obsługiwany osobno
          continue;
        default:
          // Dla nieznanych placeholderów spróbuj ekstrakcję pozycyjną
          console.warn(`Unknown placeholder '${placeholder}', consider using extractionMode: 'positional' or LaTeX-style signature like {#1}{#2}{#3}`);
          break;
      }
      
      if (extractedValue) {
        parameters.push(extractedValue);
      }
    }
    
    return parameters;
  }

  /**
   * Sprawdza czy sygnatura używa notacji LaTeX (#1, #2, #3)
   */
  private static isLatexStyleSignature(signature: string): boolean {
    return /#\d+/.test(signature);
  }

  /**
   * Wyciąga parametry pozycyjnie - prostsze podejście
   */
  private static extractParametersPositionally(definition: string, signature: MacroSignatureConfig): string[] {
    // Dla notacji LaTeX ({#1}, {#2}, {#3}) lub trybu positional
    // Po prostu wyciągnij wszystkie wartości w nawiasach klamrowych i atrybutach
    
    let expectedParamCount = 0;
    
    // Sprawdź czy to notacja LaTeX
    if (this.isLatexStyleSignature(signature.signature)) {
      // Policz parametry #1, #2, #3...
      const paramMatches = signature.signature.match(/#\d+/g);
      expectedParamCount = paramMatches ? paramMatches.length : 0;
    } else {
      // Policz placeholdery {placeholder}
      const placeholderPattern = /\{(\w+)\}/g;
      expectedParamCount = (signature.signature.match(placeholderPattern) || []).length;
    }
    
    if (expectedParamCount === 0) return [];
    
    // Znajdź wszystkie możliwe wartości parametrów w definicji
    const allMatches: string[] = [];
    
    // Wzorce do wyciągania parametrów (w kolejności priorytetów)
    const patterns = [
      // 1. Parametry w atrybutach: name=value (najczęściej to są nasze parametry)
      /(\w+)\s*=\s*([^,\]\}\s]+)/g,
      // 2. Parametry w atrybutach z cudzysłowami: name="value" 
      /(\w+)\s*=\s*"([^"]+)"/g,
      // 3. Parametry w nawiasach klamrowych: {content}
      /\{([^}]*)\}/g,
    ];
    
    // Wyciągnij parametry z atrybutów (title=value, id=value)
    const attrPattern = /(\w+)\s*=\s*([^,\]\}\s"']+|"[^"]*"|'[^']*')/g;
    let attrMatch;
    while ((attrMatch = attrPattern.exec(definition)) !== null) {
      let value = attrMatch[2].trim();
      // Usuń cudzysłowy jeśli są
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (value && !allMatches.includes(value)) {
        allMatches.push(value);
      }
    }
    
    // Dodaj parametry z nawiasów klamrowych
    const bracePattern = /\{([^}]*)\}/g;
    let braceMatch;
    while ((braceMatch = bracePattern.exec(definition)) !== null) {
      const value = braceMatch[1].trim();
      if (value && !allMatches.includes(value)) {
        allMatches.push(value);
      }
    }
    
    // Jeśli mamy za mało parametrów, dodaj puste
    while (allMatches.length < expectedParamCount) {
      allMatches.push('');
    }
    
    // Weź pierwsze N parametrów gdzie N = expectedParamCount
    return allMatches.slice(0, expectedParamCount);
  }

  /**
   * Wyciąga caption z definicji
   */
  private static extractCaptionFromDefinition(definition: string): string | null {
    // Standardowy \caption{...}
    const captionMatch = definition.match(/\\caption\s*\{([^}]*)\}/);
    if (captionMatch) {
      return captionMatch[1];
    }
    
    // Format lstinputlisting: caption=value (bez cudzysłowów)
    const lstCaptionMatch = definition.match(/caption\s*=\s*([^,\]]+)/);
    if (lstCaptionMatch) {
      return lstCaptionMatch[1].trim();
    }
    
    // Format z cudzysłowami: caption="value"
    const quotedCaptionMatch = definition.match(/caption\s*=\s*"([^"]+)"/);
    if (quotedCaptionMatch) {
      return quotedCaptionMatch[1];
    }
    
    return null;
  }

  /**
   * Wyciąga label/identifier z definicji
   */
  private static extractLabelFromDefinition(definition: string): string | null {
    // Standardowy \label{prefix:value} - wyciągnij tylko value
    const labelMatch = definition.match(/\\label\s*\{[^:]*:([^}]*)\}/);
    if (labelMatch) {
      return labelMatch[1];
    }
    
    // Format lstinputlisting: label={prefix:value}
    const lstLabelMatch = definition.match(/label\s*=\s*\{[^:]*:([^}]*)\}/);
    if (lstLabelMatch) {
      return lstLabelMatch[1];
    }
    
    // Fallback - spróbuj wyciągnąć całą część po ":"
    const fullLabelMatch = definition.match(/\\label\s*\{([^}]*)\}/);
    if (fullLabelMatch && fullLabelMatch[1].includes(':')) {
      return fullLabelMatch[1].split(':')[1];
    }
    
    // Fallback dla lstinputlisting - label={value}
    const lstFullLabelMatch = definition.match(/label\s*=\s*\{([^}]*)\}/);
    if (lstFullLabelMatch && lstFullLabelMatch[1].includes(':')) {
      return lstFullLabelMatch[1].split(':')[1];
    }
    
    return fullLabelMatch ? fullLabelMatch[1] : (lstFullLabelMatch ? lstFullLabelMatch[1] : null);
  }

  /**
   * Próbuje wyciągnąć parametr o podanej nazwie z definicji
   */
  private static extractGenericParameterFromDefinition(definition: string, parameterName: string): string | null {
    // Można tutaj dodać więcej heurystyk dla różnych typów parametrów
    return null;
  }

  /**
   * Wyciąga parametry z rozwiniętej definicji porównując z oryginalną definicją makra (stara metoda)
   */
  private static extractParametersFromExpandedDefinition(expandedDefinition: string, originalDefinition: string): string[] {
    const parameters: string[] = [];
    
    // Znajdź wszystkie miejsca gdzie w oryginalnej definicji są parametry #1, #2, etc.
    const paramMatches = [...originalDefinition.matchAll(/#(\d+)/g)];
    
    for (const match of paramMatches) {
      const paramNumber = parseInt(match[1]);
      const paramPlaceholder = match[0];
      
      // Znajdź kontekst wokół parametru w oryginalnej definicji
      const beforeParam = originalDefinition.substring(0, match.index!);
      const afterParam = originalDefinition.substring(match.index! + paramPlaceholder.length);
      
      // Znajdź ten sam kontekst w rozwiniętej definicji
      const beforePattern = this.escapeRegex(beforeParam.slice(-20)); // Ostatnie 20 znaków jako kontekst
      const afterPattern = this.escapeRegex(afterParam.slice(0, 20)); // Pierwsze 20 znaków jako kontekst
      
      const contextPattern = new RegExp(`${beforePattern}(.*?)${afterPattern}`);
      const contextMatch = expandedDefinition.match(contextPattern);
      
      if (contextMatch && contextMatch[1]) {
        parameters[paramNumber - 1] = contextMatch[1].trim();
      }
    }
    
    // Usuń puste elementy i zwróć tylko wypełnione parametry
    return parameters.filter(param => param && param.length > 0);
  }

  /**
   * Escapes special regex characters
   */
  private static escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Wyciąga opcjonalny parametr (np. width) z definicji
   */
  private static extractOptionalParameterFromDefinition(definition: string): string | null {
    // Szukaj width w includegraphics
    const widthMatch = definition.match(/\\includegraphics\[width=([^\]]*)\]/);
    if (widthMatch) {
      return widthMatch[1];
    }
    
    return null;
  }

  /**
   * Wyciąga parametry z definicji na podstawie sygnatury
   */
  private static extractParametersFromDefinition(definition: string, signature: MacroSignatureConfig): string[] {
    const parameters: string[] = [];
    
    // Znajdź ścieżkę do pliku (PATH)
    if (signature.signature.includes('PATH')) {
      const pathMatch = this.extractPathFromDefinition(definition);
      if (pathMatch) {
        parameters.push(pathMatch);
      }
    }
    
    // Znajdź caption
    const captionMatch = definition.match(/\\caption\s*\{([^}]*)\}/);
    if (captionMatch) {
      parameters.push(captionMatch[1]);
    }
    
    // Znajdź label
    const labelMatch = definition.match(/\\label\s*\{(?:rys:|fig:|tab:)?([^}]*)\}/);
    if (labelMatch) {
      parameters.push(labelMatch[1]);
    }
    
    // Znajdź inne parametry na podstawie liczby argumentów w sygnaturze
    const argCount = (signature.signature.match(/\{[^}]*\}/g) || []).length;
    while (parameters.length < argCount) {
      parameters.push(`arg${parameters.length + 1}`);
    }
    
    return parameters;
  }

  /**
   * Wyciąga ścieżkę do pliku z definicji
   */
  private static extractPathFromDefinition(definition: string): string | null {
    // Szukaj ścieżek w includegraphics
    const includegraphicsMatch = definition.match(/\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]*)\}/);
    if (includegraphicsMatch) {
      return includegraphicsMatch[1];
    }
    
    // Szukaj ścieżek w lstinputlisting
    const lstinputlistingMatch = definition.match(/\\lstinputlisting(?:\[[^\]]*\])?\s*\{([^}]*)\}/);
    if (lstinputlistingMatch) {
      return lstinputlistingMatch[1];
    }
    
    // Szukaj innych wzorców ścieżek
    const pathPatterns = [
      /\{([^}]*\.(png|jpg|jpeg|pdf|eps|svg|txt|c|cpp|m|py))\}/i,
      /\{([^}]*\/[^}]*)\}/  // ścieżka z slash
    ];
    
    for (const pattern of pathPatterns) {
      const match = definition.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Znajduje definicję makra w projekcie
   */
  static async findMacroDefinition(macroName: string): Promise<MacroDefinition | null> {
    const macroIndex = MacroIndex.getInstance();
    if (macroIndex.isAvailable()) {
      const match = await macroIndex.getMacroDefinition(macroName);
      if (match) {
        return match;
      }
    }

    try {
      const { MacroParser } = await import('./MacroParser');
      const { findClosestMainLaTeXFile } = await import('../extension');
      
      const mainFile = await findClosestMainLaTeXFile();
      if (!mainFile) return null;
      
      const allMacros = await MacroParser.findAllMacrosInProject(mainFile);
      return allMacros.find(macro => macro.name === macroName) || null;
    } catch (error) {
      console.error('Error finding macro definition (fallback):', error);
      return null;
    }
  }

  /**
   * Konwertuje użycie makra z sygnaturą na podstawie konfiguracji
   */
  static convertUsageWithSignature(usage: MacroUsage): string {
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList: MacroSignatureConfig[] = config.get('macrosList') || [];
    
    // Znajdź pasującą sygnaturę
    const matchingSignature = macrosList.find(signature => 
      signature.signature.startsWith(`\\${usage.name}`)
    );
    
    if (!matchingSignature) {
      return usage.fullText; // Zwróć oryginalny tekst jeśli nie ma konfiguracji
    }
    
    let result = matchingSignature.signature;
    
    // Zastąp PATH i inne placeholdery wartościami z użycia
    for (let i = 0; i < usage.parameters.length; i++) {
      const param = usage.parameters[i];
      
      // Zastąp PATH pierwszym parametrem który wygląda na ścieżkę
      if (result.includes('PATH') && this.looksLikePath(param)) {
        result = result.replace('PATH', param);
      } else {
        // Zastąp arg1, arg2, etc.
        result = result.replace(`arg${i + 1}`, param);
      }
    }
    
    return result;
  }

  /**
   * Sprawdza czy parametr wygląda na ścieżkę do pliku
   */
  private static looksLikePath(param: string): boolean {
    return param.includes('/') || 
           param.includes('\\') || 
           /\.(png|jpg|jpeg|pdf|eps|svg|tex)$/i.test(param);
  }

  /**
   * Generuje użycie makra z sygnaturą konfiguracji
   */
  static generateUsageFromSignature(signature: string, values: string[]): string {
    let result = signature;
    let valueIndex = 0;
    
    // Zastąp PATH pierwszą wartością która wygląda na ścieżkę
    const pathValue = values.find(v => this.looksLikePath(v));
    if (pathValue && result.includes('PATH')) {
      result = result.replace('PATH', pathValue);
      valueIndex = values.indexOf(pathValue) + 1;
    }
    
    // Zastąp pozostałe argumenty
    for (let i = valueIndex; i < values.length; i++) {
      result = result.replace(`arg${i + 1}`, values[i]);
    }
    
    return result;
  }

  /**
   * Wyciąga wartości z użycia makra zgodnie z sygnaturą
   */
  static extractValuesFromUsage(usage: MacroUsage, signature: string): string[] {
    // Uproszczona implementacja - można rozszerzyć
    return usage.parameters;
  }
}
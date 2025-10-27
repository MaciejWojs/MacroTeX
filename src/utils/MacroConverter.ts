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
    const macrosList = vscode.workspace.getConfiguration('latexMacros').get<MacroSignatureConfig[]>('macrosList', []);
    
    // Znajdź pasującą sygnaturę w konfiguracji - uproszczone
    const matchingSignature = macrosList.find(sig => 
      sig.signature.match(/\\(\w+)/)?.[1] === usage.name
    );
    
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
  private static mapParametersFromLatexSignature(_signature: string, parameters: string[], optionalParam: string | undefined, macroDefinition: MacroDefinition): Map<number, string> {
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
    // Replace in descending order to avoid partial collisions (#1 vs #10)
    return Array.from(parameterMapping.keys())
      .sort((a, b) => b - a)
      .reduce((result, position) => {
        const value = parameterMapping.get(position)!;
        return result.replace(new RegExp(`#${position}(?!\\d)`, 'g'), value);
      }, definition);
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
    const macrosList = vscode.workspace.getConfiguration('latexMacros').get<MacroSignatureConfig[]>('macrosList', []);
    const projectMacros = await this.getAllProjectMacros();
    
    // Wykorzystaj Array.find z uproszczoną logiką
    return macrosList.find(signature => {
      const macroName = signature.signature.match(/\\(\w+)/)?.[1];
      if (!macroName) return false;
      
      const projectMacro = projectMacros.find(macro => macro.name === macroName);
      return projectMacro && this.definitionsMatch(definition, projectMacro.definition);
    }) ?? null;
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
    const normalize = (def: string) => def
      .replace(/#\d+/g, 'PLACEHOLDER')                      // Parametry #1, #2
      .replace(/\{[^}]*\}/g, '{PLACEHOLDER}')               // Wartości w {}
      .replace(/=\s*[^,\]\}\s]+/g, '=PLACEHOLDER')          // Wartości po =
      .replace(/"[^"]*"/g, '"PLACEHOLDER"')                 // Wartości w ""
      .replace(/'[^']*'/g, "'PLACEHOLDER")                  // Wartości w ''
      .replace(/\s+/g, ' ')                                 // Białe znaki
      .trim();
    
    const similarity = this.calculateSimilarity(normalize(definition1), normalize(definition2));
    return similarity > 0.7;
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
   * Konwertuje definicję na użycie makra na podstawie sygnatury z konfiguracji
   */
  static convertDefinitionToUsageWithSignature(definition: string, signature: MacroSignatureConfig): string | null {
    // Wyciągnij nazwę makra z sygnatury
    const macroNameMatch = signature.signature.match(/\\(\w+)/);
    if (!macroNameMatch) return null;
    
    const macroName = macroNameMatch[1];
    
    // Wyciągnij parametry z definicji na podstawie sygnatury
    const parameters = this.extractParametersFromDefinitionUsingSignature(definition, signature);
    
    // Wyciągnij opcjonalny parametr z definicji
    const optionalParam = this.extractOptionalParameterFromDefinition(definition);
    
    // Zbuduj użycie makra na podstawie sygnatury
    let usage = `\\${macroName}`;
    
    // Dodaj opcjonalny parametr jeśli został znaleziony w definicji
    if (optionalParam) {
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
    // Oblicz oczekiwaną liczbę parametrów
    const expectedParamCount = this.isLatexStyleSignature(signature.signature)
      ? (signature.signature.match(/#\d+/g)?.length ?? 0)
      : (signature.signature.match(/\{(\w+)\}/g)?.length ?? 0);
    
    if (expectedParamCount === 0) return [];
    
    // Wyciągnij wszystkie unikalne wartości parametrów
    const allMatches = this.extractAllParameterValues(definition);
    
    // Uzupełnij brakujące parametry pustymi stringami
    while (allMatches.length < expectedParamCount) {
      allMatches.push('');
    }
    
    return allMatches.slice(0, expectedParamCount);
  }

  /**
   * Wyciąga wszystkie wartości parametrów z definicji
   */
  private static extractAllParameterValues(definition: string): string[] {
    const allMatches: string[] = [];
    
    // NAJPIERW wyciągnij wartości z atrybutów (title=value, id=value)
    // Ale TYLKO te które NIE zawierają # (nie są szablonami)
    const attrPattern = /(\w+)\s*=\s*([^,\]\}\s"'#]+|"[^"#]*"|'[^'#]*')/g;
    let attrMatch;
    
    while ((attrMatch = attrPattern.exec(definition)) !== null) {
      const value = attrMatch[2].trim().replace(/^["']|["']$/g, '');
      // Dodaj tylko jeśli nie zawiera # i nie jest już w tablicy
      if (value && !value.includes('#') && !allMatches.includes(value)) {
        allMatches.push(value);
      }
    }
    
    // POTEM dodaj parametry z nawiasów klamrowych
    const bracePattern = /\{([^}]*)\}/g;
    let braceMatch;
    
    while ((braceMatch = bracePattern.exec(definition)) !== null) {
      const value = braceMatch[1].trim();
      // Pomiń wartości zawierające # (to szablony) i już dodane
      if (value && !value.includes('#') && !allMatches.includes(value)) {
        allMatches.push(value);
      }
    }
    
    return allMatches;
  }

  /**
   * Wyciąga caption z definicji
   */
  private static extractCaptionFromDefinition(definition: string): string | null {
    const patterns = [
      /\\caption\s*\{([^}]*)\}/,           // \caption{...}
      /caption\s*=\s*"([^"]+)"/,            // caption="..."
      /caption\s*=\s*'([^']+)'/,            // caption='...'
      /caption\s*=\s*([^,\]]+)/             // caption=value (bez cudzysłowów)
    ];
    
    for (const pattern of patterns) {
      const match = definition.match(pattern);
      if (match) return match[1].trim();
    }
    
    return null;
  }

  /**
   * Wyciąga label/identifier z definicji
   */
  private static extractLabelFromDefinition(definition: string): string | null {
    const patterns = [
      /\\label\s*\{([^}]*)\}/,              // \label{...}
      /label\s*=\s*\{([^}]*)\}/             // label={...}
    ];
    
    for (const pattern of patterns) {
      const match = definition.match(pattern);
      if (!match) continue;
      
      const label = match[1];
      // Wyciągnij część po ":" jeśli istnieje (np. rys:identifier → identifier)
      return label.includes(':') ? label.split(':')[1] : label;
    }
    
    return null;
  }

  /**
   * Wyciąga opcjonalny parametr (np. width) z definicji
   */
  private static extractOptionalParameterFromDefinition(definition: string): string | null {
    const includegraphicsMatch = definition.match(/\\includegraphics\[([^\]]+)\]/);
    if (!includegraphicsMatch) return null;

    const options = includegraphicsMatch[1];
    
    // NIE wyciągaj jeśli zawiera # (to szablon, nie wartość)
    if (options.includes('#')) return null;
    
    // Wyciągnij wartość width= lub scale=
    const keyValueMatch = options.match(/(?:width|scale)=([^,\]]+)/);
    if (keyValueMatch) return keyValueMatch[1];
    
    // Pojedyncza wartość bez klucza (np. \includegraphics[0.8]{...})
    if (!options.includes('=')) return options.trim();
    
    // W przeciwnym razie zwróć wszystkie opcje
    return options;
  }

  /**
   * Wyciąga ścieżkę do pliku z definicji
   */
  private static extractPathFromDefinition(definition: string): string | null {
    // Wzorce dla komend LaTeX z plikami
    const commandPatterns = [
      /\\includegraphics(?:\[[^\]]*\])?\s*\{([^}]*)\}/,
      /\\lstinputlisting(?:\[[^\]]*\])?\s*\{([^}]*)\}/
    ];
    
    for (const pattern of commandPatterns) {
      const match = definition.match(pattern);
      if (match) return match[1];
    }
    
    // Wzorce dla ścieżek plików
    const pathPatterns = [
      /\{([^}]*\.(png|jpg|jpeg|pdf|eps|svg|txt|c|cpp|m|py))\}/i,  // rozszerzenia plików
      /\{([^}]*\/[^}]*)\}/                                           // ścieżka z /
    ];
    
    for (const pattern of pathPatterns) {
      const match = definition.match(pattern);
      if (match) return match[1];
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
  static extractValuesFromUsage(usage: MacroUsage, _signature: string): string[] {
    // Uproszczona implementacja - można rozszerzyć
    return usage.parameters;
  }
}
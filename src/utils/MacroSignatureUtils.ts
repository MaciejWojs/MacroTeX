import * as vscode from 'vscode';
import type { MacroDefinition } from './MacroParser';

export interface MacroSignature {
  signature: string;
  extensions: string[];
}

export class MacroSignatureUtils {
  /**
   * Sprawdza czy makro można przekształcić na sygnaturę zgodną z konfiguracją
   */
  static canConvertToSignature(macro: MacroDefinition): boolean {
    // Sprawdź czy makro zawiera odwołania do plików (PATH-like patterns)
    const pathPatterns = [
      /\\includegraphics/,
      /\\input/,
      /\\include/,
      /PATH/i,
      /\{[^}]*\.(png|jpg|jpeg|pdf|eps|svg)[^}]*\}/i,
      /\{[^}]*\/[^}]*\}/  // zawiera ścieżkę z slash
    ];
    
    return pathPatterns.some(pattern => pattern.test(macro.definition));
  }

  /**
   * Konwertuje makro na sygnaturę zgodną z konfiguracją
   */
  static convertToSignature(macro: MacroDefinition): MacroSignature | null {
    if (!this.canConvertToSignature(macro)) {
      return null;
    }

    // Wykryj rozszerzenia plików w definicji
    const extensionMatches = macro.definition.match(/\.(png|jpg|jpeg|pdf|eps|svg)\b/gi);
    const extensions = extensionMatches 
      ? [...new Set(extensionMatches.map(ext => ext.substring(1).toLowerCase()))]
      : ['png', 'jpg', 'jpeg'];

    // Generuj sygnaturę
    let signature = `\\${macro.name}`;
    
    // Dodaj parametry
    for (let i = 1; i <= macro.parameters; i++) {
      if (i === 1 || this.isPathParameter(macro.definition, i)) {
        signature += '{PATH}';
      } else {
        signature += `{arg${i}}`;
      }
    }

    return {
      signature,
      extensions
    };
  }

  /**
   * Sprawdza czy dany parametr prawdopodobnie zawiera ścieżkę do pliku
   */
  private static isPathParameter(definition: string, paramIndex: number): boolean {
    const pathIndicators = [
      /includegraphics/,
      /input/,
      /include/,
      /\.(png|jpg|jpeg|pdf|eps|svg)/i
    ];
    
    // Prosty heurystyk - pierwszy parametr często to ścieżka
    if (paramIndex === 1) {
      return pathIndicators.some(pattern => pattern.test(definition));
    }
    
    return false;
  }

  /**
   * Zapisuje makro do konfiguracji użytkownika
   */
  static async saveMacroToConfiguration(macroSignature: MacroSignature): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('latexMacros');
      const currentMacros: MacroSignature[] = config.get('macrosList') || [];
      
      // Sprawdź czy makro już istnieje
      const existingIndex = currentMacros.findIndex(m => m.signature === macroSignature.signature);
      
      if (existingIndex >= 0) {
        // Aktualizuj istniejące makro
        currentMacros[existingIndex] = macroSignature;
      } else {
        // Dodaj nowe makro
        currentMacros.push(macroSignature);
      }
      
      await config.update('macrosList', currentMacros, vscode.ConfigurationTarget.Global);
      return true;
    } catch (error) {
      console.error('Error saving macro to configuration:', error);
      return false;
    }
  }

  /**
   * Otwiera edytor konfiguracji dla danego makra
   */
  static async editMacroConfiguration(macroSignature: MacroSignature): Promise<void> {
    const signatureInput = await vscode.window.showInputBox({
      prompt: 'Edit macro signature',
      value: macroSignature.signature,
      placeHolder: '\\macroname{PATH}{arg2}',
      validateInput: (value) => {
        if (!value || !value.startsWith('\\')) {
          return 'Signature must start with backslash';
        }
        if (!value.includes('{')) {
          return 'Signature must contain at least one parameter';
        }
        return null;
      }
    });

    if (!signatureInput) return;

    const extensionsInput = await vscode.window.showInputBox({
      prompt: 'Edit file extensions (comma-separated)',
      value: macroSignature.extensions.join(', '),
      placeHolder: 'png, jpg',
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'At least one extension is required';
        }
        return null;
      }
    });

    if (!extensionsInput) return;

    const updatedMacro: MacroSignature = {
      signature: signatureInput,
      extensions: extensionsInput.split(',').map(ext => ext.trim().toLowerCase())
    };

    const saved = await this.saveMacroToConfiguration(updatedMacro);
    if (saved) {
      vscode.window.showInformationMessage(
        `Macro ${updatedMacro.signature} saved to configuration!`,
        'Open Settings'
      ).then(action => {
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'latexMacros.macrosList');
        }
      });
    } else {
      vscode.window.showErrorMessage('Failed to save macro to configuration');
    }
  }

  /**
   * Generuje przykład użycia makra
   */
  static generateUsageExample(macro: MacroDefinition, signature: string): string {
    const pathExample = 'images/figure1.png';
    let example = signature.replace('PATH', pathExample);
    
    // Zastąp inne parametry przykładowymi wartościami
    example = example.replace(/\{arg2\}/g, '{Caption text}');
    example = example.replace(/\{arg3\}/g, '{figure-label}');
    example = example.replace(/\{arg(\d+)\}/g, '{arg$1}');
    
    return example;
  }
}
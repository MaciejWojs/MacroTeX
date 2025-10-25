import type { MacroDefinition } from './MacroParser';

export interface MacroGroup {
  type: string;
  displayName: string;
  macros: MacroDefinition[];
  icon: string;
  description: string;
}

export class MacroGrouper {
  static groupMacrosByType(macros: MacroDefinition[]): MacroGroup[] {
    const groups = new Map<string, MacroDefinition[]>();
    
    // Grupuj makra według typu
    macros.forEach(macro => {
      if (!groups.has(macro.type)) {
        groups.set(macro.type, []);
      }
      groups.get(macro.type)!.push(macro);
    });

    // Sortuj makra w każdej grupie alfabetycznie
    groups.forEach(macroList => {
      macroList.sort((a, b) => a.name.localeCompare(b.name));
    });

    // Konwertuj na strukturę grup z metadanymi
    const groupConfigs = [
      {
        type: 'newcommand',
        displayName: 'New Commands',
        icon: '✨',
        description: 'Newly defined commands'
      },
      {
        type: 'newcommand*',
        displayName: 'New Commands (Short)',
        icon: '⭐',
        description: 'Short form commands (no paragraph breaks)'
      },
      {
        type: 'renewcommand',
        displayName: 'Renewed Commands',
        icon: '🔄',
        description: 'Redefined existing commands'
      },
      {
        type: 'renewcommand*',
        displayName: 'Renewed Commands (Short)',
        icon: '♻️',
        description: 'Short form redefined commands'
      },
      {
        type: 'def',
        displayName: 'TeX Definitions',
        icon: '⚙️',
        description: 'Low-level TeX definitions'
      }
    ];

    return groupConfigs
      .filter(config => groups.has(config.type))
      .map(config => ({
        ...config,
        macros: groups.get(config.type)!
      }));
  }

  static getMacroUsageExample(macro: MacroDefinition): string {
    const params = Array.from({ length: macro.parameters }, (_, i) => `{arg${i + 1}}`).join('');
    return `\\${macro.name}${params}`;
  }

  static formatMacroDefinition(definition: string, maxLength: number = 150): string {
    if (definition.length <= maxLength) {
      return definition;
    }
    return definition.substring(0, maxLength) + '...';
  }
}
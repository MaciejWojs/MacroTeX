import * as vscode from 'vscode';
import { MacroIndex } from '../utils/MacroIndex';

function findLastRegexMatch(text: string, re: RegExp): RegExpExecArray | null {
  let match: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  // Ensure global
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const gre = new RegExp(re.source, flags);
  while ((m = gre.exec(text)) !== null) {
    match = m;
  }
  return match;
}

export class MacroSignatureHelpProvider implements vscode.SignatureHelpProvider {
  public constructor() { }

  public async provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.SignatureHelp | null> {
    const fullText = document.getText();
    const offset = document.offsetAt(position);
    const lookStart = Math.max(0, offset - 4000);
    const substr = fullText.substring(lookStart, offset);

    // Find last macro name before cursor like \name
    const macroNameMatch = findLastRegexMatch(substr, /\\([A-Za-z@]+)/g);
    if (!macroNameMatch) return null;

    const macroName = macroNameMatch[1];
    const macroStartOffset = lookStart + (macroNameMatch.index ?? 0);

    // Gather signature string from configuration first
    const config = vscode.workspace.getConfiguration('latexMacros');
    const macrosList = config.get<{ signature: string; extensions?: string[] }[]>('macrosList', []);

    let signatureString: string | null = null;

    if (macrosList && macrosList.length > 0) {
      const found = macrosList.find(sig => {
        const m = sig.signature.match(/\\(\w+)/);
        return m && m[1] === macroName;
      });
      if (found) signatureString = found.signature;
    }

    // If not in config, try MacroIndex (project macros) asynchronously
    if (!signatureString) {
      try {
        const macroIndex = MacroIndex.getInstance();
        if (macroIndex.isAvailable()) {
          const def = await macroIndex.getMacroDefinition(macroName);
          if (def) {
            // Build a readable signature string from MacroDefinition
            // If macro has an optional first argument (defaultValue), include it in []
            let built = `\\${def.name}`;
            if (def.defaultValue) built += `[${def.defaultValue}]`;
            // Append mandatory parameters as {#1}{#2}... depending on def.parameters
            for (let i = 1; i <= def.parameters; i++) {
              built += `{#${i}}`;
            }
            signatureString = built;
          }
        }
      } catch (e) {
        // ignore errors from MacroIndex
      }
    }

    if (!signatureString) return null;

    // Parse placeholders from signatureString
    const placeholderPattern = /\{([^}]*)\}|\[([^\]]*)\]/g;
    const placeholders: { name: string; optional: boolean }[] = [];
    let phMatch;
    while ((phMatch = placeholderPattern.exec(signatureString)) !== null) {
      const name = phMatch[1] || phMatch[2] || '';
      const optional = !!phMatch[2];
      placeholders.push({ name, optional });
    }

    // Determine active parameter index by scanning text from macro start to cursor
    const absoluteMacroTextStart = macroStartOffset; // points to backslash
    const afterNameIndex = absoluteMacroTextStart + macroNameMatch[0].length;

    function findMatching(startIdx: number, openCh: string, closeCh: string): number {
      let depth = 0;
      for (let i = startIdx; i < fullText.length; i++) {
        const ch = fullText[i];
        if (ch === openCh) depth++;
        else if (ch === closeCh) {
          depth--;
          if (depth === 0) return i;
        }
      }
      return -1;
    }

    let paramIndex = 0;
    let searchPos = afterNameIndex;
    let placeholderIdx = 0;

    // Iterate placeholders and check where cursor lies
    while (placeholderIdx < placeholders.length && searchPos < offset) {
      const ph = placeholders[placeholderIdx];
      if (ph.optional) {
        // find next '[' starting at or after searchPos
        const openIdx = fullText.indexOf('[', searchPos);
        if (openIdx === -1 || openIdx >= offset) {
          // if cursor before optional open, active param is this optional
          if (offset <= openIdx || openIdx === -1) {
            paramIndex = placeholderIdx;
            break;
          }
        }
        const closeIdx = findMatching(openIdx, '[', ']');
        if (openIdx <= offset && offset <= (closeIdx === -1 ? openIdx + 1 : closeIdx)) {
          paramIndex = placeholderIdx;
          break;
        }
        // continue after close
        searchPos = (closeIdx === -1) ? openIdx + 1 : closeIdx + 1;
      } else {
        const openIdx = fullText.indexOf('{', searchPos);
        if (openIdx === -1) {
          // no more braces; active param is this one
          paramIndex = placeholderIdx;
          break;
        }
        const closeIdx = findMatching(openIdx, '{', '}');
        if (openIdx <= offset && offset <= (closeIdx === -1 ? openIdx + 1 : closeIdx)) {
          paramIndex = placeholderIdx;
          break;
        }
        searchPos = (closeIdx === -1) ? openIdx + 1 : closeIdx + 1;
      }
      placeholderIdx++;
      paramIndex = placeholderIdx;
    }

    if (paramIndex >= placeholders.length) paramIndex = placeholders.length - 1;
    if (paramIndex < 0) paramIndex = 0;

    const sig = new vscode.SignatureInformation(signatureString);
    sig.parameters = placeholders.map((p, i) => new vscode.ParameterInformation(p.name || `arg${i + 1}`));

    const help = new vscode.SignatureHelp();
    help.signatures = [sig];
    help.activeSignature = 0;
    help.activeParameter = paramIndex;

    return help;
  }
}

export default MacroSignatureHelpProvider;

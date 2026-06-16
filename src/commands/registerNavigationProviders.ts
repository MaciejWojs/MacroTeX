import * as vscode from "vscode";
import {
  MacroDefinitionProvider,
  MacroImplementationProvider,
  MacroReferenceCodeLensProvider,
  MacroReferenceProvider,
} from "../providers/MacroNavigationProviders";
import { MacroIndex } from "../utils/MacroIndex";

export function registerNavigationProviders(
  context: vscode.ExtensionContext,
  macroIndex: MacroIndex
): void {
  const definitionProviderDisposable = vscode.languages.registerDefinitionProvider(
    { language: "latex" },
    new MacroDefinitionProvider(macroIndex)
  );
  const implementationProviderDisposable = vscode.languages.registerImplementationProvider(
    { language: "latex" },
    new MacroImplementationProvider(macroIndex)
  );
  const referenceProviderDisposable = vscode.languages.registerReferenceProvider(
    { language: "latex" },
    new MacroReferenceProvider(macroIndex)
  );
  const codeLensProviderDisposable = vscode.languages.registerCodeLensProvider(
    { language: "latex" },
    new MacroReferenceCodeLensProvider(macroIndex)
  );

  context.subscriptions.push(
    definitionProviderDisposable,
    implementationProviderDisposable,
    referenceProviderDisposable,
    codeLensProviderDisposable
  );
}
